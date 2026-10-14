# 🎬 SUNUCUDA KOD GÜNCELLEME - VİZÜEL AKIŞ

## 📹 CANLI ADIM ADIM (Komut Kopyala-Yapıştır)

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                    SUNUCUDAKI KODU GÜNCELLEME                            ║
║                          (10-15 dakika)                                  ║
╚═══════════════════════════════════════════════════════════════════════════╝

BAŞLANGIÇ DURUMU:
┌─────────────────────────────────────┐
│  Sunucuda bot çalışıyor             │
│  ├─ trade-bot service: running      │
│  ├─ FastAPI: port 8000'de           │
│  └─ Telegram: connected             │
└─────────────────────────────────────┘


SONUÇ DURUMU:
┌─────────────────────────────────────┐
│  Sunucuda yeni bot çalışıyor        │
│  ├─ trade-bot service: running      │
│  ├─ FastAPI: port 8000'de           │
│  ├─ Yeni kod: aktif                 │
│  └─ Telegram: connected             │
└─────────────────────────────────────┘
```

---

## 🔌 ADIM 1: BAĞLAN (60 saniye)

### Komut 1: SSH ile Bağlan

```bash
ssh -i ~/Downloads/trade-bot-key.pem ubuntu@34.238.12.45
```

↓ Bekleme (bağlantı kuruluyor)

```
ubuntu@ip-172-31-34-156:~$ ← BU GÖRÜNÜM = BAŞARILI!
```

**EĞER HATA ALIRSAN:**
```
Permission denied (publickey)
→ Key path doğru mu? ~/Downloads/trade-bot-key.pem
→ IP doğru mu? 34.238.12.45

Bağlantı timeout
→ Security group'ta SSH (22) port açık mı?
```

✅ **Kontrol:** `ubuntu@` prompt görüyor musun?

---

## 🛑 ADIM 2: BOT'U DURDUR (30 saniye)

### Komut 1: Service'i Durdur

```bash
sudo systemctl stop trade-bot
```

↓ Sistem soruyor (password istemeyebilir)

### Komut 2: Durumunu Kontrol Et

```bash
sudo systemctl status trade-bot
```

✅ **Bunu görmek istiyorsun:**
```
● trade-bot.service - TRADE BOT
   Loaded: loaded (/etc/systemd/system/trade-bot.service; enabled)
   Active: inactive (dead)  ← İŞTE BU!
```

❌ **HATA:**
```
Active: active (running)

→ Yeniden deneyin: sudo systemctl stop trade-bot
```

---

## 📥 ADIM 3: KOD'U GÜNCELLE (2-3 dakika)

### Seçenek A: GİT KULLAN (Önerilen)

```bash
# Sunucuda git repo'na git
cd ~/trade-bot

# Tüm değişiklikleri indir
git pull origin main
```

↓ Bekleme (kod indiriliyorsa)

```
remote: Counting objects: 100%
remote: Compressing objects: 100%
Unpacking objects: 100%
Fast-forward
 backend.py          | 45 ++++++++++++++++++---
 radar_loop.py       | 23 +++++++++--
 scoring_engine.py   | 12 +++---
 3 files changed, 80 insertions(+), 23 deletions(-)
```

✅ **İyi haber:** "3 files changed, 80 insertions" = Kod indirildi!

❌ **HATA:**
```
fatal: not a git repository

→ Option B'yi kullan (SCP ile manual yükle)
```

### Seçenek B: MANUEL UPLOAD (SCP)

**SUNUCUDAN ÇIKMA!** (exit yaz)

```bash
exit
```

**LOCAL MAKİNENDEN:**

```bash
# Kod klasörüne git
cd ~/Desktop/TRADE\ BOT

