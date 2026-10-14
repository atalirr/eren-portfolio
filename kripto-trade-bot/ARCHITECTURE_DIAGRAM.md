# 🏗️ TRADE BOT - Mimarisi Görsel Rehberi

## 1. KATMANLI MİMARİ (Detaylı)

```
═══════════════════════════════════════════════════════════════════════════════════

📱 SUNUM KATMANI (Presentation / UI)
─────────────────────────────────────────────────────────────────────────────────

    ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Web Dashboard  │  │  Mobile App  │  │ Telegram Bot │
    │   (React/Vue)   │  │   (React)    │  │  Interface   │
    └────────┬────────┘  └──────┬───────┘  └──────┬───────┘
             │                  │                 │
             └──────────────────┼─────────────────┘
                                │
                    WebSocket & REST API
                                │
═══════════════════════════════════════════════════════════════════════════════════

🌐 API KATMANI (API Gateway / Backend Server)
─────────────────────────────────────────────────────────────────────────────────

              ┌─────────────────────────────────────────┐
              │        FastAPI Application              │
              │  (backend.py)                           │
              │                                         │
              │  GET  /get-status                       │
              │  GET  /get-wallet                       │
              │  POST /execute-trade                    │
              │  POST /close-position                   │
              │  GET  /get-signals                      │
              │  POST /update-settings                  │
              │  WS   /stream (WebSocket)               │
              │                                         │
              └────────┬────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
═══════════════════════════════════════════════════════════════════════════════════

⚙️  BİZNES LOJİĞİ KATMANI (Trading Engine)
─────────────────────────────────────────────────────────────────────────────────

┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  RADAR LOOP          │  │ SCORING ENGINE   │  │ TRADE EXECUTOR       │
│ (radar_loop.py)      │  │(scoring_engine.py│  │(trade_executor.py)   │
│                      │  │                  │  │                      │
│ • Market Scan        │  │ • Technical      │  │ • Execute Buy/Sell   │
│ • Signal Generation  │  │ • ML Scoring     │  │ • Risk Management    │
│ • Correlation Check  │  │ • RSI, MACD, BB  │  │ • Circuit Breaker    │
│ • Momentum Filter    │  │ • Pattern Match  │  │ • Position Sizing    │
│                      │  │                  │  │ • Stop Loss/TP       │
└─────────┬────────────┘  └────────┬─────────┘  └──────────┬───────────┘
          │                        │                       │
          │         SIGNAL         │                       │
          └────────────┬───────────┘                       │
                       │                                   │
                       │          EXECUTION                │
                       └───────────────────────────────────┤
                                                           │
          ┌─────────────────────┐         ┌───────────────▼─────┐
          │  SIGNAL ENGINE      │         │  RISK ENGINE        │
          │(signal_engine.py)   │         │(risk_engine.py)     │
          │                     │         │                     │
          │ • Filter Signals    │         │ • Drawdown Check    │
          │ • Validate Picks    │         │ • Max Positions     │
          │ • Entry Points      │         │ • Correlation Risk  │
          │ • Exit Rules        │         │ • Leverage Control  │
          └──────────┬──────────┘         └─────────────────────┘
                     │
          ┌──────────▼────────────┐
          │  COPY TRADER          │
          │(copy_trader.py)       │
          │                       │
          │ • Follow Top Traders  │
          │ • Mirror Positions    │
          │ • Adjust Sizing       │
          └───────────────────────┘

═══════════════════════════════════════════════════════════════════════════════════

💾 VERI KATMANI (State Management & Storage)
─────────────────────────────────────────────────────────────────────────────────

┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  STATE MANAGER       │  │  IN-MEMORY DATA  │  │ PERSISTENT STORAGE   │
│ (state_manager.py)   │  │                  │  │                      │
│                      │  │ • bot_settings   │  │ • bot_state.json     │
│ • Central Hub        │  │ • fleet_state    │  │ • fleet_state.json   │
│ • JSON DB            │  │ • radar_data     │  │ • trade_log.json     │
│ • Cache Layer        │  │ • backtest_cache │  │ • bot_ledger.json    │
│                      │  │                  │  │ • Signal Log         │
└──────────┬───────────┘  └──────────────────┘  └──────────────────────┘
           │
           │   (Sync)
           │
    ┌──────▼──────────────┐
    │   BACKUP ENGINE     │
    │                     │
    │ • Auto Backups      │
    │ • S3 Archive        │
    │ • Version Control   │
    └─────────────────────┘

═══════════════════════════════════════════════════════════════════════════════════

🔗 DIŞ SERVİSLER (External APIs)
─────────────────────────────────────────────────────────────────────────────────

┌────────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│  BINANCE SPOT      │  │  BYBIT FUTURES  │  │ TELEGRAM BOT        │
│                    │  │                 │  │                     │
│ • Market Data      │  │ • Futures Data  │  │ • Send Alerts       │
│ • Spot Trading     │  │ • Leverage      │  │ • Receive Commands  │
│ • Historical Candles│ │ • Short Selling │  │ • Performance Stats │
│                    │  │                 │  │                     │
└────────────────────┘  └─────────────────┘  └─────────────────────┘

╔═══════════════════════════════════════════════════════════════════════════════════╗
```

