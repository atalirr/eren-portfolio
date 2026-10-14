"""
ANTIGRAVITY AI — Katman 1: Makro Filtre
========================================
BTC haftalık trendini analiz eder, genel piyasa modunu belirler.

MODLAR:
  BULL    — Haftalık trend yukarı, agresif mod
  BEAR    — Haftalık trend aşağı, savunma modu
  NEUTRAL — Belirsiz, standart mod

Her mod botun davranışını kökten değiştirir:
  BULL  -> daha fazla pozisyon, daha düşük giriş eşiği, daha yüksek TP
  BEAR  -> çok az pozisyon, çok sıkı giriş, copy trading öncelikli
  NEUTRAL -> standart parametreler

Kullanım (backend.py içinden):
  from macro_filter import get_macro_mode, get_macro_params
  mode   = get_macro_mode()          # "BULL" / "BEAR" / "NEUTRAL"
  params = get_macro_params(mode)    # O moda göre trading parametreleri
"""

import ccxt
import pandas as pd
import numpy as np
import time
import json
import os
from datetime import datetime

# ── CACHE ─────────────────────────────────────────────────────────────────────
# Haftalık veri yavaş değişir — 4 saatte bir yenile
_cache: dict = {}
CACHE_TTL = 4 * 3600   # 4 saat

CACHE_FILE = "macro_state.json"   # Sunucu yeniden başlayınca önceki durumu hatırla


# ── EXCHANGE ──────────────────────────────────────────────────────────────────
_exchange = None

def _get_exchange():
    global _exchange
    if _exchange is None:
        _exchange = ccxt.binance({
            "enableRateLimit": True,
            "options": {"defaultType": "spot"},
            "timeout": 30000,
        })
    return _exchange


# ── VERİ ÇEKME ────────────────────────────────────────────────────────────────
def fetch_btc_weekly(limit=52) -> pd.DataFrame:
    """BTC/USDT haftalık mum verisi — son 52 hafta (~1 yıl)."""
    ex  = _get_exchange()
    try:
        bars = ex.fetch_ohlcv("BTC/USDT", "1w", limit=limit)
        df   = pd.DataFrame(bars, columns=["time", "open", "high", "low", "close", "volume"])
        df["time"] = pd.to_datetime(df["time"], unit="ms")
        return df
    except Exception as e:
        print(f"[MAKRO] BTC haftalık veri çekilemedi: {e}")
        return pd.DataFrame()


def fetch_btc_daily(limit=90) -> pd.DataFrame:
    """BTC/USDT günlük veri — son 90 gün."""
    ex = _get_exchange()
    try:
        bars = ex.fetch_ohlcv("BTC/USDT", "1d", limit=limit)
        df   = pd.DataFrame(bars, columns=["time", "open", "high", "low", "close", "volume"])
        df["time"] = pd.to_datetime(df["time"], unit="ms")
        return df
    except Exception as e:
        print(f"[MAKRO] BTC günlük veri çekilemedi: {e}")
        return pd.DataFrame()


