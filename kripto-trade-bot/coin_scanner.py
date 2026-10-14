"""
ANTIGRAVITY AI — Katman 2: Dinamik Coin Tarayıcı
==================================================
Tüm Binance USDT çiftlerini tarayıp en güçlü coinleri seçer.
Sabit TEST_SYMBOLS listesinin yerini alır.

TARAMA KRİTERLERİ:
  1. Hacim Patlaması  — günlük hacim 20 günlük ortalamanın 2×+ üstünde
  2. Fiyat Momentumu  — son 24h ve 4h getirisi pozitif
  3. EMA Hizası      — 4h EMA20 > EMA50 (kısa vadeli bull)
  4. BTC'ye Göre Güç — BTC'den daha iyi performans gösteriyor
  5. Minimum Likidite — günlük $2M+ hacim (spam coinleri filtrele)

SKORLAMA:
  Her kriter 0-4 arası puan verir, toplam 0-20
  Top N coin döndürülür (varsayılan 20)

CACHE: 1 saatte bir yenile (çok fazla API çağrısı yapmaz)

Kullanım:
  from coin_scanner import get_top_coins, get_scan_state
  coins = get_top_coins(n=20)          # ["BTC/USDT", "ETH/USDT", ...]
  state = get_scan_state()             # Tam tarama raporu
"""

import ccxt
import pandas as pd
import numpy as np
import time
import json
import os
from datetime import datetime
from typing import List, Dict

# ── AYARLAR ──────────────────────────────────────────────────────────────────
CACHE_TTL        = 1 * 3600      # 1 saat
CACHE_FILE       = "scan_state.json"
MIN_DAILY_VOL_USD = 2_000_000    # Minimum $2M günlük hacim (kalite filtresi — DÜŞÜRME)
# v2.4: Taranan evren genişletildi. Daha çok coin = daha çok FIRSAT.
#        Ama kalite korunsun diye min hacim filtresi aynı kalıyor ve
#        skor motorundaki "uzama cezası" kötü girişleri eliyor.
TOP_N_DEFAULT    = 200           # Radara beslenen coin sayısı (80 -> 200, 2.5x daha geniş havuz)
MAX_SCAN_SYMBOLS = 500           # Taranacak maksimum sembol (400 -> 500)

# Hariç tutulacak token türleri (regex değil, içerip içermediğine bak)
BLACKLIST_CONTAINS = [
    "UP", "DOWN", "BULL", "BEAR",   # Leveraged tokens
    "BUSD", "USDC", "USDT", "TUSD", "FDUSD", "DAI", "EUR", "TRY",  # Stables/fiat
    "XUSD", "BFUSD", "USDP", "AEUR", "BETH", "WBTC", "WETH", "USDE", "USD", # Stablecoin / Wrapped / Fiat / Pegged leaks
    "NFT", "FAN",
]

# Her zaman dahil edilecek temel coinler (çok düşük hacim çekse bile)
ALWAYS_INCLUDE = ["BTC/USDT", "ETH/USDT"]

# ── CACHE ─────────────────────────────────────────────────────────────────────
_cache: dict = {}

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


# ── SEMBOL LİSTESİ ────────────────────────────────────────────────────────────

def _get_current_macro_mode():
    try:
        from macro_filter import get_macro_mode
        return get_macro_mode()
    except Exception:
        return "NEUTRAL"

