@echo off
chcp 65001 >nul
title ATLI Medikal POS Sistemi
echo ========================================================
echo        ATLI Medikal POS Sistemi Baslatiliyor...
echo ========================================================
echo.
cd /d "%~dp0"

if not exist "node_modules\" (
    echo [BILGI] Ilk calistirma algilandi. Gerekli kutuphaneler kuruluyor...
    echo Bu islem birkac dakika surebilir, lutfen bekleyin...
    call npm install
    echo [BILGI] Kurulum tamamlandi.
    echo.
)

echo POS Uygulamasi aciliyor...
call npm start
pause
