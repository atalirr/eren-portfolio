"""
ANTIGRAVITY AI — Day Trader Modu
==================================
1h timeframe üzerinde çalışan gün içi trading stratejisi.

SWING TRADER'dan farkları:
  • Timeframe : 1h  (SWING: 4h)
  • TP hedefi : %2.5–5  (SWING: %6–12)
  • Hard stop  : %2  (SWING: %4)
  • Cooldown   : 2h  (SWING: 8h)
  • Max hold   : 8 bar = 8 saat
  • EOD kapat  : UTC 22:00'de tüm pozisyonlar kapatılır
  • Max pozisyon: 5  (SWING: 8)

KULLANIM (backend.py içinden):
  from day_trader import (
      get_day_params, score_1h, detect_regime_1h,
      is_eod_zone, is_eod_close_time, EOD_CLOSE_HOUR
  )
"""

import ccxt
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import Optional

# ── AYARLAR ──────────────────────────────────────────────────────────────────

TIMEFRAME           = "1h"
MAX_HOLD_BARS       = 8        # 8 saat maksimum
EOD_CLOSE_HOUR      = 21       # TR 00:00 = UTC 21:00 (Gece 12'de sıfırlama)
EOD_WARN_MINUTES    = 30       # EOD'dan 30dk önce yeni alım durdur
MAX_OPEN_POSITIONS  = 5
HARD_STOP_PCT       = 0.020    # %2.0
COOLDOWN_SECONDS    = 2 * 3600 # 2 saat

def should_hold_overnight(profit_pct: float, ai_score: float) -> bool:
    """
    Gece 12'de işlem kapatılmalı mı?
    Eğer kâr %1'den fazlaysa ve AI Skoru 70+ ise 'umut vadediyor' demektir, tut.
    """
    return profit_pct >= 1.0 and ai_score >= 70

# Scoring thresholds
BUY_THRESHOLD_DEFAULT  = 68    # 1h — yükseltildi (daha kaliteli sinyal)
SELL_THRESHOLD_DEFAULT = 42

# Day modunda izin verilen coinler (1h backteste göre seçildi)
# XRP/ADA/LINK/AVAX/DOT gürültülü — yalnızca likit büyük caplar
DAY_COIN_WHITELIST = {
    "BTC/USDT", "ETH/USDT", "DOGE/USDT",
}

def is_day_whitelisted(symbol: str) -> bool:
    """Day trader modunda bu coini taşıyabilir miyiz?"""
    return symbol in DAY_COIN_WHITELIST

# ── REJİM PARAMETRELERİ ───────────────────────────────────────────────────────

def get_day_params(regime: str, macro_mode: str = "NEUTRAL") -> dict:
    """
    Day trader rejim parametreleri — 1h timeframe.
    Makro moda göre ince ayar yapılır.
    """
    base = _base_params(regime)

    # Makro mod ayarı
    if macro_mode == "BULL":
        base["buy_thresh"]  = max(55, base["buy_thresh"] - 3)
        base["take_profit"] = base["take_profit"] + 1.0
    elif macro_mode == "BEAR":
        base["buy_thresh"]  = base["buy_thresh"] + 5
        base["take_profit"] = max(1.5, base["take_profit"] - 0.5)
        # BEAR'da CHOPPY ve HIGH_VOL'de de alım yok
        if regime in ("CHOPPY", "HIGH_VOL"):
            base["can_buy"] = False

    return base


def _base_params(regime: str) -> dict:
    """Temel 1h rejim parametreleri."""
    if regime == "TRENDING_UP":
        return {
            "buy_thresh":  68, "sell_thresh": 40,
            "atr_mult":    1.5, "take_profit": 4.0,
            "can_buy":     True, "strategy":   "DAY_TREND",
        }
    elif regime == "TRENDING_DOWN":
        return {
            "buy_thresh":  999, "sell_thresh": 58,
            "atr_mult":    1.5, "take_profit": 2.5,
            "can_buy":     False, "strategy":  "DAY_TREND",
        }
    elif regime == "CHOPPY":
        return {
            "buy_thresh":  999, "sell_thresh": 45,
            "atr_mult":    1.3, "take_profit": 2.5,
            "can_buy":     False, "strategy":  "DAY_CHOP",  # 1h CHOPPY çok gürültülü
        }
    else:  # HIGH_VOL
        return {
            "buy_thresh":  76, "sell_thresh": 50,
            "atr_mult":    2.0, "take_profit": 5.0,
            "can_buy":     True, "strategy":   "DAY_VOL",
        }


# ── MAKRO FİLTRE (4h) ────────────────────────────────────────────────────────

