# Temporary fix script
import shutil
import re

print("Backing up telegram_module.py to telegram_module.py.bak...")
shutil.copyfile("telegram_module.py", "telegram_module.py.bak")

with open("telegram_module.py", "r", encoding="utf-8", errors="replace") as f:
    lines = f.readlines()

print("Original line count:", len(lines))

# Search for CHAT_ID line and fix it
for idx, line in enumerate(lines):
    if 'CHAT_ID = os.getenv("TELEGRAM_CHAT_ID"def' in line or 'CHAT_ID = os.getenv("TELEGRAM_CHAT_ID"' in line:
        print(f"Found line {idx+1}: {line.strip()}")
        # Fix line 12
        lines[idx] = 'CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")\n\ndef fmt_tr_float(val, precision=2, sign=False):\n'
        break

# Let's save and test compile to see the next error
with open("telegram_module.py", "w", encoding="utf-8") as f:
    f.writelines(lines)

print("Fixed line 12. Let's try compile...")
try:
    import py_compile
    py_compile.compile("telegram_module.py")
    print("Compilation successful!")
except Exception as e:
    print("Compilation failed:", e)
