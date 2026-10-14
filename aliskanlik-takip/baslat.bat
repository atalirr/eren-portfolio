@echo off
chcp 65001 >nul
title HabitPulse - Aliskanlik Takip Uygulamasi
echo ========================================================
echo        HabitPulse (Aliskanlik Takip) Baslatiliyor...
echo ========================================================
echo.
cd /d "%~dp0"

if not exist "node_modules\" (
    echo [BILGI] Ilk calistirma algilandi. Gerekli kutuphaneler kuruluyor...
    echo Bu islem 1-2 dakika surebilir, lutfen bekleyin...
    call npm install --legacy-peer-deps
    echo [BILGI] Kurulum tamamlandi.
    echo.
)

echo Tarayici aciliyor: http://localhost:5173
start http://localhost:5173

echo Gelistirme sunucusu baslatiliyor...
call npm run dev
pause
