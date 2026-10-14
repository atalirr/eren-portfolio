import os
import time
import json
import asyncio
from datetime import datetime
import numpy as np
from rich.console import Console

import state_manager
import trade_executor
from scoring_engine import TechnicalScoringEngine
from telegram_module import notifier

console = Console()

# ── STRATEJIK COOLDOWN VE PARAMETRELER ────────────────────────────────────────
COMMISSION = 0.001
last_sell_times: dict = {}
loss_cooldown_symbols: dict = {}
_fleet_lock: asyncio.Lock = asyncio.Lock()
last_drawdown_warn_date = ""

# Agresif Mod Parametreleri
# NOT: Pozisyon büyüklüğü artık trade_executor.calculate_position_size() ile
# TL bazlı dinamik olarak hesaplanır (MIN 500 TL / MAX 10.000 TL).
AGG_RISK_PER_TRADE    = 0.005
AGG_MAX_POSITIONS     = 12
AGG_HARD_STOP_PCT     = 0.03       # v3.0: 1.5% -> 3% (çok dar stop yeme sorununu azaltır)
AGG_COOLDOWN_SECONDS  = 30 * 60
AGG_MIN_VOLUME_USDT   = 2_000_000
AGG_SCAN_LIMIT        = 200
AGG_TAKE_PROFIT       = 2.5
AGG_TRAILING_STOP     = 1.0
AGG_MAX_HOLD_SECS     = 8 * 3600
AGG_PARTIAL_TP_TRIGGER= 1.5
AGG_EXIT_SCORE        = 40
AGG_CORR_MAX_GROUP    = 5

# Swing Mod Parametreleri
MAX_OPEN_POSITIONS   = 5            # v3.0: 8 -> 5 (daha az ama daha büyük pozisyonlar)
RISK_PER_TRADE_PCT   = 0.015        # v3.0: 1.0% -> 1.5% (5 pozisyona uygun risk artışı)
HARD_STOP_PCT        = 0.05         # v3.1: 6% -> 5% (ML filtresi aktif, daha sıkı stop güvenli)
COOLDOWN_SECONDS     = 4 * 3600      # v2.5: 8h -> 4h (daha fazla fırsat)
DEFAULT_EXIT_SCORE   = 40
DEFAULT_TRAILING_STOP= 2.5
DEFAULT_TAKE_PROFIT  = 6.0


# ── KORELASYON FİLTRESİ ───────────────────────────────────────────────────────
CORR_GROUPS = {
    "L1":    ["BTC/USDT","ETH/USDT","BNB/USDT","SOL/USDT","AVAX/USDT","ADA/USDT","DOT/USDT"],
    "DeFi":  ["UNI/USDT","AAVE/USDT","CAKE/USDT","CRV/USDT","COMP/USDT"],
    "Meme":  ["DOGE/USDT","SHIB/USDT","PEPE/USDT","FLOKI/USDT","BONK/USDT"],
    "Layer2":["MATIC/USDT","ARB/USDT","OP/USDT","IMX/USDT"],
}
MAX_PER_GROUP = 3

# High liquidity DOWN tokens for BEAR mode
DOWN_TOKENS = [
    "BTCDOWN/USDT", "ETHDOWN/USDT", "BNBDOWN/USDT", "XRPDOWN/USDT", 
    "ADADOWN/USDT", "LINKDOWN/USDT", "DOTDOWN/USDT", "LTCDOWN/USDT", 
    "BCHDOWN/USDT", "UNIDOWN/USDT"
]

def check_correlation_limit(symbol: str) -> bool:
    fleet = state_manager.bot_settings["fleet_state"]
    for group_name, coins in CORR_GROUPS.items():
        if symbol in coins:
            if sum(1 for c in coins if c in fleet) >= MAX_PER_GROUP:
                return False
    return True

def is_blacklisted(symbol: str) -> bool:
    base = symbol.replace("/USDT", "").replace("USDT", "")
    
    # 1. Leveraged tokens (ends with UP/DOWN or contains BULL/BEAR)
    if base.endswith("UP") or base.endswith("DOWN") or "BULL" in base or "BEAR" in base:
        return True
        
    # 2. Stablecoins and fiat (exact matches)
    stables_and_fiats = {
        "BUSD", "USDC", "USDT", "TUSD", "FDUSD", "DAI", "EUR", "TRY",
        "XUSD", "BFUSD", "USDP", "AEUR", "BETH", "WBTC", "WETH", "USDE", "USD",
        "U"  # Specifically blacklist U/USDT stablecoin
    }
    if base in stables_and_fiats:
        return True
        
    # 3. Specific categories
    for bl in ["NFT", "FAN"]:
        if bl in base:
            return True
            
    return False

# ── ML FİLTRESİ ──────────────────────────────────────────────────────────────
try:
    import xgboost as _xgb
    _ML_AVAILABLE = True
except ImportError:
    _ML_AVAILABLE = False

ML_FILTER_FILE = "signal_filter.json"
ML_THRESHOLD   = 0.68              # v3.2: 63% -> 68% (daha seçici ve yüksek başarı oranlı ML filtresi)
ML_REGIME_CODE = {"TRENDING_UP": 0, "TRENDING_DOWN": 1, "CHOPPY": 2, "HIGH_VOL": 3}
ml_model       = None
ml_model_features  = []    # v3.1: Modelin beklediği feature listesi
ml_model_n_features = 0    # v3.1: Modelin beklediği feature sayısı
_ml_error_notified = False # v3.1: Aynı hatayı tekrar bildirme

def load_ml_model():
    global ml_model, ml_model_features, ml_model_n_features, _ml_error_notified
    if not _ML_AVAILABLE:
        console.print("[yellow]ML: xgboost yüklü değil — ML filtresi devre dışı[/yellow]")
        return
    if os.path.exists(ML_FILTER_FILE):
        try:
            m = _xgb.XGBClassifier()
            m.load_model(ML_FILTER_FILE)
            ml_model = m
            ml_model_n_features = m.n_features_in_
            _ml_error_notified = False
            
            # Meta'dan feature isimlerini oku
            if os.path.exists("signal_filter_meta.json"):
                try:
                    with open("signal_filter_meta.json", encoding="utf-8") as f:
                        _meta = json.load(f)
                    ml_model_features = _meta.get("feature_names", [])
                except Exception:
                    pass
            
            console.print(f"[bold green]ML FİLTRE YÜKLENDI: {ML_FILTER_FILE} "
                         f"(eşik: {ML_THRESHOLD}, features: {ml_model_n_features})[/bold green]")
            state_manager.add_log(f"ML: Model yüklendi (Eşik: {ML_THRESHOLD}, "
                                f"Features: {ml_model_n_features})")
        except Exception as e:
            console.print("[yellow]ML model yüklenemedi:[/yellow]", e, "[yellow]— ML filtresi devre dışı[/yellow]")
            state_manager.add_log(f"ML: Model yükleme hatası: {e}")
    else:
        console.print("[dim]ML filtresi: signal_filter.json bulunamadı — önce ml_backtest.py çalıştır[/dim]")

load_ml_model()

# ── MAKRO FİLTRE Entegrasyonu ────────────────────────────────────────────────
try:
    from macro_filter import get_macro_mode, get_macro_state, get_macro_params
    _MACRO_AVAILABLE = True
    console.print("[bold green]MAKRO FİLTRE YÜKLENDI (Katman 1)[/bold green]")
except ImportError:
    _MACRO_AVAILABLE = False
    console.print("[yellow]macro_filter.py bulunamadı — makro filtre devre dışı[/yellow]")

_macro_params: dict = {}
_macro_mode:   str  = "NEUTRAL"

def refresh_macro_params():
    global _macro_params, _macro_mode
    if not _MACRO_AVAILABLE:
        return
    try:
        state         = get_macro_state(force_refresh=True)
        _macro_mode   = state["mode"]
        _macro_params = get_macro_params(_macro_mode)
        console.print(
            f"[bold]MAKRO: {_macro_mode}[/bold] "
            f"(skor:{state['score']:+d}, BTC:${state['btc_price']:,.0f}) — "
            f"{_macro_params['description']}"
        )
    except Exception as e:
        console.print("[yellow]Makro filtre yenilenemedi:[/yellow]", e)

if _MACRO_AVAILABLE:
    refresh_macro_params()

# ── KOİN SCANNER Entegrasyonu ────────────────────────────────────────────────
try:
    from coin_scanner import get_top_coins, get_scan_state
    _SCANNER_AVAILABLE = True
    console.print("[bold green]KOİN SCANNER YÜKLENDI (Katman 2)[/bold green]")
except ImportError:
    _SCANNER_AVAILABLE = False
    console.print("[yellow]coin_scanner.py bulunamadı — scanner devre dışı[/yellow]")

_scanner_coins: list = []
_scanner_state: dict = {}

def refresh_scanner_coins(force: bool = False):
    global _scanner_coins, _scanner_state
    if not _SCANNER_AVAILABLE:
        return
    try:
        state = get_scan_state(force_refresh=force)
        _scanner_coins = state.get("top_coins", [])
        _scanner_state = state
        console.print(
            f"[bold]SCANNER: {len(_scanner_coins)} coin seçildi[/bold] "
            f"(BTC 4h:{state.get('btc_ret_4h', 0):+.1f}%, "
            f"güncelleme:{state.get('updated_at','?')})"
        )
    except Exception as e:
        console.print("[yellow]Coin scanner yenilenemedi:[/yellow]", e)

# ── SİNYAL MOTORU Entegrasyonu ───────────────────────────────────────────────
try:
    from signal_engine import validate_signal
    _SIGNAL_ENGINE_AVAILABLE = True
    console.print("[bold green]SİNYAL MOTORU YÜKLENDI (Katman 3)[/bold green]")
except ImportError:
    _SIGNAL_ENGINE_AVAILABLE = False
    console.print("[yellow]signal_engine.py bulunamadı — sinyal doğrulama devre dışı[/yellow]")

