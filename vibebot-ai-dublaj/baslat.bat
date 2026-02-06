@echo off
chcp 65001 >nul
title VibeBot — AI Video İndirme ve Türkçe Dublaj Stüdyosu (Port 8092)
cd /d "%~dp0"
echo ============================================================
echo  VibeBot AI Video Dublaj ve Lokalizasyon Studyosu Baslatiliyor
echo  Adres: http://localhost:8092
echo ============================================================
start "" "http://localhost:8092"
python server.py
pause
