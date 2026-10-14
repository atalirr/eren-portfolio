"""
ANTIGRAVITY AI — Day Trader Backtest
======================================
day_trader.py stratejisini 1h geçmiş verisi üzerinde test eder.
Sonuçları backtest_results_day.json ve ekrana yazar.

Çalıştırma:
  python day_trader_backtest.py
  python day_trader_backtest.py 60    <- Son 60 gün (varsayılan: 90)

Süre: ~3-8 dakika (coin sayısına göre)
"""

import sys, codecs
sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer)
sys.stderr = codecs.getwriter("utf-8")(sys.stderr.buffer)

import ccxt
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
import json, time, os, warnings
warnings.filterwarnings("ignore")

# ── AYARLAR ──────────────────────────────────────────────────────────────────

# Statik liste yerine dinamik tarama kullanılıyor (--static argümanıyla eski davranış)
# python day_trader_backtest.py 730         -> dinamik top 25 coin
# python day_trader_backtest.py 730 --static -> sadece BTC/ETH/DOGE
STATIC_SYMBOLS = ["BTC/USDT", "ETH/USDT", "DOGE/USDT"]
USE_STATIC     = "--static" in sys.argv

TIMEFRAME        = "1h"
LOOKBACK_DAYS    = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 90
INITIAL_BALANCE  = 10_000.0
RISK_PER_TRADE   = 0.008       # %0.8 — Day modunda daha küçük
MAX_POSITIONS    = 5
HARD_STOP_PCT    = 0.020       # %2.0
MAX_HOLD_BARS    = 8           # 8 saat max
COMMISSION       = 0.001       # %0.1 Binance spot

# EOD saatleri: gün içi sadece saat 02-22 UTC arasında işlem
EOD_CLOSE_HOUR   = 22
TRADE_START_HOUR = 2

SCAN_TOP_N   = 25      # Dinamik taramada kaç coin seç
MIN_VOLUME   = 5_000_000  # 24h hacim minimum $5M

RESULTS_FILE = "backtest_results_day.json"

# ── EXCHANGE ──────────────────────────────────────────────────────────────────

exchange = ccxt.binance({
    "enableRateLimit": True,
    "options": {"defaultType": "spot"},
})


# ── DİNAMİK COİN TARAMA ───────────────────────────────────────────────────────

STABLECOIN_BASES = {"USDT","USDC","BUSD","DAI","TUSD","FDUSD","USDP","FRAX"}
BLACKLIST_WORDS  = {"UP","DOWN","BULL","BEAR","3L","3S","5L","5S"}

def scan_top_coins(n: int = SCAN_TOP_N) -> list:
    """
    Binance'teki tüm USDT spotları tara, hacim + momentum skoruna göre
    en iyi N coini döndür. Kaldıraçlı token ve stablecoinler hariç.
    """
    print(f"  [TARAMA] Binance tüm USDT çiftleri taranıyor (top {n} seçilecek)...")
    try:
        tickers = exchange.fetch_tickers()
    except Exception as e:
        print(f"  [HATA] Ticker çekilemedi: {e} — statik liste kullanılıyor")
        return STATIC_SYMBOLS

    scored = []
    for sym, t in tickers.items():
        if not sym.endswith("/USDT"):
            continue
        base = sym.split("/")[0]
        # Filtreler
        if base in STABLECOIN_BASES:
            continue
        if any(w in base for w in BLACKLIST_WORDS):
            continue
        vol = float(t.get("quoteVolume") or 0)
        if vol < MIN_VOLUME:
            continue
        # Skor: hacim ağırlıklı + son 24h değişim
        chg = abs(float(t.get("percentage") or 0))
        score = vol / 1_000_000 + chg * 5
        scored.append((sym, score, vol))

    scored.sort(key=lambda x: x[1], reverse=True)
    result = [s[0] for s in scored[:n]]
    print(f"  [TARAMA] {len(scored)} coin bulundu -> top {len(result)} seçildi")
    return result


# ── VERİ ÇEKME ────────────────────────────────────────────────────────────────

