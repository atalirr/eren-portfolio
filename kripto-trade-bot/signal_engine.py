"""
ANTIGRAVITY AI — Katman 3: Çoklu Sinyal Doğrulama Motoru
==========================================================
Scoring Engine'den gelen tek sinyali 3 bağımsız filtreden geçirir.
Her filtre geçilirse onay verir, geçilmezse reddeder.

FİLTRELER:
  1. Hacim Anomalisi    — Olağandışı hacim artışı (akıllı para girişi belirteci)
  2. Çok Zaman Dilimli  — 1h + 4h trendleri aynı yönde mi?
  3. Piyasa Genişliği   — Piyasanın kaçı yükseliyor? (izole hareketi filtrele)

KULLANIM:
  from signal_engine import validate_signal, get_signal_context
  result = validate_signal(symbol, score, regime, metrics, exchange)
  if result["approved"]:
      # Al
  else:
      # Reddet — result["reason"] nedenini söyler

ÇIKIŞ:
  {
    "approved": bool,
    "confidence": float,    # 0.0 – 1.0
    "filters": {
      "volume_ok": bool,
      "mtf_ok":    bool,
      "breadth_ok": bool,
    },
    "reason": str,          # Neden kabul/red
    "details": dict,        # Ham sayılar
  }
"""

import ccxt
import pandas as pd
import numpy as np
import time
import json
import os
from datetime import datetime
from typing import Optional

# ── AYARLAR ──────────────────────────────────────────────────────────────────

# Hacim anomalisi
VOL_SPIKE_MIN       = 1.5    # Min: mevcut hacim, 20 bar ortalamasının 1.5x'i olmalı
VOL_SPIKE_STRONG    = 2.5    # Güçlü: 2.5x -> tam puan

# Çoklu zaman dilimi
MTF_REQUIRE_1H      = True   # 1h EMA20 > EMA50 gereksin mi?

# Piyasa genişliği
BREADTH_CACHE_TTL   = 300    # Genişlik her 5 dakikada bir güncellenir
BREADTH_MIN_BULL    = 0.30   # En az %30 coin yükseliyor olmalı (v2.5: gevşetildi)
BREADTH_STRONG_BULL = 0.55   # %55+ -> piyasa gerçekten güçlü

# Filtre ağırlıkları (confidence hesabı için)
WEIGHT_VOLUME  = 0.40
WEIGHT_MTF     = 0.35
WEIGHT_BREADTH = 0.25

# BEAR modunda gevşetilmiş eşikler (macro_filter'dan alınır)
BEAR_VOL_MIN    = 2.0    # BEAR modunda daha sıkı hacim (gerçek breakout iste)
BEAR_BREADTH    = 0.40   # BEAR modunda daha sıkı genişlik

# ── PIYASA GENİŞLİĞİ CACHE ───────────────────────────────────────────────────
_breadth_cache = {
    "value": None,
    "ts":    0,
    "bull_pct": 0.0,
    "bearish_pct": 0.0,
}


# ── 1. HACİM ANOMALİSİ ────────────────────────────────────────────────────────