# ── ANALİZ ────────────────────────────────────────────────────────────────────
def analyze_macro() -> dict:
    """
    BTC haftalık ve günlük veriye bakarak piyasa modunu belirle.
    Döndürür: {mode, score, signals, price, updated_at}
    """
    df_w = fetch_btc_weekly(52)
    df_d = fetch_btc_daily(90)

    if df_w.empty or len(df_w) < 20:
        return _fallback_state("Haftalık veri yetersiz")

    close_w = df_w["close"]
    close_d = df_d["close"] if not df_d.empty else close_w

    signals = {}
    score   = 0   # +1 bull, -1 bear, 0 nötr — toplama göre karar ver

    # ── 1. EMA 50 vs 200 (Haftalık) — Golden/Death Cross ─────────────────────
    ema50_w  = close_w.ewm(span=50,  adjust=False).mean()
    ema200_w = close_w.ewm(span=200, adjust=False).mean()
    if len(ema50_w) >= 1 and len(ema200_w) >= 1:
        golden_cross = float(ema50_w.iloc[-1]) > float(ema200_w.iloc[-1])
        signals["weekly_golden_cross"] = golden_cross
        score += 2 if golden_cross else -2   # Ağırlıklı — en güçlü sinyal

    # ── 2. Fiyat EMA50'nin Üstünde mi? (Haftalık) ────────────────────────────
    above_ema50 = float(close_w.iloc[-1]) > float(ema50_w.iloc[-1])
    signals["above_weekly_ema50"] = above_ema50
    score += 1 if above_ema50 else -1

    # ── 3. Son 4 Haftalık Getiri ──────────────────────────────────────────────
    if len(close_w) >= 5:
        ret_4w = (float(close_w.iloc[-1]) - float(close_w.iloc[-5])) / float(close_w.iloc[-5]) * 100
        signals["ret_4w_pct"] = round(ret_4w, 1)
        if ret_4w > 10:
            score += 2
        elif ret_4w > 0:
            score += 1
        elif ret_4w < -15:
            score -= 2
        elif ret_4w < 0:
            score -= 1

    # ── 4. Haftalık RSI ───────────────────────────────────────────────────────
    if len(close_w) >= 15:
        delta = close_w.diff()
        gain  = delta.where(delta > 0, 0).rolling(14).mean()
        loss  = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rsi_w = float((100 - (100 / (1 + gain / (loss + 1e-9)))).iloc[-1])
        signals["weekly_rsi"] = round(rsi_w, 1)
        if rsi_w > 60:
            score += 1
        elif rsi_w > 50:
            score += 0
        elif rsi_w < 40:
            score -= 1
        elif rsi_w < 30:
            score -= 2

    # ── 5. Günlük EMA20 vs EMA50 ─────────────────────────────────────────────
    if not df_d.empty and len(df_d) >= 50:
        ema20_d = close_d.ewm(span=20, adjust=False).mean()
        ema50_d = close_d.ewm(span=50, adjust=False).mean()
        daily_bull = float(ema20_d.iloc[-1]) > float(ema50_d.iloc[-1])
        signals["daily_ema_bull"] = daily_bull
        score += 1 if daily_bull else -1

    # ── MOD KARARI ────────────────────────────────────────────────────────────
    if score >= 3:
        mode = "BULL"
    elif score <= -3:
        mode = "BEAR"
    else:
        mode = "NEUTRAL"

    btc_price = float(close_w.iloc[-1])

    result = {
        "mode":       mode,
        "score":      score,
        "signals":    signals,
        "btc_price":  round(btc_price, 0),
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }

    # Cache'e yaz
    _cache["state"] = result
    _cache["ts"]    = time.time()

    # Diske kaydet (yeniden başlayınca kullanılır)
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(result, f, indent=2)
    except Exception:
        pass

    return result


