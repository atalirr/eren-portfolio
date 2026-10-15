@echo off
chcp 65001 >nul
title ATLI Medikal POS Sistemi
echo ========================================================
echo        ATLI Medikal POS Sistemi Baslatiliyor...
echo ========================================================
echo.
cd /d "%~dp0"

REM 1. ZIP dosyasından ayıklanmadan çalıştırılma kontrolü
if not exist "package.json" (
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

REM 2. Bağımlılık kontrolü
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
