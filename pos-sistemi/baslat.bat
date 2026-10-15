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
    echo [HATA] Sistemde Python bulunamadi! Lutfen python.org adresinden kurun.
    pause
    exit /b
)

if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
    )
)

echo [1/3] Backend paketleri kontrol ediliyor...
python -c "import fastapi, uvicorn, sqlalchemy, alembic, pydantic" >nul 2>nul
if %errorlevel% neq 0 (
    echo Gerekli Python paketleri kuruluyor, lutfen bekleyin...
    pip install -r backend\requirements.txt
) else (
    echo Backend gereksinimleri hazir.
)

echo.
echo [2/3] Frontend paketleri kontrol ediliyor...
if not exist "frontend\node_modules\" (
    echo Frontend paketleri kuruluyor, lutfen bekleyin...
    cd frontend
    call npm install
    cd ..
) else (
    echo Frontend gereksinimleri hazir.
)

echo.
echo [3/3] POS 6 Sistemi Baslatiliyor...
echo.
python launcher.py
pause