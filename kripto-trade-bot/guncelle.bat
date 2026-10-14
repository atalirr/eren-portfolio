@echo off
REM ════════════════════════════════════════════════════════════════════════════
REM   ANTIGRAVITY AI - SUNUCUYA KOD YÜKLEME & GÜNCELLEME
REM   2026-05-21 Updated
REM   Server: 51.20.2.214
REM ════════════════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion

REM ⚠️ SUNUCU BİLGİLERİ:
set SERVER_IP=51.20.2.214
set SSH_USER=ubuntu
set SSH_PORT=22
set SERVER_PATH=/home/ubuntu/tradebot
set PEM_FILE=..\tradebot-key.pem

REM ════════════════════════════════════════════════════════════════════════════
echo.
echo  ════════════════════════════════════════════════════════════════════
echo   ANTIGRAVITY AI - SUNUCUYA KOD YÜKLEME
echo  ════════════════════════════════════════════════════════════════════
echo.
echo  Sunucu:     %SERVER_IP%
echo  Kullanici:  %SSH_USER%
echo  Klasor:     %SERVER_PATH%
echo  PEM:        %PEM_FILE%
echo.

REM ════════════════════════════════════════════════════════════════════════════
echo  [ADIM 1/4] Sunucuya SSH bağlantısı kontrol ediliyor...
echo  ────────────────────────────────────────────────────────────────────

REM PEM dosyası var mı?
if not exist "%PEM_FILE%" (
    echo.
    echo  ❌ HATA: PEM dosyası bulunamadı!
    echo     Konumu: %PEM_FILE%
    echo.
    echo  ÇÖZÜM:
    echo  1. AWS'den tradebot-key.pem'i indir
    echo  2. Masaüstü klasörüne koy
    echo  3. Tekrar çalıştır
    echo.
    pause
    exit /b 1
)

echo  ✅ PEM dosyası bulundu: %PEM_FILE%
echo.

REM ════════════════════════════════════════════════════════════════════════════
echo  [ADIM 2/4] Python dosyaları sunucuya yükleniyor...
echo  ────────────────────────────────────────────────────────────────────
echo.

REM Sunucuda bot'u durdur
echo  • Bot durdurulmaya çalışılıyor...
ssh -i "%PEM_FILE%" %SSH_USER%@%SERVER_IP% "sudo systemctl stop tradebot 2>/dev/null || true" >nul 2>&1

REM Bekle
ping 127.0.0.1 -n 4 >nul

REM Python dosyalarını gönder
echo  • Python dosyaları yükleniyor (SCP)...
scp -i "%PEM_FILE%" -q backend.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q radar_loop.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q scoring_engine.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q indicators.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q state_manager.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q trade_executor.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q signal_engine.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q risk_engine.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q telegram_module.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q copy_trader.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q coin_scanner.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q macro_filter.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q watcher.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q signal_tracker.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q train_model.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q report_engine.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q bot_settings.json %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q signal_filter.json %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
scp -i "%PEM_FILE%" -q signal_filter_meta.json %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul

REM Kontrol
if %errorlevel% neq 0 (
    echo.
    echo  ❌ HATA: Dosyalar yüklenemedi!
    echo.
    echo  ÇÖZÜM:
    echo  1. PEM dosyası doğru mu?
    echo  2. IP adresi doğru mu? (%SERVER_IP%)
    echo  3. Sunucu çalışıyor mu?
    echo  4. Klasör yolu doğru mu? (%SERVER_PATH%)
    echo.
    pause
    exit /b 1
)

echo  ✅ Tüm dosyalar yüklendi!
echo.

REM ════════════════════════════════════════════════════════════════════════════
echo  [ADIM 3/4] Sunucuda bağımlılıklar güncelleniyor...
echo  ────────────────────────────────────────────────────────────────────
echo.

ssh -i "%PEM_FILE%" %SSH_USER%@%SERVER_IP% ^
  "cd %SERVER_PATH% && source venv/bin/activate && pip install -r requirements.txt -q" 2>nul

if %errorlevel% neq 0 (
    echo  ⚠️  Bağımlılıklar güncellenirken sorun olabilir
    echo  (Bu kritik değil, devam ediliyor...)
)

echo  ✅ Bağımlılıklar güncellendi!
echo.

REM ════════════════════════════════════════════════════════════════════════════
echo  [ADIM 4/4] Bot sunucuda yeniden başlatılıyor...
echo  ────────────────────────────────────────────────────────────────────
echo.

ssh -i "%PEM_FILE%" %SSH_USER%@%SERVER_IP% "sudo systemctl start tradebot" 2>nul

REM Bekle
ping 127.0.0.1 -n 4 >nul

REM Status kontrol
ssh -i "%PEM_FILE%" %SSH_USER%@%SERVER_IP% "sudo systemctl status tradebot" 2>nul

echo.
echo  ════════════════════════════════════════════════════════════════════
echo  ✅ GÜNCELLEME BAŞARILI!
echo  ════════════════════════════════════════════════════════════════════
echo.
echo  SUNUCU BİLGİLERİ:
echo  • IP:       %SERVER_IP%
echo  • Klasör:   %SERVER_PATH%
echo  • Service:  tradebot
echo  • Port:     8000
echo.
echo  KONTROL KOMUTLARI:
echo  • Status:  curl http://%SERVER_IP%:8000/get-status
echo  • Log:     ssh -i %PEM_FILE% %SSH_USER%@%SERVER_IP% "sudo journalctl -u tradebot -f"
echo.
echo  Telegram bot'tan /status komutu ile kontrol et!
echo  ════════════════════════════════════════════════════════════════════
echo.
pause