def detect_regime_4h(df_4h: pd.DataFrame) -> str:
    """
    4h veri üzerinden makro rejim tespit et.
    Day trader'ın 1h sinyalini onaylamak için kullanılır.
    4h TRENDING_DOWN veya HIGH_VOL -> day trader alım yapmaz.
    """
    if len(df_4h) < 55:
        return "CHOPPY"

    close = df_4h["close"]
    high  = df_4h["high"]
    low   = df_4h["low"]

    ema9  = close.ewm(span=9,  adjust=False).mean()
    ema20 = close.ewm(span=20, adjust=False).mean()
    ema50 = close.ewm(span=50, adjust=False).mean()

    e9  = float(ema9.iloc[-1])
    e20 = float(ema20.iloc[-1])
    e50 = float(ema50.iloc[-1])

    tr_list = []
    for i in range(1, len(df_4h)):
        h  = float(high.iloc[i])
        l  = float(low.iloc[i])
        pc = float(close.iloc[i - 1])
        tr_list.append(max(h - l, abs(h - pc), abs(l - pc)))
    atr_pct = (sum(tr_list[-14:]) / 14) / float(close.iloc[-1]) * 100 if tr_list else 1.5

    ret_12 = (float(close.iloc[-1]) - float(close.iloc[-13])) / float(close.iloc[-13]) * 100

    if atr_pct > 4.5:
        return "HIGH_VOL"
    if e9 > e20 > e50 and ret_12 > 1.0:
        return "TRENDING_UP"
    if e9 < e20 < e50 and ret_12 < -1.0:
        return "TRENDING_DOWN"
    return "CHOPPY"


def macro_allows_buy(regime_4h: str) -> bool:
    """
    4h makro rejim alıma izin veriyor mu?
    Sadece TRENDING_UP ve CHOPPY'e izin ver.
    TRENDING_DOWN ve HIGH_VOL -> blok.
    """
    return regime_4h == "TRENDING_UP"


async def get_macro_regime_4h(symbol: str, exchange) -> str:
    """Canlı trading için 4h rejimi çek."""
    try:
        bars = exchange.fetch_ohlcv(symbol, "4h", limit=80)
        df = pd.DataFrame(bars, columns=["time", "open", "high", "low", "close", "volume"])
        return detect_regime_4h(df)
    except Exception:
        return "CHOPPY"  # Hata durumunda güvenli taraf


# ── REJİM TESPİTİ (1h) ───────────────────────────────────────────────────────

def detect_regime_1h(df: pd.DataFrame) -> str:
    """
    1h bar verisinden rejim tespit et.
    df: OHLCV DataFrame (en az 60 satır)
    """
    if len(df) < 55:
        return "CHOPPY"

    close  = df["close"]
    high   = df["high"]
    low    = df["low"]

    # EMA hizası
    ema9   = close.ewm(span=9,   adjust=False).mean()
    ema20  = close.ewm(span=20,  adjust=False).mean()
    ema50  = close.ewm(span=50,  adjust=False).mean()

    e9  = float(ema9.iloc[-1])
    e20 = float(ema20.iloc[-1])
    e50 = float(ema50.iloc[-1])

    # ATR (14 bar)
    tr_list = []
    for i in range(1, len(df)):
        h = float(high.iloc[i])
        l = float(low.iloc[i])
        pc = float(close.iloc[i - 1])
        tr_list.append(max(h - l, abs(h - pc), abs(l - pc)))
    atr_pct = (sum(tr_list[-14:]) / 14) / float(close.iloc[-1]) * 100 if tr_list else 1.5

    # ADX benzeri trend güç (basit versiyon)
    ret_12 = (float(close.iloc[-1]) - float(close.iloc[-13])) / float(close.iloc[-13]) * 100

    # Karar
    if atr_pct > 4.5:
        return "HIGH_VOL"
    if e9 > e20 > e50 and ret_12 > 1.0:
        return "TRENDING_UP"
    if e9 < e20 < e50 and ret_12 < -1.0:
        return "TRENDING_DOWN"
    return "CHOPPY"


# ── 1h SKORLAMA ──────────────────────────────────────────────────────────────

