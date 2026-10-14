# 🔄 SUNUCUDAKI KODU GÜNCELLEME - Adım Adım Rehberi

## 📌 ÖN BİLGİLER

Mevcut durumunuz:
- ✅ Sunucuda çalışan bot var
- ✅ Yeni güncellenmiş kod var
- ❓ Bunu sunucuda nasıl çalıştırırım?

Bu rehber size göstercek!

---

## 🎯 HEDEF SONUÇ

```
ESKI                    YENİ
bot çalışıyor    →     bot durdur
                  →     kodu güncellemek
                  →     test etmek
                  →     bot yeniden başlat
```

---

## ⏱️ TAHMİN SÜRESI: 10-15 DAKİKA

---

## 🔧 ADIM 1: SUNUCUYA BAĞLAN

### Adım 1.1: Terminal Aç

**Mac/Linux:**
```bash
Terminal aç
```

**Windows:**
```
PowerShell veya CMD aç
```

### Adım 1.2: SSH ile Bağlan

Aşağıdaki komutu **KOPYALA-YAPIŞT**:

```bash
ssh -i /path/to/trade-bot-key.pem ubuntu@YOUR_SERVER_IP
```

**DEĞİŞTİR:**
- `/path/to/trade-bot-key.pem` → **Senin key dosyasının yolu**
- `YOUR_SERVER_IP` → **Senin EC2 public IP adresi**

**Örnek:**
```bash
ssh -i ~/Downloads/trade-bot-key.pem ubuntu@34.238.12.45
```

### Adım 1.3: Bağlı mısın?

Aşağıdaki prompt görmek istiyorsun:
```
ubuntu@ip-172-31-xxx-xxx:~$
```

✅ Bu görüntü = Başarılı bağlantı!

---

## 🛑 ADIM 2: ÇALIŞAN BOT'U DURDUR

### Adım 2.1: Sistemd Servisi Durdur

```bash
sudo systemctl stop trade-bot
```

### Adım 2.2: Durumu Kontrol Et

```bash
sudo systemctl status trade-bot
```

Bunu görmelisin:
```
● trade-bot.service - TRADE BOT - Crypto Trading Bot
   Loaded: loaded
   Active: inactive (dead)  ← ÖNEMLİ!
```

✅ **inactive** yazısı = Bot durduruldu!

---

## 📥 ADIM 3: YENİ KODU SUNUCUYA YÜKLE

### Seçenek A: Git Kullanarak (ÖNERİLEN)

Eğer GitHub repo'n varsa:

```bash
cd ~/trade-bot

# Tüm değişiklikleri geri al
git pull origin main

# Veya
git pull origin master

# Kontrol et
git log --oneline -5
```

### Seçenek B: Manuel Upload (SCP)

Eğer GitHub repo'n yoksa:

**LOCAL MAKINENDEKI TERMINAL'DE (Sunucudan ÇIKMA):**

```bash
# EC2'den çık
exit

# Local klasörüne git
cd /path/to/local/TRADE\ BOT

# Sunucuya yükle (SUNUCUDAKI KODU DEĞIŞT)
scp -i ~/Downloads/trade-bot-key.pem -r ./* ubuntu@34.238.12.45:~/trade-bot/

# Tekrar sunucuya bağlan
ssh -i ~/Downloads/trade-bot-key.pem ubuntu@34.238.12.45
```

✅ **Kontrol:** 
```bash
cd ~/trade-bot
ls -la
```

Yeni dosyalar görüyor musun? (backend.py vs.)

---

## 🔍 ADIM 4: DEĞİŞİKLİKLERİ DOĞRULA

### Adım 4.1: Hangi Dosyalar Değişti?

```bash
cd ~/trade-bot

# Git kullanıyorsan
git status

# veya
git diff --name-only
```

Bunu görmek istiyorsun:
```
modified:   backend.py
modified:   radar_loop.py
modified:   scoring_engine.py
```

### Adım 4.2: Detaylı Değişiklikleri Gör

```bash
# Belirli bir dosyayı kontrol et
git diff backend.py | head -50

# veya
cat backend.py | head -30
```

✅ Yeni kod görüyor musun?

---

## 📦 ADIM 5: BAĞIMLILIKLARI GÜNCELLE

### Adım 5.1: Virtual Environment'ı Aktifleştir

```bash
cd ~/trade-bot

# Aktifleştir
source venv/bin/activate

# Kontrol
which python
```

Bunu görmek istiyorsun:
```
/home/ubuntu/trade-bot/venv/bin/python
```

✅ `(venv)` prompt'ta mısın?

### Adım 5.2: Requirements'ı Yükle

**Genel kurulum:**
```bash
pip install --upgrade pip

# Tüm gerekli kütüphaneler (eğer requirements.txt varsa)
pip install -r requirements.txt
```

