@echo off
title HabitPulse - Aliskanlik Takip
echo ========================================================
echo        HabitPulse (Aliskanlik Takip) Baslatiliyor...
echo ========================================================
echo.
cd /d "%~dp0"

if not exist "package.json" (
    echo [HATA] ZIP DOSYASI HENUZ AYIKLANMAMIS!
    echo Lutfen ZIP dosyasini Tumunu Ayikla ile bir klasore cikartin.
    pause
    exit /b
)

if not exist "node_modules\" (
    echo [BILGI] Ilk calistirma algilandi. Kutuphaneler kuruluyor...
    call npm install --legacy-peer-deps
    echo [BILGI] Kurulum tamamlandi.
)

echo Tarayici aciliyor: http://localhost:5173
start http://localhost:5173

echo Gelistirme sunucusu baslatiliyor...
call npm run dev
pause