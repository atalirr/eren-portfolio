"""
ANTIGRAVITY AI - Adaptive Regime-Switching Backtest Runner
==========================================================
Scoring engine'deki rejim tespitini kullanarak
her coin'in her anindaki piyasa kosuluna gore
farkli parametrelerle islem acar/kapatir.

Calistirma: python backtest_runner.py
Sure: ~5-15 dakika (sembol sayisina gore)
"""

import sys
import codecs
sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer)
sys.stderr = codecs.getwriter("utf-8")(sys.stderr.buffer)

import ccxt
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
import json
import time
import os
import warnings
from dotenv import load_dotenv
from indicators import compute_all_indicators

warnings.filterwarnings("ignore")
load_dotenv()

# -- AYARLAR --
TEST_SYMBOLS = [
    "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT",
    "XRP/USDT", "ADA/USDT", "AVAX/USDT", "DOGE/USDT",
    "DOT/USDT", "LINK/USDT",
]

# v3.0: Tek strateji — SWING_TRADER (eski SCALPER/DEGEN/AUTO kaldırıldı)
PERSONALITY = "SWING_TRADER"

TIMEFRAME        = "4h"
LOOKBACK_DAYS    = int(sys.argv[1]) if len(sys.argv) > 1 else 365
CAPITAL_PER_TRADE= 100.0
COMMISSION       = 0.001   # %0.1 Binance taker fee

# Sabit esikler artik yok!
# Her bar'da rejim tespiti yapilip dinamik parametreler kullanilir.
# --

exchange = ccxt.binance({
    "enableRateLimit": True,
    "options": {"defaultType": "spot"},
    "timeout": 30000,
})


