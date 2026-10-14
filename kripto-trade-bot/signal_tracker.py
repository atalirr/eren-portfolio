"""
ANTIGRAVITY AI — Sinyal Doğruluk Takipçisi v2.0
================================================
İyileştirmeler:
  - 5. log_signal_full(): XGBoost için genişletilmiş özellik kaydı
       (RSI, stoch_k, bb_pct, z_score, vol_ratio, adx, atr_pct,
        macd_hist, trend_4h, ob_imbalance, rejim)
  - 13. update_signals() backend tarafından otomatik çağrılır
"""

import json
import time
import os
import ccxt
from datetime import datetime
from dotenv import load_dotenv
import threading

_signal_lock = threading.Lock()

load_dotenv()

SIGNAL_FILE = "signal_log.json"
CHECK_AFTER = [4, 24]   # saat sonra fiyat kontrol et

# Triple Barrier parametreleri (gerçekçi ML etiketleme)
BARRIER_TP_PCT    = 3.0    # Take profit: +%3.0
BARRIER_SL_PCT    = 2.0    # Stop loss: -%2.0  
BARRIER_TIMEOUT_H = 8      # Maksimum bekleme: 8 saat
COMMISSION_PCT    = 0.20   # Round-trip komisyon: %0.20

exchange = ccxt.binance({
    "enableRateLimit": True,
    "options": {"defaultType": "spot"},
    "timeout": 30000,
})


def load_signals():
    if os.path.exists(SIGNAL_FILE):
        try:
            with open(SIGNAL_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return []


def save_signals(data):
    try:
        tmp = SIGNAL_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp, SIGNAL_FILE)
    except Exception as e:
        print(f"Signal kayıt hatası: {e}")


# ── ESKİ UYUMLULUK (backend hâlâ çağırabilir) ────────────────────────────────
def log_signal(symbol: str, score: float, price: float):
    """Geriye dönük uyumluluk — temel sinyal kaydı."""
    log_signal_full(symbol, score, price, {}, "UNKNOWN")


# ── 5. GENİŞLETİLMİŞ SİNYAL KAYDI (XGBoost İçin) ──────────────────────────
def log_signal_full(symbol: str, score: float, price: float,
                    metrics: dict, regime: str):
    """
    Her alım sinyalinde tam özellik seti kaydeder.
    Bu veri daha sonra XGBoost modelini eğitmek için kullanılır.

    Kaydedilen özellikler (15 adet):
      - rsi, stoch_k, bb_pct, z_score, vol_ratio
      - adx, atr_pct, macd_pos (bool)
      - trend_4h, rsi_4h, bb_pct_4h, macd_pos_4h, z_score_4h
      - ob_imbalance, volatility
      - rejim, skor (ayrı alanlar)
    """
    with _signal_lock:
        signals = load_signals()
        entry = {
            "symbol":    symbol,
            "score":     score,
            "price":     price,
            "regime":    regime,
            "timestamp": time.time(),
            "time_str":  datetime.now().strftime("%Y-%m-%d %H:%M"),
            # XGBoost özellikleri
            "features": {
                "rsi":          metrics.get("rsi", 50),
                "stoch_k":      metrics.get("stoch_k", 50),
                "bb_pct":       metrics.get("bb_pct", 0.5),
                "z_score":      metrics.get("z_score", 0),
                "vol_ratio":    metrics.get("vol_ratio", 1),
                "adx":          metrics.get("adx", 0),
                "atr_pct":      metrics.get("atr_pct", 1.5),
                "macd_pos":     1 if metrics.get("macd_pos", False) else 0,
                "trend_4h":     {"BULLISH": 1, "BEARISH": -1, "NEUTRAL": 0}.get(
                                    metrics.get("trend_4h", "NEUTRAL"), 0),
                "rsi_4h":       metrics.get("rsi_4h", 50),
                "bb_pct_4h":    metrics.get("bb_pct_4h", 0.5),
                "macd_pos_4h":  1 if metrics.get("macd_pos_4h", False) else 0,
                "z_score_4h":   metrics.get("z_score_4h", 0),
                "ob_imbalance": metrics.get("ob_imbalance", 0.5),
                "volatility":   metrics.get("volatility", 0),
            },
            "checks": {}
        }
        signals.append(entry)
        # Maksimum 5000 sinyal tut (bellek yönetimi)
        if len(signals) > 5000:
            signals = signals[-5000:]
        save_signals(signals)