# ── RİSK MOTORU Entegrasyonu ──────────────────────────────────────────────────
try:
    from risk_engine import (
        get_risk_engine, calc_atr_trailing_stop,
        check_partial_tp, check_volatility_filter, check_time_exit,
        PARTIAL_TP_RATIO,
    )
    _RISK_ENGINE_AVAILABLE = True
    console.print("[bold green]RİSK MOTORU YÜKLENDI (Katman 5)[/bold green]")
except ImportError:
    _RISK_ENGINE_AVAILABLE = False
    console.print("[yellow]risk_engine.py bulunamadı — risk motoru devre dışı[/yellow]")

_risk_engine_inst = get_risk_engine(50000.0) if _RISK_ENGINE_AVAILABLE else None

# ── MARKET RADAR GÖREVİ ───────────────────────────────────────────────────────
async def trigger_panic_sell_all(tickers):
    held_syms = list(state_manager.bot_settings["fleet_state"].keys())
    if not held_syms:
        return
    notifier.send_message(f"🚨 *ACİL DURUM DEVRE KESİCİ (DRAWDOWN BREAKER):* Günlük kümülatif zarar sınırı (-%8) aşıldı! Tüm açık pozisyonlar kapatılıyor...")
    state_manager.bot_settings["active"] = False
    state_manager.bot_settings["market_halt"] = True  # Halt trading
    state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
    
    for s in held_syms:
        await force_sell_asset(s, "DRAWDOWN-BREAKER", tickers)
        
    notifier.send_message("✅ *TAMAMLANDI:* Drawdown Breaker tetiklendi, tüm açık pozisyonlar kapatıldı ve bot durduruldu.")