# Sunucuya yükle
scp -i ~/Downloads/trade-bot-key.pem -r ./* ubuntu@34.238.12.45:~/trade-bot/
```

↓ Bekleme (dosyalar yükleniyor)

```
backend.py              100%  45KB   1.2MB/s   00:00
radar_loop.py           100%  42KB   1.1MB/s   00:00
scoring_engine.py       100%  18KB   900KB/s   00:00
[=====> 100% COMPLETE
```

**Tekrar sunucuya bağlan:**

```bash
ssh -i ~/Downloads/trade-bot-key.pem ubuntu@34.238.12.45
cd ~/trade-bot
```

---

## ✅ ADIM 4: DEĞİŞİKLİKLERİ DOĞRULA (1 dakika)

### Komut 1: Hangi Dosyalar Değişti?

```bash
cd ~/trade-bot

# Git kullanıyorsan
git diff --name-only HEAD~1

# veya tüm değişiklikleri gör
git log --oneline -5
```

✅ **Bunu görmek istiyorsun:**
```
backend.py
radar_loop.py
scoring_engine.py
state_manager.py
```

### Komut 2: Yeni Kod'u Kontrol Et

```bash
# Yeni backend.py'nin ilk 20 satırını gör
head -20 backend.py

# veya güncellenme tarihini gör
ls -la backend.py
```

✅ **Tarih yakın zamanda mi?** May 21 2026 gibi?

---

## 📦 ADIM 5: BAĞIMLILIKLARI GÜNCELLE (2-3 dakika)

### Komut 1: Virtual Environment'ı Aktif Et

```bash
cd ~/trade-bot

source venv/bin/activate
```

✅ **Kontrol:** Prompt'a `(venv)` eklenmiş mi?

```
(venv) ubuntu@ip-172-31-34-156:~/trade-bot$
```

### Komut 2: Pip'i Güncelle

```bash
pip install --upgrade pip
```

↓ Bekleme (pip güncelleniyor)

### Komut 3: Requirements Yükle

```bash
# Eğer requirements.txt varsa
pip install -r requirements.txt

# Veya manuel
pip install fastapi uvicorn aiohttp numpy pandas pandas-ta websockets psycopg2-binary boto3 python-telegram-bot requests ccxt
```

↓ Bekleme (paketler yükleniyor)

```
Collecting fastapi
Collecting uvicorn
Collecting aiohttp
...
Successfully installed fastapi-0.95.2 uvicorn-0.21.3 ... (20 packages)
```

✅ **"Successfully installed"** = Tamam!

❌ **HATA:**
```
ERROR: Could not find a version that satisfies the requirement

→ Paket adını kontrol et
→ İnternet bağlantısı var mı?
```

---

## 🧪 ADIM 6: TEST ET (2-3 dakika)

### Komut 1: Python Syntax Kontrol

```bash
python3 -c "import backend; print('✅ backend OK')"
python3 -c "import radar_loop; print('✅ radar_loop OK')"
python3 -c "import scoring_engine; print('✅ scoring_engine OK')"
```

✅ **Bunu görmelisin:**
```
✅ backend OK
✅ radar_loop OK
✅ scoring_engine OK
```

❌ **HATA:**
```
ModuleNotFoundError: No module named 'ccxt'

→ pip install ccxt
→ Tekrar çalıştır
```

### Komut 2: Backend'i Test Et

```bash
# Backend'i başlat (test mode)
python3 backend.py
```

↓ Bekleme (backend başlıyor)

```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Shutting down
INFO:     Waiting for application startup
[bold cyan]BACKEND BAŞLIYOR...[/bold cyan]
```

✅ **"running on http://0.0.0.0:8000"** görüyor musun?

### Komut 3: API'yı Test Et (Yeni Terminal Tab'ında)

**Sunucudan ÇIKMA! (Ctrl+C)**

```bash
Ctrl+C
```

**Yeni terminal tab'ında:**

```bash
# Sunucuya bağlan
ssh -i ~/Downloads/trade-bot-key.pem ubuntu@34.238.12.45

# API'yi test et
curl http://localhost:8000/get-status
```

✅ **JSON response görmelisin:**
```json
{
  "status": "ok",
  "mode": "SIMULATED",
  "total_value": 10000,
  "roi": 0.5,
  ...
}
```

❌ **HATA:**
```
curl: (7) Failed to connect to localhost port 8000

→ Backend başlatıldı mı?
→ BAŞKA TABİ KONTROL ET
```

### Komut 4: Telegram'ı Test Et

```bash
# Telegram mesaj gönder
python3 << 'EOF'
from telegram_module import notifier
notifier.send_message("🟢 YENİ KOD ÇALIŞIYOR! Test mesaj.")
EOF
```

✅ **Telegram bot'a mesaj geldi mi?**

---

## 🚀 ADIM 7: BOT'U BAŞLAT (1 dakika)

### Komut 1: Service'i Başlat

```bash
sudo systemctl start trade-bot
```

### Komut 2: Status Kontrol

```bash
sudo systemctl status trade-bot
```

✅ **Bunu görmek istiyorsun:**
```
● trade-bot.service - TRADE BOT - Crypto Trading Bot
   Loaded: loaded (/etc/systemd/system/trade-bot.service; enabled; vendor preset: enabled)
   Active: active (running)  ← ÖNEMLİ!
   Main PID: 2345 (python3)
   Tasks: 10
   Memory: 150.2M
   CPU: 2.4%
   CGroup: /system.slice/trade-bot.service
           └─2345 /home/ubuntu/trade-bot/venv/bin/python3 backend.py

May 21 14:30:45 ubuntu backend[2345]: INFO: Uvicorn running on http://0.0.0.0:8000
May 21 14:30:46 ubuntu backend[2345]: INFO: Market radar starting...
May 21 14:30:48 ubuntu backend[2345]: INFO: Telegram handler initialized
```

✅ **active (running)** = BOT ÇALIŞIYOR!

❌ **HATA:**
```
Active: failed (Result: exit-code)

→ Log'u kontrol et: sudo journalctl -u trade-bot -n 50
→ .env dosyası doğru mu?
```

---

## 📊 ADIM 8: MONITORING (1-2 dakika)

### Komut 1: Live Log İzle

```bash
sudo journalctl -u trade-bot -f
```

↓ Canlı log

```
May 21 14:30:45 ubuntu backend[2345]: [INFO] Uvicorn running
May 21 14:30:46 ubuntu backend[2345]: [INFO] Market radar: scanning...
May 21 14:30:48 ubuntu backend[2345]: [INFO] 200 coins scanned
May 21 14:30:52 ubuntu backend[2345]: [INFO] Signals generated: 3
May 21 14:30:55 ubuntu backend[2345]: [INFO] Trade executed: BTC/USDT
May 21 14:30:58 ubuntu backend[2345]: [INFO] Telegram alert sent
```

✅ **Hatasız mi?** Çıkmak için: `Ctrl+C`

### Komut 2: Error Log'u Kontrol

```bash
tail -50 ~/trade-bot/logs/bot.error.log
```

✅ **Boş mu?** (error yok)

### Komut 3: Sistem Kaynakları

```bash
# CPU ve RAM
top -b -n 1 | head -15

# Disk space
df -h

# Memory
free -h
```

✅ **Kontrol:**
- CPU < 80% ✓
- RAM < 50% ✓
- Disk > 1GB boş ✓

### Komut 4: API Son Kontrol

```bash
curl http://localhost:8000/get-status | jq .
```

✅ **JSON görüyor musun?**

---

## ✨ TAMAM! BAŞARILI GÜNCELLEME

```
┌─────────────────────────────────────┐
│  ✅ KOD GÜNCELLENDI                 │
│  ✅ BOT ÇALIŞIYOR                   │
│  ✅ API BİR ARADA                   │
│  ✅ TELEGRAM BAĞLI                  │
│  ✅ LOG'TA HATA YOK                 │
│  ✅ SISTEM STABIL                   │
└─────────────────────────────────────┘

GÜNCELLEMENİN TAMAMLANMASI: ⏱️ 10-15 DAKIKA
```

---

## 🆘 SORUN GIDERMELER

### ❌ "Connection refused"

```bash
# Sunucuya bağlan
ssh -i ~/Downloads/trade-bot-key.pem ubuntu@34.238.12.45

# Service duruşu kontrol
sudo systemctl status trade-bot

# Eğer dead ise:
sudo systemctl restart trade-bot

# Log'u gör
sudo journalctl -u trade-bot -n 20
```

### ❌ "ModuleNotFoundError"

```bash
# Virtual environment'a gir
source ~/trade-bot/venv/bin/activate

# Tekrar yükle
pip install -r requirements.txt

# Service restart
sudo systemctl restart trade-bot
```

### ❌ "Port 8000 already in use"

```bash
# Hangi process kullanıyor?
sudo lsof -i :8000

# Öldür
kill -9 PROCESS_ID

# Yeniden başlat
sudo systemctl restart trade-bot
```

### ❌ "Git pull failed"

```bash
# Untracked changes geri al
git stash

# Tekrar pull yap
git pull origin main

# Service restart
sudo systemctl restart trade-bot
```

### ❌ ".env not found"

```bash
# Kontrol et
cat ~/.env

# Yoksa, SSH'da nano ile oluştur:
nano ~/.env

# İçeriği yapıştır:
BINANCE_API_KEY=xxx
TELEGRAM_TOKEN=yyy
MODE=SIMULATED
```

---

## 📋 QUICK CHECKLIST

```
SUNUCUYA BAĞLAN
☐ SSH komutu çalıştı
☐ ubuntu@ prompt görüyorum

BOT'U DURDUR
☐ sudo systemctl stop trade-bot
☐ Status: inactive (dead)

KOD'U GÜNCELLE
☐ git pull origin main VEYA scp upload
☐ Dosyalar güncellendi

BAĞIMLILIKLARI GÜNCELLE
☐ source venv/bin/activate
☐ pip install -r requirements.txt
☐ Hata yok

TEST ET
☐ python3 -c "import backend" → OK
☐ curl http://localhost:8000/get-status → JSON
☐ Telegram mesajı geldi

BAŞLAT
☐ sudo systemctl start trade-bot
☐ Status: active (running)
☐ Log'ta hata yok

MONITORING
☐ curl /get-status → Çalışıyor
☐ Telegram /status → Cevap geliyor
☐ CPU < 80%, RAM < 50%
```

---

## 💡 ÖNEMLİ NOTLAR

⚠️ **Her zaman systemd service'i restart et:**
```bash
sudo systemctl restart trade-bot
```

⚠️ **.env dosyasını güvenli tut:**
```bash
# Hiç GitHub'a commit etme!
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Ignore .env file"
```

⚠️ **Backups yap:**
```bash
# Önceki versiyon'u kopyala
cp -r ~/trade-bot ~/trade-bot-backup-$(date +%Y%m%d)
```

⚠️ **Production'dan ÖNCE test et:**
```bash
# SIMULATED mode'da 1 gün test
MODE=SIMULATED python3 backend.py
```

---

**🎉 BAŞARILI! YENİ KOD SUNUCUDA ÇALIŞIYOR!** 🚀