# ── BEKLEYEN SİNYALLERİ GÜNCELLE ─────────────────────────────────────────────
def update_signals():
    """Bekleyen sinyallerin fiyatlarını güncelle. Backend otomatik çağırır."""
    signals = load_signals()
    now     = time.time()
    changed = False
    new_labels = 0

    for sig in signals:
        sym = sig["symbol"].replace("-", "/")
        for hours in CHECK_AFTER:
            key = f"{hours}h"
            if key in sig.get("checks", {}):
                continue
            if now - sig.get("timestamp", now) >= hours * 3600:
                try:
                    ticker    = exchange.fetch_ticker(sym)
                    price_now = ticker["last"]
                    pnl_pct   = (price_now - sig["price"]) / sig["price"] * 100
                    if "checks" not in sig:
                        sig["checks"] = {}
                    sig["checks"][key] = {
                        "price":   price_now,
                        "pnl_pct": round(pnl_pct, 2),
                        "outcome": "WIN" if pnl_pct > 0 else "LOSS"
                    }
                    changed = True
                    if key == "24h":
                        new_labels += 1
                    time.sleep(0.3)
                except Exception as e:
                    print(f"  Güncelleme hatası ({sym}): {e}")

    if changed:
        save_signals(signals)
    return {"changed": changed, "new_24h_labels": new_labels}


def update_signals_triple_barrier():
    """Triple barrier method ile sinyal etiketleme.
    
    24h spot fiyat kontrolü yerine, sinyal anından itibaren:
    - TP'ye (%+3.0) vurulursa → WIN
    - SL'ye (%-2.0) vurulursa → LOSS  
    - Timeout (8h) dolursa → net PnL'ye göre karar
    Bu, botun gerçek çıkış kurallarına çok daha yakındır.
    """
    signals = load_signals()
    now     = time.time()
    changed = False
    new_labels = 0

    for sig in signals:
        tb_key = "triple_barrier"
        if tb_key in sig.get("checks", {}):
            continue
        # Timeout süresi dolmamışsa henüz etiketleme
        elapsed_h = (now - sig.get("timestamp", now)) / 3600
        if elapsed_h < BARRIER_TIMEOUT_H:
            continue

        sym = sig["symbol"].replace("-", "/")
        try:
            # Sinyal anından itibaren 1H bar verisi çek
            since_ms = int(sig["timestamp"] * 1000)
            bars = exchange.fetch_ohlcv(sym, '1h', since=since_ms,
                                         limit=BARRIER_TIMEOUT_H + 2)
            if not bars or len(bars) < 2:
                continue

            entry_price = sig["price"]
            tp_price = entry_price * (1 + BARRIER_TP_PCT / 100)
            sl_price = entry_price * (1 - BARRIER_SL_PCT / 100)

            barrier_hit = "TIMEOUT"
            exit_price  = entry_price

            for bar in bars[1:]:  # İlk bar giriş barı, atla
                bar_high  = bar[2]
                bar_low   = bar[3]
                bar_close = bar[4]

                # Aynı bar içinde hem SL hem TP vurulabilir — SL öncelikli (worst case)
                if bar_low <= sl_price:
                    barrier_hit = "SL"
                    exit_price  = sl_price
                    break
                if bar_high >= tp_price:
                    barrier_hit = "TP"
                    exit_price  = tp_price
                    break
            else:
                # Timeout: son kapanışa bak
                if bars:
                    exit_price = bars[-1][4]
                    barrier_hit = "TIMEOUT"

            pnl_pct = (exit_price - entry_price) / entry_price * 100
            net_pnl = pnl_pct - COMMISSION_PCT

            if "checks" not in sig:
                sig["checks"] = {}
            sig["checks"][tb_key] = {
                "outcome":     "WIN" if net_pnl > 0 else "LOSS",
                "pnl_pct":     round(pnl_pct, 2),
                "net_pnl_pct": round(net_pnl, 2),
                "exit_price":  round(exit_price, 6),
                "barrier_hit": barrier_hit,
            }
            changed = True
            new_labels += 1
            time.sleep(0.5)
        except Exception as e:
            print(f"  TB etiketleme hatası ({sym}): {e}")

    if changed:
        save_signals(signals)
    return {"changed": changed, "new_tb_labels": new_labels}