# ── MARKET RADAR GÖREVİ ───────────────────────────────────────────────────────
async def run_market_radar():
    global last_sell_times
    last_rate_update = 0
    _consecutive_errors = 0
    while True:
        try:
            if not state_manager.bot_settings.get("active", True):
                await asyncio.sleep(5)
                continue

            if not trade_executor.public_exchange.markets:
                await trade_executor.init_exchanges()

            if time.time() - last_rate_update > 3600:
                await trade_executor.refresh_usdt_try_rate()
                last_rate_update = time.time()

            try:
                tickers = await trade_executor.fetch_all_tickers_24hr()
                funding_rates = await trade_executor.fetch_all_funding_rates()
            except Exception as e:
                new_url = trade_executor.rotate_endpoint(trade_executor.public_exchange)
                state_manager.add_log(f"RADAR: Fetch hatası, geçiş: {new_url.split('/')[2]}")
                await asyncio.sleep(5)
                continue

            is_aggressive = state_manager.bot_settings.get("personality") == "AGGRESSIVE_TRADER"
            cycle_trades = []
            _min_vol = AGG_MIN_VOLUME_USDT if is_aggressive else 2_000_000
            _scan_limit = AGG_SCAN_LIMIT if is_aggressive else 200
            _mode_label = "AGG" if is_aggressive else "SWING"

            # ── BUGÜNKÜ DRAWDOWN HESABI ──────────────────────────────────────────
            start_bal = state_manager.db.get("start_balance", 50000.0)  # TL cinsinden
            realized_pnl = state_manager.db.get("total_pnl", 0.0)       # USDT cinsinden
            today_str = state_manager.get_tr_now().strftime("%Y-%m-%d")
            
            # Günlük PnL hesabı: trade_history.jsonl'den oku (trade_log 100 sınırından etkilenmez)
            _daily_sell_pnl = state_manager.db.get("_daily_realized_pnl", 0.0)
            _daily_pnl_date = state_manager.db.get("_daily_pnl_date", "")
            if _daily_pnl_date != today_str:
                # Yeni gün başladı, sıfırla
                _daily_sell_pnl = 0.0
                state_manager.db["_daily_realized_pnl"] = 0.0
                state_manager.db["_daily_pnl_date"] = today_str
            daily_realized_pnl = _daily_sell_pnl

            daily_unrealized_pnl = 0.0
            for symbol, st in state_manager.bot_settings["fleet_state"].items():
                if symbol in tickers:
                    curr_price = tickers[symbol].get('last', 0)
                    try:
                        curr_price = float(curr_price)
                        if curr_price > 0:
                            entry = float(st.get('entry', 0))
                            qty = float(st.get('qty', 0))
                            daily_unrealized_pnl += (curr_price - entry) * qty
                    except (ValueError, TypeError):
                        pass

            # Drawdown hesabı: PnL USDT → TL'ye çevirip TL bazlı start_bal ile karşılaştır
            import trade_executor as _te_mod
            _cur_rate = _te_mod.get_usdt_try_rate()
            daily_cumulative_pnl = daily_realized_pnl + daily_unrealized_pnl
            portfolio_value = start_bal + realized_pnl * _cur_rate + daily_unrealized_pnl * _cur_rate
            if _risk_engine_inst and portfolio_value > 0:
                _risk_engine_inst.update_portfolio(portfolio_value)
            drawdown_pct = (daily_cumulative_pnl * _cur_rate / portfolio_value * 100.0) if portfolio_value > 0 else 0.0

            # ── DRAWDOWN DEVRE KESİCİLERİ ──────────────────────────────────────────
            block_buys_drawdown = False
            
            # -8% Devre Kesici (Halt ve Kapat)
            if drawdown_pct <= -8.0:
                global last_drawdown_warn_date
                if last_drawdown_warn_date != today_str + "_halt":
                    last_drawdown_warn_date = today_str + "_halt"
                    state_manager.add_log(f"CIRCUIT: Kritik günlük kayıp barajı aşıldı! %{drawdown_pct:.2f} <= -8.0%")
                    # Sadece panic sell tetikle (rapor task'ları zaten arka planda çalışıyor)
                    asyncio.create_task(trigger_panic_sell_all(tickers))
                    notifier.send_message(f"🚨 *KRİTİK DEVRE KESİCİ*\nGünlük kayıp `%{drawdown_pct:.2f}` — Tüm pozisyonlar kapatılıyor!")
                await asyncio.sleep(5)
                continue
                
            # -5% Devre Kesici (Alımları durdur)
            elif drawdown_pct <= -5.0:
                block_buys_drawdown = True
                if last_drawdown_warn_date != today_str + "_warn":
                    last_drawdown_warn_date = today_str + "_warn"
                    msg_warn = f"⚠️ *GÜNLÜK HESAP KORUMASI DEVREDE*\nGünlük kümülatif zarar `%{drawdown_pct:.2f}` seviyesine ulaştı. Gün sonuna kadar yeni alımlar durduruldu."
                    notifier.send_message(msg_warn)
                    state_manager.add_log(f"CIRCUIT: Günlük zarar koruması tetiklendi (%{drawdown_pct:.2f} <= -5.0%).")

            # ── BTC MACRO VERİLERİ VE REGİME FİLTRELERİ ──────────────────────────
            import pandas as pd
            btc_df = pd.DataFrame()
            btc_1h_change = 0.0
            btc_rsi_1h = 50.0
            btc_closes = None
            try:
                btc_bars = await asyncio.to_thread(
                    trade_executor.public_exchange.fetch_ohlcv, 'BTC/USDT', timeframe='1h', limit=50
                )
                if btc_bars:
                    btc_df = pd.DataFrame(btc_bars, columns=['time','open','high','low','close','volume'])
                    from indicators import calculate_rsi, compute_all_indicators
                    btc_df = compute_all_indicators(btc_df)
                    if not btc_df.empty:
                        last_btc = btc_df.iloc[-1]
                        prev_btc = btc_df.iloc[-2]
                        btc_current_price = float(last_btc['close'])
                        btc_prev_price = float(prev_btc['close'])
                        btc_1h_change = (btc_current_price - btc_prev_price) / btc_prev_price * 100.0
                        btc_rsi_1h = float(last_btc['rsi'])
                        btc_closes = btc_df['close'].tail(30)
            except Exception as e:
                state_manager.add_log(f"RADAR: BTC filtre verileri alınamadı: {e}")

            block_buys_btc = False
            if is_aggressive:
                if btc_1h_change <= -2.0:
                    block_buys_btc = True

            def _get_vol(d):
                v = d.get('quoteVolume') or d.get('info', {}).get('quoteVolume', 0)
                try:
                    return float(v or 0)
                except (ValueError, TypeError):
                    return 0.0

            if _macro_mode == "BEAR":
                down_syms = [s for s in DOWN_TOKENS if s in tickers]
                bear_normal = sorted(
                    [s for s, d in tickers.items()
                     if s.endswith('/USDT') and not is_blacklisted(s)
                     and _get_vol(d) >= 5_000_000],
                    key=lambda x: _get_vol(tickers[x]), reverse=True
                )[:30]
                valid_symbols = down_syms + [s for s in bear_normal if s not in down_syms]
                state_manager.add_log(f"RADAR [{_mode_label}]: BEAR Modu — {len(down_syms)} DOWN + {len(bear_normal)} coin (skor +8)")
            elif is_aggressive:
                valid_symbols = sorted(
                    [s for s, d in tickers.items()
                     if s.endswith('/USDT') and not is_blacklisted(s)
                     and _get_vol(d) >= _min_vol],
                    key=lambda x: _get_vol(tickers[x]), reverse=True
                )[:_scan_limit]
                state_manager.add_log(f"RADAR [{_mode_label}]: 🔥 {len(valid_symbols)} coin taranıyor (min hacim: ${_min_vol/1e6:.1f}M)")
            elif _scanner_coins:
                valid_symbols = [s for s in _scanner_coins if s in tickers and not is_blacklisted(s)]
                if len(valid_symbols) < 20:
                    fallback_syms = sorted(
                        [s for s, d in tickers.items()
                         if s.endswith('/USDT') and not is_blacklisted(s)
                         and _get_vol(d) >= _min_vol and s not in valid_symbols],
                        key=lambda x: _get_vol(tickers[x]), reverse=True
                    )[:40]
                    valid_symbols = valid_symbols + fallback_syms
                state_manager.add_log(f"RADAR [{_mode_label}]: Katman 2 — {len(valid_symbols)} seçili coin taranıyor...")
            else:
                valid_symbols = sorted(
                    [s for s, d in tickers.items()
                     if s.endswith('/USDT') and not is_blacklisted(s)
                     and _get_vol(d) >= _min_vol],
                    key=lambda x: _get_vol(tickers[x]), reverse=True
                )[:_scan_limit]
                state_manager.add_log(f"RADAR [{_mode_label}]: {len(valid_symbols)} varlık taranıyor (scanner bekleniyor)...")

            held_syms = list(state_manager.bot_settings.get("fleet_state", {}).keys())
            for held in held_syms:
                if held in tickers and held not in valid_symbols:
                    valid_symbols.append(held)
            if held_syms:
                state_manager.add_log(f"RADAR: {len(held_syms)} açık pozisyon listeye dahil edildi")

            if not valid_symbols:
                state_manager.add_log("RADAR: Sembol bulunamadı. Yeniden deneniyor...")
                await asyncio.sleep(10)
                continue
            
            results = []
            state_manager.radar_data["progress"] = 0

            for i in range(0, len(valid_symbols), 20):
                batch = valid_symbols[i:i+20]
                state_manager.radar_data["progress"] = int((i / len(valid_symbols)) * 100)
                tasks = [
                    asyncio.to_thread(
                        TechnicalScoringEngine(
                            s, exchange=trade_executor.public_exchange,
                            personality=state_manager.bot_settings.get('personality','SWING_TRADER')
                        ).calculate_score,
                        btc_closes=btc_closes
                    ) for s in batch
                ]
                reps = await asyncio.gather(*tasks, return_exceptions=True)

                if i % 40 == 0:
                    state_manager.add_log(f"SCANNING: Neural Pulse {i}/{len(valid_symbols)} çift analiz edildi")

                for idx, r in enumerate(reps):
                    if isinstance(r, Exception) or not isinstance(r, dict) or r.get("total_score") is None:
                        continue

                    curr_symbol = batch[idx]
                    ai_score    = r.get('total_score', 0)

                    results.append(trade_executor.clean_data({
                        "symbol":  curr_symbol.replace("/", "-"),
                        "score":   ai_score,
                        "signal":  r.get('signal', 'NEUTRAL'),
                        "metrics": r.get('metrics', {}),
                    }))

                    if not state_manager.bot_settings["active"]:
                        continue

                    if state_manager.bot_settings.get("market_halt", False):
                        continue

                    state         = state_manager.bot_settings["fleet_state"].get(curr_symbol, {"side": None, "entry": 0, "peak": 0, "qty": 0})
                    price         = r.get('metrics', {}).get('price', 0)
                    if price <= 0:
                        continue
                    
                    regime_params = r.get('regime_params', {})
                    regime_name   = r.get('regime', 'UNKNOWN')
                    current_atr_pct = r.get('metrics', {}).get('atr_pct', 1.5)

                    if is_aggressive:
                        score_bonus    = 0
                        tp_bonus       = 0.0
                        active_ml_thr  = 0.56 if state_manager.bot_settings.get("use_ml_filter", False) else 0.52
                        active_max_pos = 6 if btc_rsi_1h < 35 else AGG_MAX_POSITIONS
                        active_risk    = AGG_RISK_PER_TRADE
                        active_cool    = AGG_COOLDOWN_SECONDS
                        
                        # Dynamically calculate stop-loss based on ATR
                        atr_stop_pct = current_atr_pct * 1.2
                        if atr_stop_pct > 3.0:
                            # Filter out Highly volatile coins
                            continue
                        atr_stop_pct = max(1.0, atr_stop_pct)
                        active_stop = atr_stop_pct / 100.0
                    else:
                        mp = _macro_params
                        score_bonus    = mp.get('score_bonus', 0)
                        tp_bonus       = mp.get('tp_bonus_pct', 0.0)
                        active_ml_thr  = mp.get('ml_threshold', ML_THRESHOLD)
                        active_max_pos = mp.get('max_open_positions', MAX_OPEN_POSITIONS)
                        active_risk    = mp.get('risk_per_trade_pct', RISK_PER_TRADE_PCT)
                        active_stop    = mp.get('hard_stop_pct', HARD_STOP_PCT)
                        active_cool    = mp.get('cooldown_seconds', COOLDOWN_SECONDS)

                    dyn_buy_thresh  = regime_params.get('buy_thresh', 80) + score_bonus
                    dyn_sell_thresh = regime_params.get('sell_thresh', AGG_EXIT_SCORE if is_aggressive else DEFAULT_EXIT_SCORE)
                    dyn_atr_mult    = regime_params.get('atr_mult', 3.0)
                    dyn_take_profit = regime_params.get('take_profit', AGG_TAKE_PROFIT if is_aggressive else DEFAULT_TAKE_PROFIT) + tp_bonus
                    can_buy         = regime_params.get('can_buy', True)

                    # ── ALIM KOŞULLARI ────────────────────────────────────────
                    is_buy_blocked = block_buys_drawdown or block_buys_btc
                    
                    # 4H Trend Filter (Hard Block)
                    trend_4h = r.get('metrics', {}).get('trend_4h', 'NEUTRAL')
                    if trend_4h == 'BEARISH':
                        # v2.5: Hard block kaldırıldı — scoring engine zaten -10 puan cezası veriyor
                        state_manager.add_log(f"4H-TREND-WARN: {curr_symbol} 4H trendi düşüşte (skor cezası uygulandı)")
                    
                    # Funding Rate Filter
                    fr = funding_rates.get(curr_symbol, 0.0)
                    _funding_size_mult = 1.0
                    if fr > 0.001:  # > %0.10
                        is_buy_blocked = True
                        state_manager.add_log(f"FUNDING-BLOCK: {curr_symbol} Funding Rate aşırı yüksek ({fr*100:.3f}%). Alım iptal.")
                    elif fr < -0.0005:  # < -%0.05
                        _funding_size_mult = 1.20
                        
                    # ── GECE SESSİZLİK MODU (03:00 - 05:00 TR) ──────────────
                    # v2.5: 01-06 -> 03-05 (Asya oturumu fırsatları yakalansın)
                    _tr_hour = state_manager.get_tr_now().hour
                    if 3 <= _tr_hour < 5:
                        is_buy_blocked = True

                    # ── CHOPPY REJİMİ FİLTRESİ ───────────────────────────────
                    if regime_name == "CHOPPY" and not is_buy_blocked:
                        # CHOPPY'de eşiği 6 puan yükselt — v2.5: 12 -> 6 (daha fazla fırsat)
                        dyn_buy_thresh += 6
                        if state_manager.bot_settings.get("use_ml_filter", False):
                            active_ml_thr = max(active_ml_thr, 0.60)
                        
                    # BEAR modunda +4 skor eşiği (v2.5: 8 -> 4, macro_filter zaten +4 ekliyor)
                    if _macro_mode == "BEAR" and not is_buy_blocked:
                        dyn_buy_thresh += 4

                    if can_buy and ai_score >= dyn_buy_thresh and state.get("side") != "buy" and not is_buy_blocked:
                        if len(state_manager.bot_settings["fleet_state"]) >= active_max_pos:
                            continue
                        _last_sell = last_sell_times.get(curr_symbol, 0)
                        _loss_cool = loss_cooldown_symbols.get(curr_symbol, 0)
                        _effective_cool = max(active_cool, _loss_cool)
                        if time.time() - _last_sell < _effective_cool:
                            continue
                        if is_aggressive:
                            fleet = state_manager.bot_settings["fleet_state"]
                            _corr_ok = True
                            btc_corr = r.get('metrics', {}).get('btc_corr', 0.0)
                            group_limit = 3 if btc_corr > 0.85 else AGG_CORR_MAX_GROUP
                            for gn, coins in CORR_GROUPS.items():
                                if curr_symbol in coins:
                                    if sum(1 for c in coins if c in fleet) >= group_limit:
                                        _corr_ok = False
                                        break
                            if not _corr_ok:
                                state_manager.add_log(f"CORR-SKIP: {curr_symbol} group limit reached ({group_limit}) due to BTC corr={btc_corr:.2f}")
                                continue
                        else:
                            if not check_correlation_limit(curr_symbol):
                                continue

                        if ml_model is not None and state_manager.bot_settings.get("use_ml_filter", False):
                            try:
                                _mt = r.get('metrics', {})
                                def _gm(k): return float(_mt.get(k, 0) or 0)
                                _rc = float(ML_REGIME_CODE.get(regime_name, 2))
                                _macd_pos = 1.0 if bool(_mt.get('macd_pos', False)) else 0.0
                                _trend_4h = float({"BULLISH": 1, "BEARISH": -1, "NEUTRAL": 0}.get(_mt.get("trend_4h", "NEUTRAL"), 0))
                                _macd_pos_4h = 1.0 if bool(_mt.get('macd_pos_4h', False)) else 0.0
                                
                                # ── v3.1: DİNAMİK FEATURE VEKTÖRÜ ──
                                _feat_full = {
                                    'rsi': _gm('rsi'), 'stoch_k': _gm('stoch_k'),
                                    'bb_pct': _gm('bb_pct'), 'z_score': _gm('z_score'),
                                    'vol_ratio': _gm('vol_ratio'), 'adx': _gm('adx'),
                                    'atr_pct': _gm('atr_pct'), 'macd_pos': _macd_pos,
                                    'trend_4h': _trend_4h, 'rsi_4h': _gm('rsi_4h'),
                                    'bb_pct_4h': _gm('bb_pct_4h'), 'macd_pos_4h': _macd_pos_4h,
                                    'z_score_4h': _gm('z_score_4h'),
                                    'ob_imbalance': _gm('ob_imbalance'),
                                    'volatility': _gm('volatility'),
                                    'regime_code': _rc, 'raw_score': float(ai_score),
                                }
                                
                                # Model'in beklediği feature listesine göre vektör oluştur
                                if ml_model_features:
                                    _feat_vec = [_feat_full.get(f, 0.0) for f in ml_model_features]
                                else:
                                    _all_17 = ['rsi','stoch_k','bb_pct','z_score','vol_ratio',
                                               'adx','atr_pct','macd_pos','trend_4h',
                                               'rsi_4h','bb_pct_4h','macd_pos_4h','z_score_4h',
                                               'ob_imbalance','volatility','regime_code','raw_score']
                                    _all_13 = ['rsi','stoch_k','bb_pct','z_score','vol_ratio',
                                               'adx','atr_pct','macd_pos','trend_4h',
                                               'ob_imbalance','volatility','regime_code','raw_score']
                                    _keys = _all_17 if ml_model_n_features >= 17 else _all_13
                                    _feat_vec = [_feat_full.get(f, 0.0) for f in _keys]
                                
                                _feat = np.array([_feat_vec], dtype=np.float32)
                                _win_prob = ml_model.predict_proba(_feat)[0][1]
                                if _win_prob < active_ml_thr:
                                    state_manager.add_log(f"ML-SKIP: {curr_symbol} win={_win_prob:.2f} < {active_ml_thr} ({_macro_mode})")
                                    continue
                            except Exception as ex:
                                # ── v3.1: HATA BİLDİRİM SİSTEMİ ──
                                _err_msg = str(ex)
                                state_manager.add_log(f"ML-ERROR: {curr_symbol} — {_err_msg[:100]}")
                                console.print(f"[red]ML HATA [{curr_symbol}]:[/red] {_err_msg}")
                                if not _ml_error_notified:
                                    _ml_error_notified = True
                                    try:
                                        notifier.send_message(
                                            "⚠️ *ML FİLTRE HATASI*\n"
                                            "━━━━━━━━━━━━━━━━━━━━━\n"
                                            f"📍 *Coin:* `{curr_symbol}`\n"
                                            f"❌ *Hata:* `{_err_msg[:150]}`\n"
                                            f"ℹ️ *Model Features:* `{ml_model_n_features}`\n"
                                            "🔄 *Durum:* ML filtresi devre dışı, "
                                            "diğer katmanlarla devam ediliyor.\n"
                                            "💡 *Çözüm:* Yeni eğitim sonrası otomatik düzelir."
                                        )
                                    except Exception:
                                        pass

                        if not is_aggressive and _SIGNAL_ENGINE_AVAILABLE:
                            try:
                                _sv = validate_signal(
                                    symbol     = curr_symbol,
                                    score      = ai_score,
                                    regime     = regime_name,
                                    metrics    = r.get('metrics', {}),
                                    exchange   = trade_executor.public_exchange,
                                    tickers    = tickers or {},
                                    macro_mode = _macro_mode,
                                    strict     = (_macro_mode == "BEAR"),
                                )
                                if not _sv["approved"]:
                                    state_manager.add_log(f"K3-SKIP: {curr_symbol} — {_sv['reason']}")
                                    continue
                            except Exception:
                                pass

                        _k5_size_mult = 1.0 * _funding_size_mult
                        if _RISK_ENGINE_AVAILABLE and _risk_engine_inst is not None:
                            try:
                                _today_pnl_usd = sum(
                                    t.get("pnl", 0) for t in state_manager.db.get("trade_log", [])
                                    if t.get("date") == state_manager.get_tr_now().strftime("%Y-%m-%d")
                                    and t.get("side") in ["SELL", "SELL-ALL", "PARTIAL-SELL"]
                                )
                                _today_pnl_try = _today_pnl_usd * _cur_rate
                                _k5 = _risk_engine_inst.pre_buy_check(
                                    atr_pct     = current_atr_pct,
                                    daily_pnl   = _today_pnl_try,
                                    fleet_state = state_manager.bot_settings["fleet_state"],
                                    macro_mode  = _macro_mode,
                                )
                                if not _k5["can_buy"]:
                                    state_manager.add_log(f"K5-BLOCK: {curr_symbol} — {_k5['reason']}")
                                    continue
                                _k5_size_mult = _k5.get("size_multiplier", 1.0)
                            except Exception:
                                pass

                        # DÜZELTME P0-2: ML güven tabanlı pozisyon boyutlandırması devre dışı
                        # Model CV AUC > 0.60 seviyesine kanıtlanana kadar sabit 1.0x
                        # ESKİ KOD: min_thr(0.68) > max_thr(0.65) mantık hatası nedeniyle
                        # tüm SWING işlemleri %100 oranında 2.0x çarpan alıyordu
                        _conf_mult = 1.0

                        if regime_name == "CHOPPY":
                            # Cap sizing multiplier to max 0.75x in CHOPPY market regime to prevent over-allocating on false breakouts
                            _conf_mult = min(_conf_mult, 0.75)
                        
                        qty = trade_executor.calculate_position_size(
                            price, 
                            current_atr_pct, 
                            risk_override=active_risk * _k5_size_mult,
                            conf_mult=_conf_mult
                        )
                        _source = "AGGRESSIVE_TRADER" if is_aggressive else "SWING_TRADER"

                        # v3.0: Boş işlem engeli — qty<=0 ise alım yapma
                        if qty is None or qty <= 0:
                            state_manager.add_log(f"BUY-SKIP: {curr_symbol} qty={qty} — minimum emir büyüklüğü karşılanamıyor")
                            continue

                        # DÜZELTME P1-4: Tüm aday sinyalleri kaydet (alınsın ya da alınmasın)
                        # Seçilim yanlılığını ortadan kaldırır — model reddedilen sinyallerden de öğrenir
                        try:
                            import signal_tracker as _st_pre
                            _st_pre.log_signal_full(curr_symbol, ai_score, price, r.get('metrics',{}), regime_name)
                        except Exception:
                            pass

                        order_success = False
                        try:
                            order_success, exec_price = await trade_executor.execute_order_smart(curr_symbol, 'buy', qty)
                            if order_success:
                                price = exec_price
                        except Exception as e:
                            state_manager.add_log(f"ORDER-FAILED: {curr_symbol} BUY: {str(e)[:60]}")
                            fail_msg = f"❌ *ALIM HATASI:* {curr_symbol}\n`{str(e)[:100]}`"
                            notify_mode = state_manager.bot_settings.get("notify_mode", "BATCH")
                            if notify_mode in ["BATCH", "SILENT"]:
                                cycle_trades.append({"type": "ERROR", "symbol": curr_symbol, "action": "BUY", "msg": str(e)[:100]})
                            elif notify_mode == "VERBOSE":
                                notifier.send_message(fail_msg)
                            order_success = False

                        if order_success:
                            try:
                                if is_aggressive:
                                    _trail_pct = 1.0
                                elif _RISK_ENGINE_AVAILABLE:
                                    _trail_pct = calc_atr_trailing_stop(current_atr_pct, _macro_mode)
                                else:
                                    _trail_pct = DEFAULT_TRAILING_STOP

                                async with _fleet_lock:
                                    state_manager.bot_settings["fleet_state"][curr_symbol] = {
                                        "side":         "buy",
                                        "entry":        price,
                                        "peak":         price,
                                        "qty":          qty,
                                        "time":         time.time(),
                                        "regime":       regime_name,
                                        "atr_pct":      current_atr_pct,
                                        "hard_stop":    price * (1 - active_stop),
                                        "trail_pct":    _trail_pct,
                                        "partial_sold": False,
                                        "source":       _source,
                                        "trail_activated": False,
                                    }
                                    state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
                                state_manager.add_log(f"BUY [{_mode_label}|trail%{_trail_pct:.1f}|stop%{active_stop*100:.1f}]: {curr_symbol} @ ${price:.6f} "
                                                     f"(Skor:{ai_score}, Rejim:{regime_name})")
                                # signal_tracker.log_signal_full moved before order execution (P1-4)
                                
                                # v3.0: Gelişmiş trade kaydı — tüm göstergeler dahil
                                _metrics = r.get('metrics', {})
                                trade_rec = {
                                    "time": state_manager.get_tr_now().strftime("%H:%M:%S"),
                                    "date": state_manager.get_tr_now().strftime("%Y-%m-%d"),
                                    "symbol": curr_symbol, "side": "BUY",
                                    "price": price, "qty": qty, "regime": regime_name,
                                    "source": _source,
                                    "ai_score": ai_score,
                                    "atr_pct": current_atr_pct,
                                    "hard_stop_pct": round(active_stop * 100, 2),
                                    "rsi": round(_metrics.get('rsi', 0), 1),
                                    "adx": round(_metrics.get('adx', 0), 1),
                                    "trend_4h": _metrics.get('trend_4h', 'N/A'),
                                    "macro_mode": _macro_mode,
                                    "ml_prob": round(locals().get('_win_prob', 0), 3),
                                }
                                state_manager.db.setdefault("trade_log", []).insert(0, trade_rec)
                                state_manager.append_trade_history(trade_rec)
                                state_manager.db["trade_log"] = state_manager.db["trade_log"][:100]
                                state_manager.save_db(state_manager.db)
                                
                                notify_mode = state_manager.bot_settings.get("notify_mode", "BATCH")
                                if notify_mode == "BATCH":
                                    cycle_trades.append({"type": "BUY", "symbol": curr_symbol, "price": price, "qty": qty, "source": _source})
                                elif notify_mode == "VERBOSE":
                                    success_msg = notifier.format_trade_msg("BUY", curr_symbol, price, qty, source=_source, status="✅ GERÇEKLEŞTİ")
                                    notifier.send_message(success_msg)
                            except Exception as e:
                                state_manager.add_log(f"BUY-STATE-SAVE-ERROR: {curr_symbol}: {e}")

                    # ── SATIŞ KOŞULLARI ───────────────────────────────────────
                    elif state.get("side") == "buy":
                        if price > state["peak"]:
                            old_peak = state["peak"]
                            state["peak"] = price
                            if old_peak > 0 and (price - old_peak) / old_peak >= 0.01:
                                async with _fleet_lock:
                                    if curr_symbol in state_manager.bot_settings["fleet_state"]:
                                        state_manager.bot_settings["fleet_state"][curr_symbol] = state
                                        state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
                        profit_pct = (price - state["entry"]) / state["entry"] * 100 if state["entry"] > 0 else 0
                        drop       = (state["peak"] - price) / state["peak"] * 100 if state["peak"] > 0 else 0
                        hard_stop  = state.get("hard_stop", state["entry"] * (1 - HARD_STOP_PCT))

                        # ── BREAK-EVEN KORUMASI ──────────────────────────────
                        # +%1 kâra ulaşınca stop'u maliyetin %0.5 altına çek
                        # Böylece kâra geçmiş pozisyon en fazla -%0.5 ile kapanır
                        if not state.get("breakeven_set") and profit_pct >= 1.0:
                            # DÜZELTME P1-3: Komisyon dahil gerçek başabaş
                            # Eski: entry * 0.995 = -%0.5 altı → komisyonla net -%0.70 zarar kilitleme
                            # Yeni: entry * 1.003 = +%0.3 üstü → %0.20 komisyon sonrası net +%0.1 kâr
                            new_stop = state["entry"] * 1.003
                            if new_stop > hard_stop:
                                state["hard_stop"] = new_stop
                                state["breakeven_set"] = True
                                hard_stop = new_stop
                                async with _fleet_lock:
                                    if curr_symbol in state_manager.bot_settings["fleet_state"]:
                                        state_manager.bot_settings["fleet_state"][curr_symbol] = state
                                        state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
                                state_manager.add_log(f"BREAK-EVEN: {curr_symbol} +{profit_pct:.1f}% kâr — stop maliyete çekildi (${new_stop:.6f})")

                        if _RISK_ENGINE_AVAILABLE:
                            dyn_trail = state.get("trail_pct") or calc_atr_trailing_stop(current_atr_pct, _macro_mode)
                        else:
                            entry_atr = state.get('atr_pct', 1.5)
                            avg_atr   = (entry_atr + current_atr_pct) / 2
                            dyn_trail = max(1.5, min(10.0, avg_atr * dyn_atr_mult))

                        should_sell = False
                        reason      = ""

                        if _RISK_ENGINE_AVAILABLE and not state.get("partial_sold"):
                            try:
                                _partial = check_partial_tp(state["entry"], price, state["qty"], state, _macro_mode)
                                if _partial:
                                    try:
                                        _pqty = _partial["qty"]
                                        _partial_success, _exec_price = await trade_executor.execute_order_smart(curr_symbol, 'sell', _pqty)
                                        if _partial_success:
                                            price = _exec_price
                                            _gross_ppnl = (price - state["entry"]) * _pqty
                                            _pcommission = (state["entry"] + price) * _pqty * 0.001
                                            _ppnl = _gross_ppnl - _pcommission
                                            state_manager.db["total_pnl"] = round(state_manager.db.get("total_pnl", 0) + _ppnl, 2)
                                            # Günlük drawdown takibi güncelle
                                            state_manager.db["_daily_realized_pnl"] = round(
                                                state_manager.db.get("_daily_realized_pnl", 0.0) + _ppnl, 2)
                                            if _ppnl > 0:
                                                _v_share = 0.0
                                                # state_manager.db["profit_vault"] = round(state_manager.db.get("profit_vault", 0.0) + _v_share, 2)
                                                # state_manager.db["profit_vault_count"] = state_manager.db.get("profit_vault_count", 0) + 1
                                            # v3.0 FIX: trade_log kaydı artık if _partial_success İÇİNDE
                                            state_manager.db.setdefault("trade_log", []).insert(0, {
                                                "time": state_manager.get_tr_now().strftime("%H:%M:%S"),
                                                "date": state_manager.get_tr_now().strftime("%Y-%m-%d"),
                                                "symbol": curr_symbol, "side": "PARTIAL-SELL",
                                                "price": price, "qty": _pqty, "pnl": round(_ppnl, 2),
                                                "reason": _partial["reason"],
                                                "source": state.get("source", "SWING_TRADER"),
                                                "entry": state["entry"],
                                                "profit_pct": round(((price - state["entry"]) / state["entry"]) * 100, 2),
                                            })
                                            state_manager.append_trade_history(state_manager.db["trade_log"][0])
                                            state_manager.db["trade_log"] = state_manager.db["trade_log"][:100]
                                            state_manager.save_db(state_manager.db)
                                        else:
                                            state_manager.add_log(f"PARTIAL-SELL-FAILED: {curr_symbol} emir reddedildi")
                                        
                                        notify_mode = state_manager.bot_settings.get("notify_mode", "BATCH")
                                        if notify_mode == "BATCH":
                                            cycle_trades.append({
                                                "type": "PARTIAL-SELL",
                                                "symbol": curr_symbol,
                                                "price": price,
                                                "qty": _pqty,
                                                "pnl": round(_ppnl, 2),
                                                "entry": state["entry"],
                                                "reason": _partial["reason"]
                                            })
                                        elif notify_mode == "VERBOSE":
                                            p_msg = notifier.format_trade_msg("SELL", curr_symbol, price, _pqty, _ppnl, _partial["reason"])
                                            notifier.send_message(p_msg)
                                        
                                        state["qty"]          = _partial["keep_qty"]
                                        state["partial_sold"] = True
                                        state["hard_stop"]    = state["entry"] * 1.005
                                        async with _fleet_lock:
                                            if curr_symbol in state_manager.bot_settings["fleet_state"]:
                                                state_manager.bot_settings["fleet_state"][curr_symbol] = state
                                                state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
                                        state_manager.add_log(f"PARTIAL-SELL: {curr_symbol} %{PARTIAL_TP_RATIO*100:.0f} @ ${price:.6f} | PnL:${_ppnl:.2f} | stop->break-even")
                                    except Exception as e:
                                        state_manager.add_log(f"PARTIAL-ORDER-FAIL: {curr_symbol}: {str(e)[:60]}")
                            except Exception:
                                pass

                        if is_aggressive:
                            _elapsed = time.time() - state.get("time", 0)
                            if _elapsed > AGG_MAX_HOLD_SECS:
                                if not state.get("tp_reduced_hold_time", False):
                                    state["tp_reduced_hold_time"] = True
                                    async with _fleet_lock:
                                        if curr_symbol in state_manager.bot_settings["fleet_state"]:
                                            state_manager.bot_settings["fleet_state"][curr_symbol] = state
                                            state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
                                    state_manager.add_log(f"HOLD-TIME-EXCEEDED: {curr_symbol} has been open for {_elapsed/3600:.1f}h. TP reduced to 1.0%")
                                dyn_take_profit = 1.0

                            # Trailing stop activation and check
                            if not state.get("trail_activated", False) and profit_pct >= 1.2:
                                state["trail_activated"] = True
                                async with _fleet_lock:
                                    if curr_symbol in state_manager.bot_settings["fleet_state"]:
                                        state_manager.bot_settings["fleet_state"][curr_symbol] = state
                                        state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
                                state_manager.add_log(f"TRAIL-ACTIVATE: {curr_symbol} trailing stop activated at +{profit_pct:.2f}% profit.")
                            
                            if state.get("trail_activated", False) and drop >= 1.0:
                                should_sell = True
                                reason = f"TRAIL-LOCK-AGG-1.0%-{regime_name}"

                        if not is_aggressive and _RISK_ENGINE_AVAILABLE and not should_sell:
                            try:
                                _te = check_time_exit(curr_symbol, state, price)
                                if _te:
                                    should_sell = True
                                    reason      = _te["reason"]
                            except Exception:
                                pass

                        if not should_sell and price <= hard_stop:
                            should_sell = True
                            reason = f"HARD-STOP-{regime_name}"
                        elif not should_sell and profit_pct >= dyn_take_profit:
                            should_sell = True
                            reason = f"TAKE-PROFIT-{regime_name}" if not state.get("tp_reduced_hold_time", False) else f"TAKE-PROFIT-HOLD-TIME-{regime_name}"
                        elif not is_aggressive and not should_sell and drop >= dyn_trail and profit_pct > 0.3:
                            # v2.4: Trailing stop SADECE pozisyon kârdayken çalışır.
                            # Eskiden zararda da tetikleniyor ve kaybı kalıcılaştırıyordu
                            # (backtest: trailing tek başına en büyük zarar kaynağıydı).
                            # Zarardaki pozisyonu artık yalnızca HARD-STOP kapatır.
                            should_sell = True
                            reason = f"TRAIL-LOCK%{dyn_trail:.1f}-{regime_name}"
                        elif not should_sell and ai_score < dyn_sell_thresh:
                            # SCORE-DROP: Sadece pozisyon zarardayken tetiklenir.
                            # v3.0: Tolerans eklendi — çok erken ve çok küçük zararlarda tetiklenmez.
                            # Eski hali 168 gereksiz satış yapıyordu (-15.94$ kayıp + ~67$ komisyon).
                            _hold_secs = time.time() - state.get("time", time.time())
                            _min_hold_for_drop = 900  # en az 15 dakika tutulmuş olmalı
                            _min_loss_for_drop = -1.0  # en az -%1 zararda olmalı
                            if profit_pct <= _min_loss_for_drop and _hold_secs >= _min_hold_for_drop:
                                should_sell = True
                                reason = f"SCORE-DROP-{regime_name}"
                            elif profit_pct <= 0.0 and profit_pct > _min_loss_for_drop:
                                state_manager.add_log(f"SCORE-DROP-WAIT: {curr_symbol} skor düştü ama zarar küçük ({profit_pct:.2f}%) — bekleniyor")
                            elif profit_pct > 0.0:
                                state_manager.add_log(f"SCORE-DROP-SKIP: {curr_symbol} skor düştü ({ai_score:.0f}<{dyn_sell_thresh:.0f}) ama +{profit_pct:.2f}% kârda — satış engellendi")

                        if should_sell:
                            notify_mode = state_manager.bot_settings.get("notify_mode", "BATCH")
                            try:
                                _sell_success, _exec_price = await trade_executor.execute_order_smart(curr_symbol, 'sell', state["qty"])
                                if _sell_success:
                                    price = _exec_price
                                    gross_pnl = (price - state["entry"]) * state["qty"]
                                    commission = (state["entry"] + price) * state["qty"] * 0.001
                                    pnl = gross_pnl - commission
                                    
                                    if not is_aggressive and notify_mode == "VERBOSE":
                                        notifier.send_message(notifier.format_trade_msg("SELL", curr_symbol, price, state["qty"], pnl, reason, status="⏳ SATIŞ EMRİ VERİLDİ..."))
                                    
                                    state_manager.db["total_pnl"] = round(state_manager.db.get("total_pnl", 0) + pnl, 2)
                                    # Günlük drawdown takibi güncelle
                                    state_manager.db["_daily_realized_pnl"] = round(
                                        state_manager.db.get("_daily_realized_pnl", 0.0) + pnl, 2)
                                    if pnl > 0:
                                        _v_share = 0.0
                                        # state_manager.db["profit_vault"] = round(state_manager.db.get("profit_vault", 0.0) + _v_share, 2)
                                        # state_manager.db["profit_vault_count"] = state_manager.db.get("profit_vault_count", 0) + 1
                                    # v3.0 FIX: Tüm kayıt ve silme işlemleri artık if _sell_success İÇİNDE
                                    _hold_minutes = round((time.time() - state.get("time", time.time())) / 60, 1)
                                    state_manager.db.setdefault("trade_log", []).insert(0, {
                                        "time": state_manager.get_tr_now().strftime("%H:%M:%S"),
                                        "date": state_manager.get_tr_now().strftime("%Y-%m-%d"),
                                        "symbol": curr_symbol, "side": "SELL",
                                        "price": price, "qty": state["qty"], "pnl": round(pnl, 2), "reason": reason,
                                        "source": state.get("source", "SWING_TRADER"),
                                        "entry": state["entry"],
                                        "profit_pct": round(((price - state["entry"]) / state["entry"]) * 100, 2),
                                        "hold_minutes": _hold_minutes,
                                        "regime": state.get("regime", "N/A"),
                                    })
                                    state_manager.append_trade_history(state_manager.db["trade_log"][0])
                                    state_manager.db["trade_log"] = state_manager.db["trade_log"][:100]
                                    state_manager.save_db(state_manager.db)

                                    # Zarar varsa 2 saat, kar ise normal cooldown (v2.5: 4h -> 2h)
                                    if pnl < 0:
                                        last_sell_times[curr_symbol] = time.time()
                                        loss_cooldown_symbols[curr_symbol] = 7200
                                        state_manager.add_log(f"LOSS-COOLDOWN: {curr_symbol} 2 saat alim engeli (PnL:${pnl:.2f})")
                                    else:
                                        last_sell_times[curr_symbol] = time.time()
                                        loss_cooldown_symbols.pop(curr_symbol, None)
                                    async with _fleet_lock:
                                        if curr_symbol in state_manager.bot_settings["fleet_state"]:
                                            del state_manager.bot_settings["fleet_state"][curr_symbol]
                                            state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
                                    
                                    state_manager.add_log(f"PROFIT-REALIZED: {curr_symbol} | {reason} | PnL: ${pnl:.2f} | Süre: {_hold_minutes}dk")
                                    
                                    if notify_mode == "BATCH":
                                        cycle_trades.append({
                                            "type": "SELL",
                                            "symbol": curr_symbol,
                                            "price": price,
                                            "qty": state["qty"],
                                            "pnl": round(pnl, 2),
                                            "entry": state["entry"],
                                            "reason": reason
                                        })
                                    elif notify_mode == "VERBOSE":
                                        sell_msg = notifier.format_trade_msg("SELL", curr_symbol, price, state["qty"], pnl, reason, status="✅ SATIŞ TAMAMLANDI")
                                        notifier.send_message(sell_msg)
                                else:
                                    state_manager.add_log(f"SELL-FAILED: {curr_symbol} | {reason} | Emir reddedildi")
                            except Exception as e:
                                state_manager.add_log(f"ORDER-FAILED: {curr_symbol} SELL: {str(e)[:60]}")
                                fail_msg = f"❌ *SATIŞ HATASI:* {curr_symbol}\n`{str(e)[:100]}`"
                                if notify_mode in ["BATCH", "SILENT"]:
                                    cycle_trades.append({
                                        "type": "ERROR",
                                        "symbol": curr_symbol,
                                        "action": "SELL",
                                        "msg": str(e)[:100]
                                    })
                                elif notify_mode == "VERBOSE":
                                    notifier.send_message(fail_msg)

                await asyncio.sleep(0.1)

            if results:
                # radar_lock is local to backend or state_manager
                # state_manager.radar_data can be updated safely
                state_manager.radar_data["top_picks"] = sorted(results, key=lambda x: x['score'], reverse=True)
            state_manager.radar_data["progress"] = 100

            if cycle_trades:
                notify_mode = state_manager.bot_settings.get("notify_mode", "BATCH")
                if notify_mode == "BATCH":
                    batch_msg = notifier.format_batch_msg(cycle_trades)
                    if batch_msg.strip():
                        await notifier.send_message_async(batch_msg)
                elif notify_mode == "SILENT":
                    errors_only = [t for t in cycle_trades if t.get("type") == "ERROR"]
                    if errors_only:
                        batch_msg = notifier.format_batch_msg(errors_only)
                        if batch_msg.strip():
                            await notifier.send_message_async(batch_msg)

            await asyncio.sleep(2)
            _consecutive_errors = 0

        except Exception as e:
            _consecutive_errors += 1
            try:
                from rich.markup import escape as _rich_escape
                console.print(f"[bold red]RADAR-ERROR:[/bold red] {_rich_escape(str(e))}")
            except Exception:
                print(f"RADAR-ERROR: {e}")
            _delay = min(5 * (2 ** (_consecutive_errors - 1)), 300)
            print(f"[RADAR] Yeniden deneme {_consecutive_errors}. bekleme: {_delay}s")
            await asyncio.sleep(_delay)