def fetch_ohlcv(symbol: str, days: int, tf: str = None) -> pd.DataFrame:
    tf = tf or TIMEFRAME
    since = exchange.parse8601(
        (datetime.now(timezone.utc) - timedelta(days=days + 5)).strftime("%Y-%m-%dT00:00:00Z")
    )
    all_bars = []
    while True:
        bars = exchange.fetch_ohlcv(symbol, tf, since=since, limit=1000)
        if not bars:
            break
        all_bars.extend(bars)
        since = bars[-1][0] + 1
        if len(bars) < 1000:
            break
        time.sleep(0.3)

    df = pd.DataFrame(all_bars, columns=["time", "open", "high", "low", "close", "volume"])
    df["time"] = pd.to_datetime(df["time"], unit="ms", utc=True)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    df = df[df["time"] >= cutoff].reset_index(drop=True)
    return df


def build_4h_regime_map(symbol: str, days: int) -> dict:
    """
    4h veri çek, her 4h bar için rejim hesapla.
    Döndürür: {timestamp_saat -> regime} dict'i
    1h backtestte her bar için 4h makro rejimi lookup'ta kullanılır.
    """
    df4 = fetch_ohlcv(symbol, days + 10, tf="4h")
    if len(df4) < 55:
        return {}

    close = df4["close"]
    high  = df4["high"]
    low   = df4["low"]

    ema9  = close.ewm(span=9,  adjust=False).mean()
    ema20 = close.ewm(span=20, adjust=False).mean()
    ema50 = close.ewm(span=50, adjust=False).mean()

    tr_ser = pd.concat([
        high - low,
        (high - close.shift(1)).abs(),
        (low  - close.shift(1)).abs(),
    ], axis=1).max(axis=1)
    atr14 = tr_ser.rolling(14).mean()
    atr_pct = atr14 / close * 100
    ret12 = close.pct_change(12) * 100

    regime_map = {}
    for i in range(len(df4)):
        if pd.isna(atr_pct.iloc[i]) or pd.isna(ret12.iloc[i]):
            r = "CHOPPY"
        elif atr_pct.iloc[i] > 4.5:
            r = "HIGH_VOL"
        elif ema9.iloc[i] > ema20.iloc[i] > ema50.iloc[i] and ret12.iloc[i] > 1.0:
            r = "TRENDING_UP"
        elif ema9.iloc[i] < ema20.iloc[i] < ema50.iloc[i] and ret12.iloc[i] < -1.0:
            r = "TRENDING_DOWN"
        else:
            r = "CHOPPY"

        # Bu 4h bar'ın kapsadığı her saati map'e ekle
        bar_time = df4["time"].iloc[i]
        for h in range(4):
            key = bar_time + pd.Timedelta(hours=h)
            key = key.replace(minute=0, second=0, microsecond=0)
            regime_map[key] = r

    return regime_map


# ── İNDİKATÖRLER ─────────────────────────────────────────────────────────────

def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    close  = df["close"]
    high   = df["high"]
    low    = df["low"]
    volume = df["volume"]

    df["ema9"]  = close.ewm(span=9,  adjust=False).mean()
    df["ema20"] = close.ewm(span=20, adjust=False).mean()
    df["ema50"] = close.ewm(span=50, adjust=False).mean()

    # MACD
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd  = ema12 - ema26
    sig   = macd.ewm(span=9, adjust=False).mean()
    df["macd_hist"] = macd - sig

    # RSI
    delta = close.diff()
    gain  = delta.where(delta > 0, 0).rolling(14).mean()
    loss  = (-delta.where(delta < 0, 0)).rolling(14).mean()
    df["rsi"] = 100 - 100 / (1 + gain / (loss + 1e-9))

    # Stochastic
    low14  = low.rolling(14).min()
    high14 = high.rolling(14).max()
    df["stoch_k"] = (close - low14) / (high14 - low14 + 1e-9) * 100
    df["stoch_d"] = df["stoch_k"].rolling(3).mean()

    # Hacim oranı
    df["vol_ratio"] = volume / (volume.rolling(20).mean() + 1e-9)

    # ATR
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low  - prev_close).abs(),
    ], axis=1).max(axis=1)
    df["atr"]     = tr.rolling(14).mean()
    df["atr_pct"] = df["atr"] / close * 100

    return df.dropna().reset_index(drop=True)


