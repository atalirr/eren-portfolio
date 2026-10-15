@echo off
title ANTIGRAVITY AI - Trade Bot
echo ========================================================
echo        ANTIGRAVITY AI - Kripto Trade Bot
echo ========================================================
echo.
cd /d "%~dp0"

if not exist "requirements.txt" (
    echo [HATA] ZIP DOSYASI HENUZ AYIKLANMAMIS!
    echo Lutfen ZIP dosyasini Tumunu Ayikla ile bir klasore cikartin.
    pause
    exit /b
)

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Sistemde Python bulunamadi!
    pause
    exit /b
)

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
    )
)

echo [1/2] Python gereksinimleri kontrol ediliyor...
call pip install -r requirements.txt --quiet

if exist "frontend\" (
    echo [2/2] Frontend kontrol ediliyor...
    if not exist "frontend\node_modules\" (
        echo [BILGI] Frontend kutuphaneleri kuruluyor...
        cd frontend
        call npm install --quiet
        cd ..
    )
    start "TradeBot Frontend" cmd /k "cd frontend && npm run dev"
    timeout /t 3 /nobreak >nul
    start http://localhost:5173
)

echo.
echo ========================================================
echo   Backend calistiriliyor... (Kapatmak icin Ctrl+C)
echo ========================================================
echo.
python backend.py
pause