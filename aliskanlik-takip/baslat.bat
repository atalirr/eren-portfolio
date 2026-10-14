@echo off
chcp 65001 > nul
title Alışkanlık Takip Uygulaması
echo ============================================
echo   Alışkanlık Takip Uygulaması Başlatılıyor...
echo ============================================
cd /d "%~dp0"
timeout /t 2 /nobreak > nul
start http://localhost:5173
npm run dev
pause
