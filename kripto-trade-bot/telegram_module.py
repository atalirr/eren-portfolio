import requests
import os
import json
import asyncio
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# .env dosyasından veya ortam değişkenlerinden al
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

BORDER = "━━━━━━━━━━"

def fmt_tr_float(val, precision=2, sign=False):
    fmt = f"{val:+.{precision}f}" if sign else f"{val:.{precision}f}"
    return fmt.replace('.', ',')

def fmt_tr_currency(val, precision=2, sign=False):
    fmt = f"{val:+,.{precision}f}" if sign else f"{val:,.{precision}f}"
    placeholder = "TEMP_DECIMAL"
    return fmt.replace('.', placeholder).replace(',', '.').replace(placeholder, ',')

def get_pnl_pct(pnl, qty, price):
    cost = price * qty - pnl
    if cost <= 0:
        return 0.0
    return (pnl / cost) * 100.0

def get_all_time_stats():
    wins = 0
    losses = 0
    trades = []
    reset_date = "2026-05-23"
    
    if os.path.exists("trade_history.jsonl"):
        try:
            with open("trade_history.jsonl", "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        t = json.loads(line)
                        t_date = t.get("date") or t.get("ts_iso", "")[:10]
                        if t_date >= reset_date:
                            trades.append(t)
        except Exception:
            pass
            
    if not trades:
        try:
            import state_manager
            trades = state_manager.db.get("trade_log", [])
        except Exception:
            pass
            
    sells = [t for t in trades if t.get("side") in ["SELL", "SELL-ALL", "PARTIAL-SELL"]]
    for t in sells:
        pnl = t.get("pnl", 0)
        if pnl > 0:
            wins += 1
        elif pnl < 0:
            losses += 1
            
    total_closed = wins + losses
    win_rate = (wins / total_closed * 100) if total_closed > 0 else 0.0
    return win_rate, total_closed, wins, losses

def escape_markdown(text):
    if not text:
        return ""
    text = str(text)
    text = text.replace("\\", "\\\\")
    text = text.replace("_", "\\_")
    text = text.replace("*", "\\*")
    text = text.replace("`", "\\`")
    text = text.replace("[", "\\[")
    return text

class TelegramNotifier:
    def __init__(self, token=None, chat_id=None):
        self.token = token or TOKEN
        self.chat_id = chat_id or CHAT_ID
        self.is_active = bool(self.token and self.chat_id)
        
        if not self.is_active:
            print("Telegram: Token veya Chat ID eksik. Bildirimler devre dışı.")

    def send_message(self, message, reply_markup=None):
        """Senkron mesaj gönderimi (loglar vb. için)"""
        if not self.is_active:
            return False
            
        url = f"https://api.telegram.org/bot{self.token}/sendMessage"
        
        if reply_markup is None:
            # Dokunmatik klavye butonları
            reply_markup = {
                "keyboard": [
                    [{"text": "📊 Durum"}, {"text": "💼 Cüzdan"}, {"text": "🏦 Kumbara"}],
                    [{"text": "📈 Rapor"}, {"text": "📋 Günlük Hesap Kontrol"}, {"text": "⚙️ Yönetim"}]
                ],
                "resize_keyboard": True,
                "one_time_keyboard": False
            }
            
        payload = {
            "chat_id": self.chat_id,
            "text": message,
            "parse_mode": "Markdown",
            "reply_markup": reply_markup
        }
        
        try:
            response = requests.post(url, json=payload, timeout=10)
            return response.status_code == 200
        except Exception as e:
            print(f"Telegram gönderim hatası: {e}")
            return False

    async def send_message_async(self, message, reply_markup=None):
        """Asenkron mesaj gönderimi (backend görevleri için)"""
        if not self.is_active:
            return False
        return await asyncio.to_thread(self.send_message, message, reply_markup)

    def edit_message(self, message_id, message, reply_markup=None):
        """Senkron mesaj düzenleme"""
        if not self.is_active:
            return False
            
        url = f"https://api.telegram.org/bot{self.token}/editMessageText"
        payload = {
            "chat_id": self.chat_id,
            "message_id": message_id,
            "text": message,
            "parse_mode": "Markdown"
        }
        if reply_markup is not None:
            payload["reply_markup"] = reply_markup
            
        try:
            response = requests.post(url, json=payload, timeout=10)
            return response.status_code == 200
        except Exception as e:
            print(f"Telegram düzenleme hatası: {e}")
            return False

    async def edit_message_async(self, message_id, message, reply_markup=None):
        """Asenkron mesaj düzenleme"""
        if not self.is_active:
            return False
        return await asyncio.to_thread(self.edit_message, message_id, message, reply_markup)

    def format_trade_msg(self, action, symbol, price, qty, pnl=None, source="", status="✅ GERÇEKLEŞTİ"):
        """Alım/Satım bildirimlerini dikey formatta ve sadeleştirilmiş olarak üretir (%100 TL)"""
        import trade_executor
        from state_manager import get_tr_now
        
        # Türkiye Saati (UTC+3)
        tr_time = get_tr_now()
        rate = trade_executor.get_usdt_try_rate()
        price_try = price * rate
        
        action_title = "*🚀 ALIM İŞLEMİ*" if action == "BUY" else "*💰 SATIM İŞLEMİ*"
        msg = f"{action_title}\n"
        msg += f"{BORDER}\n"
        msg += f"🪙 Sembol: {symbol}\n"
        msg += f"📍 Durum: {status}\n"
        msg += f"💵 Fiyat: {fmt_tr_currency(price_try, 2)} ₺\n"
        msg += f"📦 Miktar: {fmt_tr_float(qty, 6)}\n"

        if pnl is not None:
            pnl_try = pnl * rate
            pnl_emoji = "📈 KÂR" if pnl >= 0 else "📉 ZARAR"
            sign = "+" if pnl >= 0 else ""
            msg += f"📊 Net K/Z: {pnl_emoji}  {sign}{fmt_tr_currency(pnl_try, 2)} ₺\n"

        if source:
            source_lbl = "Agresif Mod" if "AGGRESSIVE" in source else "Swing Mod"
            msg += f"🔍 Mod: {source_lbl}\n"

        msg += f"🕒 Saat: {tr_time.strftime('%H:%M:%S')} TR\n"
        return msg

    def format_batch_msg(self, cycle_trades):
        """Döngü içindeki işlemleri konsolide edip estetik bir dikey özet oluşturur (%100 TL)"""
        import trade_executor
        rate = trade_executor.get_usdt_try_rate()
        
        buys = [t for t in cycle_trades if t.get("type") == "BUY"]
        sells = [t for t in cycle_trades if t.get("type") == "SELL"]
        partials = [t for t in cycle_trades if t.get("type") == "PARTIAL-SELL"]
        errors = [t for t in cycle_trades if t.get("type") == "ERROR"]
        
        def _tr_reason(r_str):
            if not r_str: return "Normal"
            r = str(r_str)
            if "TAKE-PROFIT" in r: return "Kâr Alma (Hedef)"
            if "HARD-STOP" in r: return "Zarar Durdurma (Sert Stop)"
            if "SCORE-DROP" in r: return "Skor Düşüşü Çıkışı"
            if "TRAIL" in r: return "Takip Eden Kâr Kilidi"
            if "PARTIAL" in r or "Kısmi" in r: return "Kısmi Kâr Alma"
            if "TIME" in r: return "Zaman Süresi Çıkışı"
            return r

        msg = "*🤖 DÖNGÜ İŞLEMLERİ RAPORU*\n"
        msg += f"{BORDER}\n\n"
        
        if buys:
            msg += "*🟢 ALIMLAR*\n"
            msg += f"{BORDER}\n"
            for b in buys:
                sym = escape_markdown(b["symbol"])
                pr = b["price"]
                qty = b["qty"]
                source = b.get("source", "")
                src_lbl = "Agresif Mod" if "AGGRESSIVE" in source else "Swing Mod"
                msg += f"• {sym}\n"
                msg += f"  ↳ Fiyat: {fmt_tr_currency(pr*rate, 2)} ₺\n"
                msg += f"  ↳ Miktar: {fmt_tr_float(qty, 6)}\n"
                msg += f"  ↳ Mod: {src_lbl}\n"
            msg += "\n"
            
        if partials:
            msg += "*🟡 KISMİ SATIŞLAR*\n"
            msg += f"{BORDER}\n"
            for p in partials:
                sym = escape_markdown(p["symbol"])
                pr = p["price"]
                qty = p["qty"]
                pnl = p["pnl"]
                entry = p["entry"]
                reason = _tr_reason(escape_markdown(p["reason"]))
                pct = ((pr - entry) / entry * 100) if entry > 0 else 0
                pct_str = fmt_tr_float(pct, 2, sign=True)
                pnl_try_str = fmt_tr_currency(pnl*rate, 2, sign=True)
                msg += f"• {sym}\n"
                msg += f"  ↳ Fiyat: {fmt_tr_currency(pr*rate, 2)} ₺\n"
                msg += f"  ↳ Miktar: {fmt_tr_float(qty, 6)}\n"
                msg += f"  ↳ Net K/Z: {pnl_try_str} ₺\n"
                msg += f"  ↳ Getiri: %{pct_str}\n"
                msg += f"  ↳ Neden: {reason}\n"
            msg += "\n"
            
        if sells:
            msg += "*🔴 SATIŞLAR*\n"
            msg += f"{BORDER}\n"
            for s in sells:
                sym = escape_markdown(s["symbol"])
                pr = s["price"]
                qty = s["qty"]
                pnl = s["pnl"]
                entry = s["entry"]
                reason = _tr_reason(escape_markdown(s["reason"]))
                pct = ((pr - entry) / entry * 100) if entry > 0 else 0
                pct_str = fmt_tr_float(pct, 2, sign=True)
                pnl_try_str = fmt_tr_currency(pnl*rate, 2, sign=True)
                pnl_emoji = "📈" if pnl >= 0 else "📉"
                msg += f"• {sym}\n"
                msg += f"  ↳ Fiyat: {fmt_tr_currency(pr*rate, 2)} ₺\n"
                msg += f"  ↳ Miktar: {fmt_tr_float(qty, 6)}\n"
                msg += f"  ↳ Net K/Z: {pnl_emoji} {pnl_try_str} ₺\n"
                msg += f"  ↳ Getiri: %{pct_str}\n"
                msg += f"  ↳ Neden: {reason}\n"
            msg += "\n"
            
        if errors:
            msg += "*❌ HATALAR*\n"
            msg += f"{BORDER}\n"
            for e in errors:
                sym = escape_markdown(e.get("symbol", ""))
                action = escape_markdown(e.get("action", ""))
                err_msg = escape_markdown(e.get("msg", ""))
                msg += f"• {action} - {sym}\n"
                msg += f"  ↳ Hata: {err_msg}\n"
            msg += "\n"
            
        return msg.strip()

    def get_updates(self, offset=None):
        """Yeni mesajları kontrol eder"""
        if not self.is_active: return []
        url = f"https://api.telegram.org/bot{self.token}/getUpdates"
        params = {"timeout": 1, "offset": offset}
        try:
            resp = requests.get(url, params=params, timeout=5)
            if resp.status_code == 200:
                return resp.json().get("result", [])
        except Exception:
            pass
        return []

    async def handle_commands(self, command_callback):
        """Komutları dinleyen ve yanıtlayan ana döngü"""
        offset = None
        print("Telegram: Komut dinleyici başlatıldı...")
        while True:
            try:
                updates = await asyncio.to_thread(self.get_updates, offset)
                if not updates:
                    await asyncio.sleep(0.2)
                    continue
                for update in updates:
                    offset = update["update_id"] + 1
                    if "callback_query" in update:
                        cb = update["callback_query"]
                        cb_id = cb["id"]
                        cb_data = cb.get("data")
                        message = cb.get("message", {})
                        message_id = message.get("message_id")
                        
                        if cb_data == "show_ml":
                            ml_msg = self._generate_ml_detail_msg()
                            await self.send_message_async(ml_msg)
                        else:
                            res = await command_callback(cb_data)
                            if res and isinstance(res, dict) and message_id:
                                new_msg = self._generate_settings_msg(res)
                                new_kbd = self._generate_settings_keyboard(res)
                                await self.edit_message_async(message_id, new_msg, reply_markup=new_kbd)
                        url_ans = f"https://api.telegram.org/bot{self.token}/answerCallbackQuery"
                        try:
                            requests.post(url_ans, json={"callback_query_id": cb_id}, timeout=5)
                        except Exception:
                            pass
                        continue
                    if "message" in update and "text" in update["message"]:
                        try:
                            chat_id = str(update["message"]["chat"]["id"])
                        except KeyError:
                            continue
                        text = update["message"]["text"].lower().strip()
                        print(f"Telegram Komutu Alındı: chat_id={chat_id}, text='{text}'")
                        if self.chat_id and chat_id != str(self.chat_id):
                            print(f"Telegram Chat ID Uyuşmazlığı: Gelen={chat_id}, İzinli={self.chat_id}")
                            continue

                        if text in ["/durum", "/status", "📊 genel durum", "genel durum", "durum", "📊 durum"]:
                            res = await command_callback("get_status")
                            await self.send_message_async(self._generate_status_msg(res))
                        elif text in ["/egitim", "/ml", "🧠 model eğitimi", "model eğitimi", "egitim", "eğitim", "🧠 eğitim"]:
                            await self.send_message_async(self._generate_ml_detail_msg())

                        elif text in ["/cuzdan", "/wallet", "💼 cüzdan kontrolü", "cüzdan kontrolü", "cüzdan", "cüzdan göster", "cüzdanı göster", "💼 cüzdan"]:
                            res = await command_callback("get_status")
                            await self.send_message_async(self._generate_positions_msg(res))
                        elif text in ["/kumbara", "/kasa", "🏦 kâr kumbarası", "kâr kumbarası", "kumbara", "🏦 kumbara"]:
                            await self.send_message_async(self._generate_kumbara_msg())
                        elif text in ["/rapor", "/report", "📈 günlük performans", "günlük performans", "rapor", "📈 rapor"]:
                            res = await command_callback("get_status")
                            await self.send_message_async(self._generate_report_msg(res))
                        elif text in ["/coinler", "/radar", "/firsatlar", "fırsatlar", "🛰️ radar taraması", "radar taraması", "🛰️ coinler", "coinler", "📋 günlük hesap kontrol", "günlük hesap kontrol", "günlük hesap", "📋 günlük hesap"]:
                            res = await command_callback("get_status")
                            await self.send_message_async(self._generate_coins_msg(res))
                        elif text in ["/yonetim", "/settings", "⚙️ yönetim paneli", "yönetim paneli", "⚙️ yönetim", "yönetim"]:
                            res = await command_callback("get_status")
                            await self.send_message_async(self._generate_settings_msg(res), reply_markup=self._generate_settings_keyboard(res))
                        elif text in ["/bildirim", "🔔 bildirim", "bildirim"]:
                            res = await command_callback("toggle_notifications")
                            if isinstance(res, dict):
                                try:
                                    import state_manager
                                    notify_mode = state_manager.bot_settings.get("notify_mode", "BATCH")
                                except Exception:
                                    notify_mode = res.get("notify_mode", "BATCH")
                                if notify_mode == "BATCH":
                                    msg = "🔔 *BİLDİRİM MODU:* DÖNGÜ ÖZETİ aktif."
                                elif notify_mode == "SILENT":
                                    msg = "🔕 *BİLDİRİM MODU:* SESSİZ aktif."
                                else:
                                    msg = "📢 *BİLDİRİM MODU:* DETAYLI aktif."
                                await self.send_message_async(msg)
                        elif text in ["/durdur", "🛑 durdur", "durdur"]:
                            await self.send_message_async("🛑 *BOT DURDURULDU!*")
                            await command_callback("stop_bot")
                        elif text in ["/baslat", "🚀 başlat", "baslat", "🚀 baslat"]:
                            await self.send_message_async("🚀 *BOT BAŞLATILDI!*")
                            await command_callback("start_bot")
                        elif text in ["/switch", "🔄 mod değiştir", "mod değiştir", "🔥 agresif moda geç", "🛡️ swing moda geç"]:
                            res = await command_callback("switch_mode")
                            if isinstance(res, dict):
                                new_mode = res.get("new_mode", "?")
                                if new_mode == "AGGRESSIVE_TRADER":
                                    msg = "🔥 *AGRESİF MOD AKTİF!*\n⚡ 1h | 200+ coin | Stop ATR | TP %2.5 | Max 12 poz"
                                else:
                                    msg = "🛡️ *SWING MOD AKTİF!*\n⚡ 4h | 40-60 coin | Stop %4 | TP %5-8 | Max 8 poz"
                                await self.send_message_async(msg)
                        elif text.startswith("/sat"):
                            parts = text.split()
                            symbol = parts[1].upper().replace("-", "/") if len(parts) > 1 else None
                            if not symbol:
                                await self.send_message_async("⚠️ Lütfen sembol belirtin. Örn: /sat BTC")
                            else:
                                await self.send_message_async(f"⏳ {symbol} için emir iletiliyor...")
                                await command_callback(f"sell_asset:{symbol}")
                        elif text in ["/yardim", "/help", "/start", "yardım", "yardim", "help", "start", "❓ yardım"]:
                            msg = "*🤖 Antigravity AI — Uzaktan Kumanda*\n"
                            msg += f"{BORDER}\n"
                            msg += "📊 `/durum` — Genel bakiye ve durum özeti\n"
                            msg += "💼 `/cuzdan` — Açık pozisyonlar ve cüzdan detayı\n"
                            msg += "📈 `/rapor` — Günlük performans raporu\n"
                            msg += "🛰️ `/coinler` — Radar fırsatları\n"
                            msg += "⚙️ `/yonetim` — Bot ayarları\n"
                            msg += "🚀 `/baslat` — Botu başlat\n"
                            msg += "🛑 `/durdur` — Botu durdur\n"
                            msg += "🔥 `/switch` — Swing ↔ Agresif mod\n"
                            msg += "💰 `/sat [SEMBOL]` — Coin sat\n"
                            await self.send_message_async(msg)
            except Exception as e:
                print(f"Telegram dinleme hatası: {e}")
                await asyncio.sleep(2)

    def get_ml_train_info(self):
        """Yapay zeka (ML) modelinin güncel eğitim ve veri birikim durumunu döner."""
        try:
            import os, json, time
            trained_samples = 0
            auc_score = 0.0
            trained_at = "Bilinmiyor"
            feature_names = []
            
            if os.path.exists("signal_filter_meta.json"):
                with open("signal_filter_meta.json", encoding="utf-8") as f:
                    meta = json.load(f)
                    trained_samples = meta.get("train_samples", 0)
                    auc_score = meta.get("auc", 0.0)
                    trained_at = meta.get("trained_at", "Bilinmiyor")
                    feature_names = meta.get("feature_names", [])
                    
            total_labeled = 0
            unlabeled_with_features = 0
            pending_list = []
            now_ts = time.time()
            
            if os.path.exists("signal_log.json"):
                with open("signal_log.json", encoding="utf-8") as f:
                    signals = json.load(f)
                    total_labeled = len([s for s in signals if "24h" in s.get("checks", {}) and "features" in s])
                    unlabeled_signals = [s for s in signals if "features" in s and "24h" not in s.get("checks", {})]
                    unlabeled_with_features = len(unlabeled_signals)
                    
                    # Bekleyen her bir sinyalin kaç saatinin kaldığını hesapla
                    for s in unlabeled_signals:
                        sig_ts = s.get("timestamp", now_ts)
                        passed_secs = now_ts - sig_ts
                        passed_hours = min(24.0, max(0.0, passed_secs / 3600.0))
                        rem_hours = max(0.0, 24.0 - passed_hours)
                        pending_list.append({
                            "symbol": s.get("symbol", "?"),
                            "passed_h": round(passed_hours, 1),
                            "rem_h": round(rem_hours, 1),
                            "time_str": s.get("time_str", "?")
                        })
                    
            new_samples = max(0, total_labeled - trained_samples)
            rem_needed = max(0, 25 - new_samples)
            return {
                "trained_samples": trained_samples,
                "total_labeled": total_labeled,
                "new_samples": new_samples,
                "rem_needed": rem_needed,
                "unlabeled": unlabeled_with_features,
                "pending_list": pending_list,
                "auc": round(auc_score * 100, 1),
                "trained_at": trained_at,
                "n_features": len(feature_names)
            }
        except Exception:
            return {
                "trained_samples": 0, "total_labeled": 0, "new_samples": 0,
                "rem_needed": 25, "unlabeled": 0, "pending_list": [], "auc": 0.0,
                "trained_at": "Bilinmiyor", "n_features": 0
            }

    def _generate_ml_detail_msg(self):
        """Model eğitimi detaylı durum mesajı — Monospace Blok."""
        ml_info = self.get_ml_train_info()
        
        auc_val = ml_info['auc']
        if auc_val >= 65:
            auc_emoji = "🟢 Güçlü"
        elif auc_val >= 55:
            auc_emoji = "🟡 Orta"
        else:
            auc_emoji = "🔴 Geliştirilmeli"
            
        rem_needed = ml_info['rem_needed']
        if rem_needed == 0:
            status_str = "🚀 Otomatik Eğitim Bekleniyor"
        elif rem_needed <= 5:
            status_str = "🟢 Eğitime Çok Az Kaldı"
        else:
            status_str = "⏸️ Veri Birikimi Devam Ediyor"
            
        msg  = "🧠 *YAPAY ZEKA (ML) EĞİTİM DETAYLARI*\n"
        msg += f"{BORDER}\n\n"
        
        msg += "📊 *MODEL BAŞARI & METRİKLER*\n"
        msg += "```\n"
        msg += f"• Başarı Skoru (ROC-AUC) : %{auc_val:.1f} ({auc_emoji})\n"
        msg += f"• Model Özellik Sayısı   : {ml_info['n_features']} Teknik Gösterge\n"
        msg += f"• Son Eğitim Tarihi      : {ml_info['trained_at']}\n"
        msg += f"• Modeldeki Veri Sayısı  : {ml_info['trained_samples']} Sinyal\n"
        msg += "```\n\n"
        
        msg += "🔄 *EĞİTİM BİRİKİM SAYAÇLARI*\n"
        msg += "```\n"
        msg += f"• Toplam Etiketli Sinyal : {ml_info['total_labeled']} Adet\n"
        msg += f"• Yeni Veri Birikimi     : {ml_info['new_samples']} / 25 Sinyal\n"
        msg += f"• Eğitime Kalan Veri     : {ml_info['rem_needed']} Sinyal\n"
        msg += f"• Bekleyen 24h Kontrol   : {ml_info['unlabeled']} Sinyal\n"
        msg += "```\n\n"
        
        pending_list = ml_info.get("pending_list", [])
        if pending_list:
            msg += "⏳ *BEKLEYEN SİNYALLERİN 24H SAYAÇLARI*\n"
            msg += "```\n"
            for p in pending_list[-5:]:  # En güncel 5 sinyal
                sym = p['symbol'].split('/')[0][:6]
                passed_h = p['passed_h']
                rem_h = p['rem_h']
                msg += f"• {sym:<6} {passed_h:>4.1f}h doldu | {rem_h:>4.1f}h kaldı\n"
            msg += "```\n\n"
        
        msg += f"📌 *Güncel Durum:* `{status_str}`\n\n"
        msg += "💡 *Bilgi:* Bekleyen sinyaller 24 saati doldurunca WIN/LOSS etiketini alır ve otomatik olarak yeni veri sayacına eklenir."
        return msg



    def _generate_status_msg(self, data):
        """Portföy durum raporu — Çerçevesiz Temiz Monospace Blok & %100 TL."""
        if not data or not isinstance(data, dict):
            return "⚠️ Durum raporu alınamadı."
        import trade_executor
        rate = data.get('usdt_try_rate') or trade_executor.get_usdt_try_rate()
        total_val_try  = data.get('total_val', 0) or 0
        realized_try   = data.get('realized_pnl', 0) or 0
        unreal_try     = data.get('unrealized_pnl', 0) or 0
        roi            = data.get('career_roi', 0) or 0
        mode           = data.get('personality', 'SWING_TRADER')
        active         = data.get('bot_active', True)
        wallet_usd     = data.get('wallet', {}).get('USDT', 0) or 0
        allocated_usd  = data.get('allocated_capital', 0) or 0
        win_rate_val, total_closed, wins_cnt, losses_cnt = get_all_time_stats()
        
        ml_info = self.get_ml_train_info()
        
        mode_emoji = "🔥" if mode == "AGGRESSIVE_TRADER" else "🛡️"
        mode_label = "Agresif - 1s" if mode == "AGGRESSIVE_TRADER" else "Swing - 4s"
        state_txt  = "🟢 Çalışıyor" if active else "🔴 Durduruldu"
        roi_sign   = "+" if roi >= 0 else ""
        
        realized_sign = "+" if realized_try >= 0 else ""
        realized_emoji = "🟢" if realized_try >= 0 else "🔴"
        unreal_sign = "+" if unreal_try >= 0 else ""
        unreal_emoji = "🟢" if unreal_try >= 0 else "🔴"

        win_rate_str = f"%{fmt_tr_float(win_rate_val, 1)} ({wins_cnt}W / {losses_cnt}L - {total_closed} işlem)" if total_closed > 0 else "%0.0 (Henüz işlem yok)"
        
        msg  = "📊 *GENEL DURUM RAPORU*\n"
        msg += f"{BORDER}\n\n"
        
        msg += "💰 *TOPLAM VARLIK & GETİRİ*\n"
        msg += "```\n"
        msg += f"• Toplam Bakiye : {fmt_tr_currency(total_val_try, 2)} ₺\n"
        msg += f"• Toplam Getiri : %{fmt_tr_float(roi, 2, sign=True)}\n"
        msg += f"• Genel Başarı  : {win_rate_str}\n"
        msg += "```\n\n"
        
        msg += "🏦 *SERMAYE DAĞILIMI*\n"
        msg += "```\n"
        msg += f"• Boştaki Nakit : {fmt_tr_currency(wallet_usd*rate, 2)} ₺\n"
        msg += f"• Pozisyondaki  : {fmt_tr_currency(allocated_usd*rate, 2)} ₺\n"
        msg += "```\n\n"
        
        msg += "📊 *NET KÂR / ZARAR*\n"
        msg += "```\n"
        msg += f"• Gerçekleşen Net K/Z : {realized_emoji} {realized_sign}{fmt_tr_currency(realized_try, 2)} ₺\n"
        msg += f"• Açık Pozisyon K/Z   : {unreal_emoji} {unreal_sign}{fmt_tr_currency(unreal_try, 2)} ₺\n"
        msg += "```\n\n"
        
        msg += "🧠 *YAPAY ZEKA (ML) EĞİTİM DURUMU*\n"
        msg += "```\n"
        msg += f"• Model Skor (ROC-AUC) : %{ml_info['auc']}\n"
        msg += f"• Son Eğitilen Veri    : {ml_info['trained_samples']} sinyal\n"
        msg += f"• Yeni Veri Birikimi   : {ml_info['new_samples']} / 25 sinyal\n"
        msg += "```\n\n"
        
        msg += "🤖 *SİSTEM*\n"
        msg += "```\n"
        msg += f"• Durum: {state_txt}\n"
        msg += f"• Mod  : {mode_emoji} {mode_label}\n"
        import state_manager
        msg += f"• Zaman: {state_manager.get_tr_now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        msg += "```"
        return msg

    def _generate_kumbara_msg(self):
        """Kâr Kumbarası (Güvenli Kasa) mesajı — Çerçevesiz Monospace Blok & %100 TL."""
        import trade_executor
        import state_manager
        rate = trade_executor.get_usdt_try_rate()
        vault_usd = state_manager.db.get("profit_vault", 0.0)
        vault_count = state_manager.db.get("profit_vault_count", 0)
        vault_try = vault_usd * rate
        
        msg  = "🏦 *KÂR KUMBARASI (GÜVENLİ KASA)*\n"
        msg += f"{BORDER}\n\n"
        msg += "💰 *BİRİKEN KÂR DURUMU*\n"
        msg += "```\n"
        msg += f"• Güvenceye Alınan Kâr : {fmt_tr_currency(vault_try, 2)} ₺\n"
        msg += f"• Kâr Aktarım Oranı   : %20 (Her kârlı işlemden)\n"
        msg += f"• Kârlı İşlem Adedi    : {vault_count} adet\n"
        msg += f"• Kasa Güvenlik Durumu : 🔒 Kilitli & Güvencede\n"
        msg += "```\n\n"
        msg += "💡 *Not: Bu kasadaki para botun aktif işlem riskine sokulmaz. Bot kâr ettikçe %20'si otomatik kilitlenen birikiminizdir.*"
        return msg

    def _generate_positions_msg(self, data):
        """Açık pozisyonlar — Çerçevesiz, 'text' Etiketsiz Temiz Monospace Blok & %100 TL."""
        if not data or not isinstance(data, dict):
            return "⚠️ Cüzdan bilgisi alınamadı."
        import trade_executor
        import state_manager
        import time
        rate = data.get('usdt_try_rate') or trade_executor.get_usdt_try_rate()
        managed = [x for x in (data.get('full_wallet', []) or []) if x.get("is_managed")]
        if not managed:
            return "📭 Aktif açık pozisyon bulunmuyor."
            
        fleet = state_manager.bot_settings.get("fleet_state", {})
        now_ts = time.time()
        
        msg  = "💼 *AKTİF AÇIK POZİSYONLAR*\n"
        msg += f"{BORDER}\n\n"
        tot_val_usd = 0.0
        tot_pnl_usd = 0.0
        
        for it in managed:
            asset = str(it.get("asset", "")).upper()
            sym = f"{asset}/USDT"
            pct   = it.get("pnl_pct", 0) or 0
            val_usd   = it.get("value", 0) or 0
            qty   = it.get("qty", 0) or 0
            pnl_usd = it.get("pnl", 0) or 0
            pnl_try = pnl_usd * rate
            val_try = val_usd * rate
            tot_val_usd += val_usd
            tot_pnl_usd += pnl_usd
            
            st_fleet = fleet.get(f"{asset}USDT") or fleet.get(f"{asset}/USDT") or {}
            open_time = st_fleet.get("time", 0.0)
            
            hold_str = "0m"
            if open_time > 0:
                sec = int(now_ts - open_time)
                h, m = sec // 3600, (sec % 3600) // 60
                hold_str = f"{h}h {m}m" if h > 0 else f"{m}m"
                
            emoji = "🟢" if pct >= 0 else "🔴"
            sign = "+" if pct >= 0 else ""
            pnl_try_str = f"{sign}{fmt_tr_currency(pnl_try, 2)} ₺"
            pct_str = f"%{fmt_tr_float(pct, 2, sign=True)}"
            val_try_str = f"{fmt_tr_currency(val_try, 0)} ₺"
            qty_str = fmt_tr_float(qty, 2)
            
            msg += "```\n"
            msg += f"🪙 {sym:<10} [{emoji} {pct_str}]\n"
            msg += f"• Net K/Z  : {pnl_try_str}\n"
            msg += f"• Değer    : {val_try_str} ({qty_str} {asset})\n"
            msg += f"• Elde Tut : {hold_str}\n"
            msg += "```\n\n"
            
        tot_pnl_try = tot_pnl_usd * rate
        tot_emoji = "🟢 KÂRDA" if tot_pnl_usd >= 0 else "🔴 ZARARDA"
        tot_sign = "+" if tot_pnl_usd >= 0 else ""
        tot_pnl_str = f"{tot_sign}{fmt_tr_currency(tot_pnl_try, 2)} ₺"
        tot_val_str = f"{fmt_tr_currency(tot_val_usd*rate, 2)} ₺"
        
        msg += "📊 *POZİSYON ÖZET TABLOSU*\n"
        msg += "```\n"
        msg += f"• Pozisyon Sayısı: {len(managed)} adet\n"
        msg += f"• Toplam Değer   : {tot_val_str}\n"
        msg += f"• Toplam Net K/Z : {tot_pnl_str}\n"
        msg += f"• Parasal Durum  : {tot_emoji}\n"
        msg += "```"
        return msg

    def _generate_report_msg(self, data):
        """Günlük performans raporu — Keskin Monospace Vurgulu & %100 TL."""
        if not data or not isinstance(data, dict):
            return "⚠️ Performans raporu alınamadı."
        import trade_executor
        import state_manager
        rate = data.get('usdt_try_rate') or trade_executor.get_usdt_try_rate()
        
        today_str_db = state_manager.get_tr_now().strftime("%Y-%m-%d")
        today_str_display = state_manager.get_tr_now().strftime("%d/%m/%Y")
        
        trades = []
        try:
            trades = [t for t in state_manager.db.get("trade_log", []) if t.get("date") == today_str_db]
        except Exception:
            pass
            
        buys = [t for t in trades if t.get("side") == "BUY"]
        sells = [t for t in trades if t.get("side") in ["SELL", "SELL-ALL", "PARTIAL-SELL"]]
        
        daily_try     = data.get('daily_pnl', 0) or 0
        total_val_try = data.get('total_val', 0) or 0
        
        tot_emoji = "🟢 KÂR" if daily_try >= 0 else "🔴 ZARAR"
        tot_sign = "+" if daily_try >= 0 else ""
        daily_pnl_str = f"{tot_sign}{fmt_tr_currency(daily_try, 2)} ₺"
        total_val_str = f"{fmt_tr_currency(total_val_try, 2)} ₺"
        
        msg  = "📅 *GÜNLÜK PERFORMANS RAPORU*\n"
        msg += f"📅 Tarih: `{today_str_display}`\n"
        msg += f"{BORDER}\n\n"
        
        msg += "📊 *PORTFÖY ÖZETİ*\n"
        msg += f"▫️ Kasa Toplam Değer: `{total_val_str}`\n"
        msg += f"▫️ Günlük Net K/Z: {tot_emoji} `{daily_pnl_str}`\n"
        if total_val_try > 0:
            daily_roi = (daily_try / (total_val_try - daily_try)) * 100 if (total_val_try - daily_try) > 0 else 0
            msg += f"▫️ Günlük Getiri: `%` `{fmt_tr_float(daily_roi, 2, sign=True)}`\n"
        msg += "\n"
        
        msg += "🚪 *KAPANAN POZİSYONLAR*\n"
        msg += f"{BORDER}\n"
        if not sells:
            msg += "📭 Bugün kapatılan işlem bulunmuyor.\n"
        else:
            for s in sells:
                pnl_usd = s.get("pnl", 0)
                pnl_try = pnl_usd * rate
                sign = "+" if pnl_usd >= 0 else ""
                emoji = "🟢" if pnl_usd >= 0 else "🔴"
                pct = 0.0
                entry = s.get("entry", 0)
                price = s.get("price", 0)
                if entry > 0 and price > 0:
                    pct = ((price - entry) / entry) * 100
                pct_str = f"`(%{fmt_tr_float(pct, 2, sign=True)})`" if pct != 0.0 else ""
                pnl_item_str = f"{sign}{fmt_tr_currency(pnl_try, 2)} ₺"
                
                msg += f"• `{s['symbol']}`: {emoji} `{pnl_item_str}` {pct_str}\n"
        msg += "\n"
        
        msg += "🟢 *YENİ AÇILAN POZİSYONLAR*\n"
        msg += f"{BORDER}\n"
        if not buys:
            msg += "📭 Bugün yeni alım yapılmadı.\n"
        else:
            for b in buys:
                cost_usd = b.get("price", 0) * b.get("qty", 0)
                cost_try = cost_usd * rate
                msg += f"• `{b['symbol']}`: `{fmt_tr_currency(cost_try, 2)} ₺`\n"
        msg += "\n"

        managed = [x for x in (data.get('full_wallet', []) or []) if x.get("is_managed")]
        msg += f"💼 *AKTİF AÇIK POZİSYONLAR ({len(managed)} adet)*\n"
        msg += f"{BORDER}\n"
        if not managed:
            msg += "📭 Aktif açık pozisyon bulunmuyor.\n"
        else:
            for it in managed:
                pct = it.get("pnl_pct", 0) or 0
                val = it.get("value", 0) or 0
                pnl_usd = it.get("pnl", 0) or 0
                pnl_try = pnl_usd * rate
                emoji = "🟢" if pct >= 0 else "🔴"
                sign = "+" if pct >= 0 else ""
                pnl_item_str = f"{sign}{fmt_tr_currency(pnl_try, 2)} ₺"
                pct_item_str = f"%{fmt_tr_float(pct, 2, sign=True)}"
                msg += f"• `{it.get('asset')}/USDT`: {emoji} `{pnl_item_str}` (`{pct_item_str}`)\n"
        msg += "\n"

        ml_info = self.get_ml_train_info()
        msg += "🧠 *YAPAY ZEKA (ML) EĞİTİM BİRİKİMİ*\n"
        msg += f"{BORDER}\n"
        msg += f"▫️ Son Eğitilen Model Verisi: `{ml_info['trained_samples']} sinyal` (ROC-AUC: `%` `{ml_info['auc']}`)\n"
        msg += f"▫️ Yeni Veri Birikimi: `{ml_info['new_samples']} / 25 sinyal` (Sonraki eğitime {ml_info['rem_needed']} veri kaldı)\n"

        return msg.strip()

    def _generate_coins_msg(self, data):
        """Bugün işlem yapılan tüm coinlerin 4 sütunlu listesi, gün adı ve finansal kârlılık özeti."""
        import trade_executor
        import state_manager
        import json, os
        rate = data.get('usdt_try_rate') or trade_executor.get_usdt_try_rate()
        now_tr = state_manager.get_tr_now()
        today_db = now_tr.strftime("%Y-%m-%d")
        today_disp = now_tr.strftime("%d/%m/%Y")
        
        tr_days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
        day_name = tr_days[now_tr.weekday()]
        
        trades = []
        if os.path.exists("trade_history.jsonl"):
            try:
                with open("trade_history.jsonl", "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            t = json.loads(line)
                            if t.get("date") == today_db:
                                trades.append(t)
            except Exception:
                pass
        if not trades:
            trades = [t for t in state_manager.db.get("trade_log", []) if t.get("date") == today_db]
            
        sells = [t for t in trades if t.get("side") in ["SELL", "SELL-ALL", "PARTIAL-SELL"]]
        
        msg  = "🛰️ *GÜNLÜK İŞLEMLER VE KÂRLILIK ÖZETİ*\n"
        msg += f"📅 Tarih: `{today_disp}, {day_name}`\n"
        msg += f"{BORDER}\n\n"
        
        if not sells:
            msg += "📭 Bugün henüz kapanmış işlem bulunmuyor.\n\n"
        else:
            msg += "*📜 GÜNLÜK İŞLEMLER*\n"
            msg += "```\n"
            
            items = []
            for s in sells:
                sym = str(s.get("symbol", "")).split("/")[0][:5]
                t_str = str(s.get("time", ""))[:5] or "--:--"
                pnl_usd = s.get("pnl", 0) or 0
                pnl_try = pnl_usd * rate
                emoji = "🟢" if pnl_usd >= 0 else "🔴"
                sign = "+" if pnl_usd >= 0 else ""
                pnl_str = f"{sign}{fmt_tr_currency(pnl_try, 0)}₺"
                items.append(f"{emoji} {sym:<5} {t_str} {pnl_str:>6}")
                
            for item in items:
                msg += item + "\n"
            msg += "```\n\n"
            
        managed = [x for x in (data.get('full_wallet', []) or []) if x.get("is_managed")]
        if managed:
            msg += f"*💼 AÇIK POZİSYONLAR ({len(managed)} adet)*\n"
            msg += f"{BORDER}\n"
            for it in managed:
                sym = str(it.get("asset", ""))[:6]
                pct = it.get("pnl_pct", 0) or 0
                pnl_usd = it.get("pnl", 0) or 0
                pnl_try = pnl_usd * rate
                emoji = "🟢" if pct >= 0 else "🔴"
                sign = "+" if pct >= 0 else ""
                pnl_str = f"{sign}{fmt_tr_currency(pnl_try, 0)}₺"
                pct_str = f"%{fmt_tr_float(pct, 1, sign=True)}"
                msg += f"• `{sym}`: {emoji} `{pnl_str}` (`{pct_str}`)\n"
            msg += "\n"
            
        tot_win_usd = sum(s.get("pnl", 0) for s in sells if (s.get("pnl", 0) or 0) > 0)
        tot_loss_usd = abs(sum(s.get("pnl", 0) for s in sells if (s.get("pnl", 0) or 0) < 0))
        tot_pnl_usd = sum(s.get("pnl", 0) or 0 for s in sells)
        tot_pnl_try = tot_pnl_usd * rate
        
        fin_win_rate = (tot_win_usd / (tot_win_usd + tot_loss_usd) * 100) if (tot_win_usd + tot_loss_usd) > 0 else 0.0
        
        tot_emoji = "🟢 KÂRDA" if tot_pnl_usd >= 0 else "🔴 ZARARDA"
        tot_sign = "+" if tot_pnl_usd >= 0 else ""
        msg += "📊 *FINANSAL KÂRLILIK VE GENEL SONUÇ*\n"
        msg += f"{BORDER}\n"
        msg += f"▫️ Finansal Kârlılık Oranı: `%` `{fmt_tr_float(fin_win_rate, 1)}` *(Kazanılan / Toplam Hacim)*\n"
        msg += f"▫️ Günlük Parasal Durum: {tot_emoji}\n"
        msg += f"▫️ *BUGÜNKÜ NET K/Z TOPLAMI:* {tot_emoji} `{tot_pnl_str}`"
        return msg

    def _send_help_msg(self):
        msg = "🤖 *KOMUTLAR LİSTESİ*\n"
        msg += f"{BORDER}\n"
        msg += "📊 `/durum` — Günlük performans raporu\n"
        msg += "💼 `/cuzdan` — Açık pozisyon özeti\n"
        msg += "⚙️ `/yonetim` — Bot ayarları\n"
        msg += "🧠 `/egitim` — Model eğitimi & başarım detayları\n"
        msg += "🚀 `/baslat` — Botu başlat\n"
        msg += "🛑 `/durdur` — Botu durdur\n"
        msg += "🔥 `/switch` — Swing ↔ Agresif mod\n"
        msg += "💰 `/sat [SEMBOL]` — Coin sat\n"
        return msg

    def _generate_settings_msg(self, data):
        """Yönetim paneli."""
        active = data.get('bot_active', True)
        mode   = data.get('personality', 'SWING_TRADER')
        try:
            import state_manager
            notify_mode = state_manager.bot_settings.get("notify_mode", "BATCH")
        except Exception:
            notify_mode = data.get('notify_mode', 'BATCH')
        status_str = "🟢 ÇALIŞIYOR" if active else "🔴 DURDURULDU"
        mode_str   = "🔥 AGRESİF - 1s" if mode == "AGGRESSIVE_TRADER" else "🛡️ SWING - 4s"
        if notify_mode == "BATCH":      notify_str = "🔔 DÖNGÜ ÖZETİ"
        elif notify_mode == "SILENT":   notify_str = "🔕 SESSİZ"
        else:                           notify_str = "📢 DETAYLI"
        msg  = "*⚙️ YÖNETİM PANELİ*\n"
        msg += f"{BORDER}\n\n"
        msg += f"🤖 Bot: `{status_str}`\n"
        msg += f"🎯 Mod: `{mode_str}`\n"
        msg += f"🔔 Bildirim: `{notify_str}`\n\n"
        msg += f"{BORDER}\nAşağıdaki butonları kullanın:"
        return msg

    def _generate_settings_keyboard(self, data):
        """Yönetim paneli inline butonları."""
        active = data.get('bot_active', True)
        mode   = data.get('personality', 'SWING_TRADER')
        try:
            import state_manager
            notify_mode = state_manager.bot_settings.get("notify_mode", "BATCH")
        except Exception:
            notify_mode = data.get('notify_mode', 'BATCH')
        active_btn = "🛑 Botu Durdur" if active else "🚀 Botu Başlat"
        mode_btn   = "🛡️ Swing Moda Geç" if mode == "AGGRESSIVE_TRADER" else "🔥 Agresif Moda Geç"
        if notify_mode == "BATCH":      notify_btn = "🔕 Sessiz Moda Geç"
        elif notify_mode == "SILENT":   notify_btn = "📢 Detaylı Moda Geç"
        else:                           notify_btn = "🔔 Döngü Özetine Geç"
        return {
            "inline_keyboard": [
                [{"text": active_btn, "callback_data": "toggle_active"},
                 {"text": mode_btn,   "callback_data": "toggle_mode"}],
                [{"text": notify_btn, "callback_data": "toggle_notifications"}],
                [{"text": "🧠 Model Eğitimi Detayları", "callback_data": "show_ml"}]
            ]
        }


# Global instance
notifier = TelegramNotifier()

if __name__ == "__main__":
    if TOKEN and CHAT_ID:
        print("Test mesajı gönderiliyor...")
        res = notifier.send_message("🤖 *ANTIGRAVITY AI* Telegram bağlantısı başarılı!")
        print("Başarılı!" if res else "Başarısız!")
    else:
        print("Lütfen .env dosyasına TELEGRAM_BOT_TOKEN ve TELEGRAM_CHAT_ID ekleyin.")
