@echo off
chcp 65001 >nul
title ATLI MEDIKAL - POS 6 SISTEMI
echo ========================================================
echo        ATLI MEDIKAL - POS 6 SISTEMI BASLATILIYOR
echo ========================================================
echo.
cd /d "%~dp0"

REM 1. ZIP dosyasından ayıklanmadan çalıştırılma kontrolü
if not exist "launcher.py" (
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

REM 2. Python kontrolü
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Sistemde Python bulunamadi! Lutfen python.org adresinden Python kurun.
    pause
    exit /b
)

REM 3. Backend hazırlığı
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
    )
)

echo [1/3] Backend gereksinimleri kontrol ediliyor...
call pip install -r backend\requirements.txt --quiet

REM 4. Frontend hazırlığı
echo [2/3] Frontend gereksinimleri kontrol ediliyor...
if not exist "frontend\node_modules\" (
    echo [BILGI] Frontend kutuphaneleri kuruluyor... Bu islem ilk seferde 1-2 dakika surebilir...
    cd frontend && call npm install --quiet && cd ..
)

echo [3/3] POS 6 Sistemi Baslatiliyor...
echo.
python launcher.py
pause
