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

set "PY_CMD="
if exist "backend\venv\Scripts\python.exe" (
    set "PY_CMD=backend\venv\Scripts\python.exe"
)
if "%PY_CMD%"=="" (
    py -3.12 -c "import sys" >nul 2>nul
    if %errorlevel% equ 0 set "PY_CMD=py -3.12"
)
if "%PY_CMD%"=="" (
    where python >nul 2>nul
    if %errorlevel% equ 0 set "PY_CMD=python"
)
if "%PY_CMD%"=="" (
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
%PY_CMD% -c "import fastapi, uvicorn, sqlalchemy, alembic, pydantic" >nul 2>nul
if %errorlevel% neq 0 (
    echo Backend paketleri kuruluyor, lutfen bekleyin...
    %PY_CMD% -m pip install -r backend\requirements.txt
) else (
    echo Backend paketleri hazir.
)

echo.
echo [2/3] Frontend paketleri kontrol ediliyor...
if not exist "frontend\node_modules\" (
    echo Frontend paketleri kuruluyor, lutfen bekleyin...
    cd frontend
    call npm install --legacy-peer-deps
    cd ..
) else (
    echo Frontend paketleri hazir.
)

echo.
echo [3/3] POS 6 Sistemi Baslatiliyor...
echo.
%PY_CMD% launcher.py
pause