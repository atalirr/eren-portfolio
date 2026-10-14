"""
ANTIGRAVITY AI — Binance Copy Trader
=====================================
Binance SPOT leaderboard'undaki bir trader'ı takip eder.
Trader yeni pozisyon açınca bot da açar, kapatınca kapatır.
Risk yönetimi (sizing, stop, TP) tamamen senin botunda kalır.

KULLANIM:
  1. python copy_trader.py --list        -> Top trader'ları listele
  2. python copy_trader.py --follow ID   -> Trader ID'sini kaydet
  3. Backend çalışırken otomatik takip başlar

GEREKSİNİM:
  pip install requests
"""

import requests
import json
import time
import os
import sys
import argparse
from datetime import datetime

# ── AYARLAR ──────────────────────────────────────────────────────────────────
CONFIG_FILE    = "copy_config.json"       # Takip edilen trader bilgisi
POSITIONS_FILE = "tracked_positions.json" # Son bilinen pozisyonlar
SIGNAL_FILE    = "copy_signals.json"      # Bot'un okuyacağı sinyal dosyası
POLL_INTERVAL  = 300                      # Her 5 dakikada bir kontrol

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Content-Type": "application/json",
    "clienttype":   "web",
    "accept":       "*/*",
    "lang":         "en",
}

BASE_URL   = "https://www.binance.com"
LIST_URL   = f"{BASE_URL}/bapi/copy-trade/v2/public/copy-trade/lead-data/search-list"
POS_URL    = f"{BASE_URL}/bapi/copy-trade/v1/friendly/copy-trade/lead-portfolio/positions"
DETAIL_URL = f"{BASE_URL}/bapi/copy-trade/v1/public/copy-trade/lead-data/detail"


# ── API FONKSIYONLARI ─────────────────────────────────────────────────────────

def get_leaderboard(limit=20, sort_by="ROI", time_range="30D"):
    """
    Binance SPOT copy trading liderboard'unu çek.
    sort_by: ROI | PNL | COPIERS
    time_range: 7D | 30D | 90D | ALL
    """
    payload = {
        "products":   ["SPOT"],
        "tradeType":  "SPOT",
        "timeRange":  time_range,
        "sortType":   sort_by,
        "pageNumber": 1,
        "pageSize":   limit,
    }
    try:
        r = requests.post(LIST_URL, json=payload, headers=HEADERS, timeout=15)
        r.raise_for_status()
        data = r.json()
        if data.get("code") != "000000":
            print(f"  API hatası: {data.get('message', 'Bilinmiyor')}")
            return []
        return data.get("data", {}).get("list", [])
    except requests.exceptions.ConnectionError:
        print("  BAĞLANTI HATASI: Binance'e erişilemiyor.")
        print("  VPN açık mıdır? İnternet bağlantısını kontrol et.")
        return []
    except Exception as e:
        print(f"  Leaderboard çekilemedi: {e}")
        return []


def get_trader_positions(portfolio_id):
    """Belirli bir trader'ın açık SPOT pozisyonlarını çek."""
    params = {
        "portfolioId": portfolio_id,
        "tradeType":   "SPOT",
    }
    try:
        r = requests.get(POS_URL, params=params, headers=HEADERS, timeout=15)
        r.raise_for_status()
        data = r.json()
        if data.get("code") != "000000":
            return []
        return data.get("data", {}).get("list", [])
    except requests.exceptions.ConnectionError:
        print("  BAĞLANTI HATASI: Binance'e erişilemiyor.")
        return []
    except Exception as e:
        print(f"  Pozisyonlar alınamadı: {e}")
        return []


def get_trader_detail(portfolio_id):
    """Trader detay bilgisini çek."""
    params = {"portfolioId": portfolio_id, "tradeType": "SPOT"}
    try:
        r = requests.get(DETAIL_URL, params=params, headers=HEADERS, timeout=15)
        data = r.json()
        return data.get("data", {})
    except Exception:
        return {}


# ── LEADERBOARD GÖSTER ────────────────────────────────────────────────────────

