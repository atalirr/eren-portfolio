@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo ==================================================
echo         KOOPERATİF BOTU BAŞLATILIYOR
echo ==================================================
echo.

:: Arka planda asılı kalan hayalet süreçleri temizle
taskkill /F /IM python.exe >nul 2>&1

:: Web arayüzünü tarayıcıda aç
start "" "http://localhost:5000"

:: Botu çalıştır ve hataları 'hata_logu.txt' dosyasına kaydet
python app.py 2> hata_logu.txt

echo.
echo ==================================================
echo   Program sonlandi. Kapatmak icin bir tusa basin.
echo ==================================================
pause >nul