def check_volume_anomaly(
    symbol: str,
    exchange,
    macro_mode: str = "NEUTRAL"
) -> dict:
    """
    4h mumları kullanarak hacim anomalisi tespit et.
    Normal hacmin kaç katı işlem yapılıyor?
    """
    min_spike = BEAR_VOL_MIN if macro_mode == "BEAR" else VOL_SPIKE_MIN

    try:
        bars = exchange.fetch_ohlcv(symbol, "4h", limit=30)
        if not bars or len(bars) < 22:
            return {"ok": False, "score": 0.0, "reason": "Yetersiz 4h veri", "ratio": 0}

        df    = pd.DataFrame(bars, columns=["time", "open", "high", "low", "close", "volume"])
        vol   = df["volume"]
        price = df["close"]

        # Son bar hacmi vs geçmiş 20 bar ortalaması (son barı hariç tut)
        cur_vol  = float(vol.iloc[-1])
        avg_vol  = float(vol.iloc[-21:-1].mean())
        ratio    = cur_vol / (avg_vol + 1e-9)

        # Fiyat yönü: hacim artışı yukarı yönde mi? (boşa dökülen hacim değil)
        price_up = float(price.iloc[-1]) >= float(price.iloc[-2])

        # OBV trend (kısa vadeli)
        obv = 0.0
        obv_vals = []
        for i in range(len(df)):
            if i == 0:
                obv_vals.append(0.0)
                continue
            if float(df["close"].iloc[i]) > float(df["close"].iloc[i - 1]):
                obv += float(df["volume"].iloc[i])
            elif float(df["close"].iloc[i]) < float(df["close"].iloc[i - 1]):
                obv -= float(df["volume"].iloc[i])
            obv_vals.append(obv)

        # Son 5 barda OBV artıyor mu?
        obv_rising = obv_vals[-1] > obv_vals[-5] if len(obv_vals) >= 5 else False

        # Karar
        ok    = ratio >= min_spike and price_up
        score = 0.0
        if ratio >= VOL_SPIKE_STRONG and price_up:
            score = 1.0
        elif ratio >= min_spike and price_up:
            score = 0.7
        elif ratio >= min_spike * 0.8 and obv_rising:
            score = 0.4
        elif ratio >= 1.0:
            score = 0.2

        return {
            "ok":        ok,
            "score":     score,
            "ratio":     round(ratio, 2),
            "obv_rising": obv_rising,
            "price_up":  price_up,
            "reason":    f"Hacim x{ratio:.1f} | OBV {'▲' if obv_rising else '▼'} | {'OK' if ok else 'ZAYIF'}",
        }

    except Exception as e:
        return {"ok": False, "score": 0.3, "reason": f"Hacim analizi hatası: {e}", "ratio": 0}


# ── 2. ÇOKLU ZAMAN DİLİMİ HİZASI ─────────────────────────────────────────────

def check_multi_timeframe(
    symbol: str,
    exchange,
    macro_mode: str = "NEUTRAL"
) -> dict:
    """
    1h ve 4h zaman dilimlerinin aynı yönde olup olmadığını kontrol et.
    4h BULL -> 1h da BULL mu?
    """
    try:
        bars_1h = exchange.fetch_ohlcv(symbol, "1h", limit=60)
        if not bars_1h or len(bars_1h) < 55:
            return {"ok": True, "score": 0.5, "reason": "1h veri yetersiz — geçildi", "aligned": False}

        df     = pd.DataFrame(bars_1h, columns=["time", "open", "high", "low", "close", "volume"])
        close  = df["close"]
        price  = float(close.iloc[-1])

        # EMA hizası
        ema20  = close.ewm(span=20, adjust=False).mean()
        ema50  = close.ewm(span=50, adjust=False).mean()
        bull_1h = float(ema20.iloc[-1]) > float(ema50.iloc[-1])
        above_ema20 = price > float(ema20.iloc[-1])

        # RSI 1h
        delta = close.diff()
        gain  = delta.where(delta > 0, 0).rolling(14).mean()
        loss  = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rsi_1h = float((100 - 100 / (1 + gain / (loss + 1e-9))).iloc[-1])

        # Kısa vadeli momentum (son 4h)
        ret_4bar = (price - float(close.iloc[-5])) / float(close.iloc[-5]) * 100

        # Karar
        strong_align = bull_1h and above_ema20 and rsi_1h > 50
        weak_align   = bull_1h or (above_ema20 and ret_4bar > 0)

        if strong_align:
            score = 1.0
            ok    = True
        elif weak_align:
            score = 0.6
            ok    = True if not MTF_REQUIRE_1H else False
        else:
            # 1h bearish — 4h bull ile çelişiyor
            score = 0.0
            ok    = False

        return {
            "ok":         ok,
            "score":      score,
            "bull_1h":    bull_1h,
            "above_ema20": above_ema20,
            "rsi_1h":     round(rsi_1h, 1),
            "ret_4bar":   round(ret_4bar, 2),
            "aligned":    strong_align,
            "reason":     f"1h EMA {'BULL' if bull_1h else 'BEAR'} | RSI {rsi_1h:.0f} | {'HİZALI ✓' if ok else 'ÇAKIŞIYOR ✗'}",
        }

    except Exception as e:
        return {"ok": True, "score": 0.5, "reason": f"MTF analizi hatası: {e}", "aligned": False}


# ── 3. PİYASA GENİŞLİĞİ ──────────────────────────────────────────────────────