def fetch_usdt_symbols() -> List[str]:
    """
    Binance'deki tüm aktif USDT spot çiftlerini çek.
    Hacme göre sırala (24h ticker), ilk MAX_SCAN_SYMBOLS al.
    """
    ex = _get_exchange()
    try:
        tickers = ex.fetch_tickers()  # Tüm tickerları tek seferde çek
    except Exception as e:
        print(f"[SCANNER] Ticker çekilemedi: {e}")
        return ALWAYS_INCLUDE[:]

    # USDT çiftlerini filtrele
    usdt_tickers = []
    mode = _get_current_macro_mode()
    for symbol, t in tickers.items():
        if not symbol.endswith("/USDT"):
            continue

        # Blacklist kontrolü
        base = symbol.replace("/USDT", "")
        skip = False
        for bl in BLACKLIST_CONTAINS:
            if bl == "DOWN" and mode == "BEAR":
                continue  # BEAR modunda DOWN tokenları engelleme
            if bl in base:
                skip = True
                break
        if skip:
            continue

        vol_usd = float(t.get("quoteVolume") or 0)
        min_vol = 50_000 if ("DOWN" in base and mode == "BEAR") else MIN_DAILY_VOL_USD
        if vol_usd < min_vol:
            continue

        usdt_tickers.append((symbol, vol_usd))

    # Hacme göre sırala
    usdt_tickers.sort(key=lambda x: x[1], reverse=True)
    symbols = [s[0] for s in usdt_tickers[:MAX_SCAN_SYMBOLS]]

    # Her zaman dahil edilenleri ekle (zaten varsa duplicate olmaz)
    for s in ALWAYS_INCLUDE:
        if s not in symbols:
            symbols.insert(0, s)

    return symbols


# ── TEKİL KOİN ANALİZİ ───────────────────────────────────────────────────────

def analyze_coin(symbol: str, btc_ret_4h: float = 0.0, btc_ret_24h: float = 0.0) -> Dict:
    """
    Tek bir coin için teknik skor hesapla.
    btc_ret_*: BTC'nin aynı dönem getirisini karşılaştırma için al.
    """
    ex  = _get_exchange()
    try:
        bars = ex.fetch_ohlcv(symbol, "4h", limit=60)
    except Exception:
        return None

    if not bars or len(bars) < 30:
        return None

    df = pd.DataFrame(bars, columns=["time", "open", "high", "low", "close", "volume"])
    close = df["close"]
    vol   = df["volume"]

    score    = 0
    signals  = {}
    price    = float(close.iloc[-1])

    # ── 1. Hacim Patlaması (0-4 puan) ─────────────────────────────────────────
    avg_vol_20 = float(vol.iloc[-21:-1].mean())
    cur_vol    = float(vol.iloc[-1])
    vol_ratio  = cur_vol / (avg_vol_20 + 1e-9)
    signals["vol_ratio"] = round(vol_ratio, 2)

    if vol_ratio >= 4.0:
        score += 4
    elif vol_ratio >= 2.5:
        score += 3
    elif vol_ratio >= 1.5:
        score += 2
    elif vol_ratio >= 1.0:
        score += 1

    # ── 2. 4h Fiyat Momentumu (0-4 puan) ──────────────────────────────────────
    ret_4h = (price - float(close.iloc[-2])) / float(close.iloc[-2]) * 100
    signals["ret_4h_pct"] = round(ret_4h, 2)

    if ret_4h >= 3.0:
        score += 4
    elif ret_4h >= 1.5:
        score += 3
    elif ret_4h >= 0.5:
        score += 2
    elif ret_4h >= 0.0:
        score += 1

    # ── 3. 24h Momentum (0-4 puan) ────────────────────────────────────────────
    ret_24h = (price - float(close.iloc[-7])) / float(close.iloc[-7]) * 100  # ~24h (6 bar × 4h)
    signals["ret_24h_pct"] = round(ret_24h, 2)

    if ret_24h >= 8.0:
        score += 4
    elif ret_24h >= 4.0:
        score += 3
    elif ret_24h >= 1.5:
        score += 2
    elif ret_24h >= 0.0:
        score += 1

    # ── 4. EMA Hizası (0-4 puan) ──────────────────────────────────────────────
    ema20 = close.ewm(span=20, adjust=False).mean()
    ema50 = close.ewm(span=50, adjust=False).mean()
    ema_bull = float(ema20.iloc[-1]) > float(ema50.iloc[-1])
    above_ema20 = price > float(ema20.iloc[-1])
    signals["ema_bull"]     = ema_bull
    signals["above_ema20"]  = above_ema20

    if ema_bull and above_ema20:
        score += 4
    elif ema_bull:
        score += 2
    elif above_ema20:
        score += 1

    # ── 5. BTC'ye Göre Göreceli Güç (0-4 puan) ───────────────────────────────
    rs_4h  = ret_4h  - btc_ret_4h
    rs_24h = ret_24h - btc_ret_24h
    signals["rs_vs_btc_4h"]  = round(rs_4h, 2)
    signals["rs_vs_btc_24h"] = round(rs_24h, 2)

    if rs_4h > 2.0 and rs_24h > 3.0:
        score += 4
    elif rs_4h > 1.0 or rs_24h > 2.0:
        score += 3
    elif rs_4h > 0.0 and rs_24h > 0.0:
        score += 2
    elif rs_4h > 0.0 or rs_24h > 0.0:
        score += 1

    # ── Günlük hacim USD ──────────────────────────────────────────────────────
    # 4h × 6 = 24h yaklaşımı
    vol_24h_usd = float(vol.iloc[-6:].sum()) * price
    signals["vol_24h_usd"] = int(vol_24h_usd)

    return {
        "symbol":      symbol,
        "price":       price,
        "score":       score,
        "max_score":   20,
        "signals":     signals,
    }