---

## 2. AWS DEPLOYMENT MİMARİSİ

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                              AWS BULUT ORTAMI                                      ║
╠═══════════════════════════════════════════════════════════════════════════════════╣

                              🌐 INTERNET / WEB

    ┌────────────────┐        ┌──────────────────┐        ┌─────────────┐
    │  User Browser  │◄─────► │  CloudFront CDN  │◄─────► │ S3 Bucket   │
    │                │        │  (Cached)        │        │ (Frontend)  │
    └────────────────┘        └────────┬─────────┘        └─────────────┘
                                       │
                                       │ HTTP/S
                                       │
                        ┌──────────────▼──────────────┐
                        │   AWS API GATEWAY           │
                        │  (REST API Routes)          │
                        │  - Rate Limiting            │
                        │  - Auth Layer               │
                        │  - Request Validation       │
                        └──────────────┬──────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        
    ┌───▼──────────────────────┐  ┌───▼──────────────────┐   ┌─────▼────────────┐
    │   EC2 Instance           │  │  Lambda Functions    │   │  ECS Fargate      │
    │  (Primary Backend)       │  │  (Serverless API)    │   │ (Background Tasks)│
    │                          │  │                      │   │                   │
    │ • backend.py             │  │ • /get-status        │   │ • radar_loop      │
    │ • FastAPI Server         │  │ • /execute-trade     │   │ • scoring_engine  │
    │ • Real-time Processing   │  │ • /get-wallet        │   │ • trade_executor  │
    │ • Telegram Bot Handler   │  │ • /update-settings   │   │ • telegram_module │
    │                          │  │                      │   │                   │
    │ CPU: 2 vCPU              │  │ Memory: 256-512MB    │   │ Memory: 512MB-1GB │
    │ Memory: 2-4 GB           │  │ Timeout: 30s         │   │ Timeout: 15 min   │
    │ Storage: 20-50 GB        │  │ Duration: 60s        │   │ Duration: Long    │
    └────────────┬─────────────┘  └────────────────────┘   └────────────────────┘
                 │
     ┌───────────┼───────────┬──────────────────┐
     │           │           │                  │
     
 ┌───▼────┐ ┌──▼────┐ ┌───▼──────┐  ┌──────▼────┐
 │ RDS    │ │ S3    │ │ DynamoDB │  │ Secrets   │
 │(State) │ │(Logs) │ │ (Cache)  │  │Manager    │
 │        │ │       │ │          │  │(API Keys) │
 │PostgreSQL│ │Backup│ │Session   │  │           │
 │ 20 GB  │ │Store  │ │Cache     │  │Encrypted  │
 └────────┘ └───────┘ └──────────┘  └───────────┘
 
                     │
                     │ (VPC Networks)
                     │
 ┌──────────────────▼────────────────────────────┐
 │          MONITORING & LOGGING                  │
 │                                                │
 │ • CloudWatch Logs (Centralized Logging)       │
 │ • CloudWatch Metrics (Performance)             │
 │ • CloudWatch Alarms (Alerts & Notifications) │
 │ • X-Ray (Distributed Tracing)                │
 │ • SNS (Alert Distribution)                    │
 │                                                │
 └────────────────────────────────────────────────┘
 
                     │
                     │ (Notifications)
                     │
     ┌───────────────┼────────────────┐
     │               │                │
  ┌──▼──┐      ┌────▼──┐      ┌────▼──┐
  │Email│      │ SMS   │      │Telegram│
  └─────┘      └───────┘      └────────┘

