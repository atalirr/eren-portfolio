import subprocess
import sys
import os
import shutil

# Make sure we are in backend folder
backend_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(backend_dir)

# Ensure dist exists
dist_dir = os.path.join(backend_dir, "dist")
if os.path.exists(dist_dir):
    try:
        shutil.rmtree(dist_dir)
    except Exception as e:
        print(f"Warning: Could not remove dist dir: {e}")

# PyInstaller command with hidden imports
cmd = [
    "pyinstaller",
    "--noconfirm",
    "--onedir",
    "--console",
    "--name=pos6-backend",
    "--add-data=src;src",
    "--add-data=alembic;alembic",
    "--add-data=alembic.ini;.",
    "--hidden-import=pydantic_settings",
    "--hidden-import=fastapi",
    "--hidden-import=uvicorn",
    "--hidden-import=uvicorn.protocols.http.auto",
    "--hidden-import=uvicorn.protocols.http.h11_impl",
    "--hidden-import=uvicorn.protocols.websockets.auto",
    "--hidden-import=uvicorn.protocols.websockets.wsproto_impl",
    "--hidden-import=uvicorn.lifespan.on",
    "--hidden-import=uvicorn.loops.auto",
    "--hidden-import=uvicorn.loops.asyncio",
    "--hidden-import=email_validator",
    "--hidden-import=sqlalchemy",
    "--hidden-import=sqlalchemy.sql.default_comparator",
    "--hidden-import=passlib.handlers.bcrypt",
    "--hidden-import=passlib",
    "main.py"
]

print(f"Running command: {' '.join(cmd)}")
# We want to run pyinstaller from the venv
venv_pyinstaller = os.path.join(backend_dir, "venv", "Scripts", "pyinstaller.exe")
if os.path.exists(venv_pyinstaller):
    cmd[0] = venv_pyinstaller
    print(f"Using venv pyinstaller: {cmd[0]}")
else:
    print("Warning: venv pyinstaller not found, using global pyinstaller")

# Execute
result = subprocess.run(cmd, shell=True)
if result.returncode != 0:
    print("Error: PyInstaller build failed")
    sys.exit(result.returncode)

print("Build successful!")
