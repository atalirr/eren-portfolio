@echo off
chcp 65001 >nul
title VocabFlow - AI Ingilizce Kelime ve Okuma
echo ========================================================
echo        VocabFlow Sunucusu Baslatiliyor...
echo ========================================================
echo.
cd /d "%~dp0"

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
