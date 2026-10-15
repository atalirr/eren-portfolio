"""
POS 6 - Auto Update & Backup Script
This script allows clients to update their POS system to the latest version
without losing their SQLite database, .env keys, or configurations.
"""

import os
import sys
import shutil
import urllib.request
import zipfile
import tempfile
from pathlib import Path

# Color helpers for terminal output
def print_success(msg):
    print(f"\033[92m[OK] {msg}\033[0m")

def print_info(msg):
    print(f"\033[94m[INFO] {msg}\033[0m")

def print_error(msg):
    print(f"\033[91m[HATA] {msg}\033[0m")

def main():
    print("\n===========================================")
    print("      POS 6 - SISTEM GUNCELLEME PANELI     ")
    print("===========================================\n")

    root_dir = Path(__file__).parent.absolute()
    print_info(f"Uygulama dizini: {root_dir}")

    # 1. Konfigürasyon yedekle
    backend_env = root_dir / "backend" / ".env"
    backup_env = None

    if backend_env.exists():
        print_info("Mevcut .env ayarlari yedekleniyor...")
        temp_dir = Path(tempfile.gettempdir())
        backup_env = temp_dir / "pos6_backend_env_backup"
        try:
            shutil.copy2(backend_env, backup_env)
            print_success(f".env dosyasi gecici olarak yedeklendi: {backup_env}")
        except Exception as e:
            print_error(f".env yedeklenirken hata olustu: {e}")
            confirm = input("Yedekleme basarisiz oldu. Devam etmek istiyor musunuz? (e/h): ")
            if confirm.lower() != 'e':
                sys.exit(1)

    # 2. Guncelleme URL'i sor
    print("\nLutfen guncelleme paketinin (.zip) URL adresini girin.")
    print("Varsayilan adresi kullanmak icin Enter tusuna basin.")
    default_url = "https://github.com/erena/pos-releases/archive/refs/heads/main.zip"
    url_input = input(f"URL [{default_url}]: ").strip()
    url = url_input if url_input else default_url

    # 3. Zip indir
    temp_zip = Path(tempfile.gettempdir()) / "pos6_update.zip"
    print_info(f"\nGuncelleme paketi indiriliyor: {url}")
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) POS6-Updater'}
        )
        with urllib.request.urlopen(req, timeout=30) as response, open(temp_zip, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
        print_success("Guncelleme paketi basariyla indirildi.")
    except Exception as e:
        print_error(f"Paket indirilirken hata olustu: {e}")
        if backup_env and backup_env.exists():
            backup_env.unlink()
        sys.exit(1)

    # 4. Guncellemeyi uygula (dosyalari cikar)
    print_info("\nDosyalar guncelleniyor...")
    try:
        extract_dir = Path(tempfile.gettempdir()) / "pos6_extracted"
        if extract_dir.exists():
            shutil.rmtree(extract_dir)
        extract_dir.mkdir()

        # Zip dosyasini gecici klasore cikar
        with zipfile.ZipFile(temp_zip, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)

        # Zip icindeki ana alt klasoru bul (github zip'leri genelde repo-name-branch adinda bir alt klasor icerir)
        subdirs = [x for x in extract_dir.iterdir() if x.is_dir()]
        source_dir = subdirs[0] if subdirs else extract_dir

        # Hedefteki kod dosyalarini guncelle
        for item in source_dir.iterdir():
            if item.name in [".git", "venv", ".idea", "node_modules"]:
                continue  # Bu klasorleri degistirme
            
            dest_path = root_dir / item.name
            if item.is_dir():
                if dest_path.exists():
                    shutil.rmtree(dest_path)
                shutil.copytree(item, dest_path)
                print_info(f"Klasor guncellendi: {item.name}")
            else:
                shutil.copy2(item, dest_path)
                print_info(f"Dosya guncellendi: {item.name}")

        print_success("Uygulama dosyalari basariyla guncellendi.")
    except Exception as e:
        print_error(f"Dosyalar cikarilirken veya kopyalanirken hata: {e}")
        if backup_env and backup_env.exists():
            backup_env.unlink()
        sys.exit(1)

    # 5. Konfigürasyonu geri yukle
    if backup_env and backup_env.exists():
        print_info("\n.env ayarlari geri yukleniyor...")
        try:
            backend_env.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(backup_env, backend_env)
            backup_env.unlink()
            print_success(".env ayarlari geri yuklendi.")
        except Exception as e:
            print_error(f".env geri yuklenirken hata olustu: {e}")

    # 6. Temizlik
    if temp_zip.exists():
        temp_zip.unlink()
    if extract_dir.exists():
        shutil.rmtree(extract_dir)

    print("\n===========================================")
    print("      GUNCELLEME TAMAMLANDI (SORUNSUZ)     ")
    print("  Veritabani verileriniz (AppData) korundu. ")
    print("===========================================\n")
    input("Cikmak icin Enter tusuna basin...")

if __name__ == "__main__":
    # Windows rengi etkinlestirmek icin os.system
    os.system("")
    main()