def check_market_breadth(
    tickers: dict,
    macro_mode: str = "NEUTRAL"
) -> dict:
    """
    Piyasadaki kaç coin yükseliyor?
    Tüm borsayı aşağı çekiyorsa tek bir coinin rallisi güvenilir değil.

    tickers: ccxt.fetch_tickers() çıktısı (zaten radarda var)
    """
    global _breadth_cache

    # Cache geçerliyse direkt döndür
    if (time.time() - _breadth_cache["ts"]) < BREADTH_CACHE_TTL and _breadth_cache["value"] is not None:
        cached = _breadth_cache
        return {
            "ok":        cached["value"],
            "score":     cached["score"],
            "bull_pct":  cached["bull_pct"],
            "reason":    cached["reason"],
        }

    min_bull = BEAR_BREADTH if macro_mode == "BEAR" else BREADTH_MIN_BULL

    try:
        if not tickers:
            return {"ok": True, "score": 0.5, "bull_pct": 0.5, "reason": "Ticker yok — geçildi"}

        # USDT çiftlerini filtrele, son 24h değişimine bak
        total    = 0
        rising   = 0
        falling  = 0

        for symbol, t in tickers.items():
            if not symbol.endswith("/USDT"):
                continue
            if "UP" in symbol or "DOWN" in symbol:
                continue
            chg = t.get("percentage") or t.get("change")
            if chg is None:
                continue
            try:
                chg = float(chg)
            except (ValueError, TypeError):
                continue
            total  += 1
            if chg > 0:
                rising  += 1
            elif chg < 0:
                falling += 1

        if total < 10:
            return {"ok": True, "score": 0.5, "bull_pct": 0.5, "reason": "Yetersiz veri — geçildi"}

        bull_pct    = rising / total
        bearish_pct = falling / total

        ok = bull_pct >= min_bull

        if bull_pct >= BREADTH_STRONG_BULL:
            score = 1.0
        elif bull_pct >= min_bull:
            score = 0.7
        elif bull_pct >= 0.30:
            score = 0.3
        else:
            score = 0.0

        reason = f"%{bull_pct*100:.0f} yükseliyor ({rising}/{total}) | {'GENİŞ ✓' if ok else 'DAR ✗'}"

        # Cache'e yaz
        _breadth_cache = {
            "value":       ok,
            "score":       score,
            "bull_pct":    round(bull_pct, 3),
            "bearish_pct": round(bearish_pct, 3),
            "reason":      reason,
            "ts":          time.time(),
        }

        return {"ok": ok, "score": score, "bull_pct": round(bull_pct, 3), "reason": reason}

    except Exception as e:
        return {"ok": True, "score": 0.5, "bull_pct": 0.5, "reason": f"Genişlik hatası: {e}"}


# ── ANA DOĞRULAMA ─────────────────────────────────────────────────────────────

def validate_signal(
    symbol:     str,
    score:      float,
    regime:     str,
    metrics:    dict,
    exchange,
    tickers:    dict  = None,
    macro_mode: str   = "NEUTRAL",
    strict:     bool  = True,
) -> dict:
    """
    Bir alım sinyalini 3 filtreden geçir.

    strict=True -> tüm 3 filtre geçilmeli (BEAR modunda önerilen)
    strict=False -> 2/3 filtre yeterli (BULL modunda daha rahat)

    Döndürür: {approved, confidence, filters, reason, details}
    """
    # v2.5: BULL ve NEUTRAL modda 2/3 filtre yeterli (sadece BEAR'da 3/3 zorunlu)
    if macro_mode in ("BULL", "NEUTRAL"):
        strict = False

    # ── Filtre 1: Hacim ───────────────────────────────────────────────────────
    vol = check_volume_anomaly(symbol, exchange, macro_mode)

    # ── Filtre 2: Çoklu Zaman Dilimi ─────────────────────────────────────────
    mtf = check_multi_timeframe(symbol, exchange, macro_mode)

    # ── Filtre 3: Piyasa Genişliği ────────────────────────────────────────────
    if tickers:
        breadth = check_market_breadth(tickers, macro_mode)
    else:
        breadth = {"ok": True, "score": 0.5, "bull_pct": 0.5, "reason": "Ticker yok — geçildi"}

    # ── Confidence Hesabı ─────────────────────────────────────────────────────
    confidence = (
        vol["score"]     * WEIGHT_VOLUME  +
        mtf["score"]     * WEIGHT_MTF     +
        breadth["score"] * WEIGHT_BREADTH
    )

    # ── Onay Kararı ───────────────────────────────────────────────────────────
    filters_ok = {
        "volume_ok":  vol["ok"],
        "mtf_ok":     mtf["ok"],
        "breadth_ok": breadth["ok"],
    }
    passed = sum(filters_ok.values())

    if strict:
        approved = passed == 3
    else:
        approved = passed >= 2

    # Güven eşiği — v2.5: 0.35 -> 0.30 (daha fazla sinyal geçsin)
    if confidence < 0.30:
        approved = False

    # Neden
    if approved:
        reason = f"Onay ✓ ({passed}/3 filtre | güven:{confidence:.0%})"
    else:
        failed = [k.replace("_ok", "") for k, v in filters_ok.items() if not v]
        reason = f"Red ✗ ({passed}/3 filtre | güven:{confidence:.0%}) — başarısız: {', '.join(failed) or 'güven düşük'}"

    return {
        "approved":   approved,
        "confidence": round(confidence, 3),
        "passed":     passed,
        "strict":     strict,
        "filters":    filters_ok,
        "reason":     reason,
        "details": {
            "volume":  vol,
            "mtf":     mtf,
            "breadth": breadth,
        },
    }