# ── DOĞRULUK RAPORU ───────────────────────────────────────────────────────────
def print_accuracy_report():
    signals = load_signals()
    if not signals:
        print("  Henüz sinyal yok.")
        return

    print("\n" + "=" * 60)
    print("  SİNYAL DOĞRULUK RAPORU")
    print("=" * 60)

    for hours in CHECK_AFTER:
        key     = f"{hours}h"
        checked = [s for s in signals if key in s.get("checks", {})]
        if not checked:
            print(f"\n  {hours}h sonuç: henüz yok ({len(signals)} bekliyor)")
            continue
        wins    = [s for s in checked if s["checks"][key]["outcome"] == "WIN"]
        wr      = len(wins) / len(checked) * 100
        avg_pnl = sum(s["checks"][key]["pnl_pct"] for s in checked) / len(checked)
        print(f"\n  {hours} SAAT SONRA:")
        print(f"  Win Rate  : {wr:.1f}%  ({len(wins)}/{len(checked)} sinyal)")
        print(f"  Ortalama  : {avg_pnl:+.2f}%")
        if wr >= 60:    print(f"  Sonuç     : Model bu zaman diliminde güçlü")
        elif wr >= 50:  print(f"  Sonuç     : Ortalama — iyileştirme gerekebilir")
        else:           print(f"  Sonuç     : Model bu zaman diliminde zayıf")

    # Skor kalibrasyonu
    print("\n  SKOR KALİBRASYONU (24h sonuç):")
    key = "24h"
    bins = {"65-70": [], "70-75": [], "75-80": [], "80-85": [], "85-90": [], "90+": []}
    for s in signals:
        if key not in s.get("checks", {}): continue
        sc = s["score"]
        outcome = 1 if s["checks"][key]["outcome"] == "WIN" else 0
        if 65 <= sc < 70:   bins["65-70"].append(outcome)
        elif 70 <= sc < 75: bins["70-75"].append(outcome)
        elif 75 <= sc < 80: bins["75-80"].append(outcome)
        elif 80 <= sc < 85: bins["80-85"].append(outcome)
        elif 85 <= sc < 90: bins["85-90"].append(outcome)
        elif sc >= 90:      bins["90+"].append(outcome)
    for b, outcomes in bins.items():
        if outcomes:
            wr = sum(outcomes) / len(outcomes) * 100
            print(f"  Skor {b}: {wr:.0f}% win  ({len(outcomes)} sinyal)")

    # XGBoost veri durumu
    total_with_features = sum(1 for s in signals if "features" in s)
    total_labeled       = sum(1 for s in signals if "24h" in s.get("checks", {}))
    print(f"\n  XGBoost Veri Durumu:")
    print(f"  Özellik kayıtlı  : {total_with_features}/{len(signals)}")
    print(f"  Etiketli (24h)   : {total_labeled}")
    if total_labeled >= 500:
        print(f"  Durum: HAZIR — python train_model.py çalıştırabilirsin")
    else:
        remaining = 500 - total_labeled
        print(f"  Durum: {remaining} etiketli sinyal daha gerekli")

    print("=" * 60 + "\n")


# ── MANUEL ÇALIŞTIRMA ─────────────────────────────────────────────────────────
def main():
    print("\n  Sinyal takipçisi başlatıldı. Çıkmak için Ctrl+C\n")
    while True:
        print(f"  [{datetime.now().strftime('%H:%M:%S')}] Kontrol ediliyor...")
        update_signals()
        print_accuracy_report()
        time.sleep(300)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n  Tracker durduruldu.")
        print_accuracy_report()
