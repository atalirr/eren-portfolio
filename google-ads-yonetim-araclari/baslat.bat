@echo off
chcp 65001 >nul
title Atli Medikal - Google Ads AI Denetim ve Otomasyon Komut Merkezi
cd /d "%~dp0"

echo ============================================================================
echo   ATLI MEDIKAL - GOOGLE ADS AI DENETIM, KESIF VE OTOMASYON KOMUT MERKEZI
echo   Sunucu baslatiliyor: http://localhost:8093
echo ============================================================================
echo.

start "" "http://localhost:8093"
python server.py

pause
