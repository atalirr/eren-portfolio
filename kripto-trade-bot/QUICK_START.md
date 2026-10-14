# ⚡ HIZLI BAŞLANGIÇ - AWS Deployment (30 Dakika Kısa Versiyon)

## 🚨 HEMEN ŞU ANDA YAP (Sırasıyla)

### **ADIM 1: AWS'ye Gir (5 dakika)**

1. https://aws.amazon.com git
2. Sign in (veya Create Account)
3. AWS Console'u aç (top-right corner)
4. **Region seç**: `us-east-1` (solda üstte, sağa tıkla)

✅ **Kontrol:** Console açık, bölge US-EAST-1 gösteriyor mu?

---

### **ADIM 2: EC2 Instance Oluştur (10 dakika)**

**Search bar'a** "EC2" yaz → Click `EC2` (Compute)

#### 2.1 Launch Instance
```
1. "Instances" (solda) → Click
2. "Launch Instance" (sağda, turuncu buton)
```

#### 2.2 Adım Adım Doldur

**NAME:**
```
trade-bot-server
```

**APPLICATION AND OS IMAGES (AMI):**
- Ubuntu seç
- **Ubuntu Server 22.04 LTS** (Free tier eligible) seç

**INSTANCE TYPE:**
- `t2.micro` seç (free tier)

**KEY PAIR:**
```
Create new key pair
Name: trade-bot-key
Format: .pem (Mac/Linux) veya .ppk (Windows PuTTY)
→ Download key → Secure klasöre kaydet (sifrelemek)
```

**NETWORK SECURITY (FIREWALL KURALLARI):**

"Create security group" seç

```
Security group name: trade-bot-sg

Inbound rules:
┌─────────┬─────────┬──────────────┬─────────────┐
│ Type    │ Port    │ Source       │ Description │
├─────────┼─────────┼──────────────┼─────────────┤
│ SSH     │ 22      │ 0.0.0.0/0    │ SSH Access  │
│ HTTP    │ 80      │ 0.0.0.0/0    │ HTTP        │
│ HTTPS   │ 443     │ 0.0.0.0/0    │ HTTPS       │
│ Custom  │ 8000    │ 0.0.0.0/0    │ FastAPI     │
│ Custom  │ 5432    │ 0.0.0.0/0    │ Database    │
└─────────┴─────────┴──────────────┴─────────────┘
```

**STORAGE:**
- 20 GB (default)

**ADVANCED DETAILS:**
- Skip (default fine)

✅ **LAUNCH** (turuncu buton, sağ altta)

✅ **Kontrol:** "Successfully launched" mesajı görüyor musun?

```
COPY & SAVE:
- Instance ID: i-0123456789abc (will need)
- Public IP: XX.XXX.XXX.XXX (will need)
```

---

### **ADIM 3: EC2'ye SSH ile Bağlan (5 dakika)**

#### Sadece Mac/Linux için:
```bash
# Terminal aç

# Key dosyasını secure hale getir
chmod 400 /path/to/trade-bot-key.pem

# Bağlan (XX.XXX.XXX.XXX = Public IP)
ssh -i /path/to/trade-bot-key.pem ubuntu@XX.XXX.XXX.XXX

# Prompt görmek: ubuntu@ip-xxx-xxx-xxx-xxx:~$
# → GEREKSEYEBİLİR: yes yazıp Enter (host fingerprint accept etmek için)
```

#### Windows için (PuTTY):
```
1. PuTTY indir (https://www.putty.org/)
2. PuTTYgen aç
3. "Load" → trade-bot-key.pem seç
4. "Save private key" → trade-bot-key.ppk
5. PuTTY aç
6. Host: ubuntu@XX.XXX.XXX.XXX
7. SSH → Auth → Private key: trade-bot-key.ppk
8. Open
```

✅ **Kontrol:** Ubuntu prompt görmek?

---

### **ADIM 4: EC2'de Kurulum (5 dakika)**

**Aşağıdaki komutları kopyala-yapıştır:**

```bash
# System güncelle
sudo apt update && sudo apt upgrade -y

# Python 3.10+ kur
sudo apt install -y python3.10 python3.10-venv python3-pip

# Git & wget
sudo apt install -y git curl wget

# Klasör oluştur
mkdir -p ~/trade-bot
cd ~/trade-bot

# Virtual environment
python3.10 -m venv venv
source venv/bin/activate

# Dependencies yükle (critical!)
pip install --upgrade pip setuptools wheel
pip install fastapi uvicorn aiohttp numpy pandas python-telegram-bot psycopg2-binary boto3 requests

# Test et
python3 -c "import fastapi; print(f'FastAPI version: {fastapi.__version__}')"
```

✅ **Kontrol:** `(venv)` prompt'ta mısın? FastAPI version görüyor musun?

---

### **ADIM 5: Kodunu EC2'ye Yükle (3 dakika)**

#### Option A: Git (eğer GitHub repo'n varsa)
```bash
git clone https://github.com/YOUR_USERNAME/trade-bot.git
cd trade-bot
```

#### Option B: Manual Upload (SCP ile)

**Local makinendeki Terminal'de** (EC2'den ÇIKMA):
```bash
# EC2'den logout et (Ctrl+D veya exit)

# Local terminal'de:
cd /path/to/TRADE\ BOT

# Kod'u EC2'ye gönder
scp -i /path/to/trade-bot-key.pem -r ./* ubuntu@XX.XXX.XXX.XXX:~/trade-bot/

# Tekrar EC2'ye bağlan
ssh -i /path/to/trade-bot-key.pem ubuntu@XX.XXX.XXX.XXX
```

