import os
import json
import threading
from datetime import datetime, timezone, timedelta
from rich.console import Console
from rich.markup import escape as rich_escape

console = Console()

DB_FILE    = "bot_ledger.json"
STATE_FILE = "bot_state.json"
HISTORY_FILE = "trade_history.jsonl"   # v2.4: asla kesilmeyen kalıcı işlem kaydı
HARD_STOP_PCT = 0.05  # v3.1: radar_loop ile senkron (%5)

# DÜZELTME P2-1: Thread-safe dosya yazma kilitleri
_state_lock = threading.Lock()
_db_lock    = threading.Lock()

def get_tr_now():
    """Returns the current datetime in Turkey's local timezone (UTC+3) as a timezone-naive object."""
    return datetime.now(timezone(timedelta(hours=3))).replace(tzinfo=None)

def append_trade_history(entry):
    """
    Her işlemi (alış/satış/kısmi satış) anında, asla kesilmeyen bir dosyaya ekler.
    bot_ledger.json içindeki trade_log son 100 işlemle SINIRLI olduğu için,
    1 ay sonra yapılacak değerlendirme verisi burada güvenle saklanır.
    JSONL formatı (her satır 1 işlem) — çökmeye/senkron kaybına dayanıklı.
    """
    try:
        rec = dict(entry)
        rec.setdefault("ts_iso", get_tr_now().isoformat(timespec="seconds"))
        with open(HISTORY_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            f.flush()
            os.fsync(f.fileno())
    except Exception as e:
        console.print("[bold red]Trade history yazılamadı:[/bold red]", e)


def reconcile_pnl(data):
    """
    Startup PnL doğrulama: trade_history.jsonl'deki gerçek işlemlerden
    total_pnl'yi yeniden hesaplar ve ledger ile karşılaştırır.
    Uyumsuzluk varsa otomatik düzeltir. Bu sayede restart/crash
    sonrası bakiye kaybı yaşanmaz.
    """
    reset_date = data.get("pnl_reset_date", "")
    if not reset_date:
        console.print("[dim]PNL-RECONCILE: pnl_reset_date yok, doğrulama atlandı[/dim]")
        return data

    if not os.path.exists(HISTORY_FILE):
        console.print("[dim]PNL-RECONCILE: trade_history.jsonl bulunamadı[/dim]")
        return data

    try:
        # trade_history.jsonl'den reset tarihinden sonraki tüm PnL'yi topla
        calculated_pnl = 0.0
        trade_count = 0
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    t = json.loads(line)
                    t_date = t.get("date", "")
                    t_pnl = t.get("pnl", 0)
                    t_side = t.get("side", "")
                    # Sadece reset tarihinden sonraki SATIŞ işlemlerini say
                    if t_date >= reset_date and t_side in ("SELL", "SELL-ALL", "PARTIAL-SELL"):
                        calculated_pnl += t_pnl
                        trade_count += 1
                except (json.JSONDecodeError, ValueError):
                    continue

        calculated_pnl = round(calculated_pnl, 2)
        ledger_pnl = round(data.get("total_pnl", 0.0), 2)
        diff = round(calculated_pnl - ledger_pnl, 2)

        if abs(diff) > 0.01:
            console.print(
                f"[bold red]PNL-RECONCILE UYUMSUZLUK TESPİT EDİLDİ![/bold red]\n"
                f"  Ledger total_pnl : {ledger_pnl} USDT\n"
                f"  Hesaplanan PnL   : {calculated_pnl} USDT ({trade_count} işlem, {reset_date}'den beri)\n"
                f"  Fark             : {diff:+.2f} USDT\n"
                f"  [bold green]→ total_pnl {calculated_pnl} olarak DÜZELTİLDİ[/bold green]"
            )
            data["total_pnl"] = calculated_pnl
            # trade_log'u da temizle: reset öncesi kayıtları kaldır
            old_count = len(data.get("trade_log", []))
            data["trade_log"] = [
                t for t in data.get("trade_log", [])
                if t.get("date", "") >= reset_date
            ]
            new_count = len(data["trade_log"])
            if old_count != new_count:
                console.print(
                    f"  [yellow]trade_log temizlendi: {old_count} → {new_count} kayıt "
                    f"({old_count - new_count} eski kayıt silindi)[/yellow]"
                )
            save_db(data)
        else:
            console.print(
                f"[green]PNL-RECONCILE OK: {ledger_pnl} USDT "
                f"({trade_count} işlem, {reset_date}'den beri)[/green]"
            )

    except Exception as e:
        console.print(f"[bold red]PNL-RECONCILE HATA: {e}[/bold red]")

    return data


def load_db():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data and isinstance(data, dict):
                    return data
                console.print("[bold red]bot_ledger boş veya geçersiz, yedek deneniyor...[/bold red]")
        except Exception as e:
            console.print("[bold red]bot_ledger yüklenemedi:[/bold red]", e)
        # Ana dosya okunamazsa .tmp yedeğini dene
        tmp = DB_FILE + ".tmp"
        if os.path.exists(tmp):
            try:
                with open(tmp, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if data and isinstance(data, dict):
                        console.print("[bold yellow]KURTARMA: .tmp yedeğinden ledger yüklendi[/bold yellow]")
                        return data
            except Exception:
                pass
    return {"total_pnl": 0.0, "career_trades": [], "start_balance": 50000.0, "trade_log": [], "profit_vault": 0.0, "profit_vault_count": 0, "pnl_reset_date": ""}

def save_db(data):
    with _db_lock:
        try:
            tmp = DB_FILE + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, DB_FILE)
        except Exception as e:
            console.print("[bold red]CRITICAL: DB kayıt hatası:[/bold red]", e)

SETTINGS_FILE = "bot_settings.json"

def load_settings():
    defaults = {
        "active":        True,
        "personality":   "SWING_TRADER",
        "notify_mode":   "BATCH",
        "market_halt":   False,
        "use_ml_filter": False,
    }
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                defaults.update(data)
        except Exception as e:
            console.print("[bold red]bot_settings yüklenemedi:[/bold red]", e)
    return defaults

def save_settings():
    try:
        data = {
            "active":        bot_settings.get("active", True),
            "personality":   bot_settings.get("personality", "SWING_TRADER"),
            "notify_mode":   bot_settings.get("notify_mode", "BATCH"),
            "market_halt":   bot_settings.get("market_halt", False),
            "use_ml_filter": bot_settings.get("use_ml_filter", False),
        }
        tmp = SETTINGS_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, SETTINGS_FILE)
    except Exception as e:
        console.print("[bold red]CRITICAL: Settings kayıt hatası:[/bold red]", e)