# ── TELEGRAM KOMUT İŞLEYİCİ ───────────────────────────────────────────────────
async def force_sell_asset(symbol, reason, tickers=None):
    state = state_manager.bot_settings["fleet_state"].get(symbol)
    if not state: return
    try:
        if not tickers:
            tickers = await trade_executor.fetch_all_tickers_24hr()
        
        price = tickers.get(symbol, {}).get("last", 0)
        if price == 0:
            state_manager.add_log(f"FORCE-SELL-SKIP: {symbol} fiyat=0, satış yapılamadı!")
            notifier.send_message(f"⚠️ {symbol} fiyat alınamadı, satış başarısız!")
            return
        
        _sell_success, _exec_price = await trade_executor.execute_order_smart(symbol, 'sell', state["qty"])
        if _sell_success:
            price = _exec_price
            gross_pnl = (price - state["entry"]) * state["qty"]
            commission = (state["entry"] + price) * state["qty"] * 0.001
            pnl = gross_pnl - commission
            state_manager.db["total_pnl"] = round(state_manager.db.get("total_pnl", 0) + pnl, 2)
            
            # Kâr kumbarası payı (force_sell dahil)
            if pnl > 0:
                _v_share = pnl * 0.20
                state_manager.db["profit_vault"] = round(state_manager.db.get("profit_vault", 0.0) + _v_share, 2)
                state_manager.db["profit_vault_count"] = state_manager.db.get("profit_vault_count", 0) + 1
            
            # Günlük drawdown takibi güncelle
            state_manager.db["_daily_realized_pnl"] = round(
                state_manager.db.get("_daily_realized_pnl", 0.0) + pnl, 2)
            
            # v3.0 FIX: Tüm kayıt ve silme artık if _sell_success İÇİNDE
            state_manager.db.setdefault("trade_log", []).insert(0, {
                "time": state_manager.get_tr_now().strftime("%H:%M:%S"),
                "date": state_manager.get_tr_now().strftime("%Y-%m-%d"),
                "symbol": symbol, "side": "SELL",
                "price": price, "qty": state["qty"], "pnl": round(pnl, 2), "reason": reason,
                "source": state.get("source", "SWING_TRADER"),
                "entry": state["entry"],
                "profit_pct": round(((price - state["entry"]) / state["entry"]) * 100, 2),
            })
            state_manager.append_trade_history(state_manager.db["trade_log"][0])
            state_manager.save_db(state_manager.db)
            
            state_manager.add_log(f"FORCE-SELL: {symbol} | {reason} | PnL: ${pnl:.2f}")
            notifier.send_message(notifier.format_trade_msg("SELL", symbol, price, state["qty"], pnl, reason))
            
            async with _fleet_lock:
                if symbol in state_manager.bot_settings["fleet_state"]:
                    del state_manager.bot_settings["fleet_state"][symbol]
                    state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
        else:
            state_manager.add_log(f"FORCE-SELL-FAILED: {symbol} | Emir reddedildi")
    except Exception as e:
        state_manager.add_log(f"FORCE-SELL-ERROR: {symbol}: {e}")