# ── REJİM TESPİTİ ─────────────────────────────────────────────────────────────

def detect_regime(row) -> str:
    if float(row["atr_pct"]) > 4.5:
        return "HIGH_VOL"
    if row["ema9"] > row["ema20"] > row["ema50"]:
        return "TRENDING_UP"
    if row["ema9"] < row["ema20"] < row["ema50"]:
        return "TRENDING_DOWN"
    return "CHOPPY"


# ── REJİM PARAMETRELERİ ────────────────────────────────────────────────────────

def get_params(regime: str) -> dict:
    if regime == "TRENDING_UP":
        return {"buy": 68,  "sell": 40, "tp": 4.0, "atr_m": 1.5, "can_buy": True}   # 63->68
    elif regime == "TRENDING_DOWN":
        return {"buy": 999, "sell": 58, "tp": 2.5, "atr_m": 1.5, "can_buy": False}
    elif regime == "CHOPPY":
        return {"buy": 999, "sell": 45, "tp": 2.5, "atr_m": 1.3, "can_buy": False}  # CHOPPY: alım yok
    else:  # HIGH_VOL
        return {"buy": 76,  "sell": 50, "tp": 5.0, "atr_m": 2.0, "can_buy": True}


# ── SKORLAMA ──────────────────────────────────────────────────────────────────

def compute_score(row, prev_row, regime: str) -> float:
    score = 0.0
    rsi  = float(row["rsi"])
    sk   = float(row["stoch_k"])
    sd   = float(row["stoch_d"])
    vr   = float(row["vol_ratio"])
    h    = float(row["macd_hist"])
    hp   = float(prev_row["macd_hist"])

    # EMA (30)
    if regime == "TRENDING_UP":
        if row["ema9"]  > row["ema20"]:  score += 10
        if row["ema20"] > row["ema50"]:  score += 10
        if row["close"] > row["ema9"]:   score += 10
    elif regime == "CHOPPY":
        if row["close"] > row["ema20"]:  score += 15
        if row["ema9"]  > row["ema20"]:  score += 15
    else:
        if row["close"] > row["ema50"]:  score += 20
        if row["ema9"]  > row["ema50"]:  score += 10

    # MACD (25)
    if h > 0 and h > hp:    score += 25
    elif h > 0:              score += 15
    elif h > hp:             score += 8

    # RSI (20)
    if regime == "TRENDING_UP":
        if 40 < rsi < 65:    score += 20
        elif 35 < rsi < 72:  score += 10
    elif regime == "CHOPPY":
        if 30 < rsi < 55:    score += 20
        elif rsi < 40:       score += 10
    else:
        if 35 < rsi < 70:    score += 20
        elif 25 < rsi < 75:  score += 10

    # Stochastic (15)
    if sk > sd and sk < 80:  score += 15
    elif sk > sd:             score += 8

    # Hacim (10)
    if vr > 1.5:   score += 10
    elif vr > 1.0: score += 5

    return score


# ── TEK SEMBOL BACKTEST ────────────────────────────────────────────────────────