def load_fleet_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f: return json.load(f)
        except Exception as e:
            console.print("[bold red]bot_state yüklenemedi:[/bold red]", e)
    return {}

def save_fleet_state(state):
    with _state_lock:
        try:
            tmp = STATE_FILE + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=4)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, STATE_FILE)
        except Exception as e:
            console.print("[bold red]CRITICAL: State kayıt hatası:[/bold red]", e)
    save_settings()

def migrate_legacy_positions(fleet: dict) -> dict:
    changed = False
    for sym, st in list(fleet.items()):
        if st.get("source") != "DAY_TRADER":
            continue
        entry = float(st.get("entry") or 0)
        hs    = float(st.get("hard_stop") or 0)
        if entry <= 0 or hs <= 0:
            continue
        current_stop_pct = (entry - hs) / entry
        if current_stop_pct < 0.03:
            new_hs = entry * (1 - HARD_STOP_PCT)
            st["hard_stop"]      = new_hs
            st["migrated_from"]  = "DAY_TRADER"
            st["source"]         = "SWING_TRADER"
            changed = True
            console.print(
                f"[yellow]MIGRATE: {sym} hard_stop "
                f"%{current_stop_pct*100:.1f} -> %{HARD_STOP_PCT*100:.1f} "
                f"(${hs:.6f} -> ${new_hs:.6f})[/yellow]"
            )
    if changed:
        save_fleet_state(fleet)
    return fleet

# DÜZELTME P2-2: Hayalet pozisyon temizleme
def reconcile_positions(fleet: dict) -> dict:
    """trade_history.jsonl ile karşılaştırarak hayalet pozisyonları temizle.
    
    bot_state.json'da açık görünen ama aslında kapanmış pozisyonları tespit eder.
    """
    if not os.path.exists(HISTORY_FILE) or not fleet:
        return fleet
    
    # trade_history.jsonl'den tüm satış kayıtlarını oku
    sell_records = []
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    t = json.loads(line.strip())
                    if t.get("side") in ("SELL", "SELL-ALL"):
                        sell_records.append(t)
                except (json.JSONDecodeError, ValueError):
                    continue
    except Exception:
        return fleet
    
    ghosts = []
    for sym in list(fleet.keys()):
        buy_time = fleet[sym].get("time", 0)
        # Bu pozisyon alındıktan sonra satılmış mı?
        for sell in sell_records:
            if (sell.get("symbol") == sym and 
                sell.get("timestamp", sell.get("time", 0)) > buy_time):
                ghosts.append(sym)
                break
    
    if ghosts:
        for sym in ghosts:
            del fleet[sym]
        console.print(f"[yellow]GHOST CLEANUP: {ghosts} hayalet pozisyonları temizlendi[/yellow]")
        save_fleet_state(fleet)
    
    return fleet

# Global states
db = load_db()
db = reconcile_pnl(db)  # Startup PnL doğrulama — trade_history.jsonl ile karşılaştır
_loaded_settings = load_settings()
_fleet = load_fleet_state()
_fleet = migrate_legacy_positions(_fleet)
_fleet = reconcile_positions(_fleet)  # P2-2: Hayalet pozisyon temizliği
bot_settings = {
    "active":        _loaded_settings["active"],
    "personality":   _loaded_settings["personality"],
    "notify_mode":   _loaded_settings["notify_mode"],
    "fleet_state":   _fleet,
    "market_halt":   _loaded_settings["market_halt"],
    "use_ml_filter": _loaded_settings.get("use_ml_filter", False),
}
radar_data = {"top_picks": [], "progress": 0}
system_logs = []
last_total_val = 0.0

def add_log(msg):
    global system_logs
    ts = datetime.now().strftime("%H:%M:%S")
    entry = f"[{ts}] {msg}"
    
    # Escaping brackets/markup in message for rich printing
    safe_msg = rich_escape(msg)
    safe_entry = f"[{ts}] {safe_msg}"

    if msg.startswith("SCANNING:"):
        for i in range(len(system_logs)):
            if "SCANNING:" in system_logs[i]:
                system_logs.pop(i); break
        system_logs.insert(0, entry)
    else:
        system_logs.insert(0, entry)
    system_logs = system_logs[:15]
    
    if any(x in msg for x in ["BUY", "SELL", "PnL", "FAIL", "CIRCUIT", "EOD", "STOP"]):
        style = "bold red" if ("FAIL" in msg or "$-" in msg) else "bold green" if ("BUY" in msg or "SELL" in msg) else "bold yellow"
        console.print(safe_msg, style=style)
    elif "OPPORTUNITY-BUY" in msg:
        console.print(safe_msg, style="bold cyan")
    else:
        console.print(safe_msg, style="dim")