def show_leaderboard(limit=20):
    """Top trader'ları tabloya bas."""
    print("\n" + "=" * 75)
    print("  BİNANCE SPOT COPY TRADING — TOP TRADER'LAR (Son 30 Gün)")
    print("=" * 75)
    print("  %-5s %-20s %8s %10s %8s %10s" % (
        "SIRA", "TRADER ADI", "ROI%", "PNL($)", "TAKİPÇİ", "PORTFOLIO_ID"))
    print("-" * 75)

    traders = get_leaderboard(limit)
    if not traders:
        print("  Trader listesi alınamadı.")
        print("\n  NOT: Binance bazen bölgeye göre erişimi kısıtlıyor.")
        print("  Çözüm: https://www.binance.com/copy-trading/spot'tan")
        print("  manuel olarak bir trader'ın ID'sini kopyalayabilirsin.")
        return []

    for i, t in enumerate(traders, 1):
        roi       = float(t.get("roi", 0)) * 100
        pnl       = float(t.get("pnl", 0))
        followers = t.get("followerCount", 0)
        pid       = t.get("leadPortfolioId", "—")
        name      = t.get("nickName", "Anonim")[:20]
        symbol    = "[+]" if roi > 0 else "[-]"
        print("  %s %-4d %-20s %7.1f%% %+9.2f$ %7d  %s" % (
            symbol, i, name, roi, pnl, followers, pid))

    print("=" * 75)
    print("\n  Takip etmek için: python copy_trader.py --follow <PORTFOLIO_ID>")
    return traders


# ── TRADER SEÇ VE KAYDET ──────────────────────────────────────────────────────

def save_config(portfolio_id, name=""):
    config = {
        "portfolio_id": str(portfolio_id),
        "name":         name,
        "set_at":       datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
    print(f"\n  Kaydedildi! Takip edilen trader: {name or portfolio_id}")
    print(f"  Backend başladığında otomatik takip başlayacak.\n")


def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE) as f:
            return json.load(f)
    return None


# ── POZİSYON KARŞILAŞTIR -> SİNYAL ÜRET ──────────────────────────────────────

def positions_to_dict(positions):
    """Pozisyon listesini {symbol: bilgi} dict'ine çevir."""
    result = {}
    for p in positions:
        symbol = p.get("symbol", "").replace("USDT", "/USDT")
        if symbol:
            result[symbol] = {
                "amount":      float(p.get("positionAmount", 0)),
                "entry_price": float(p.get("entryPrice", 0)),
                "pnl":         float(p.get("unrealizedPnl", 0)),
            }
    return result


def load_tracked_positions():
    if os.path.exists(POSITIONS_FILE):
        with open(POSITIONS_FILE) as f:
            return json.load(f)
    return {}


def save_tracked_positions(positions):
    with open(POSITIONS_FILE, "w") as f:
        json.dump(positions, f, indent=2)


def write_signal(action, symbol, reason=""):
    """Bot'un okuyacağı sinyal dosyasına yaz."""
    signals = []
    if os.path.exists(SIGNAL_FILE):
        try:
            with open(SIGNAL_FILE) as f:
                signals = json.load(f)
        except Exception:
            signals = []

    signal = {
        "action":    action,      # BUY veya SELL
        "symbol":    symbol,      # BTC/USDT
        "source":    "COPY_TRADE",
        "reason":    reason,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "processed": False,
    }
    signals.insert(0, signal)
    signals = signals[:50]       # Son 50 sinyali tut

    with open(SIGNAL_FILE, "w") as f:
        json.dump(signals, f, indent=2)

    print(f"  [{action}] {symbol} sinyali yazıldı ({reason})")


def detect_changes(old_positions, new_positions):
    """Eski ve yeni pozisyonları karşılaştır, değişiklikleri bul."""
    signals = []

    # Yeni açılan pozisyonlar -> BUY sinyali
    for symbol, info in new_positions.items():
        if symbol not in old_positions:
            signals.append(("BUY", symbol, "Trader yeni pozisyon açtı"))
            write_signal("BUY", symbol, "Trader yeni pozisyon açtı")

    # Kapanan pozisyonlar -> SELL sinyali
    for symbol in old_positions:
        if symbol not in new_positions:
            signals.append(("SELL", symbol, "Trader pozisyonu kapattı"))
            write_signal("SELL", symbol, "Trader pozisyonu kapattı")

    return signals


# ── ANA TAKİP DÖNGÜSÜ ─────────────────────────────────────────────────────────

