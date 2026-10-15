@echo off
chcp 65001 >nul
title VocabFlow - AI Ingilizce Kelime ve Okuma
echo ========================================================
echo        VocabFlow Sunucusu Baslatiliyor...
echo ========================================================
echo.
cd /d "%~dp0"

REM 1. ZIP dosyasından ayıklanmadan çalıştırılma kontrolü
if not exist "server.cjs" (
    echo ========================================================
    echo   [HATA] ZIP DOSYASI HENUZ AYIKLANMAMIS!
    echo ========================================================
    echo.
    echo Bu dosyayi ZIP arsivinin icinden dogrudan calistirdiniz.
    echo Windows, ZIP icindeki diger kodlari gorememektedir.
    echo.
    echo LUTFEN SU ADIMLARI IZLEYIN:
    echo 1. Indirdiginiz ZIP dosyasina sag tiklayin.
    echo 2. "Tumunu Ayikla..." (Extract All) secenegine tiklayin.
    echo 3. Olusan yeni klasorun icine girip 'baslat.bat' dosyasina tiklayin.
    echo ========================================================
    echo.
    pause
    exit /b
)

if not exist ".env" (
    echo [BILGI] .env dosyasi bulunamadi, .env.example sablonu kopyalaniyor...
    copy .env.example .env >nul
    echo [NOT] Gemini yapay zeka ozellikleri icin .env dosyasina API key ekleyebilirsiniz.
    echo.
)

echo Tarayici aciliyor: http://localhost:3000
start http://localhost:3000

echo Node.js sunucusu calistiriliyor...
node server.cjs
pause