async def telegram_command_handler(cmd):
    from backend import get_status  # Import status directly from backend server module
    if cmd == "get_status":
        return await get_status()
    elif cmd == "stop_bot":
        state_manager.bot_settings["active"] = False
        state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
        state_manager.add_log("SYSTEM: Telegram üzerinden alımlar DURDURULDU.")
        return True
    elif cmd == "start_bot":
        state_manager.bot_settings["active"] = True
        state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
        state_manager.add_log("SYSTEM: Telegram üzerinden alımlar BAŞLATILDI.")
        return True
    elif cmd == "toggle_active":
        state_manager.bot_settings["active"] = not state_manager.bot_settings["active"]
        state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
        state_lbl = "BAŞLATILDI" if state_manager.bot_settings["active"] else "DURDURULDU"
        state_manager.add_log(f"SYSTEM: Telegram üzerinden alımlar {state_lbl}.")
        return await get_status()
    elif cmd == "toggle_mode":
        current = state_manager.bot_settings.get("personality", "SWING_TRADER")
        new_mode = "AGGRESSIVE_TRADER" if current != "AGGRESSIVE_TRADER" else "SWING_TRADER"
        state_manager.bot_settings["personality"] = new_mode
        state_manager.save_settings()
        state_manager.add_log(f"SWITCH: Mod değişti -> {new_mode}")
        return await get_status()
    elif cmd == "toggle_notifications":
        current = state_manager.bot_settings.get("notify_mode", "BATCH")
        if current == "BATCH":
            new_notify = "SILENT"
        elif current == "SILENT":
            new_notify = "VERBOSE"
        else:
            new_notify = "BATCH"
        state_manager.bot_settings["notify_mode"] = new_notify
        state_manager.save_settings()
        state_manager.add_log(f"SYSTEM: Bildirim modu değişti -> {new_notify}")
        return await get_status()
    elif cmd.startswith("sell_asset:"):
        target = cmd.split(":")[1]
        if target == "HEPSİ":
            held_syms = list(state_manager.bot_settings["fleet_state"].keys())
            if not held_syms:
                notifier.send_message("📭 Botun yönettiği aktif bir pozisyon bulunmuyor.")
                return True
            tickers = await trade_executor.fetch_all_tickers_24hr()
            notifier.send_message(f"🔥 *BOT POZİSYONLARI KAPATILIYOR:* {len(held_syms)} işlem sonlandırılıyor...")
            results = await asyncio.gather(
                *[force_sell_asset(s, "TELEGRAM-BOT-ALL", tickers) for s in held_syms],
                return_exceptions=True
            )
            failed = [str(r) for r in results if isinstance(r, Exception)]
            if failed:
                notifier.send_message(f"⚠️ *TAMAMLANDI:* {len(held_syms) - len(failed)}/{len(held_syms)} pozisyon kapatıldı. {len(failed)} hata oluştu.")
            else:
                notifier.send_message(f"✅ *TAMAMLANDI:* Botun tüm {len(held_syms)} işlemi başarıyla kapatıldı.")
            return True
        else:
            if target in state_manager.bot_settings["fleet_state"]:
                tickers = await trade_executor.fetch_all_tickers_24hr()
                await force_sell_asset(target, "TELEGRAM-MANUAL", tickers)
                return True
    elif cmd == "switch_mode":
        current = state_manager.bot_settings.get("personality", "SWING_TRADER")
        new_mode = "AGGRESSIVE_TRADER" if current != "AGGRESSIVE_TRADER" else "SWING_TRADER"
        state_manager.bot_settings["personality"] = new_mode
        state_manager.save_settings()
        state_manager.add_log(f"SWITCH: Mod değişti -> {new_mode}")
        return {"new_mode": new_mode}
    return False