def backtest_symbol(symbol: str, days: int) -> dict:
    try:
        df = fetch_ohlcv(symbol, days)
        df = add_indicators(df)
        regime_map_4h = build_4h_regime_map(symbol, days)
    except Exception as e:
        return {"symbol": symbol, "error": str(e)}

    if len(df) < 60:
        return {"symbol": symbol, "error": "Yetersiz veri"}

    balance     = INITIAL_BALANCE
    position    = None   # {entry, qty, peak, hard_stop, trail_pct, bars_held, regime}
    trades      = []
    regime_stats= {}
    macro_blocked = 0  # 4h filtresi tarafından engellenen fırsatlar

    for i in range(50, len(df)):
        row      = df.iloc[i]
        prev_row = df.iloc[i - 1]
        price    = float(row["close"])

        # İşlem saati kontrolü (UTC)
        utc_hour = row["time"].hour
        in_hours = TRADE_START_HOUR <= utc_hour < EOD_CLOSE_HOUR
        eod_warn = utc_hour >= (EOD_CLOSE_HOUR - 1)

        # 4h makro rejim — TRENDING_DOWN veya HIGH_VOL ise alım yok
        bar_key    = row["time"].replace(minute=0, second=0, microsecond=0)
        regime_4h  = regime_map_4h.get(bar_key, "CHOPPY")
        macro_ok   = (regime_4h == "TRENDING_UP")

        regime = detect_regime(row)
        regime_stats[regime] = regime_stats.get(regime, 0) + 1
        params = get_params(regime)
        score  = compute_score(row, prev_row, regime)

        # ── EOD KAPAT ──────────────────────────────────────────────────────
        if position and utc_hour >= EOD_CLOSE_HOUR:
            pnl       = (price - position["entry"]) * position["qty"]
            pnl      -= abs(pnl) * COMMISSION + price * position["qty"] * COMMISSION
            balance  += position["qty"] * price * (1 - COMMISSION)
            trades.append({
                "entry":  position["entry"],
                "exit":   price,
                "pnl":    round(pnl, 4),
                "pnl_pct": round((price - position["entry"]) / position["entry"] * 100, 2),
                "reason": "EOD-CLOSE",
                "regime": position["regime"],
                "bars":   position["bars_held"],
            })
            position = None
            continue

        # ── SATIŞ ─────────────────────────────────────────────────────────
        if position:
            position["bars_held"] += 1
            if price > position["peak"]:
                position["peak"] = price

            profit_pct = (price - position["entry"]) / position["entry"] * 100
            drop       = (position["peak"] - price) / position["peak"] * 100
            hard_stop  = position["hard_stop"]
            trail_pct  = position["trail_pct"]

            should_sell = False
            reason      = ""

            if price <= hard_stop:
                should_sell, reason = True, "HARD-STOP"
            elif profit_pct >= params["tp"]:
                should_sell, reason = True, f"TAKE-PROFIT"
            elif drop >= trail_pct:
                should_sell, reason = True, f"TRAIL"
            elif score < params["sell"]:
                should_sell, reason = True, "SCORE-DROP"
            elif position["bars_held"] >= MAX_HOLD_BARS:
                should_sell, reason = True, "MAX-HOLD"

            if should_sell:
                pnl       = (price - position["entry"]) * position["qty"]
                pnl      -= abs(pnl) * COMMISSION + price * position["qty"] * COMMISSION
                balance  += position["qty"] * price * (1 - COMMISSION)
                trades.append({
                    "entry":   position["entry"],
                    "exit":    price,
                    "pnl":     round(pnl, 4),
                    "pnl_pct": round(profit_pct, 2),
                    "reason":  reason,
                    "regime":  position["regime"],
                    "bars":    position["bars_held"],
                })
                position = None

        # ── ALIM ──────────────────────────────────────────────────────────
        # 4h makro TRENDING_UP değilse alım engellenir
        if (position is None and in_hours and not eod_warn
                and macro_ok and params["can_buy"] and score >= params["buy"]):

            risk_amt = balance * RISK_PER_TRADE
            atr_raw  = float(row["atr"])
            qty      = risk_amt / (atr_raw * 2) if atr_raw > 0 else risk_amt / (price * HARD_STOP_PCT)
            cost     = qty * price * (1 + COMMISSION)

            if cost > balance * 0.98:
                qty  = (balance * 0.98) / (price * (1 + COMMISSION))
                cost = qty * price * (1 + COMMISSION)

            if qty > 0 and cost <= balance:
                balance -= cost
                trail   = float(row["atr_pct"]) * 1.5
                trail   = max(1.2, min(3.5, trail))
                position = {
                    "entry":      price,
                    "qty":        qty,
                    "peak":       price,
                    "hard_stop":  price * (1 - HARD_STOP_PCT),
                    "trail_pct":  trail,
                    "bars_held":  0,
                    "regime":     regime,
                }

    # Açık pozisyon varsa kapat
    if position:
        price = float(df.iloc[-1]["close"])
        pnl   = (price - position["entry"]) * position["qty"]
        pnl  -= abs(pnl) * COMMISSION
        balance += position["qty"] * price * (1 - COMMISSION)
        trades.append({
            "entry":   position["entry"],
            "exit":    price,
            "pnl":     round(pnl, 4),
            "pnl_pct": round((price - position["entry"]) / position["entry"] * 100, 2),
            "reason":  "FINAL-CLOSE",
            "regime":  position["regime"],
            "bars":    position["bars_held"],
        })

    # ── ÖZET ─────────────────────────────────────────────────────────────────
    n          = len(trades)
    wins       = [t for t in trades if t["pnl"] > 0]
    losses     = [t for t in trades if t["pnl"] <= 0]
    total_pnl  = sum(t["pnl"] for t in trades)
    win_rate   = len(wins) / n * 100 if n > 0 else 0
    avg_win    = sum(t["pnl"] for t in wins)  / len(wins)   if wins   else 0
    avg_loss   = sum(t["pnl"] for t in losses)/ len(losses) if losses else 0
    pf         = abs(avg_win * len(wins)) / max(abs(avg_loss * len(losses)), 1e-9)
    avg_bars   = sum(t["bars"] for t in trades) / n if n > 0 else 0

    # Max drawdown
    equity = INITIAL_BALANCE
    peak   = INITIAL_BALANCE
    max_dd = 0.0
    for t in trades:
        equity += t["pnl"]
        if equity > peak:
            peak = equity
        dd = (peak - equity) / peak * 100
        if dd > max_dd:
            max_dd = dd

    return {
        "symbol":        symbol,
        "total_trades":  n,
        "win_rate":      round(win_rate, 1),
        "total_pnl":     round(total_pnl, 2),
        "profit_factor": round(pf, 2),
        "max_drawdown":  round(max_dd, 1),
        "avg_bars_held": round(avg_bars, 1),
        "final_balance": round(balance, 2),
        "regime_stats":  regime_stats,
        "trades":        trades[-20:],   # Son 20 işlem
    }