def fetch_ohlcv(symbol: str, days: int) -> pd.DataFrame:
    """Binance'ten gecmis OHLCV verisi cek."""
    since = exchange.parse8601(
        (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT00:00:00Z")
    )
    bars = []
    while True:
        chunk = exchange.fetch_ohlcv(symbol, TIMEFRAME, since=since, limit=1000)
        if not chunk:
            break
        bars.extend(chunk)
        since = chunk[-1][0] + 1
        if len(chunk) < 1000:
            break
        time.sleep(0.3)

    df = pd.DataFrame(bars, columns=["time", "open", "high", "low", "close", "volume"])
    df["time"] = pd.to_datetime(df["time"], unit="ms")
    return df


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Scoring engine ile ayni indikatorleri hesapla + rejim tespiti yap."""
    return compute_all_indicators(df)


def detect_regime(row, df_slice):
    """Rejim tespiti (scoring_engine v2.5 ile aynı mantık)."""
    adx     = float(row['adx'])     if not np.isnan(row['adx'])     else 0
    plus_di = float(row['plus_di']) if not np.isnan(row['plus_di']) else 0
    minus_di= float(row['minus_di'])if not np.isnan(row['minus_di'])else 0
    atr_pct = float(row['atr_pct']) if not np.isnan(row['atr_pct']) else 0

    recent_atr = float(df_slice['atr_pct'].tail(20).mean()) if len(df_slice) >= 20 else atr_pct
    if np.isnan(recent_atr):
        recent_atr = atr_pct

    if recent_atr > 3.0:
        return 'HIGH_VOL'
    # v2.5: ADX eşiği 22
    if adx > 22:
        return 'TRENDING_UP' if plus_di > minus_di else 'TRENDING_DOWN'
    return 'CHOPPY'


def get_regime_params(regime):
    """
    SWING_TRADER v2.5 — 4h timeframe, rejime özel parametreler.
    """
    if regime == 'TRENDING_UP':
        return {'buy_thresh': 68, 'sell_thresh': 45, 'atr_mult': 2.5, 'take_profit': 5.0,  'can_buy': True,  'strategy': 'MOMENTUM_SWING'}
    elif regime == 'TRENDING_DOWN':
        return {'buy_thresh': 78, 'sell_thresh': 65, 'atr_mult': 2.0, 'take_profit': 3.0,  'can_buy': True,  'strategy': 'OVERSOLD_BOUNCE'}
    elif regime == 'CHOPPY':
        return {'buy_thresh': 66, 'sell_thresh': 52, 'atr_mult': 2.5, 'take_profit': 5.0,  'can_buy': True,  'strategy': 'MEAN_REVERSION'}
    else:  # HIGH_VOL
        return {'buy_thresh': 70, 'sell_thresh': 55, 'atr_mult': 3.0, 'take_profit': 8.0,  'can_buy': True,  'strategy': 'WIDE_STOPS'}


def compute_bar_score(row, prev_row, regime):
    """Rejime gore skor hesapla (scoring_engine mantigi)."""
    rsi  = float(row['rsi'])    if not np.isnan(row['rsi'])    else 50
    sk   = float(row['stoch_k'])if not np.isnan(row['stoch_k'])else 50
    sd   = float(row['stoch_d'])if not np.isnan(row['stoch_d'])else 50
    bb   = float(row['bb_pct']) if not np.isnan(row['bb_pct']) else 0.5
    zs   = float(row['z_score'])if not np.isnan(row['z_score'])else 0
    vr   = float(row['vol_ratio'])if not np.isnan(row['vol_ratio'])else 1
    h_now  = float(row['macd_hist'])  if not np.isnan(row['macd_hist'])  else 0
    h_prev = float(prev_row['macd_hist']) if not np.isnan(prev_row['macd_hist']) else 0
    pdi  = float(row['plus_di']) if not np.isnan(row['plus_di']) else 0
    mdi  = float(row['minus_di'])if not np.isnan(row['minus_di'])else 0

    score = 0

    if regime == 'TRENDING_UP':
        # EMA hizalamasi (30)
        if row['ema9']  > row['ema20']:  score += 10
        if row['ema20'] > row['ema50']:  score += 10
        if row['ema50'] > row['ema200']: score += 10
        # MACD (25)
        if h_now > 0 and h_now > h_prev:  score += 25
        elif h_now > 0:                   score += 15
        elif h_now > h_prev:              score += 10
        # RSI (20)
        if 40 < rsi < 65:   score += 20
        elif 30 < rsi < 75: score += 10
        # Volume (15)
        if vr > 1.5:   score += 15
        elif vr > 1.0: score += 8
        # DI (10)
        if pdi > mdi * 1.5: score += 10
        elif pdi > mdi:     score += 5

    elif regime == 'TRENDING_DOWN':
        # RSI oversold (30)
        if rsi < 25:   score += 30
        elif rsi < 35: score += 20
        elif rsi < 45: score += 5
        # Stoch RSI (25)
        if sk < 15 and sd < 15:   score += 25
        elif sk < 25 and sk > sd: score += 15
        elif sk < 40 and sk > sd: score += 5
        # Bollinger (20)
        if bb < 0.05:  score += 20
        elif bb < 0.15:score += 12
        elif bb < 0.25:score += 5
        # Z-Score (15)
        if zs < -2.0:   score += 15
        elif zs < -1.5: score += 10
        elif zs < -1.0: score += 5
        # Volume (10)
        if vr > 2.0:   score += 10
        elif vr > 1.5: score += 5

    elif regime == 'CHOPPY':
        # Z-Score (30)
        if zs < -2.0:   score += 30
        elif zs < -1.5: score += 22
        elif zs < -1.0: score += 12
        elif zs < -0.5: score += 5
        # Bollinger (25)
        if bb < 0.05:  score += 25
        elif bb < 0.15:score += 18
        elif bb < 0.25:score += 10
        elif bb < 0.35:score += 3
        # RSI (25)
        if rsi < 30:   score += 25
        elif rsi < 38: score += 18
        elif rsi < 45: score += 8
        # Stoch (10)
        if sk < 20 and sk > sd: score += 10
        elif sk < 30:           score += 5
        # Volume (10)
        if vr > 1.5: score += 10
        elif vr > 1.0: score += 3

    else:  # HIGH_VOL
        # RSI (25)
        if rsi < 25:   score += 25
        elif rsi < 32: score += 15
        elif rsi < 40: score += 5
        # Stoch (25)
        if sk < 10 and sd < 15: score += 25
        elif sk < 20 and sk > sd: score += 15
        # Z-Score (20)
        if zs < -2.5:  score += 20
        elif zs < -2.0:score += 12
        elif zs < -1.5:score += 5
        # MACD (15)
        if h_now > 0 and h_prev <= 0: score += 15
        elif h_now > h_prev:          score += 8
    # v2.5 Extension penalty
    ext_penalty = 0.0
    if zs > 2.5:     ext_penalty += 25
    elif zs > 1.5:   ext_penalty += 12
    elif zs > 1.0:   ext_penalty += 5

    if rsi > 78:     ext_penalty += 20
    elif rsi > 72:   ext_penalty += 12
    elif rsi > 68:   ext_penalty += 5

    try:
        ema20 = float(row['ema20'])
        price = float(row['close'])
        if ema20 > 0 and price > 0:
            dist = (price - ema20) / ema20 * 100
            if dist > 8:     ext_penalty += 15
            elif dist > 4:   ext_penalty += 8
            elif dist > 2.5: ext_penalty += 3
    except Exception:
        pass

    if regime == 'TRENDING_UP':
        ext_penalty *= 0.5

    raw_score = score - ext_penalty
    return max(0, min(round(raw_score, 1), 100))


def run_backtest(symbol: str, df: pd.DataFrame) -> dict:
    """Rejim-adaptive backtest simulasyonu."""
    df = df.dropna().reset_index(drop=True)
    if len(df) < 300:
        return None

    position = None
    trades   = []
    balance  = 0.0
    last_exit_bar = None  # Cooldown takibi
    regime_stats = {"TRENDING_UP": 0, "TRENDING_DOWN": 0, "CHOPPY": 0, "HIGH_VOL": 0}

    for i in range(200, len(df)):
        row      = df.iloc[i]
        prev_row = df.iloc[i-1]
        price    = row["close"]

        # Her barda rejim tespit et
        df_slice = df.iloc[max(0, i-50):i+1]
        regime   = detect_regime(row, df_slice)
        params   = get_regime_params(regime)
        score    = compute_bar_score(row, prev_row, regime)

        regime_stats[regime] = regime_stats.get(regime, 0) + 1

        # -- ALIM --
        if position is None and params.get('can_buy', True) and score >= params['buy_thresh']:
            # Son islemden en az 6 bar gecmis olmali (overtrading onlemi)
            if last_exit_bar is not None and (i - last_exit_bar) < 6:
                pass  # Cooldown - henuz erken
            else:
                # ATR degerini kaydet (dinamik stop icin)
                current_atr_pct = float(row['atr_pct']) if not np.isnan(row['atr_pct']) else 1.5
                qty = CAPITAL_PER_TRADE / (price * (1 + COMMISSION))
                position = {
                    "entry":    price,
                    "peak":     price,
                    "qty":      qty,
                    "bar_idx":  i,
                    "time":     row["time"],
                    "regime":   regime,
                    "atr_pct":  current_atr_pct,
                }

        # -- SATIS --
        elif position is not None:
            if price > position["peak"]:
                position["peak"] = price

            drop       = (position["peak"] - price) / position["peak"] * 100
            profit_pct = (price - position["entry"]) / position["entry"] * 100

            # ATR-based dinamik trailing stop
            # Piyasanin kendi volatilitesini kullan, sabit % degil
            current_atr = float(row['atr_pct']) if not np.isnan(row['atr_pct']) else position['atr_pct']
            # Giris ve guncel ATR'nin ortalamasini al (daha stabil)
            avg_atr = (position['atr_pct'] + current_atr) / 2
            dynamic_trail = avg_atr * params['atr_mult']
            # Minimum %1.5, maksimum %10 siniri koy
            dynamic_trail = max(1.5, min(10.0, dynamic_trail))

            # Cikis onceligi: 1) Take profit, 2) ATR trailing, 3) Timeout, 4) Score drop
            sell_ok   = False
            reason    = ""
            hold_bars = i - position["bar_idx"]

            if profit_pct >= params['take_profit']:
                sell_ok = True
                reason  = "TAKE_PROFIT_%s" % regime
            elif drop >= dynamic_trail:
                sell_ok = True
                reason  = "ATR_TRAIL_%s" % regime
            elif hold_bars >= 18:
                # Zaman aşımı: 18×4h = 72 saatte TP'ye ulaşılamadıysa çık
                # Sürüklenen pozisyon ATR tuzağına düşmeden temizlenir
                sell_ok = True
                reason  = "TIMEOUT_%s" % regime
            elif score < params['sell_thresh']:
                sell_ok = True
                reason  = "SCORE_DROP_%s" % regime

            if sell_ok:
                sell_price = price * (1 - COMMISSION)
                buy_price  = position["entry"] * (1 + COMMISSION)
                pnl        = (sell_price - buy_price) * position["qty"]
                pnl_pct    = (sell_price - buy_price) / buy_price * 100
                # hold_bars zaten yukarıda hesaplandı
                balance   += pnl

                trades.append({
                    "symbol":     symbol,
                    "entry_time": str(position["time"]),
                    "exit_time":  str(row["time"]),
                    "entry":      round(buy_price,  6),
                    "exit":       round(sell_price, 6),
                    "pnl":        round(pnl,     2),
                    "pnl_pct":    round(pnl_pct, 2),
                    "hold_bars":  hold_bars,
                    "reason":     reason,
                    "entry_regime": position["regime"],
                    "exit_regime":  regime,
                })
                last_exit_bar = i
                position = None

    if not trades:
        return None

    wins     = [t for t in trades if t["pnl"] > 0]
    losses   = [t for t in trades if t["pnl"] <= 0]
    win_rate = len(wins) / len(trades) * 100
    avg_win  = np.mean([t["pnl_pct"] for t in wins])   if wins   else 0
    avg_loss = np.mean([t["pnl_pct"] for t in losses]) if losses else 0
    profit_f = abs(avg_win / avg_loss) if avg_loss != 0 else float("inf")

    # Beklenti (Expectancy): pozitifse strateji kârli, negatifse zararlı
    wr_dec      = win_rate / 100
    expectancy  = (wr_dec * avg_win) - ((1 - wr_dec) * abs(avg_loss))

    # Risk/Reward oranı
    rr_ratio    = abs(avg_win / avg_loss) if avg_loss != 0 else float("inf")

    pnl_series  = pd.Series([t["pnl"] for t in trades])
    cum_pnl     = pnl_series.cumsum()
    rolling_max = cum_pnl.cummax()
    drawdown    = cum_pnl - rolling_max
    max_dd      = drawdown.min()

    avg_hold = np.mean([t["hold_bars"] for t in trades])

    return {
        "symbol":        symbol,
        "total_trades":  len(trades),
        "win_rate":      round(win_rate, 1),
        "total_pnl":     round(balance, 2),
        "avg_win_pct":   round(avg_win, 2),
        "avg_loss_pct":  round(avg_loss, 2),
        "profit_factor": round(profit_f, 2),
        "expectancy":    round(expectancy, 3),   # % per trade — pozitif olmalı
        "rr_ratio":      round(rr_ratio, 2),     # 2.0+ hedef
        "max_drawdown":  round(max_dd, 2),
        "avg_hold_h":    round(avg_hold, 1),
        "regime_stats":  regime_stats,
        "trades":        trades,
    }


def print_summary(results: list):
    """Sonuclari tabloya bas."""
    print("\n" + "=" * 90)
    print("  ANTIGRAVITY AI - ADAPTIVE REGIME BACKTEST SONUCLARI v2.1")
    print("=" * 90)
    print("  %-12s %6s %7s %10s %8s %7s %8s %9s" % (
        "SEMBOL", "ISLEM", "WIN%", "TOPLAM PNL", "R/R", "BEKLENTI", "MAX DD", "ORT.SURE"))
    print("-" * 90)

    total_pnl    = 0
    total_trades = 0
    for r in sorted(results, key=lambda x: x["total_pnl"], reverse=True):
        emoji    = "[+]" if r["total_pnl"] > 0 else "[-]"
        pnl_s    = "%+.2f$" % r["total_pnl"]
        exp_s    = "%+.2f%%" % r.get("expectancy", 0)
        rr_s     = "1:%.2f" % r.get("rr_ratio", 0)
        print("  %s %-11s %6d %6.1f%% %10s %8s %7s %7.2f$ %8.1fh" % (
            emoji, r["symbol"], r["total_trades"], r["win_rate"], pnl_s,
            rr_s, exp_s, r["max_drawdown"], r["avg_hold_h"]))
        total_pnl    += r["total_pnl"]
        total_trades += r["total_trades"]

    print("-" * 90)
    wins_all  = sum(1 for r in results for t in r["trades"] if t["pnl"] > 0)
    total_all = sum(len(r["trades"]) for r in results)
    overall_wr = wins_all / total_all * 100 if total_all else 0
    all_exp    = np.mean([r.get("expectancy", 0) for r in results])
    all_rr     = np.mean([r.get("rr_ratio", 0) for r in results])
    print("  %-12s %6d %6.1f%% %+10.2f$   1:%.2f  %+6.2f%%" % (
        "TOPLAM", total_trades, overall_wr, total_pnl, all_rr, all_exp))
    print("=" * 90)

    # Rejim dagilimi
    print("\n  [REJIM DAGILIMI]")
    all_regimes = {"TRENDING_UP": 0, "TRENDING_DOWN": 0, "CHOPPY": 0, "HIGH_VOL": 0}
    for r in results:
        for k, v in r.get("regime_stats", {}).items():
            all_regimes[k] = all_regimes.get(k, 0) + v
    total_bars = sum(all_regimes.values()) or 1
    for regime, count in sorted(all_regimes.items(), key=lambda x: -x[1]):
        pct = count / total_bars * 100
        print("  %-16s %6d bar (%5.1f%%)" % (regime, count, pct))

    # Cikis sebepleri analizi
    print("\n  [CIKIS SEBEPLERI]")
    reason_pnl = {}
    reason_cnt = {}
    for r in results:
        for t in r["trades"]:
            reason_base = t["reason"].split("_")[0]  # TRAILING, SCORE, TAKE
            reason_pnl[reason_base] = reason_pnl.get(reason_base, 0) + t["pnl"]
            reason_cnt[reason_base] = reason_cnt.get(reason_base, 0) + 1
    for reason in sorted(reason_pnl.keys()):
        cnt = reason_cnt[reason]
        pnl = reason_pnl[reason]
        avg = pnl / cnt if cnt else 0
        print("  %-12s %4d islem  toplam: %+8.2f$  ort: %+6.2f$" % (reason, cnt, pnl, avg))

    # Model degerlendirmesi
    print("\n  [MODEL DEGERLENDIRMESI]")
    positive = sum(1 for r in results if r["total_pnl"] > 0)

    # v2.1: Beklenti ve R/R da değerlendirmeye dahil
    if all_exp > 0 and all_rr >= 2.0 and overall_wr >= 45 and positive >= len(results) * 0.6:
        verdict = "[GUCLU] Model gercek piyasada test edilmeye hazir"
    elif all_exp > 0 and all_rr >= 1.5 and overall_wr >= 40:
        verdict = "[ORTA]  Daha fazla veriyle dogrulanmasi onerilir"
    elif all_exp > 0:
        verdict = "[ZAYIF-POS] Beklenti pozitif ama R/R veya WR yetersiz"
    else:
        verdict = "[ZAYIF] Beklenti negatif — strateji gozden gecirilmeli"

    print("  Win Rate    : %.1f%% (hedef >= 45%%)" % overall_wr)
    print("  R/R Orani   : 1:%.2f  (hedef >= 1:2.0)" % all_rr)
    print("  Beklenti    : %+.2f%% per islem (hedef > 0)" % all_exp)
    print("  Karli Sembol: %d/%d (hedef >= %%60)" % (positive, len(results)))
    print("  Net PnL     : $%+.2f (%d gun, %d sembol)" % (total_pnl, LOOKBACK_DAYS, len(TEST_SYMBOLS)))
    print("  Sonuc       : %s" % verdict)
    print()


def main():
    print("\n  ADAPTIVE REGIME BACKTEST BASLIYOR")
    print("  %d gun, %d sembol, Mod: %s\n" % (LOOKBACK_DAYS, len(TEST_SYMBOLS), PERSONALITY))

    results = []
    for sym in TEST_SYMBOLS:
        try:
            print("  [%s] veri cekiliyor..." % sym, end=" ", flush=True)
            df = fetch_ohlcv(sym, LOOKBACK_DAYS)
            print("%d mum, hesaplaniyor..." % len(df), end=" ", flush=True)
            df = compute_indicators(df)
            result = run_backtest(sym, df)
            if result:
                results.append(result)
                print("[OK] %d islem, $%+.2f" % (result["total_trades"], result["total_pnl"]))
            else:
                print("yetersiz veri, atlandi")
            time.sleep(0.5)
        except Exception as e:
            print("HATA: %s" % e)

    if not results:
        print("Hic sonuc uretilemedi.")
        return

    print_summary(results)

    # JSON'a kaydet
    out = {
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "config": {
            "mode": "ADAPTIVE_REGIME",
            "personality": PERSONALITY,
            "lookback_days": LOOKBACK_DAYS,
            "regime_params": {
                "TRENDING_UP":   get_regime_params("TRENDING_UP"),
                "TRENDING_DOWN": get_regime_params("TRENDING_DOWN"),
                "CHOPPY":        get_regime_params("CHOPPY"),
                "HIGH_VOL":      get_regime_params("HIGH_VOL"),
            }
        },
        "results": results,
    }
    with open("backtest_results.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print("  [KAYDEDILDI] Detayli sonuclar -> backtest_results.json\n")


if __name__ == "__main__":
    main()