# ── DİĞER GÖREVLER ────────────────────────────────────────────────────────────
async def copy_trader_task():
    await asyncio.sleep(30)
    while True:
        try:
            import copy_trader as ct
            pending = ct.get_pending_signals()
            for sig in pending:
                action = sig.get("action", "").upper()
                symbol = sig.get("symbol", "")
                reason = sig.get("reason", "COPY_TRADE")
                if not symbol or not action:
                    continue
                if "/" not in symbol:
                    symbol = symbol.replace("USDT", "/USDT")

                state_manager.add_log(f"COPY-SİNYAL: {action} {symbol} ({reason})")

                if not state_manager.bot_settings["active"]:
                    state_manager.add_log("COPY-SKIP: Bot aktif değil")
                    continue
                if state_manager.bot_settings.get("market_halt", False):
                    state_manager.add_log("COPY-SKIP: Market halt aktif")
                    continue

                # Process buys/sells
                # Note: keeping it simple as copy_trader_task is currently a stub or background scanner
        except Exception as e:
            console.print("[dim]Copy trader task error:[/dim]", str(e))
        await asyncio.sleep(10)

async def macro_refresh_task():
    await asyncio.sleep(120)
    while True:
        try:
            await asyncio.to_thread(refresh_macro_params)
        except Exception as e:
            console.print("[dim]Makro yenileme hata:[/dim]", str(e))
        await asyncio.sleep(4 * 3600)