def run_follow_loop(portfolio_id, name=""):
    """Sürekli çalışan takip döngüsü."""
    print("\n" + "=" * 60)
    print(f"  COPY TRADER BAŞLADI")
    print(f"  Trader   : {name or portfolio_id}")
    print(f"  Kontrol  : Her {POLL_INTERVAL//60} dakikada bir")
    print(f"  Sinyal   : {SIGNAL_FILE}")
    print("=" * 60)
    print("  Durdurmak için: Ctrl+C\n")

    tracked = load_tracked_positions()
    errors  = 0

    while True:
        try:
            now = datetime.now().strftime("%H:%M:%S")
            print(f"  [{now}] Pozisyonlar kontrol ediliyor...", end=" ")

            positions = get_trader_positions(portfolio_id)

            if positions is None:
                print("API hatası, bekleniyor...")
                errors += 1
                if errors >= 5:
                    print("  5 ardışık hata — 10 dakika bekleniyor...")
                    time.sleep(600)
                    errors = 0
                time.sleep(60)
                continue

            current = positions_to_dict(positions)
            errors  = 0

            # Değişiklik kontrolü
            changes = detect_changes(tracked, current)

            if changes:
                print(f"{len(changes)} değişiklik!")
                for action, symbol, reason in changes:
                    print(f"    -> {action}: {symbol} ({reason})")
            else:
                coin_list = ", ".join(current.keys()) if current else "boş portföy"
                print(f"değişiklik yok ({coin_list})")

            save_tracked_positions(current)
            tracked = current

        except KeyboardInterrupt:
            print("\n\n  Copy trader durduruldu.")
            break
        except Exception as e:
            print(f"HATA: {e}")
            errors += 1

        time.sleep(POLL_INTERVAL)


# ── SİNYAL OKUYUCU (backend için) ────────────────────────────────────────────

def get_pending_signals():
    """
    Backend'in çağırdığı fonksiyon.
    İşlenmemiş sinyalleri döndürür, sonra işlenmiş işaretle.
    """
    if not os.path.exists(SIGNAL_FILE):
        return []

    try:
        with open(SIGNAL_FILE) as f:
            signals = json.load(f)
    except Exception:
        return []

    pending  = [s for s in signals if not s.get("processed")]
    if pending:
        # İşlenmiş işaretle
        for s in signals:
            if not s.get("processed"):
                s["processed"] = True
        with open(SIGNAL_FILE, "w") as f:
            json.dump(signals, f, indent=2)

    return pending


# ── KOMUT SATIRI ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Binance Copy Trader")
    parser.add_argument("--list",   action="store_true", help="Top trader'ları listele")
    parser.add_argument("--follow", type=str,            help="Trader ID'si ile takibe başla")
    parser.add_argument("--status", action="store_true", help="Mevcut takip durumunu göster")
    parser.add_argument("--stop",   action="store_true", help="Takibi durdur (config sil)")
    parser.add_argument("--limit",  type=int, default=20,help="Listelenecek trader sayısı")
    args = parser.parse_args()

    if args.list:
        show_leaderboard(args.limit)

    elif args.follow:
        # Trader adını almaya çalış
        detail = get_trader_detail(args.follow)
        name   = detail.get("nickName", "")
        save_config(args.follow, name)
        print(f"\n  Şimdi takibi başlatmak için:")
        print(f"  python copy_trader.py --start")

    elif args.status:
        config = load_config()
        if not config:
            print("\n  Henüz takip edilen trader yok.")
            print("  python copy_trader.py --list  ->  trader listele")
            print("  python copy_trader.py --follow ID  ->  takibe başla")
        else:
            print(f"\n  Takip edilen: {config['name'] or config['portfolio_id']}")
            print(f"  Ayarlandı  : {config['set_at']}")
            tracked = load_tracked_positions()
            if tracked:
                print(f"  Açık pozisyonlar ({len(tracked)}):")
                for sym, info in tracked.items():
                    print(f"    {sym}: giriş ${info['entry_price']:.4f}, "
                          f"PnL ${info['pnl']:+.2f}")
            else:
                print("  Takip pozisyonu yok (henüz çalıştırılmadı)")

    elif args.stop:
        for f in [CONFIG_FILE, POSITIONS_FILE]:
            if os.path.exists(f): os.remove(f)
        print("  Takip durdu, config silindi.")

    elif hasattr(args, 'start') or "--start" in sys.argv:
        config = load_config()
        if not config:
            print("  Önce takip edilecek trader'ı seç:")
            print("  python copy_trader.py --list")
            print("  python copy_trader.py --follow <ID>")
        else:
            run_follow_loop(config["portfolio_id"], config.get("name", ""))

    else:
        # Hiç argüman yoksa —list gibi davran
        config = load_config()
        if config:
            print(f"\n  Mevcut config: {config['name'] or config['portfolio_id']}")
            print(f"  Takibi başlatmak için: python copy_trader.py --start")
        show_leaderboard(args.limit)


if __name__ == "__main__":
    # --start argümanı için özel kontrol (argparse'ın dışında)
    if "--start" in sys.argv:
        config = load_config()
        if not config:
            print("  Önce: python copy_trader.py --follow <PORTFOLIO_ID>")
        else:
            run_follow_loop(config["portfolio_id"], config.get("name", ""))
    else:
        main()