╠═══════════════════════════════════════════════════════════════════════════════════╣
║                   EXTERNAL TRADING PLATFORMS (WAN)                                ║
╠═══════════════════════════════════════════════════════════════════════════════════╣

  ┌────────────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────┐
  │ Binance API    │   │ Bybit API    │   │Telegram API  │   │ TradingView│
  │                │   │              │   │              │   │            │
  │ Market Data    │   │Futures Trade │   │Bot Commands  │   │Indicators  │
  │ Spot Trading   │   │Leverage Trade│   │Notifications │   │            │
  │ WebSocket      │   │WebSocket     │   │              │   │            │
  │ Streams        │   │              │   │              │   │            │
  └────────────────┘   └──────────────┘   └──────────────┘   └────────────┘

╚═══════════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. DATA FLOW (İşlem Akışı)

```
EXAMPLE: BTC/USDT İçin İşlem Yürütme

┌─────────────────────────────────────────────────────────────────────┐
│ 1️⃣  MARKET SCAN (Her 1 Dakika)                                      │
├─────────────────────────────────────────────────────────────────────┤
│ • Binance'den 200 coin'in 24h data'sı çek                           │
│ • Volume, Price, RSI, MACD hesapla                                  │
│ • Trend strength ve momentum analiz et                              │
│                                                                      │
│ INPUT:  Binance API (Market Data)                                   │
│ OUTPUT: coins_data = {...}                                          │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│ 2️⃣  SCORING (Teknik Puanlama)                                        │
├─────────────────────────────────────────────────────────────────────┤
│ • Her coin için Technical Score hesapla (0-100)                     │
│ • ML Model ile tahmin güvenliği kontrolü                            │
│ • Volatility risk adjust                                            │
│ • Correlation check (aynı grupta çok fazla coin X)                  │
│                                                                      │
│ INPUT:  coins_data + scoring_engine.py                              │
│ OUTPUT: top_picks = [{"symbol": "BTC/USDT", "score": 78, ...}]     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│ 3️⃣  SIGNAL FILTERING (Sinyal Doğrulama)                              │
├─────────────────────────────────────────────────────────────────────┤
│ • Min score threshold: >= 60                                        │
│ • Volume minimum: >= 500K USDT/24h                                  │
│ • Volatility range: 1-15%                                           │
│ • Cooldown check: son işlemden 30+ min geçtimi?                     │
│ • Existing positions: Zaten bu coin'de pozisyon var mı?             │
│                                                                      │
│ INPUT:  top_picks + signal_engine.py + state_manager.py             │
│ OUTPUT: signals = [{"symbol": "BTC/USDT", "action": "BUY"}]         │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│ 4️⃣  RISK ASSESSMENT (Risk Yönetimi)                                  │
├─────────────────────────────────────────────────────────────────────┤
│ • Max position check: 8 açık pozisyon limit                         │
│ • Portfolio correlation: Risk açısından çeşitli mi?                 │
│ • Drawdown check: Bugün zaten -2% kaybettik mi?                     │
│ • Available balance: Yeterli margin var mı?                         │
│ • Circuit breaker: 3 ard arda loss sonrası stop                     │
│                                                                      │
│ INPUT:  signals + risk_engine.py + fleet_state                      │
│ OUTPUT: approved_signals = [{"symbol": "BTC/USDT", "qty": 1.5}]     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│ 5️⃣  TRADE EXECUTION (İşlem Yürütme)                                  │
├─────────────────────────────────────────────────────────────────────┤
│ • Current price: Binance'den live price al                          │
│ • Order size: Position sizing algorithm (Kelly Criterion)           │
│ • Order type: Limit order (price control) veya Market              │
│ • Slippage tolerance: Max 0.5%                                      │
│                                                                      │
│ INPUT:  approved_signals + current_prices                           │
│ OUTPUT: order_id = "12345"                                          │
│        trade = {                                                     │
│          "symbol": "BTC/USDT",                                       │
│          "side": "BUY",                                              │
│          "qty": 1.5,                                                │
│          "entry": 42567.89,                                         │
│          "timestamp": "2026-05-21 12:30:45"                         │
│        }                                                             │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│ 6️⃣  POSITION MANAGEMENT (Pozisyon Yönetimi)                          │
├─────────────────────────────────────────────────────────────────────┤
│ • Stop Loss: Entry'den -4% aşağıda                                  │
│ • Take Profit: Entry'den +6% yukarıda                               │
│ • Trailing Stop: Fiyat artarsa stop otomatik yükselt               │
│ • Partial TP: Kar alışta 30% satış @ +3%, kalan @ +6%             │
│ • Max Hold Time: 6 saat tutma limiti                                │
│                                                                      │
│ INPUT:  active_trades + live_prices                                 │
│ OUTPUT: Trade açık kalır, monitör edilir                            │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│ 7️⃣  EXIT (Çıkış)                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Trigger Scenarios:                                                  │
│ • Stop Loss hit → Otomatik satış (loss kontrolü)                    │
│ • Take Profit hit → Otomatik satış (kar alma)                      │
│ • Score < 40 (Exit Threshold) → Signal satış (trend yok)           │
│ • Max hold time exceeded → Force satış                              │
│                                                                      │
│ INPUT:  trade_prices + exit_rules                                   │
│ OUTPUT: sell_order = {                                              │
│          "symbol": "BTC/USDT",                                       │
│          "side": "SELL",                                             │
│          "qty": 1.5,                                                │
│          "exit": 42889.34,                                          │
│          "pnl": 481.35 (profit),                                    │
│          "pnl_pct": 1.13%                                           │
│        }                                                             │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│ 8️⃣  LOGGING & NOTIFICATION (Kayıt & Bildirim)                        │
├─────────────────────────────────────────────────────────────────────┤
│ • Trade geçmişini JSON'a kaydet                                     │
│ • PnL hesap et ve toplam güncelle                                   │
│ • Telegram'a bildirim gönder:                                       │
│   "📈 BTC/USDT SATIN: 42567.89 | 1.5 qty | +1.13%"                │
│ • CloudWatch metrics güncelle                                       │
│ • Dashboard'u refresh et (WebSocket)                                │
│                                                                      │
│ INPUT:  trade_result + trade_log                                    │
│ OUTPUT: • bot_state.json updated                                    │
│         • Telegram alert sent                                       │
│         • Frontend updated                                          │
└─────────────────────────────────────────────────────────────────────┘

📊 TIMING:
  Dakika:  0 sec   10 sec   20 sec   30 sec   40 sec   50 sec   60 sec
  Adım:    [1]     [2]      [3]      [4]      [5]      [6,7,8]  [1]
  
  Total cycle: ~60 saniye (1 dakika tekrar)
```

