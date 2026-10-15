# -*- coding: utf-8 -*-
import subprocess
import time
import os
import sys
import webbrowser

base_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(base_dir, "backend")
frontend_dir = os.path.join(base_dir, "frontend")

# Python executable (venv or system python)
venv_python = os.path.join(backend_dir, "venv", "Scripts", "python.exe")
if os.path.exists(venv_python):
    python_exe = venv_python
else:
    python_exe = sys.executable

print("=" * 60)
print("       ATLI MEDIKAL - POS 6 SISTEMI BASLATILIYOR")
print("=" * 60)
print()

# 1. Eski servisleri temizle
print("[1/4] Portlar kontrol ediliyor (14532, 5174)...")
try:
    subprocess.run(
        ["powershell", "-NoProfile", "-Command", 
         "Get-NetTCPConnection -LocalPort 14532,5174 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"],
        capture_output=True
    )
except Exception:
    pass

# 2. Frontend başlat
print("[2/4] Frontend Vite sunucusu baslatiliyor (Port 5174)...")
vite_js = os.path.join(frontend_dir, "node_modules", "vite", "bin", "vite.js")
if os.path.exists(vite_js):
    p_front = subprocess.Popen(["node", vite_js], cwd=frontend_dir)
else:
    p_front = subprocess.Popen(["npm", "run", "dev"], cwd=frontend_dir, shell=True)

# 3. Backend başlat
print("[3/4] Python FastAPI Backend sunucusu baslatiliyor (Port 14532)...")
p_back = subprocess.Popen([python_exe, "main.py"], cwd=backend_dir)

time.sleep(3)
print("[4/4] Tarayici aciliyor...")
webbrowser.open("http://localhost:5174/#/invoices")

print()
print("=" * 60)
print("   [BASARILI] POS 6 SISTEMI AKTIF VE KULLANIMA HAZIR!")
print("=" * 60)
print("   Web Arayuzu : http://localhost:5174/#/invoices")
print("   API Backend : http://127.0.0.1:14532")
print()
print("   Sistemi durdurmak icin bu pencereyi kapatabilirsiniz.")
print("=" * 60)

try:
    p_back.wait()
except KeyboardInterrupt:
    pass
finally:
    try:
        p_front.terminate()
    except Exception:
        pass
    try:
        p_back.terminate()
    except Exception:
        pass
