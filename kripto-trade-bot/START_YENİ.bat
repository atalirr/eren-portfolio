@echo off
REM ════════════════════════════════════════════════════════════════════════════
REM   ANTIGRAVITY AI - LOCAL BAŞLATICI
REM   Backend (port 8000) + Frontend (port 5173)
REM   2026-05-21 Updated
REM ════════════════════════════════════════════════════════════════════════════

title ANTIGRAVITY AI - Master Launcher (Stable 3.12)
color 0A

echo.
echo  ════════════════════════════════════════════════════════════════════
echo   ANTIGRAVITY AI - Trade Bot v8.0-QUANT (Stable 3.12)
echo  ════════════════════════════════════════════════════════════════════
echo.
echo   Klasör: %cd%
echo   Python: C:\Users\erena\AppData\Local\Programs\Python\Python312
echo   Frontend Port: 5173
echo   Backend Port: 8000
echo.

cd /d "%~dp0"

REM ════════════════════════════════════════════════════════════════════════════
echo  [1/3] Eski Python süreçleri temizleniyor...
echo  ────────────────────────────────────────────────────────────────────

taskkill /F /IM python.exe /T >nul 2>nul

timeout /t 2 /nobreak >nul

REM ════════════════════════════════════════════════════════════════════════════
echo  [2/3] Backend başlatılıyor (Python 3.12, Port: 8000)...
echo  ────────────────────────────────────────────────────────────────────

set PYTHONIOENCODING=utf-8
set PYTHONUNBUFFERED=1

REM Python 3.12 ile backend başlat
start "ANTIGRAVITY BACKEND" cmd /k ^
  "C:\Users\erena\AppData\Local\Programs\Python\Python312\python.exe -u backend.py"

timeout /t 5 /nobreak >nul

echo  ✅ Backend başlatıldı
echo.

REM ════════════════════════════════════════════════════════════════════════════
echo  [3/3] Frontend başlatılıyor (Node.js, Port: 5173)...
echo  ────────────────────────────────────────────────────────────────────

if exist "frontend" (
    start "ANTIGRAVITY FRONTEND" cmd /k ^
      "cd frontend && npm run dev"
    timeout /t 5 /nobreak >nul
    echo  ✅ Frontend başlatıldı
) else (
    echo  ⚠️  Frontend klasörü bulunamadı
    echo  (Sadece Backend çalışıyor)
)

echo.

REM ════════════════════════════════════════════════════════════════════════════
echo.
echo  ════════════════════════════════════════════════════════════════════
echo  ✅ SISTEM BAŞLATILDI
echo  ════════════════════════════════════════════════════════════════════
echo.
echo  ERIŞIM ADRESLERİ:
echo  • Frontend:  http://localhost:5173
echo  • Backend:   http://localhost:8000
echo  • Status:    http://localhost:8000/get-status
echo.
echo  BU PENCERE AÇIK KALMALI!
echo  (Kapatırsan bot duracak)
echo.
echo  Çıkmak: Ctrl+C (tüm pencereleri kapat)
echo.
echo  ════════════════════════════════════════════════════════════════════
echo.

REM Browser'ı aç
timeout /t 3 /nobreak >nul
start http://localhost:5173

REM Main pencereyi açık tut
echo  Sistem çalışıyor... (bu pencereyi kapatma)
pause