---

## 4. KATMAN BAĞLANTILARI (Dependency Graph)

```
┌───────────────────────────────────────────────────────────────────┐
│                         DEPENDENCY TREE                           │
├───────────────────────────────────────────────────────────────────┤

                         backend.py (Entry)
                              │
                              ├─► FastAPI Server
                              ├─► CORS Middleware
                              ├─► Lifespan Context
                              │
                              └─► Spawns Tasks
                                  ├─► radar_loop
                                  ├─► trade_executor
                                  ├─► telegram_handler
                                  └─► monitoring_tasks


         radar_loop.py (Market Intelligence)
              │
              ├─► scoring_engine.py (Technical Scoring)
              │   ├─► indicators.py (RSI, MACD, BB, etc)
              │   └─► ML models (predictions)
              │
              ├─► signal_engine.py (Signal Filtering)
              │   ├─► state_manager.py (Get fleet state)
              │   └─► risk_engine.py (Position checks)
              │
              ├─► trade_executor.py (Execute)
              │   ├─► Binance/Bybit API calls
              │   ├─► state_manager.py (Update state)
              │   └─► telegram_module.py (Send alerts)
              │
              ├─► copy_trader.py (Copy top traders)
              │   └─► trade_executor.py
              │
              ├─► macro_filter.py (Economic data)
              │   └─► TradingView API
              │
              ├─► coin_scanner.py (New listings)
              │   └─► Binance API
              │
              └─► report_engine.py (Generate reports)
                  └─► telegram_module.py

         state_manager.py (Central State Hub)
              │
              ├─► Load: bot_state.json
              ├─► Load: fleet_state.json
              ├─► Load: bot_ledger.json
              ├─► Load: trade_log.json
              │
              └─► Methods:
                  ├─► get/set operations
                  ├─► Atomic updates
                  ├─► Backup to S3
                  └─► Cache sync

         telegram_module.py (Notification & Commands)
              │
              ├─► notifier.send_message()
              ├─► handle_commands() (Listen)
              │   ├─► /status
              │   ├─► /balance
              │   ├─► /trades
              │   ├─► /stop
              │   └─► /start
              │
              └─► Telegram Bot API

         trade_executor.py (Exchange Interface)
              │
              ├─► init_exchanges()
              │   ├─► Binance Client
              │   └─► Bybit Client
              │
              ├─► Execute Orders
              │   ├─► create_order()
              │   ├─► cancel_order()
              │   └─► update_position()
              │
              ├─► Risk Controls
              │   ├─► circuit_breaker_monitor()
              │   ├─► stop_loss_check()
              │   └─► take_profit_check()
              │
              └─► Wallet Management
                  ├─► get_balance()
                  ├─► get_positions()
                  └─► calculate_equity()

         backtest_runner.py (Backtesting)
              │
              ├─► Load historical data
              ├─► Simulate trades
              │   ├─► scoring_engine.py
              │   ├─► signal_engine.py
              │   └─► risk_engine.py
              │
              └─► Generate reports
                  ├─► analysis.py
                  └─► metrics (Win%, ROI, DD, etc)

└───────────────────────────────────────────────────────────────────┘
```

