# 🚀 TRADE BOT AWS Deployment Stratejisi

## 📐 KATMANLI MİMARİ (Layered Architecture)

Kodunuz **5 katmanlı mikroservis mimarisine** sahiptir:

```
┌─────────────────────────────────────────────────────────┐
│  SUNUM KATMANI (Presentation Layer)                      │
│  - Frontend (React/Vue Dashboard)                        │
│  - WebSocket bağlantıları (real-time updates)           │
└──────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  API KATMANI (API Layer)                                 │
│  - backend.py (FastAPI)                                 │
│  - /get-status, /execute-trade, /get-wallet, etc.      │
│  - CORS middleware                                      │
└──────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  BİZNES LOJİĞİ KATMANI (Business Logic Layer)          │
│  ├─ radar_loop.py (Piyasa Taraması & Sinyal Üretimi)   │
│  ├─ scoring_engine.py (Teknik Puanlama)                │
│  ├─ trade_executor.py (İşlem Yürütme)                  │
│  ├─ signal_engine.py (Sinyal Mantığı)                  │
│  └─ risk_engine.py (Risk Yönetimi)                     │
└──────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  VERI KATMANI (Data Layer)                              │
│  ├─ state_manager.py (Durum Yönetimi)                  │
│  ├─ bot_state.json (Anında durum)                      │
│  ├─ fleet_state.json (Pozisyon takibi)                 │
│  └─ trade_log (İşlem geçmişi)                          │
└──────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  HARICI SERVİSLER (External Services)                   │
│  ├─ Binance/Bybit API (Piyasa Verileri & İşlemler)     │
│  ├─ Telegram API (Bildirimler & Komutlar)              │
│  └─ TradingView API (İndikatörler)                     │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 SON YAPILAN DEĞİŞİKLİKLER (May 21, 2026)

### Değiştirilen Dosyalar:
1. **backend.py** - FastAPI yapısı güncellenmiş
2. **radar_loop.py** - Piyasa tarama algoritması iyileştirilmiş
3. **scoring_engine.py** - Teknik puanlama mantığı refactor edilmiş
4. **indicators.py** - İndikatör kütüphanesi eklenmişt
5. **state_manager.py** - Durum yönetimi merkezi
6. **trade_executor.py** - İşlem yürütme optimize edilmiş
7. **backtest_runner.py** - Backtest sistemi güçlendirilmiş

### Mimari İyileştirmeler:
✅ **Modüler Yapı** - Her bileşen bağımsız çalışabilir
✅ **Async Processing** - Eşzamansız işlem (FastAPI + asyncio)
✅ **State Management** - Merkezi durum kontrolü
✅ **Risk Controls** - Circuit Breaker ve Position Limits
✅ **Telegram Integration** - Real-time komut & bildirimler

---

## 🌩️ AWS DEPLOYMENT MIMARISI

### Önerilen AWS Mimarisi:

```
┌─────────────────────────────────────────────────────────┐
│                   INTERNET                              │
│              (Kullanıcı Tarayıcısı)                    │
└──────────────────────────────────────────┬──────────────┘
                                           │
                    ┌──────────────────────┴──────────────────┐
                    │                                         │
        ┌───────────▼─────────┐                 ┌──────────▼────────┐
        │   CloudFront CDN    │                 │  API Gateway      │
        │  (Dashboard Cache)  │                 │  (Route: /api/*)  │
        └─────────────────────┘                 └────────┬─────────┘
                                                         │
                        ┌────────────────────────────────┴──────────┐
                        │                                           │
              ┌─────────▼──────────┐                  ┌──────────▼───┐
              │    EC2 / ECS       │                  │   Lambda      │
              │  (Backend Server)  │                  │ (API Routes)  │
              │   - backend.py     │                  │               │
              │   - FastAPI        │                  │ (Optional)    │
              └────────┬───────────┘                  └───────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        │              │              │              │
    ┌───▼───┐  ┌──────▼──┐  ┌───────▼──┐  ┌────────▼──┐
    │  RDS  │  │ S3 (Logs)│  │ DynamoDB │  │ Secrets   │
    │(State)│  │& Backups │  │  (Cache) │  │ Manager   │
    └───────┘  └──────────┘  └──────────┘  │(API Keys) │
                                           └───────────┘
        │
    ┌───▼────────────────────────────────────────┐
    │   BACKGROUND TASKS (ECS Fargate / Lambda)   │
    │   ├─ radar_loop (her 1 dakika)            │
    │   ├─ scoring_engine (her 30 saniye)       │
    │   ├─ trade_executor (event-driven)        │
    │   └─ telegram_module (komut listener)      │
    └────────────────────────────────────────────┘
        │
    ┌───▴──────────────────────────────────────────┐
    │  EXTERNAl SERVICES (Outbound)                 │
    │  ├─ Binance API (Market Data)                │
    │  ├─ Bybit API (Trading)                      │
    │  └─ Telegram API (Notifications)             │
    └────────────────────────────────────────────┘
```

---

## 🔧 AWS DEPLOYMENT ADIM ADIM

### **AŞAMA 1: AWS'DE PROJE SETUP (30 dakika)**

#### 1.1 AWS Hesabı ve İlk Ayarlar
```bash
# AWS CLI kurulumu
aws configure
# Access Key ID: YOUR_ACCESS_KEY
# Secret Access Key: YOUR_SECRET_KEY
# Default region: us-east-1 (veya eu-west-1)
# Output format: json
```

#### 1.2 EC2 Instance Oluşturma (Backend için)
**AWS Console > EC2 > Launch Instance**

```
Adım 1: AMI Seç
- Ubuntu Server 22.04 LTS (free tier eligible)

Adım 2: Instance Type
- t2.micro (free tier) veya t3.small (prod)

Adım 3: Network Settings
- VPC: default
- Subnet: public
- Auto-assign Public IP: Enable
- Security Group: Yeni oluştur
  * HTTP (80): Anywhere
  * HTTPS (443): Anywhere
  * SSH (22): Your IP only
  * Custom TCP (8000): Anywhere (FastAPI)

Adım 4: Storage
- 20 GB (free tier başına)

Adım 5: Key Pair
- Yeni oluştur: "trade-bot-key.pem"
- Download et ve secure sakla!

Adım 6: Launch
```

#### 1.3 RDS Database Oluşturma (State Management için)
**AWS Console > RDS > Create Database**

```
- Engine: PostgreSQL (free tier: version 13 compat)
- DB Instance Class: db.t2.micro (free tier)
- Storage: 20 GB
- DB Name: trade_bot_db
- Username: admin
- Password: Strong password (save it!)
- Public Access: No (erişim EC2'den olacak)
- Backup: 7 days
```

#### 1.4 S3 Bucket Oluşturma (Logs & Backups için)
**AWS Console > S3 > Create Bucket**

```
- Bucket name: trade-bot-logs-<your-id>
- Region: us-east-1
- Block public access: CHECKED
- Versioning: Enable
```

---

### **AŞAMA 2: EC2'DE BACKEND DEPLOY (45 dakika)**

#### 2.1 EC2'ye Bağlanma
```bash
# SSH ile bağlan
ssh -i trade-bot-key.pem ubuntu@YOUR_EC2_PUBLIC_IP

# Sistem güncellemesi
sudo apt update && sudo apt upgrade -y

# Python 3.10+ kurulumu
sudo apt install -y python3.10 python3.10-venv python3-pip

# Gerekli sistem paketleri
sudo apt install -y git curl wget postgresql-client
```

#### 2.2 Backend Kodunu EC2'ye Yükle
```bash
# Option A: Git üzerinden (eğer repo varsa)
cd ~
git clone https://github.com/your-username/trade-bot.git
cd trade-bot

# Option B: Manual yükleme (SCP ile)
# Local'den: scp -i trade-bot-key.pem -r /path/to/TRADE\ BOT ubuntu@YOUR_EC2_PUBLIC_IP:~/trade-bot
```

#### 2.3 Python Virtual Environment ve Dependencies
```bash
cd ~/trade-bot
python3.10 -m venv venv
source venv/bin/activate

# requirements.txt oluştur
pip install fastapi uvicorn aiohttp numpy pandas pandas-ta websockets psycopg2 boto3 python-telegram-bot

# Veya mevcut requirements.txt varsa
pip install -r requirements.txt
```

#### 2.4 Environment Variables Ayarla
```bash
# .env dosyası oluştur
nano .env

# İçerik (aşağıya kopyala):
```
```env
# EXCHANGE KEYS
BINANCE_API_KEY=your_binance_key
BINANCE_SECRET_KEY=your_binance_secret
BYBIT_API_KEY=your_bybit_key
BYBIT_SECRET_KEY=your_bybit_secret

# TELEGRAM
TELEGRAM_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# DATABASE
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=5432
DB_NAME=trade_bot_db
DB_USER=admin
DB_PASSWORD=your_strong_password

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=trade-bot-logs-xyz

# BOT SETTINGS
MODE=LIVE  # veya SIMULATED
DEBUG=False
```

#### 2.5 FastAPI Sunucusunu Test Et
```bash
cd ~/trade-bot
source venv/bin/activate

# Test çalıştırması (ön planda)
python backend.py

# Veya uvicorn ile
uvicorn backend:app --host 0.0.0.0 --port 8000 --reload
```

#### 2.6 Systemd Service Oluştur (Otomatik Başlama için)
```bash
sudo nano /etc/systemd/system/trade-bot.service

# Aşağıdaki içeriği yapıştır:
```

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
StandardOutput=append:/home/ubuntu/trade-bot/logs/bot.log
StandardError=append:/home/ubuntu/trade-bot/logs/bot.error.log

[Install]
WantedBy=multi-user.target
```

```bash
# Service'i aktifleştir
sudo systemctl daemon-reload
sudo systemctl enable trade-bot
sudo systemctl start trade-bot

# Durumunu kontrol et
sudo systemctl status trade-bot

# Log görüntüle
sudo journalctl -u trade-bot -f
```

---

### **AŞAMA 3: BACKGROUND TASKS SETUP (30 dakika)**

#### 3.1 AWS CloudWatch Events (Scheduler)
Radar loop'u her dakika çalıştırmak için:

**AWS Console > CloudWatch > Events > Create Rule**

```
Name: trade-bot-radar-trigger
Schedule: rate(1 minute)

Target:
- Service: Lambda veya SQS
- Function: invoke-radar-loop
- Input: {"action": "run_radar"}
```

#### 3.2 Alternative: EC2'de Cron Job
```bash
# EC2'ye SSH ile bağlan
ssh -i trade-bot-key.pem ubuntu@YOUR_EC2_PUBLIC_IP

# Crontab'ı aç
crontab -e

# Aşağıdaki satırları ekle:
```

```cron
# Radar her dakika
* * * * * cd /home/ubuntu/trade-bot && source venv/bin/activate && python -c "from radar_loop import run_market_radar; import asyncio; asyncio.run(run_market_radar())" >> /home/ubuntu/trade-bot/logs/cron.log 2>&1

# Daily report 8 AM UTC'de
0 8 * * * cd /home/ubuntu/trade-bot && source venv/bin/activate && python -c "from radar_loop import daily_report_task; import asyncio; asyncio.run(daily_report_task())" >> /home/ubuntu/trade-bot/logs/cron.log 2>&1
```

---

### **AŞAMA 4: FRONTEND DEPLOYMENT (30 dakika)**

#### 4.1 S3 + CloudFront Setup
```bash
# Build the frontend
cd frontend
npm run build

# S3'e yükle
aws s3 sync dist/ s3://trade-bot-logs-xyz/frontend/ --delete

# CloudFront distribution oluştur (AWS Console'dan)
# Origin: S3 bucket
# Distribution domain: xyz.cloudfront.net
```

#### 4.2 API Gateway (Optional - Lambda Proxy için)
```bash
# AWS Console > API Gateway > Create REST API

# Resources:
GET /status -> backend-lambda
POST /execute-trade -> backend-lambda
GET /wallet -> backend-lambda

# Deploy: Stage: prod
```

---

### **AŞAMA 5: MONITORING & LOGGING (20 dakika)**

#### 5.1 CloudWatch Logs
```bash
# Log Group oluştur
aws logs create-log-group --log-group-name /trade-bot/backend

# Metric alarms
aws cloudwatch put-metric-alarm \
  --alarm-name trade-bot-cpu-high \
  --alarm-description "Alert when CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

#### 5.2 Application Insights
```python
# backend.py'ye ekle
import logging
import watchtower

# CloudWatch handler
cloudwatch_handler = watchtower.CloudWatchLogHandler()
logging.getLogger().addHandler(cloudwatch_handler)
```

---

## 📊 DEPLOYMENT CHECKLIST

### Pre-Deployment:
- [ ] AWS Account setup tamamlandı
- [ ] IAM roles oluşturuldu
- [ ] All API keys (Binance, Bybit, Telegram) hazırlandı
- [ ] Security groups konfigüre edildi
- [ ] Backups stratejisi belirlenmiş
- [ ] Monitoring rules tanımlandı

### Deployment:
- [ ] EC2 instance çalışıyor
- [ ] RDS database bağlı
- [ ] S3 buckets oluşturulmuş
- [ ] Backend servisi running
- [ ] CloudWatch logs akış yapıyor
- [ ] Telegram bildirim çalışıyor
- [ ] Frontend accessible

### Post-Deployment:
- [ ] Load testing yapıldı
- [ ] Security audit tamamlandı
- [ ] Disaster recovery tested
- [ ] Team training completed
- [ ] Documentation updated

---

## 🎯 DEPLOYMENT SONRASI ADIMLAR

### 1. Health Check
```bash
# Backend status
curl http://YOUR_EC2_IP:8000/get-status

# Telegram test
curl -X POST http://YOUR_EC2_IP:8000/telegram-test

# Wallet check
curl http://YOUR_EC2_IP:8000/get-wallet
```

### 2. Simulated Mode'da Test
```python
# state_manager.py'da
MODE = "SIMULATED"  # Gerçek işlem yapmaz

# Backtest ile validasyon
python backtest_runner.py --symbol BTC/USDT --days 30
```

### 3. Gradual Rollout
```
Gün 1-3: Nano pozisyonlar (0.1-1 USDT)
Gün 4-7: Küçük pozisyonlar (1-10 USDT)
Gün 8-14: Normal pozisyonlar (10-100 USDT)
Gün 15+: Full scale
```

---

## 💰 ESTIMATED AWS COSTS (Monthly)

| Service | Free Tier | Cost |
|---------|-----------|------|
| EC2 (t2.micro) | 750h/mo | $0-20 |
| RDS (db.t2.micro) | 750h/mo | $0-25 |
| S3 Storage | 5GB | $0-2 |
| Data Transfer | - | $5-15 |
| CloudWatch | 10GB logs | $0-5 |
| **TOPLAM** | | **$0-67/ay** |

**Note:** Production için t3.small/m5.large kullanırsa 100-300$/ay

---

## 🔐 SECURITY BEST PRACTICES

1. **API Keys**
   ```bash
   # Secrets Manager kullan
   aws secretsmanager create-secret --name trade-bot/binance-key
   ```

2. **Database**
   - Encryption at rest enable
   - Multi-AZ deployment
   - Automated backups

3. **Network**
   - VPC isolation
   - Security groups kuralları
   - HTTPS/SSL enabled

4. **Monitoring**
   - CloudTrail logging
   - VPC Flow Logs
   - GuardDuty enabled

---

## 📞 SUPPORT & TROUBLESHOOTING

### Common Issues:

1. **"Connection refused"**
   - EC2 security group'ta 8000 port açık mı?
   - `sudo systemctl status trade-bot` kontrol et

2. **"Database connection failed"**
   - RDS endpoint doğru mu?
   - Security group inbound kuralında EC2 IP var mı?

3. **"Out of memory"**
   - EC2 instance type büyült
   - Swap memory ekle

4. **"Telegram mesaj gelmiyor"**
   - Bot token doğru mu?
   - Chat ID doğru mu?
   - Telegram API erişim açık mı?

---

**Hazırlanma Zamanı:** ~3-4 saat
**Bilgi Seviyesi:** Intermediate
**Risk:** Düşük (Simulated mode'ta test et öncesinde)

**GİDİŞAT!** 🚀