# ── BTC REFERANS DEĞERLERİ ────────────────────────────────────────────────────

def get_btc_returns() -> tuple:
    """BTC'nin 4h ve 24h getirisini döndür (karşılaştırma için)."""
    ex = _get_exchange()
    try:
        bars = ex.fetch_ohlcv("BTC/USDT", "4h", limit=10)
        close = [b[4] for b in bars]
        ret_4h  = (close[-1] - close[-2]) / close[-2] * 100
        ret_24h = (close[-1] - close[-7]) / close[-7] * 100 if len(close) >= 7 else 0.0
        return round(ret_4h, 2), round(ret_24h, 2)
    except Exception:
        return 0.0, 0.0


# ── ANA TARAMA ────────────────────────────────────────────────────────────────

def run_scan(n: int = TOP_N_DEFAULT) -> dict:
    """
    Tam tarama yap: tüm USDT çiftlerini analiz et, en iyi N'i döndür.
    """
    print(f"\n[SCANNER] Tarama başlıyor...")
    t0 = time.time()

    # BTC referans değerleri
    btc_ret_4h, btc_ret_24h = get_btc_returns()
    print(f"[SCANNER] BTC referans: 4h={btc_ret_4h:+.1f}% 24h={btc_ret_24h:+.1f}%")

    # Sembol listesi
    symbols = fetch_usdt_symbols()
    print(f"[SCANNER] {len(symbols)} sembol taranacak...")

    results  = []
    errors   = 0
    scanned  = 0

    for symbol in symbols:
        result = analyze_coin(symbol, btc_ret_4h, btc_ret_24h)
        scanned += 1

        if result is None:
            errors += 1
            continue

        results.append(result)

        # İlerleme
        if scanned % 50 == 0:
            print(f"[SCANNER] {scanned}/{len(symbols)} tarandı...")

        # Rate limit için kısa bekleme
        time.sleep(0.05)

    # Skora göre sırala
    results.sort(key=lambda x: x["score"], reverse=True)
    top_n = results[:n]

    elapsed = round(time.time() - t0, 1)
    print(f"[SCANNER] Tarama tamamlandı: {scanned} tarandı, {errors} hata, {elapsed}s")

    state = {
        "top_coins":    [r["symbol"] for r in top_n],
        "details":      top_n,
        "total_scanned": scanned,
        "total_errors":  errors,
        "btc_ret_4h":   btc_ret_4h,
        "btc_ret_24h":  btc_ret_24h,
        "scan_seconds": elapsed,
        "updated_at":   datetime.now().strftime("%Y-%m-%d %H:%M"),
    }

    # Cache'e yaz
    _cache["state"] = state
    _cache["ts"]    = time.time()

    # Diske kaydet
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(state, f, indent=2, default=str)
    except Exception:
        pass

    return state