def _fallback_state(reason=""):
    """Veri alınamazsa disk cache veya NEUTRAL döndür."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE) as f:
                cached = json.load(f)
            cached["from_cache"] = True
            return cached
        except Exception:
            pass
    return {
        "mode":       "NEUTRAL",
        "score":      0,
        "signals":    {},
        "btc_price":  0,
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "note":       reason,
    }


# ── ANA FONKSİYON ─────────────────────────────────────────────────────────────
def get_macro_mode(force_refresh=False) -> str:
    """
    Güncel piyasa modunu döndür: "BULL" / "BEAR" / "NEUTRAL"
    Cache TTL dolmadıysa API çağrısı yapmaz.
    """
    # Cache geçerliyse direkt döndür
    if not force_refresh:
        if _cache.get("ts") and (time.time() - _cache["ts"]) < CACHE_TTL:
            return _cache["state"]["mode"]

    state = analyze_macro()
    return state["mode"]


def get_macro_state(force_refresh=False) -> dict:
    """Tam durum raporunu döndür (mode + signals + score)."""
    if not force_refresh:
        if _cache.get("ts") and (time.time() - _cache["ts"]) < CACHE_TTL:
            return _cache["state"]
    return analyze_macro()


# ── MOD'A GÖRE PARAMETRELERİ AYARLA ──────────────────────────────────────────
def get_macro_params(mode: str) -> dict:
    """
    Makro moda göre trading parametrelerini döndür.
    Bu değerler backend.py'deki sabit değerlerin üzerine uygulanır.
    """
    if mode == "BULL":
        return {
            "max_open_positions":  10,      # 8 -> 10
            "risk_per_trade_pct":  0.012,   # 1.0% -> 1.2%
            "hard_stop_pct":       0.04,    # normal
            "cooldown_seconds":    6 * 3600,# 8h -> 6h
            "ml_threshold":        0.55,    # 0.58 -> 0.55 (biraz gevşet)
            "score_bonus":         0,       # Eşiklere bonus yok
            "tp_bonus_pct":        2.0,     # TP hedeflerine +2% ekle
            "description":         "Agresif — bull piyasası",
        }
    elif mode == "BEAR":
        return {
            "max_open_positions":  4,       # 8 -> 4
            "risk_per_trade_pct":  0.006,   # 1.0% -> 0.6%
            "hard_stop_pct":       0.03,    # 4% -> 3% (daha sıkı)
            "cooldown_seconds":    6 * 3600, # v2.5: 12h -> 6h (daha fazla fırsat)
            "ml_threshold":        0.65,    # 0.58 -> 0.65 (çok sıkı)
            "score_bonus":         4,       # v2.5: 8 -> 4 (radar_loop'ta zaten +4 ekleniyor)
            "tp_bonus_pct":        -1.0,    # TP hedeflerinden -1% çıkar (hızlı al)
            "description":         "Savunma — bear piyasası",
        }
    else:  # NEUTRAL
        return {
            "max_open_positions":  8,
            "risk_per_trade_pct":  0.010,
            "hard_stop_pct":       0.04,
            "cooldown_seconds":    4 * 3600, # v2.5: 8h -> 4h
            "ml_threshold":        0.58,
            "score_bonus":         0,
            "tp_bonus_pct":        0.0,
            "description":         "Standart — nötr piyasa",
        }


# ── RAPOR ────────────────────────────────────────────────────────────────────
def print_macro_report():
    """Terminalde okunaklı makro rapor bas."""
    state  = get_macro_state(force_refresh=True)
    params = get_macro_params(state["mode"])
    icons  = {"BULL": "▲", "BEAR": "▼", "NEUTRAL": "◆"}

    print("\n" + "=" * 55)
    print(f"  ANTIGRAVITY AI — MAKRO DURUM")
    print("=" * 55)
    print(f"  Mod       : {icons.get(state['mode'], '?')} {state['mode']}  ({params['description']})")
    print(f"  Skor      : {state['score']:+d}  (>= +3 = BULL, <= -3 = BEAR)")
    print(f"  BTC Fiyat : ${state['btc_price']:,.0f}")
    print(f"  Güncelleme: {state['updated_at']}")
    print()
    print("  Sinyaller:")
    for k, v in state.get("signals", {}).items():
        icon = "+" if v is True or (isinstance(v, (int, float)) and v > 0) else "-"
        print(f"    [{icon}] {k}: {v}")
    print()
    print("  Bu modda parametreler:")
    print(f"    Max pozisyon  : {params['max_open_positions']}")
    print(f"    Risk/işlem    : %{params['risk_per_trade_pct']*100:.1f}")
    print(f"    Hard stop     : %{params['hard_stop_pct']*100:.0f}")
    print(f"    ML eşiği      : {params['ml_threshold']}")
    print(f"    Cooldown      : {params['cooldown_seconds']//3600}h")
    if params["score_bonus"] != 0:
        print(f"    Giriş eşiği   : +{params['score_bonus']} (daha az sinyal)")
    if params["tp_bonus_pct"] != 0:
        print(f"    TP ayarı      : {params['tp_bonus_pct']:+.1f}%")
    print("=" * 55)


if __name__ == "__main__":
    print_macro_report()
