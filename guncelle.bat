@echo off
chcp 65001 >nul
echo ========================================================
echo        Eren Atli - Proje Guncelleme Scripti
echo ========================================================
echo.
echo [1/3] Degisiklikler kontrol ediliyor...
git add .

echo.
set /p commit_msg="Guncelleme notu girin (bos birakirsaniz otomatik mesaj yazilir): "
if "%commit_msg%"=="" set commit_msg="Projeler guncellendi: %date% %time%"

echo.
echo [2/3] Kayit aliniyor: %commit_msg%
git commit -m "%commit_msg%"

echo.
echo [3/3] GitHub'a yukleniyor...
git push -u origin main

echo.
echo ========================================================
echo   ISLEM TAMAMLANDI! GitHub basariyla guncellendi.
echo ========================================================
pause