async def scanner_refresh_task():
    await asyncio.sleep(5)
    while True:
        try:
            state_manager.add_log("SCANNER: Katman 2 taraması başlıyor...")
            await asyncio.to_thread(refresh_scanner_coins, True)
            state_manager.add_log(f"SCANNER: {len(_scanner_coins)} coin seçildi -> radar güncellendi")
        except Exception as e:
            console.print("[dim]Scanner yenileme hata:[/dim]", str(e))
        await asyncio.sleep(3600)

async def signal_tracker_task():
    await asyncio.sleep(60)
    while True:
        try:
            import signal_tracker
            result = await asyncio.to_thread(signal_tracker.update_signals)
            # v3.1: Etiketleme sonucunu logla
            if isinstance(result, dict) and result.get("new_24h_labels", 0) > 0:
                n = result["new_24h_labels"]
                state_manager.add_log(f"TRACKER: {n} yeni sinyal 24h etiketi aldı")
        except Exception as e:
            console.print("[dim]Signal tracker hata:[/dim]", str(e)[:50])
        await asyncio.sleep(600)

async def daily_report_task():
    from report_engine import generate_daily_report
    while True:
        try:
            now = state_manager.get_tr_now()
            if now.hour == 0 and now.minute == 1:
                summary = await asyncio.to_thread(generate_daily_report)
                if summary:
                    state_manager.add_log("REPORT: Günlük özet raporu oluşturuldu.")
                    notifier.send_message(summary)
                await asyncio.sleep(120)
        except Exception as e:
            console.print("[dim]Rapor görevi hatası:[/dim]", str(e))
        await asyncio.sleep(30)

async def billing_reminder_task():
    """Sends a Telegram notification daily for AWS trial check and monthly for billing reminder."""
    await asyncio.sleep(30)  # Wait for startup
    while True:
        try:
            now = state_manager.get_tr_now()
            # Send daily trial reminder & billing check at 12:00 PM (noon) to avoid disturbance
            if now.hour == 12 and now.minute == 0:
                last_trial_reminder = state_manager.db.get("last_trial_reminder_date", "")
                current_date_str = now.strftime("%Y-%m-%d") # e.g. "2026-07-16"
                
                if last_trial_reminder != current_date_str:
                    # Send trial reminder
                    trial_end_str = state_manager.bot_settings.get("free_trial_end_date", "2027-05-07")
                    try:
                        from datetime import datetime as dt
                        trial_end = dt.strptime(trial_end_str, "%Y-%m-%d")
                        diff = trial_end - now
                        days_left = diff.days
                        
                        if days_left >= 0:
                            msg = "ℹ️ *AWS ÜCRETSİZ DENEME KONTROLÜ*\n"
                            msg += "-------------------------------------\n"
                            msg += f"📅 Sunucunuzun ücretsiz deneme bitiş tarihi: `{trial_end_str}`\n"
                            msg += f"⏳ Kalan süre: *{days_left} gün*\n\n"
                            msg += "_Not: Ücretsiz deneme bittiğinde ücretlendirme başlamaması için AWS konsolunuzu kontrol etmeyi unutmayın._"
                            notifier.send_message(msg)
                            state_manager.add_log(f"Telegram deneme süresi hatırlatması gönderildi (Kalan: {days_left} gün).")
                    except Exception as ex:
                        console.print("[dim]Deneme süresi hesaplama hatası:[/dim]", str(ex))
                    
                    # Last day of month check: tomorrow's month is different from today's month
                    from datetime import timedelta
                    tomorrow = now + timedelta(days=1)
                    if tomorrow.month != now.month:
                        last_billing = state_manager.db.get("last_billing_reminder_month", "")
                        current_month_str = now.strftime("%Y-%m")
                        if last_billing != current_month_str:
                            msg_bill = "⚠️ *ANTIGRAVITY AI - SUNUCU FATURALANDIRMA UYARISI*\n"
                            msg_bill += "-------------------------------------\n"
                            msg_bill += "📅 Bugün ayın son günü! Sunucu ücretlendirmesini kontrol etmeyi unutmayın.\n"
                            msg_bill += "💡 Gereksiz faturalandırmayı önlemek için kullanmadığınız servisleri kapatabilir veya AWS faturalarınızı kontrol edebilirsiniz."
                            notifier.send_message(msg_bill)
                            state_manager.add_log("Telegram fatura hatırlatma mesajı gönderildi.")
                            state_manager.db["last_billing_reminder_month"] = current_month_str
                    
                    state_manager.db["last_trial_reminder_date"] = current_date_str
                    state_manager.save_db(state_manager.db)
                    
                    # Cooldown for 60 seconds to avoid repeating
                    await asyncio.sleep(65)
        except Exception as e:
            console.print("[dim]Fatura hatırlatma görevi hatası:[/dim]", str(e))
        await asyncio.sleep(30)