# ── HIZLI ONAY (Tek API Çağrısı) ─────────────────────────────────────────────

def fast_validate(
    symbol:     str,
    exchange,
    tickers:    dict  = None,
    macro_mode: str   = "NEUTRAL",
) -> dict:
    """
    Sadece hacim + piyasa genişliği — MTF dahil değil.
    Radar döngüsünde hız gerektiren durumlarda kullan.
    """
    vol     = check_volume_anomaly(symbol, exchange, macro_mode)
    breadth = check_market_breadth(tickers or {}, macro_mode)

    confidence = vol["score"] * 0.6 + breadth["score"] * 0.4
    approved   = vol["ok"] or breadth["ok"]   # 1/2 yeterli (hızlı onay)

    return {
        "approved":   approved,
        "confidence": round(confidence, 3),
        "filters":    {"volume_ok": vol["ok"], "breadth_ok": breadth["ok"]},
        "reason":     f"Hızlı: hacim x{vol.get('ratio',0):.1f} | %{breadth.get('bull_pct',0)*100:.0f} bull",
    }


# ── PIYASA DURUMU ÖZETI ───────────────────────────────────────────────────────

def get_market_context(tickers: dict, macro_mode: str = "NEUTRAL") -> dict:
    """
    Piyasa genişliğini hesapla ve özetle.
    Backend /scan-status veya log'larda gösterilebilir.
    """
    breadth = check_market_breadth(tickers, macro_mode)
    bull_pct = breadth.get("bull_pct", 0)

    if bull_pct >= 0.65:
        sentiment = "GÜÇLÜ YÜKSELİŞ"
    elif bull_pct >= 0.50:
        sentiment = "ILIMLI YÜKSELİŞ"
    elif bull_pct >= 0.40:
        sentiment = "KARIŞIK"
    elif bull_pct >= 0.30:
        sentiment = "ZAYIF"
    else:
        sentiment = "DÜŞÜŞ BASKISI"

    return {
        "sentiment":  sentiment,
        "bull_pct":   bull_pct,
        "breadth_ok": breadth["ok"],
        "macro_mode": macro_mode,
    }


# ── CLI TEST ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    symbol = sys.argv[1] if len(sys.argv) > 1 else "BTC/USDT"
    mode   = sys.argv[2] if len(sys.argv) > 2 else "NEUTRAL"

    ex = ccxt.binance({
        "enableRateLimit": True,
        "options": {"defaultType": "spot"},
    })

    print(f"\n  Sinyal doğrulanıyor: {symbol} (makro mod: {mode})")
    print("  " + "─" * 55)

    result = validate_signal(
        symbol     = symbol,
        score      = 80,
        regime     = "TRENDING_UP",
        metrics    = {},
        exchange   = ex,
        macro_mode = mode,
        strict     = mode == "BEAR",
    )

    icon = "✓" if result["approved"] else "✗"
    print(f"  {icon} {result['reason']}")
    print()
    for fname, fok in result["filters"].items():
        status = "✓" if fok else "✗"
        detail = result["details"].get(fname.replace("_ok", ""), {})
        print(f"  [{status}] {fname:<12} -> {detail.get('reason', '—')}")
    print()
    print(f"  Güven skoru: {result['confidence']:.0%}")