# ── ANA ÇALIŞMA ───────────────────────────────────────────────────────────────

def main():
    # Dinamik veya statik coin listesi
    symbols = STATIC_SYMBOLS if USE_STATIC else scan_top_coins(SCAN_TOP_N)

    print("\n" + "=" * 65)
    print("  ANTIGRAVITY AI — DAY TRADER BACKTEST (1h)")
    mod_str = "STATİK" if USE_STATIC else f"DİNAMİK top {SCAN_TOP_N}"
    print(f"  Semboller: {len(symbols)} [{mod_str}] | Süre: Son {LOOKBACK_DAYS} gün")
    print(f"  EOD kapat: UTC {EOD_CLOSE_HOUR}:00 | Max hold: {MAX_HOLD_BARS}h")
    print("=" * 65)

    results     = []
    total_start = time.time()

    for i, symbol in enumerate(symbols, 1):
        print(f"  [{i}/{len(symbols)}] {symbol:<14}", end=" ", flush=True)
        t0  = time.time()
        res = backtest_symbol(symbol, LOOKBACK_DAYS)
        elapsed = round(time.time() - t0, 1)

        if "error" in res:
            print(f"HATA: {res['error']}")
            continue

        icon = "▲" if res["total_pnl"] > 0 else "▼"
        print(f"{icon} PnL:${res['total_pnl']:>8.2f} | "
              f"WR:{res['win_rate']:>5.1f}% | "
              f"İşlem:{res['total_trades']:>3} | "
              f"PF:{res['profit_factor']:>4.2f} | "
              f"DD:{res['max_drawdown']:>4.1f}% | "
              f"{elapsed}s")
        results.append(res)
        time.sleep(0.3)

    if not results:
        print("\n  Sonuç yok.")
        return

    # ── ÖZET ─────────────────────────────────────────────────────────────────
    all_trades  = [t for r in results for t in r.get("trades", [])]
    all_wins    = [t for t in all_trades if t["pnl"] > 0]
    total_pnl   = sum(r["total_pnl"] for r in results)
    profit_pct  = round(total_pnl / INITIAL_BALANCE * 100, 2)
    avg_wr      = sum(r["win_rate"] for r in results) / len(results)
    avg_pf      = sum(r["profit_factor"] for r in results) / len(results)
    avg_dd      = sum(r["max_drawdown"] for r in results) / len(results)
    avg_bars    = sum(r["avg_bars_held"] for r in results) / len(results)
    profitable  = sum(1 for r in results if r["total_pnl"] > 0)

    # Rejim dağılımı
    all_regimes = {}
    for r in results:
        for reg, cnt in r.get("regime_stats", {}).items():
            all_regimes[reg] = all_regimes.get(reg, 0) + cnt
    total_bars = sum(all_regimes.values()) or 1

    elapsed_total = round(time.time() - total_start, 1)

    print("\n" + "=" * 65)
    print("  TOPLAM ÖZET")
    print("=" * 65)
    print(f"  Süre           : {elapsed_total}s")
    print(f"  Test edilen    : {len(results)} sembol, son {LOOKBACK_DAYS} gün")
    print(f"  Toplam işlem   : {len(all_trades)}")
    print(f"  Kazanan sembol : {profitable}/{len(results)}")
    print(f"  Genel Win Rate : %{avg_wr:.1f}")
    print(f"  Profit Factor  : {avg_pf:.2f}")
    print(f"  Toplam PnL     : ${total_pnl:+.2f}  (%{profit_pct:+.1f})")
    print(f"  Ort. Drawdown  : %{avg_dd:.1f}")
    print(f"  Ort. Hold Süresi: {avg_bars:.1f} bar ({avg_bars:.0f} saat)")
    print()
    print("  Rejim dağılımı:")
    for reg, cnt in sorted(all_regimes.items(), key=lambda x: -x[1]):
        print(f"    {reg:<20} %{cnt/total_bars*100:>4.0f}  ({cnt} bar)")
    print()
    print("  En iyi 3 sembol:")
    for r in sorted(results, key=lambda x: x["total_pnl"], reverse=True)[:3]:
        print(f"    {r['symbol']:<14} PnL:${r['total_pnl']:>8.2f} | WR:{r['win_rate']:.1f}% | Trades:{r['total_trades']}")
    print()
    print("  En kötü 3 sembol:")
    for r in sorted(results, key=lambda x: x["total_pnl"])[:3]:
        print(f"    {r['symbol']:<14} PnL:${r['total_pnl']:>8.2f} | WR:{r['win_rate']:.1f}% | Trades:{r['total_trades']}")
    print("=" * 65)

    # JSON kaydet
    output = {
        "date":    datetime.now().strftime("%Y-%m-%d %H:%M"),
        "mode":    "DAY_TRADER",
        "config": {
            "timeframe":      TIMEFRAME,
            "lookback_days":  LOOKBACK_DAYS,
            "risk_pct":       RISK_PER_TRADE * 100,
            "hard_stop_pct":  HARD_STOP_PCT * 100,
            "max_hold_bars":  MAX_HOLD_BARS,
            "eod_close_utc":  EOD_CLOSE_HOUR,
            "max_positions":  MAX_POSITIONS,
        },
        "summary": {
            "total_trades":   len(all_trades),
            "win_rate":       round(avg_wr, 1),
            "total_pnl":      round(total_pnl, 2),
            "profit_pct":     profit_pct,
            "profit_factor":  round(avg_pf, 2),
            "max_drawdown":   round(avg_dd, 1),
            "avg_bars_held":  round(avg_bars, 1),
            "profitable_pct": round(profitable / len(results) * 100, 1),
        },
        "results": results,
    }
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\n  Sonuçlar kaydedildi: {RESULTS_FILE}")
    print()


if __name__ == "__main__":
    main()