✅ **Kontrol:** `ls ~/trade-bot/` → backend.py, radar_loop.py vs. görüyor musun?

---

### **ADIM 6: .env File Oluştur (2 dakika)**

```bash
cd ~/trade-bot
nano .env
```

Aşağıdaki metni yapıştır (SENİN values'lerle değiştir):
```env
# EXCHANGE KEYS (Binance)
BINANCE_API_KEY=your_binance_api_key_here
BINANCE_SECRET_KEY=your_binance_secret_key_here

# EXCHANGE KEYS (Bybit)
BYBIT_API_KEY=your_bybit_api_key_here
BYBIT_SECRET_KEY=your_bybit_secret_key_here

# TELEGRAM
TELEGRAM_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# BOT SETTINGS
MODE=SIMULATED
DEBUG=True
HOST=0.0.0.0
PORT=8000
```

**Kaydet:**
- `Ctrl+X` → `Y` → `Enter`

✅ **Kontrol:** `cat .env` → Tüm values doldurulmuş mu?

---

### **ADIM 7: Backend'i Test Et (2 dakika)**

```bash
cd ~/trade-bot
source venv/bin/activate

# Basit test
python3 -c "import backend; print('Backend module OK')"

# FastAPI server başlat (test mode)
python3 backend.py &

# Bekleme... 3-5 saniye

# Test et (yeni terminal tab'ında)
curl http://localhost:8000/get-status
```

✅ **Kontrol:** JSON response görüyor musun? Hata mı yoksa?

---

### **ADIM 8: Systemd Service Oluştur (1 dakika)**

```bash
# Service file oluştur
sudo nano /etc/systemd/system/trade-bot.service
```

Aşağıdaki kodu yapıştır:
```ini
[Unit]
Description=TRADE BOT - Crypto Trading Bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/trade-bot
Environment="PATH=/home/ubuntu/trade-bot/venv/bin"
EnvironmentFile=/home/ubuntu/trade-bot/.env
ExecStart=/home/ubuntu/trade-bot/venv/bin/python backend.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Kaydet:** `Ctrl+X` → `Y` → `Enter`

```bash
# Aktivate et
sudo systemctl daemon-reload
sudo systemctl enable trade-bot
sudo systemctl start trade-bot

# Kontrol et
sudo systemctl status trade-bot

# Canlı log
sudo journalctl -u trade-bot -f
```

✅ **Kontrol:** `active (running)` yazısı görüyor musun?

---

## 🧪 TESTING

### Test 1: API Endpoint'i
```bash
curl http://XX.XXX.XXX.XXX:8000/get-status
```

Expected Response:
```json
{
  "status": "ok",
  "mode": "SIMULATED",
  "positions": 0,
  ...
}
```

### Test 2: Telegram
```bash
curl -X POST http://XX.XXX.XXX.XXX:8000/telegram-test
```

Expected: Telegram'da mesaj geldi mi?

### Test 3: Backtest
```bash
source venv/bin/activate
python backtest_runner.py --symbol BTC/USDT --days 7
```

Expected: `backtest_results.json` oluştu mu?

---

## 🎛️ DASHBOARD ERIŞIM

### Web Dashboard'u Aç
```
http://XX.XXX.XXX.XXX:8000/dashboard
(veya frontend klasöründeki index.html)
```

### Telegram Commands
```
/status  → Bot durumu
/balance → Cüzdan bakiyesi
/trades  → Son işlemler
/stop    → Botu durdur
/start   → Botu başlat
```

---

## ⚠️ TROUBLESHOOTING

| Problem | Çözüm |
|---------|-------|
| **"Connection refused"** | EC2 security group'ta 8000 port açık mı? |
| **"ModuleNotFoundError"** | `pip install -r requirements.txt` çalıştır |
| **"Permission denied" (SSH)** | `chmod 400 trade-bot-key.pem` çalıştır |
| **Bot doesn't start** | `sudo systemctl status trade-bot` kontrol et |
| **No Telegram alerts** | API key/token/chat ID doğru mu? |
| **Out of memory** | EC2 t2.small'a upgrade et |

---

## 📊 SONRAKI ADIMLAR (Opsiyonel)

### 1. Domain Name (HTTPS)
```bash
# Route 53 (AWS)'den domain satın al
# CloudFront distribution yap
```

### 2. Database (RDS)
```bash
# PostgreSQL RDS oluştur
# state_manager.py'de bağlantı ayarla
# Backup scheduled
```

### 3. Monitoring
```bash
# CloudWatch alarms
# SNS notifications
# Auto-scaling
```

### 4. CI/CD
```bash
# GitHub Actions
# Auto-deploy on push
# Automated testing
```

---

## 🚀 BAŞARILI! Neler Yaptın?

✅ AWS EC2 instance oluşturdun
✅ Python environment kurdum
✅ Backend'i çalıştırdın
✅ API endpoint'leri test ettin
✅ Telegram'ı bağladın
✅ Systemd service'i ayarladın
✅ Dashboard accessible

**BOT CANLIDA! 🎉**

---

## 📞 YARDIM GEREKIRSE

1. CloudWatch logs kontrol et: `sudo journalctl -u trade-bot -f`
2. .env dosyasının tüm keys doğru mu?
3. Binance/Bybit API keys active mi?
4. EC2 instance running mi?
5. Security group kuralları doğru mu?

---

**GERÇEKTİ DEPLOYMENT SÜRESI: 30-45 DAKİKA** ⏱️

**GİDİŞAT!** 🚀

---

*Son Güncelleme: 2026-05-21*
*Versiyon: 1.0*
