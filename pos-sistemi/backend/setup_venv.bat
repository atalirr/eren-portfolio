@echo off
REM Install all requirements in backend venv
echo Installing requirements in backend venv...
cd /d %~dp0
if exist "venv\Scripts\pip.exe" (
    venv\Scripts\pip.exe install -r requirements.txt
    echo.
    echo Done! All packages installed.
) else (
    echo ERROR: venv\Scripts\pip.exe not found!
    echo Please make sure you are running this from the backend directory.
    pause
    exit /b 1
)
pause






