def score_1h(df: pd.DataFrame, regime: str) -> dict:
    """
    1h mum verisi üzerinde teknik skor hesapla.
    SWING_TRADER skorlama mantığının 1h versiyonu.

    Döndürür: {total_score, signal, metrics, regime_params}
    """
    if len(df) < 55:
        return {"total_score": 0, "signal": "NEUTRAL", "metrics": {}, "regime_params": _base_params(regime)}

    close  = df["close"]
    high   = df["high"]
    low    = df["low"]
    volume = df["volume"]
    price  = float(close.iloc[-1])

    score = 0

    # ── EMA Hizası (30 puan) ──────────────────────────────────────────────────
    ema9  = close.ewm(span=9,  adjust=False).mean()
    ema20 = close.ewm(span=20, adjust=False).mean()
    ema50 = close.ewm(span=50, adjust=False).mean()

    if regime == "TRENDING_UP":
        if float(ema9.iloc[-1])  > float(ema20.iloc[-1]): score += 10
        if float(ema20.iloc[-1]) > float(ema50.iloc[-1]): score += 10
        if price > float(ema9.iloc[-1]):                   score += 10
    elif regime == "CHOPPY":
        if price > float(ema20.iloc[-1]):                  score += 15
        if float(ema9.iloc[-1]) > float(ema20.iloc[-1]):  score += 15
    else:  # HIGH_VOL
        if price > float(ema50.iloc[-1]):                  score += 20
        if float(ema9.iloc[-1]) > float(ema50.iloc[-1]):  score += 10

    # ── MACD (25 puan) ───────────────────────────────────────────────────────
    ema12   = close.ewm(span=12, adjust=False).mean()
    ema26   = close.ewm(span=26, adjust=False).mean()
    macd    = ema12 - ema26
    signal  = macd.ewm(span=9, adjust=False).mean()
    hist    = macd - signal
    h_now   = float(hist.iloc[-1])
    h_prev  = float(hist.iloc[-2])

    if h_now > 0 and h_now > h_prev:   score += 25
    elif h_now > 0:                     score += 15
    elif h_now > h_prev:                score += 8

    # ── RSI (20 puan) ────────────────────────────────────────────────────────
    delta = close.diff()
    gain  = delta.where(delta > 0, 0).rolling(14).mean()
    loss  = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rsi   = float((100 - 100 / (1 + gain / (loss + 1e-9))).iloc[-1])

    if regime == "TRENDING_UP":
        if 40 < rsi < 65:    score += 20
        elif 35 < rsi < 72:  score += 10
    elif regime == "CHOPPY":
        if 30 < rsi < 55:    score += 20
        elif rsi < 40:       score += 10
    else:
        if 35 < rsi < 70:    score += 20
        elif 25 < rsi < 75:  score += 10

    # ── Stokastik (15 puan) ──────────────────────────────────────────────────
    low14  = low.rolling(14).min()
    high14 = high.rolling(14).max()
    stoch_k = (close - low14) / (high14 - low14 + 1e-9) * 100
    stoch_d = stoch_k.rolling(3).mean()
    sk = float(stoch_k.iloc[-1])
    sd = float(stoch_d.iloc[-1])

    if sk > sd and sk < 80:  score += 15
    elif sk > sd:             score += 8

    # ── Hacim (10 puan) ──────────────────────────────────────────────────────
    vol_avg = float(volume.rolling(20).mean().iloc[-1])
    vol_rat = float(volume.iloc[-1]) / (vol_avg + 1e-9)
    if vol_rat > 1.5:   score += 10
    elif vol_rat > 1.0: score += 5

    # ── ATR Hesabı ───────────────────────────────────────────────────────────
    tr_list = []
    for i in range(1, len(df)):
        h  = float(high.iloc[i])
        l  = float(low.iloc[i])
        pc = float(close.iloc[i - 1])
        tr_list.append(max(h - l, abs(h - pc), abs(l - pc)))
    atr_raw = sum(tr_list[-14:]) / 14 if tr_list else price * 0.015
    atr_pct = atr_raw / price * 100

    # ── Bollinger Band %B ─────────────────────────────────────────────────────
    sma20  = close.rolling(20).mean()
    std20  = close.rolling(20).std()
    bb_up  = sma20 + 2 * std20
    bb_low = sma20 - 2 * std20
    bb_pct = (price - float(bb_low.iloc[-1])) / (float(bb_up.iloc[-1]) - float(bb_low.iloc[-1]) + 1e-9)

    # ── Sinyal ───────────────────────────────────────────────────────────────
    params = _base_params(regime)
    if score >= params["buy_thresh"]:
        sig = "BUY"
    elif score < params["sell_thresh"]:
        sig = "SELL"
    else:
        sig = "NEUTRAL"

    return {
        "total_score":   score,
        "signal":        sig,
        "regime":        regime,
        "regime_params": params,
        "metrics": {
            "price":    price,
            "rsi":      round(rsi, 1),
            "stoch_k":  round(sk, 1),
            "stoch_d":  round(sd, 1),
            "macd_hist": round(h_now, 6),
            "bb_pct":   round(bb_pct, 3),
            "vol_ratio": round(vol_rat, 2),
            "atr_pct":   round(atr_pct, 2),
        },
    }