---

## 5. FILE STRUCTURE (Dosya Yapısı)

```
trade-bot/
│
├── 📄 backend.py ...................... API Server (FastAPI)
├── 📄 radar_loop.py ................... Main Bot Loop
├── 📄 scoring_engine.py ............... Technical Scoring
├── 📄 indicators.py ................... Technical Indicators
├── 📄 signal_engine.py ................ Signal Validation
├── 📄 risk_engine.py .................. Risk Management
├── 📄 trade_executor.py ............... Order Execution
├── 📄 state_manager.py ................ Central State Hub
├── 📄 telegram_module.py .............. Bot & Notifications
├── 📄 copy_trader.py .................. Copy Trader Logic
├── 📄 coin_scanner.py ................. New Coin Detector
├── 📄 macro_filter.py ................. Macro Analysis
├── 📄 report_engine.py ................ Report Generator
├── 📄 signal_tracker.py ............... Track Signals
├── 📄 backtest_runner.py .............. Backtesting Engine
├── 📄 analyze_backtest.py ............. Backtest Analysis
├── 📄 optimize_params.py .............. Parameter Optimizer
│
├── 📁 frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.vue
│   ├── package.json
│   └── dist/ (Built files)
│
├── 📁 data/
│   ├── bot_state.json ................. Live State
│   ├── fleet_state.json ............... Positions
│   ├── trade_log.json ................. Trade History
│   ├── bot_ledger.json ................ Accounting
│   └── signal_log.json ................ Signals History
│
├── 📁 logs/
│   ├── bot.log
│   ├── bot.error.log
│   └── trades.log
│
├── 📁 backups/
│   └── state_backups/ (Daily backups)
│
├── 📄 requirements.txt
├── 📄 .env (Environment variables)
├── 📄 .gitignore
├── 📄 README.md
├── 📄 AWS_DEPLOYMENT_STRATEGY.md (👈 YOU ARE HERE)
└── 📄 docker-compose.yml (Optional)
```

---

## ÖZET: NE YAPMALI?

### 🎯 DEPLOYMENT STRATEJİNİZ:

```
HÜN 1: AWS KURULUM
├─ AWS Account oluştur
├─ EC2 instance launch et (t2.micro)
├─ RDS database oluştur (PostgreSQL)
└─ S3 bucket ve IAM roles ayarla

GÜN 2-3: BACKEND DEPLOY
├─ EC2'ye SSH bağlantı
├─ Python environment setup
├─ Code'u yükle
├─ Dependencies install
├─ .env file configure
├─ Systemd service oluştur
└─ Backend test et

GÜN 4-5: TASK SCHEDULING
├─ CloudWatch Events setup
├─ Cron jobs configure
└─ Monitoring alerts

GÜN 6: TESTING
├─ Simulated mode testler
├─ API endpoint testleri
├─ Backtest validation
└─ Telegram alerts test

GÜN 7+: GRADUAL ROLLOUT
├─ Nano pozisyonlarla başla (0.1 USDT)
├─ Küçük pozisyonlara yükselt
└─ Normal scale'e ulaş
```

### ✅ IMMEDIATE ACTIONS:

1. **AWS CLI kurulumu** (eğer yapmadıysan)
   ```bash
   aws configure
   ```

2. **EC2 Instance oluştur**
   - Type: Ubuntu 22.04 LTS
   - Size: t2.micro (başlangıç)
   - Security: SSH, HTTP, Custom port 8000

3. **Dosyaları hazırla**
   - `.env` file oluştur (tüm API keys)
   - `requirements.txt` güncelle
   - `README.md` yaz

4. **Backtest çalıştır** (ÖNCE!)
   ```bash
   python backtest_runner.py --symbol BTC/USDT --days 30
   ```

5. **Simulated mode'da test et** (GEREKLİ!)
   ```bash
   MODE=SIMULATED python backend.py
   ```

6. **SONRA AWS'ye deploy et**

---

**Bu mimariniz profesyonel seviye. AWS deployment 100% yapılabilir!** 🚀