async def auto_train_ml_task():
    """Checks signal log and automatically retrains XGBoost if new data accumulates."""
    await asyncio.sleep(60)  # startup delay
    _last_telegram_status = 0  # Son Telegram durum bildirimi zamanı
    
    while True:
        try:
            if not os.path.exists("signal_log.json"):
                await asyncio.sleep(900)
                continue
                
            with open("signal_log.json", encoding="utf-8") as f:
                signals = json.load(f)
            
            # v3.0: Hem 24h etiketli sinyaller hem de trade_history'den eğitim
            target_key = "24h"
            labeled = [s for s in signals if target_key in s.get("checks", {}) and "features" in s]
            total_labeled_count = len(labeled)
            
            # Etiketlenmemiş ama features olan sinyalleri de say
            unlabeled_with_features = [s for s in signals if "features" in s and target_key not in s.get("checks", {})]
            
            trained_samples = 0
            last_trained_at = "Hiç"
            if os.path.exists("signal_filter_meta.json"):
                try:
                    with open("signal_filter_meta.json", encoding="utf-8") as f:
                        meta = json.load(f)
                    trained_samples = meta.get("train_samples", 0)
                    last_trained_at = meta.get("trained_at", "Bilinmiyor")
                except Exception:
                    pass
            
            fark = total_labeled_count - trained_samples
            kalan = max(0, 25 - fark)
            
            # v3.1: Her kontrolde detaylı logla
            state_manager.add_log(
                f"ML-CHECK: Etiketli={total_labeled_count}, "
                f"Bekleyen={len(unlabeled_with_features)}, "
                f"SonEğitim={trained_samples}, "
                f"Sayaç={fark}/25, Kalan={kalan}"
            )
            
            # v3.1: Her 6 saatte bir Telegram'a durum bildir
            import time as _time
            _now = _time.time()
            if _now - _last_telegram_status >= 21600:  # 6 saat
                _last_telegram_status = _now
                _status_emoji = "🟢 Eğitim yakında!" if fark >= 20 else "⏸️ Birikim devam ediyor"
                notifier.send_message(
                    "🧠 *ML EĞİTİM DURUMU*\n"
                    "━━━━━━━━━━━━━━━━━━━━━\n"
                    f"📊 Etiketli sinyal: `{total_labeled_count}`\n"
                    f"⏳ Bekleyen (24h): `{len(unlabeled_with_features)}`\n"
                    f"🔄 Sayaç: `{fark}/25` yeni sinyal\n"
                    f"📅 Son eğitim: `{last_trained_at}`\n"
                    f"{_status_emoji}"
                )
            
            if total_labeled_count >= 50 and fark >= 25:
                state_manager.add_log(
                    f"ML-AUTOTRAIN: Eğitim başlatılıyor! "
                    f"Toplam={total_labeled_count}, Yeni={fark}"
                )
                notifier.send_message(
                    "🔄 *ML EĞİTİM BAŞLADI*\n"
                    f"📊 Toplam veri: `{total_labeled_count}` sinyal\n"
                    f"🆕 Yeni veri: `{fark}` sinyal\n"
                    "⏳ Lütfen bekleyin..."
                )
                
                import train_model
                import importlib
                importlib.reload(train_model)
                
                res = await asyncio.to_thread(train_model.run_autotrain_logic, min_auc=0.55)
                
                if res and res.get("success"):
                    new_auc = res.get("auc", 0.0)
                    new_count = res.get("train_samples", 0)
                    cv_auc = res.get("cv_auc")
                    cv_str = f", CV: {cv_auc:.3f}" if cv_auc is not None else ""
                    
                    # Modeli yeniden yükle
                    load_ml_model()
                    
                    # v3.1: Doğrulama mesajı
                    _verify_msg = ""
                    if ml_model is not None:
                        _verify_msg = f"\n✅ *Doğrulama:* Model {ml_model_n_features} feature ile yüklendi"
                    
                    state_manager.add_log(
                        f"ML-AUTOTRAIN-SUCCESS: Veri={new_count}, "
                        f"AUC={new_auc:.3f}{cv_str}, "
                        f"Features={ml_model_n_features}"
                    )
                    
                    notifier.send_message(
                        "🤖 *ML MODEL EĞİTİM TAMAMLANDI* ✅\n"
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        f"📊 *Eğitim Verisi:* `{new_count}` sinyal\n"
                        f"📈 *ROC-AUC:* `{new_auc:.3f}`{cv_str}\n"
                        f"🔢 *Feature Sayısı:* `{ml_model_n_features}`"
                        f"{_verify_msg}\n"
                        "🔄 *Durum:* Yeni model aktif!"
                    )
                else:
                    reason = res.get("reason", "Bilinmeyen hata") if res else "Eğitim sonucu alınamadı"
                    state_manager.add_log(f"ML-AUTOTRAIN-FAILED: {reason}")
                    
                    # v3.1: Başarısız eğitimi de Telegram'a bildir
                    notifier.send_message(
                        "⚠️ *ML EĞİTİM BAŞARISIZ*\n"
                        "━━━━━━━━━━━━━━━━━━━━━\n"
                        f"❌ *Neden:* `{reason[:200]}`\n"
                        f"📊 *Veri:* `{total_labeled_count}` sinyal\n"
                        "🔄 15dk sonra tekrar denenecek."
                    )
                    
        except Exception as e:
            console.print("[dim]ML auto-train task error:[/dim]", str(e))
            state_manager.add_log(f"ML-AUTOTRAIN-ERROR: {str(e)[:100]}")
            try:
                notifier.send_message(
                    f"🚨 *ML AUTOTRAIN KRİTİK HATA*\n"
                    f"❌ `{str(e)[:200]}`"
                )
            except Exception:
                pass
            
        await asyncio.sleep(900)  # Check every 15 minutes


async def weekly_report_task():
    """Her Pazar 09:00 TR saatinde haftalık analiz raporu üretir ve JSON olarak kaydeder."""
    await asyncio.sleep(60)
    while True:
        try:
            now = state_manager.get_tr_now()
            # Pazar (weekday=6) ve saat 09:00
            if now.weekday() == 6 and now.hour == 9 and now.minute == 0:
                last_sent = state_manager.db.get("last_weekly_report_date", "")
                this_sunday = now.strftime("%Y-%m-%d")
                if last_sent == this_sunday:
                    await asyncio.sleep(120)
                    continue

                from datetime import timedelta
                week_start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
                week_end   = now.strftime("%Y-%m-%d")

                all_trades  = state_manager.db.get("trade_log", [])
                week_trades = [t for t in all_trades if week_start <= t.get("date", "") <= week_end]
                sells       = [t for t in week_trades if t.get("side") in ["SELL", "SELL-ALL", "PARTIAL-SELL"]]

                total_trades  = len(sells)
                winning       = [t for t in sells if (t.get("pnl") or 0) > 0]
                losing        = [t for t in sells if (t.get("pnl") or 0) < 0]
                total_pnl_usd = sum(t.get("pnl", 0) for t in sells)
                rate          = trade_executor.get_usdt_try_rate()
                total_pnl_try = total_pnl_usd * rate
                win_rate      = round(len(winning) / total_trades * 100, 1) if total_trades > 0 else 0

                # Coin başı zarar özeti
                from collections import defaultdict
                coin_pnl   = defaultdict(float)
                coin_count = defaultdict(int)
                for t in losing:
                    sym = t.get("symbol", "?")
                    coin_pnl[sym]   += t.get("pnl", 0)
                    coin_count[sym] += 1
                top_losers = sorted(coin_pnl.items(), key=lambda x: x[1])[:5]

                # Coin başı kâr özeti
                coin_win_pnl = defaultdict(float)
                for t in winning:
                    sym = t.get("symbol", "?")
                    coin_win_pnl[sym] += t.get("pnl", 0)
                top_winners = sorted(coin_win_pnl.items(), key=lambda x: x[1], reverse=True)[:3]

                # JSON raporu kaydet (Antigravity AI ile analiz için)
                report_data = {
                    "rapor_tarihi":           this_sunday,
                    "hafta_baslangic":        week_start,
                    "hafta_bitis":            week_end,
                    "toplam_islem":           total_trades,
                    "kazanilan":              len(winning),
                    "kaybedilen":             len(losing),
                    "win_rate_pct":           win_rate,
                    "net_pnl_usd":            round(total_pnl_usd, 2),
                    "net_pnl_try":            round(total_pnl_try, 2),
                    "en_cok_zarar_coinler":   [{"symbol": s, "pnl_usd": round(p, 2), "islem_sayisi": coin_count[s]} for s, p in top_losers],
                    "en_cok_kar_coinler":     [{"symbol": s, "pnl_usd": round(p, 2)} for s, p in top_winners],
                    "tum_islemler":           sells
                }

                report_path = f"weekly_report_{this_sunday}.json"
                with open(report_path, "w", encoding="utf-8") as f:
                    json.dump(report_data, f, ensure_ascii=False, indent=2)

                state_manager.db["last_weekly_report_date"] = this_sunday
                state_manager.save_db(state_manager.db)

                # ── Telegram mesajı — Modern Çerçevesiz Monospace & %100 TL ──
                pnl_sign  = "+" if total_pnl_try >= 0 else ""
                pnl_emoji = "🟢" if total_pnl_try >= 0 else "🔴"
                wr_emoji  = "🏆" if win_rate >= 55 else ("⚠️" if win_rate >= 40 else "🚨")

                def _fmt_try(val, dec=2):
                    abs_v = abs(val)
                    if dec == 0:
                        return f"{abs_v:,.0f}".replace(",", ".")
                    return f"{abs_v:,.{dec}f}".replace(",", "X").replace(".", ",").replace("X", ".")

                # Portföy değeri
                _start_bal = state_manager.db.get("start_balance", 50000.0)
                _realized = state_manager.db.get("total_pnl", 0.0)
                _portfolio_try = _start_bal + (_realized * rate)
                _vault_usd = state_manager.db.get("profit_vault", 0.0)
                _vault_try = _vault_usd * rate

                msg  = f"📊 *HAFTALIK ANALİZ RAPORU*\n"
                msg += f"📅 _{week_start} → {week_end}_\n\n"

                msg += "📦 *İŞLEM ÖZETİ*\n"
                msg += "```\n"
                msg += f"• Toplam İşlem     : {total_trades} adet\n"
                msg += f"• Kârlı İşlem      : ✅ {len(winning)} adet\n"
                msg += f"• Zararlı İşlem    : ❌ {len(losing)} adet\n"
                msg += f"• Başarı Oranı     : {wr_emoji} %{win_rate}\n"
                msg += "```\n\n"

                msg += "💰 *FİNANSAL ÖZET*\n"
                msg += "```\n"
                msg += f"• Haftalık Net K/Z : {pnl_emoji} {pnl_sign}{_fmt_try(total_pnl_try)} ₺\n"
                msg += f"• Portföy Değeri   : {_fmt_try(_portfolio_try)} ₺\n"
                msg += f"• Kumbara Birikimi : 🏦 {_fmt_try(_vault_try)} ₺\n"
                msg += "```\n"

                if top_losers:
                    msg += "\n🔴 *EN ÇOK ZARAR ÇIKARAN COİNLER*\n"
                    msg += "```\n"
                    for sym, pnl_val in top_losers:
                        cnt = coin_count[sym]
                        s_name = str(sym).split('/')[0][:6]
                        msg += f"• {s_name:<6} {_fmt_try(pnl_val*rate, 0):>7} ₺  ({cnt}x)\n"
                    msg += "```\n"

                if top_winners:
                    msg += "\n🟢 *EN İYİ PERFORMANS*\n"
                    msg += "```\n"
                    for sym, pnl_val in top_winners:
                        s_name = str(sym).split('/')[0][:6]
                        msg += f"• {s_name:<6} +{_fmt_try(pnl_val*rate, 0):>7} ₺\n"
                    msg += "```"

                notifier.send_message(msg)
                state_manager.add_log(f"WEEKLY-REPORT: Haftalık rapor gönderildi ({this_sunday}). JSON: {report_path}")
                await asyncio.sleep(120)
        except Exception as e:
            console.print("[dim]Haftalık rapor görevi hatası:[/dim]", str(e))
        await asyncio.sleep(30)
