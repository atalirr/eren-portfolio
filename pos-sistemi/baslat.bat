@echo off
title ATLI MEDIKAL - POS 6
echo ========================================================
echo        ATLI MEDIKAL - POS 6 SISTEMI BASLATILIYOR
echo ========================================================
echo.
cd /d "%~dp0"

if not exist "launcher.py" (
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

if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
    )
)

echo [1/3] Backend gereksinimleri kontrol ediliyor...
call pip install -r backend\requirements.txt --quiet

echo [2/3] Frontend gereksinimleri kontrol ediliyor...
if not exist "frontend\node_modules\" (
    echo [BILGI] Frontend kutuphaneleri kuruluyor, lutfen bekleyin...
    cd frontend
    call npm install --quiet
    cd ..
)

echo [3/3] POS 6 Sistemi Baslatiliyor...
echo.
python launcher.py
pause