**Veya Manuel:** (eğer requirements.txt yoksa)
```bash
pip install fastapi uvicorn aiohttp numpy pandas pandas-ta websockets psycopg2-binary boto3 python-telegram-bot requests ccxt
```

✅ **Kontrol:** Hata yoksa tamam!

---

## 🧪 ADIM 6: KODU TEST ET

### Adım 6.1: Python Syntax Kontrol

```bash
cd ~/trade-bot
source venv/bin/activate

# Basit import testi
python3 -c "import backend; print('✅ backend.py OK')"
python3 -c "import radar_loop; print('✅ radar_loop.py OK')"
python3 -c "import scoring_engine; print('✅ scoring_engine.py OK')"
```

Eğer **HATA** görürsen:
```
ModuleNotFoundError: No module named 'xyz'
→ pip install xyz
```

### Adım 6.2: Backend'i Manual Test Et

**Eğer API'ya erişiliyorsa:**

```bash
# Backend'i başlat (ön planda, test için)
python3 backend.py
```

Veya uvicorn ile:
```bash
uvicorn backend:app --host 0.0.0.0 --port 8000
```

Bunu görmek istiyorsun:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

✅ Server çalışıyor!

### Adım 6.3: API'yı Test Et (Yeni Terminal Tab'ında)

**Başka bir terminal aç:**

```bash
ssh -i ~/Downloads/trade-bot-key.pem ubuntu@34.238.12.45

# Test yap
curl http://localhost:8000/get-status

# veya
curl http://YOUR_SERVER_IP:8000/get-status
```

Bunu görmek istiyorsun:
```json
{
  "status": "ok",
  "mode": "SIMULATED",
  "total_value": 10000,
  ...
}
```

❌ **Eğer hata alırsan:**
```bash
# Backend'i durdur (Ctrl+C)

# Log'u kontrol et
tail -50 ~/trade-bot/logs/bot.error.log

# Hatayı oku ve düzelt
```

✅ API çalışıyor!

### Adım 6.4: Telegram'ı Test Et

```bash
curl -X POST http://localhost:8000/telegram-test

# veya

python3 << 'EOF'
from telegram_module import notifier
notifier.send_message("🧪 Test mesaj - Yeni kod çalışıyor!")
EOF
```

✅ Telegram'da mesaj geldi mi?

---

## ✅ ADIM 7: BOT'U BAŞLAT (PRODUCTION)

### Adım 7.1: Backend'i Durdur (Ctrl+C)

```
Eğer manual olarak başlattıysan:
Ctrl+C (terminal'de)
```

### Adım 7.2: Systemd Service'i Başlat

```bash
sudo systemctl start trade-bot
```

### Adım 7.3: Durumu Kontrol Et

```bash
sudo systemctl status trade-bot
```

Bunu görmek istiyorsun:
```
● trade-bot.service - TRADE BOT - Crypto Trading Bot
   Loaded: loaded
   Active: active (running) ← ÖNEMLİ!
```

✅ **active (running)** = Bot çalışıyor!

### Adım 7.4: Log'u İzle

```bash
# Canlı log
sudo journalctl -u trade-bot -f

# Veya son 50 satır
sudo journalctl -u trade-bot -n 50

# Veya hata log'u
tail -f ~/trade-bot/logs/bot.error.log
```

Bunu görmek istiyorsun:
```
May 21 14:30:45 ubuntu backend[1234]: [INFO] Market radar starting...
May 21 14:30:48 ubuntu backend[1234]: [INFO] Scanning 200 coins...
May 21 14:31:02 ubuntu backend[1234]: [INFO] Signals generated: 5
```

✅ Bot çalışıyor ve işlem yapıyor!

---

## 🔄 ADIM 8: DAEMON'U YENIDEN BAŞLAT (OPTIONAL)

Eğer service'de değişiklik yaptıysan:

```bash
sudo systemctl daemon-reload
sudo systemctl restart trade-bot
```

---

## 📊 ADIM 9: MONITORING

### Kontrol Listesi

```bash
# 1. Service status
sudo systemctl status trade-bot

# 2. Log'lar
sudo journalctl -u trade-bot -f

# 3. API çalışıyor mu?
curl http://localhost:8000/get-status | jq .

# 4. Dikkat edilecek hataları kontrol
grep -i "error\|exception" ~/trade-bot/logs/bot.error.log | tail -20

# 5. Telegram mesajları geliyor mu?
# Telegram bot'tan /status komutu gönder

# 6. Diskette yer var mı?
df -h

# 7. RAM yeterli mi?
free -h

# 8. CPU kullanımı
top -b -n 1 | head -20
```

---

## ❌ SORUN GIDERMELER

### Sorun 1: "Connection refused" hatası

