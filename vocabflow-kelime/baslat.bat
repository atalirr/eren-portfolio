@echo off
title VocabFlow - AI Ingilizce Kelime ve Okuma
echo ========================================================
echo        VocabFlow Sunucusu Baslatiliyor...
echo ========================================================
echo.
cd /d "%~dp0"

if not exist "server.cjs" (
    echo [HATA] ZIP DOSYASI HENUZ AYIKLANMAMIS!
    echo Lutfen ZIP dosyasini Tumunu Ayikla ile bir klasore cikartin.
    pause
    exit /b
)

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
    )
)

echo Tarayici aciliyor: http://localhost:3000
start http://localhost:3000

echo Node.js sunucusu calistiriliyor...
node server.cjs
pause