@echo off
chcp 65001 >nul
title ANTIGRAVITY AI - Trade Bot Baslatici
echo ========================================================
echo        ANTIGRAVITY AI - Kripto Trade Bot
echo ========================================================
echo.
cd /d "%~dp0"

REM 1. .env kontrolü
if not exist ".env" (
    echo [BILGI] .env dosyasi olusturuluyor (.env.example kopyalandi)...
    copy .env.example .env >nul
    echo [NOT] Gercek bakiye/API islemleri icin .env icine anahtar ekleyebilirsiniz.
    echo.
)

REM 2. Python kontrolü
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Sistemde Python bulunamadi! Lutfen python.org adresinden Python kurun.
    pause
    exit /b
)

REM 3. Python kutuphaneleri kontrolu
echo [1/2] Python gereksinimleri kontrol ediliyor...
call pip install -r requirements.txt --quiet
echo  Python gereksinimleri hazir.

REM 4. Frontend kontrolu
if exist "frontend\" (
    echo [2/2] Frontend kontrol ediliyor...
    if not exist "frontend\node_modules\" (
        echo [BILGI] Frontend kutuphaneleri kuruluyor...
        cd frontend && call npm install --quiet && cd ..
    )
    echo Frontend baslatiliyor...
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