def _fallback_state():
    """Disk cache veya varsayılan liste döndür."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE) as f:
                cached = json.load(f)
            cached["from_cache"] = True
            return cached
        except Exception:
            pass
    # Disk cache de yoksa sabit listeyle devam
    return {
        "top_coins": [
            "BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT",
            "DOGE/USDT", "ADA/USDT", "AVAX/USDT", "LINK/USDT", "DOT/USDT",
            "MATIC/USDT", "UNI/USDT", "ATOM/USDT", "LTC/USDT", "BCH/USDT",
            "ETC/USDT", "FIL/USDT", "NEAR/USDT", "APT/USDT", "OP/USDT",
        ],
        "details":       [],
        "total_scanned": 0,
        "updated_at":    datetime.now().strftime("%Y-%m-%d %H:%M"),
        "fallback":      True,
    }


# ── GENEL API ─────────────────────────────────────────────────────────────────

def get_top_coins(n: int = TOP_N_DEFAULT, force_refresh: bool = False) -> List[str]:
    """
    En güçlü N coin listesini döndür.
    Cache TTL dolmadıysa API çağrısı yapmaz.
    """
    if not force_refresh:
        if _cache.get("ts") and (time.time() - _cache["ts"]) < CACHE_TTL:
            return _cache["state"]["top_coins"][:n]

    # Disk cache kontrol (sunucu yeni başladıysa)
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE) as f:
                cached = json.load(f)
            cached_ts = time.mktime(
                datetime.strptime(cached["updated_at"], "%Y-%m-%d %H:%M").timetuple()
            )
            if time.time() - cached_ts < CACHE_TTL:
                _cache["state"] = cached
                _cache["ts"]    = cached_ts
                return cached["top_coins"][:n]
        except Exception:
            pass

    try:
        state = run_scan(n)
        return state["top_coins"][:n]
    except Exception as e:
        print(f"[SCANNER] Tarama başarısız: {e}")
        return _fallback_state()["top_coins"][:n]


def get_scan_state(force_refresh: bool = False) -> dict:
    """Tam tarama durumunu döndür."""
    if not force_refresh:
        if _cache.get("ts") and (time.time() - _cache["ts"]) < CACHE_TTL:
            return _cache["state"]
    try:
        return run_scan()
    except Exception as e:
        print(f"[SCANNER] Tarama başarısız: {e}")
        return _fallback_state()


# ── RAPOR ────────────────────────────────────────────────────────────────────

def print_scan_report(n: int = 20):
    """Terminalde okunaklı tarama raporu bas."""
    state = get_scan_state(force_refresh=True)

    print("\n" + "=" * 70)
    print("  ANTIGRAVITY AI — KOİN TARAMA RAPORU (Katman 2)")
    print("=" * 70)
    print(f"  Taranan  : {state.get('total_scanned', 0)} sembol")
    print(f"  BTC 4h   : {state.get('btc_ret_4h', 0):+.1f}%  |  24h: {state.get('btc_ret_24h', 0):+.1f}%")
    print(f"  Süre     : {state.get('scan_seconds', '?')}s")
    print(f"  Güncelleme: {state.get('updated_at', '?')}")
    print()
    print(f"  {'SIRA':<5} {'SEMBOL':<14} {'SKOR':>5}  {'4h%':>7}  {'24h%':>7}  {'RS_4h':>7}  {'VOL_RATIO':>9}")
    print("-" * 70)

    for i, coin in enumerate(state.get("details", [])[:n], 1):
        sig = coin.get("signals", {})
        print(f"  {i:<5} {coin['symbol']:<14} {coin['score']:>4}/20"
              f"  {sig.get('ret_4h_pct', 0):>+7.1f}%"
              f"  {sig.get('ret_24h_pct', 0):>+7.1f}%"
              f"  {sig.get('rs_vs_btc_4h', 0):>+7.1f}"
              f"  {sig.get('vol_ratio', 0):>9.1f}x")

    print("=" * 70)
    print(f"\n  Top {n} coin listesi:")
    print("  " + ", ".join(state.get("top_coins", [])[:n]))
    print()


if __name__ == "__main__":
    import sys
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    print_scan_report(n)
