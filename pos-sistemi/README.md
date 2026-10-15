# 🏪 POS 6 - Satış Noktası Sistemi

**Offline-First** masaüstü POS uygulaması. Tek `.exe` dosyası olarak paketlenir, tak-çalıştır mantığıyla çalışır.

## 🎯 Proje Vizyonu

- ✅ **Offline-First**: İnternet olmadan çalışır
- ✅ **Cloud-Ready**: Gelecekte bulut senkronizasyonuna %100 uyumlu
- ✅ **Hata Toleransı Sıfır**: Clean Architecture + DDD prensipleri
- ✅ **Ölçeklenebilir**: Feature-based modüler yapı
- ✅ **Tak-Çalıştır**: Tek `.exe` dosyası ile dağıtım

## 🛠️ Teknoloji Yığını

- **Shell**: Electron.js (Main Process)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + Zustand
- **Backend**: Python FastAPI + Pydantic + SQLAlchemy
- **Veritabanı**: SQLite (Yerel dosya)

## 📁 Proje Yapısı

Proje **feature-based** (özellik tabanlı) modüler yapıda tasarlanmıştır:

```
pos-6/
├── electron/          # Electron Main Process
├── frontend/          # React + TypeScript Frontend
├── backend/           # Python FastAPI Backend
└── build/             # Build araçları ve konfigürasyonlar
```

Detaylı klasör yapısı için: [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🚀 Kurulum

### Gereksinimler

- **Node.js** >= 18.x
- **Python** >= 3.10
- **Git**

### 1. Repository'yi Klonlayın

```bash
git clone <repository-url>
cd pos-6
```

### 2. Ortam Değişkenlerini Ayarlayın

```bash
# Backend için
cp backend/.env.example backend/.env

# Root için (opsiyonel)
cp .env.example .env
```

`.env` dosyalarını düzenleyerek gerekli ayarları yapın.

### 3. Frontend Kurulumu

```bash
cd frontend
npm install
```

### 4. Backend Kurulumu

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

### 5. Veritabanını Oluşturun

```bash
cd backend
alembic upgrade head
```

## 💻 Geliştirme Modu

### Terminal 1: Backend (Python FastAPI)

```bash
cd backend
python main.py
```

Backend `http://127.0.0.1:14532` adresinde çalışacak.

### Terminal 2: Frontend (React + Vite)

```bash
cd frontend
npm run dev
```

Frontend genellikle `http://localhost:5173` adresinde çalışacak.

### Terminal 3: Electron

```bash
npm run electron:dev
```

Electron penceresi açılacak ve uygulama çalışacak.

## 👥 Ekip Çalışması (Collaboration)

### Branch Stratejisi

- `main`: Production-ready kod (asla direkt commit atmayın)
- `develop`: Geliştirme branch'i (ana branch)
- `feature/stok-yonetimi`: Yeni özellikler için
- `feature/siparis-sistemi`: Yeni özellikler için
- `bugfix/urun-ekleme-hatasi`: Bug düzeltmeleri için

### Çalışma Akışı

1. **Yeni özellik için branch oluşturun:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/yeni-ozellik
   ```

2. **Değişikliklerinizi commit edin:**
   ```bash
   git add .
   git commit -m "feat: yeni özellik eklendi"
   ```

3. **Branch'inizi push edin:**
   ```bash
   git push origin feature/yeni-ozellik
   ```

4. **Pull Request oluşturun:**
   - GitHub/GitLab üzerinden `feature/yeni-ozellik` → `develop` için PR açın
   - Code review bekleyin
   - Merge edildikten sonra branch'inizi silin

### Commit Mesajları (Conventional Commits)

- `feat:` Yeni özellik
- `fix:` Bug düzeltmesi
- `refactor:` Kod yeniden yapılandırması
- `docs:` Dokümantasyon değişiklikleri
- `test:` Test ekleme/düzeltme
- `chore:` Build, dependency güncellemeleri

**Örnek:**
```bash
feat(inventory): ürün ekleme formu eklendi
fix(sales): sepet tutarı hesaplama hatası düzeltildi
refactor(orders): repository katmanı iyileştirildi
```

### Çakışma Önleme

- **Feature modülleri birbirinden bağımsız**: Her feature kendi klasöründe (`src/features/sales`, `src/features/inventory`)
- **Shared klasörüne dikkat**: Birden fazla feature'da kullanılacak değişiklikleri dikkatli yapın
- **Sık sık pull alın**: `git pull origin develop` ile güncel kalın

## 🏗️ Production Build

### 1. Frontend Build

```bash
cd frontend
npm run build
```

Build çıktısı `frontend/dist/` klasöründe oluşacak.

### 2. Python Binary Build

```bash
cd backend
npm run build:python
```

Python kodu binary'ye dönüştürülecek (PyInstaller/Nuitka kullanılacak).

### 3. Electron Packaging

```bash
npm run build:electron
```

Tek `.exe` dosyası `dist/pos6-setup.exe` olarak oluşturulacak.

### Build Çıktısı

- **Windows**: `dist/pos6-setup.exe`
- **macOS**: `dist/pos6.dmg` (gelecekte)
- **Linux**: `dist/pos6.AppImage` (gelecekte)

## 📊 Veritabanı Yönetimi

### Migration Oluşturma

```bash
cd backend
alembic revision --autogenerate -m "urun_tablosu_eklendi"
```

### Migration Uygulama

```bash
alembic upgrade head
```

### Migration Geri Alma

```bash
alembic downgrade -1
```

## 🔐 Güvenlik Notları

- `.env` dosyasını **asla** Git'e commit etmeyin
- Production'da `SECRET_KEY`'i güvenli bir değerle değiştirin
- SQLite dosyası `%APPDATA%/pos6/db.sqlite` konumunda saklanır (güvenli)

## 📝 Mimari Tasarım

Detaylı mimari tasarım, klasör yapısı, veritabanı şeması ve mantık akış şeması için:

👉 **[ARCHITECTURE.md](./ARCHITECTURE.md)** dosyasına bakın.

## 🐛 Sorun Giderme

### Python process başlamıyor

- Port çakışması olabilir: `.env` dosyasında farklı bir port deneyin
- Python kurulumunu kontrol edin: `python --version`

### Electron penceresi açılmıyor

- Backend'in çalıştığından emin olun: `http://127.0.0.1:14532/health`
- Console loglarını kontrol edin: `npm run electron:dev`

### Veritabanı bağlantı hatası

- SQLite dosyasının yazılabilir olduğundan emin olun
- `%APPDATA%/pos6/` klasörünün mevcut olduğunu kontrol edin

## 📚 Öğrenme Kaynakları

- [Clean Architecture (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Feature-Based Architecture](https://kentcdodds.com/blog/colocation)

## 📄 Lisans

[Lisans bilgisi eklenecek]

## 👨‍💻 Geliştiriciler

- [İsim 1]
- [İsim 2]

---

**Not**: Bu proje, Clean Architecture ve DDD prensipleriyle, hata toleransı sıfır ve ölçeklenebilir bir şekilde tasarlanmıştır.


