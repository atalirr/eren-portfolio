@echo off
REM ════════════════════════════════════════════════════════════════════════════
REM   ANTIGRAVITY AI - SUNUCUDAN VERİ İNDİRME
REM   2026-05-21 Updated
REM   Server: 51.20.2.214
REM ════════════════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion

REM ⚠️ SUNUCU BİLGİLERİ:
set SERVER_IP=51.20.2.214
set SSH_USER=ubuntu
set SERVER_PATH=/home/ubuntu/tradebot
set PEM_FILE=..\tradebot-key.pem

echo.
echo  ════════════════════════════════════════════════════════════════════
echo   ANTIGRAVITY AI - SUNUCUDAN VERİ İNDİRME
echo  ════════════════════════════════════════════════════════════════════
echo.
echo  Sunucu:     %SERVER_IP%
echo  Kaynak:     %SERVER_PATH%
echo  Hedef:      Geçerli klasör (%cd%)
echo.

REM ════════════════════════════════════════════════════════════════════════════
echo  [1/2] Sunucu bağlantısı kontrol ediliyor...
echo  ────────────────────────────────────────────────────────────────────

if not exist "%PEM_FILE%" (
    echo.
    echo  ❌ HATA: PEM dosyası bulunamadı!
    echo     Konumu: %PEM_FILE%
    echo.
    pause
    exit /b 1
)

echo  ✅ PEM dosyası bulundu
echo.

REM ════════════════════════════════════════════════════════════════════════════
echo  [2/2] Dosyalar indiriliyor...
echo  ────────────────────────────────────────────────────────────────────
echo.

REM Veri dosyalarını indir
echo  • bot_state.json indiriliyor...
scp -i "%PEM_FILE%" -q %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/bot_state.json . 2>nul

echo  • bot_settings.json indiriliyor...
scp -i "%PEM_FILE%" -q %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/bot_settings.json . 2>nul

echo  • bot_ledger.json indiriliyor...
scp -i "%PEM_FILE%" -q %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/bot_ledger.json . 2>nul

echo  • trade_history.jsonl indiriliyor...
scp -i "%PEM_FILE%" -q %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/trade_history.jsonl . 2>nul

echo  • fleet_state.json indiriliyor...
scp -i "%PEM_FILE%" -q %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/fleet_state.json . 2>nul

echo  • trade_log.json indiriliyor...
scp -i "%PEM_FILE%" -q %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/trade_log.json . 2>nul

echo  • signal_log.json indiriliyor...
scp -i "%PEM_FILE%" -q %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/signal_log.json . 2>nul

echo  • backtest_results.json indiriliyor...
scp -i "%PEM_FILE%" -q %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/backtest_results.json . 2>nul

if %errorlevel% neq 0 (
    echo.
    echo  ⚠️  Bazı dosyalar indirilememiş olabilir.
    echo  (Bu normal olabilir - mevcut olmayan dosyalar atlanır)
    echo.
)

echo.
echo  ════════════════════════════════════════════════════════════════════
echo  ✅ VERİ İNDİRME TAMAMLANDI
echo  ════════════════════════════════════════════════════════════════════
echo.
echo  İndirilen dosyalar:
echo  • bot_state.json       (Bot durum bilgisi)
echo  • bot_ledger.json      (İşlem defterleri)
echo  • fleet_state.json     (Pozisyon durumu)
echo  • trade_log.json       (İşlem geçmişi)
echo  • signal_log.json      (Sinyal geçmişi)
echo  • backtest_results.json (Backtest sonuçları)
echo.
echo  Konum: %cd%
echo  ════════════════════════════════════════════════════════════════════
echo.
pause