def fetch_and_score(symbol: str, exchange) -> Optional[dict]:
    """Sembol için 1h veri çek ve skorla. None = hata."""
    try:
        bars = exchange.fetch_ohlcv(symbol, TIMEFRAME, limit=80)
        if not bars or len(bars) < 60:
            return None
        df     = pd.DataFrame(bars, columns=["time", "open", "high", "low", "close", "volume"])
        regime = detect_regime_1h(df)
        result = score_1h(df, regime)
        return result
    except Exception:
        return None


# ── EOD MANTIK ────────────────────────────────────────────────────────────────

def utc_hour() -> int:
    """Mevcut UTC saati döndür."""
    return datetime.now(timezone.utc).hour


def utc_minute() -> int:
    return datetime.now(timezone.utc).minute


def is_eod_close_time() -> bool:
    """UTC 22:00–22:05 arasında mı? -> Tüm pozisyonları kapat."""
    h = utc_hour()
    m = utc_minute()
    return h == EOD_CLOSE_HOUR and m < 5


def is_eod_warn_zone() -> bool:
    """EOD'dan 30dk önce mi? -> Yeni alım açma."""
    h = utc_hour()
    m = utc_minute()
    # 21:30–22:05 arası uyarı bölgesi
    return (h == EOD_CLOSE_HOUR - 1 and m >= (60 - EOD_WARN_MINUTES)) or is_eod_close_time()


def eod_minutes_remaining() -> int:
    """UTC 22:00'e kaç dakika kaldığını döndür."""
    now = datetime.now(timezone.utc)
    eod = now.replace(hour=EOD_CLOSE_HOUR, minute=0, second=0, microsecond=0)
    if now >= eod:
        eod = eod.replace(day=eod.day + 1)
    delta = (eod - now).seconds // 60
    return delta


def is_trading_hours() -> bool:
    """
    Gün içi işlem saati mi?
    UTC 02:00–22:00 arası (Asya + Avrupa + ABD örtüşümleri)
    """
    h = utc_hour()
    return 2 <= h < EOD_CLOSE_HOUR


# ── GÜNLÜK İSTATİSTİK ─────────────────────────────────────────────────────────

def get_day_summary(trade_log: list) -> dict:
    """Bugünkü day trader işlemlerini özetle."""
    today = datetime.now().strftime("%Y-%m-%d")
    today_trades = [
        t for t in trade_log
        if t.get("date") == today and t.get("source") == "DAY_TRADER"
    ]
    wins   = [t for t in today_trades if t.get("pnl", 0) > 0 and t.get("side") == "SELL"]
    losses = [t for t in today_trades if t.get("pnl", 0) <= 0 and t.get("side") == "SELL"]
    total_pnl = sum(t.get("pnl", 0) for t in today_trades if t.get("side") == "SELL")

    return {
        "date":        today,
        "total_trades": len(wins) + len(losses),
        "wins":         len(wins),
        "losses":       len(losses),
        "win_rate":     round(len(wins) / max(len(wins) + len(losses), 1) * 100, 1),
        "total_pnl":    round(total_pnl, 2),
        "eod_minutes":  eod_minutes_remaining(),
        "trading_hours": is_trading_hours(),
        "eod_warn":     is_eod_warn_zone(),
    }


# ── CLI TEST ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    symbol = sys.argv[1] if len(sys.argv) > 1 else "BTC/USDT"

    ex = ccxt.binance({
        "enableRateLimit": True,
        "options": {"defaultType": "spot"},
    })

    print(f"\n  DAY TRADER TEST: {symbol}")
    print(f"  UTC saat    : {utc_hour():02d}:{utc_minute():02d}")
    print(f"  İşlem saati : {'✓' if is_trading_hours() else '✗'}")
    print(f"  EOD uyarı   : {'✓' if is_eod_warn_zone() else '✗'}")
    print(f"  EOD kapanış : {'✓' if is_eod_close_time() else '✗'}")
    print(f"  EOD kalan   : {eod_minutes_remaining()} dakika")
    print()

    result = fetch_and_score(symbol, ex)
    if result:
        params = get_day_params(result["regime"], "NEUTRAL")
        print(f"  Skor        : {result['total_score']} / 100")
        print(f"  Sinyal      : {result['signal']}")
        print(f"  Rejim       : {result['regime']}")
        print(f"  Buy eşiği   : {params['buy_thresh']}")
        print(f"  TP hedefi   : %{params['take_profit']}")
        m = result["metrics"]
        print(f"  RSI={m['rsi']}  ATR={m['atr_pct']}%  Vol={m['vol_ratio']}x")
    else:
        print("  Veri alınamadı.")