```bash
# SSH bağlantı
ssh -i ~/Downloads/trade-bot-key.pem ubuntu@34.238.12.45

# Ping ile kontrol
ping 34.238.12.45
```

**Çözüm:** 
- EC2 public IP doğru mu?
- Security group'ta SSH port açık mı?

---

### Sorun 2: "ModuleNotFoundError"

```bash
# Virtual environment aktif mi?
which python

# Evet mi? /home/ubuntu/trade-bot/venv/bin/python

# Aktifleştir
source ~/trade-bot/venv/bin/activate

# Requirements yükle
pip install -r requirements.txt
```

---

### Sorun 3: "Port 8000 already in use"

```bash
# Başka process'i bul
sudo lsof -i :8000

# Öldür
kill -9 PROCESS_ID

# Veya service restart
sudo systemctl restart trade-bot
```

---

### Sorun 4: Bot başlıyor ama çöküyor

```bash
# Service log'u kontrol
sudo journalctl -u trade-bot -n 100

# Error log'u
cat ~/trade-bot/logs/bot.error.log

# .env dosyası doğru mu?
cat ~/.env | grep BINANCE
```

---

### Sorun 5: Güncellemeler uygulanmadı

```bash
# Git status kontrol
git status

# Untracked files varsa
git stash

# Tekrar pull yap
git pull origin main

# Service restart
sudo systemctl restart trade-bot
```

---

## 📋 QUICK CHECKLIST (Hızlı Kontrol)

```
GÜNCELLEMEDEN ÖNCE:
☐ SSH bağlantı kurdum
☐ Bot'u durdurdum
☐ .env file'ı yedekledim

GÜNCELLEME SIRASIN:
☐ Yeni kodu yükledim
☐ Git pull yaptım / SCP ile yükledim
☐ Değişiklikleri doğruladım
☐ Requirements yükledim

TEST AŞAMASI:
☐ Python syntax kontrolü
☐ Import testi başarılı
☐ API /get-status çalıştı
☐ Telegram mesajı geldi

DEPLOYMENT:
☐ Bot'u başlattım
☐ Status aktif (running)
☐ Log'ta hata yok
☐ Telegram /status komutu çalıştı

MONITORING:
☐ Last 30 minutes log temiz
☐ CPU < 80%
☐ RAM < 70%
☐ Disk > 1GB boş
```

---

## 💡 PRO TIPS

### Tip 1: Güncellemeler Sırasında Downtime Yok
```bash
# Yeni terminal'de eski bot çalıştırırken
# Yeni kodu başka klasörde test et

cp -r ~/trade-bot ~/trade-bot-new
cd ~/trade-bot-new
# Test et...
# Tamam? Eski klasörü değiştir
```

### Tip 2: Rollback (Geri Alma)
```bash
cd ~/trade-bot

# Önceki version'a dön
git revert HEAD

# veya
git checkout HEAD~1 -- .

# Restart
sudo systemctl restart trade-bot
```

### Tip 3: Logları Döndür (Log Cleanup)
```bash
# Eski logları sıkıştır
tar -czf ~/trade-bot/logs/logs-$(date +%Y%m%d).tar.gz ~/trade-bot/logs/*.log

# Cleanup
rm ~/trade-bot/logs/*.log
```

### Tip 4: Automatic Backups
```bash
# Cron job ekle
crontab -e

# Ekle (hergün 23:00'de):
0 23 * * * cp -r ~/trade-bot ~/trade-bot-backup-$(date +\%Y\%m\%d)
```

---

## 🎯 ÖZET: NE YAPTıN?

```
1. SSH ile sunucuya bağlandın
2. Çalışan bot'u durdurdun
3. Yeni kodu yükledin (git pull/scp)
4. Bağımlılıkları güncelledin
5. Test ettin (manual + API)
6. Bot'u başlattın
7. Monitoring başlattın
```

**SONUÇ: GÜNCELLENEN KOD SUNUCUDA ÇALIŞIYOR! 🚀**

---

## 📞 SIKI DÖNÜŞ ADIMLAR

Eğer hızlı yapmak istiyorsan (60 saniye):

```bash
# 1. SSH bağlan
ssh -i ~/Downloads/trade-bot-key.pem ubuntu@YOUR_IP

# 2. Bot durdur
sudo systemctl stop trade-bot

# 3. Kodu güncelle
cd ~/trade-bot && git pull origin main

# 4. Dependencies
source venv/bin/activate && pip install -r requirements.txt

# 5. Bot başlat
sudo systemctl start trade-bot

# 6. Kontrol
sudo systemctl status trade-bot

# 7. Log
sudo journalctl -u trade-bot -f
```

**TAMAM!** ✅

---

*Son Güncelleme: 2026-05-21*
*Versiyon: 1.0*
