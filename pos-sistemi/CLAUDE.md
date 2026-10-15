# POS 6 — Claude Bağlam Dosyası

## Proje Özeti
Offline-First masaüstü POS (Satış Noktası) uygulaması. Tek `.exe` olarak paketlenir.
Geliştirici: Ata (erenatli008@gmail.com)

## Teknoloji Stack
- **Electron.js** — Masaüstü shell, `electron/main.js`
- **Frontend** — React + Vite + TypeScript + Tailwind CSS + Zustand
- **Backend** — Python FastAPI, port `14532`, `backend/main.py`
- **Veritabanı** — SQLite (`%APPDATA%/pos6/db.sqlite`), SQLAlchemy ORM, Alembic migration

## Klasör Yapısı
```
pos-6/
├── electron/           # Electron Main Process
├── frontend/
│   └── src/
│       ├── features/   # Feature modülleri (aşağıda liste)
│       ├── components/ # Shared UI bileşenleri
│       ├── store/      # Zustand global state
│       ├── router/     # React Router
│       └── shared/     # Ortak tipler, utils
└── backend/
    └── src/
        ├── features/   # Backend feature modülleri
        ├── core/       # App factory, middleware
        └── shared/     # DB session, config, base modeller
```

## Frontend Feature Modülleri (`frontend/src/features/`)
- `auth` — Giriş/oturum yönetimi
- `dashboard` — Ana kontrol paneli
- `sales` — Satış ekranı (POS)
- `inventory` — Stok yönetimi
- `orders` — Sipariş takibi
- `finance` — Finansal raporlar
- `reports` — Genel raporlar
- `customers` — Müşteri yönetimi
- `personnel` — Personel yönetimi
- `transactions` — İşlem geçmişi
- `ecommerce` — E-ticaret entegrasyonu
- `settings` — Uygulama ayarları
- `shifts` — Vardiya yönetimi
- `labels` — Etiket yönetimi

## Backend Feature Modülleri (`backend/src/features/`)
- `auth`, `sales`, `inventory`, `orders`, `finance`
- `customers`, `personnel`, `transactions`, `analytics`
- `dashboard`, `ecommerce`, `settings`, `system`

## Backend Mimarisi (Her Feature İçin)
```
features/{feature}/
├── models.py       # SQLAlchemy ORM modelleri (BaseModel'den türer)
├── repository.py   # DB sorguları (CRUD)
├── service.py      # İş mantığı
├── router.py       # FastAPI endpoint'leri
└── schemas.py      # Pydantic şemaları
```

## BaseModel Ortak Kolonları
Her model şunları miras alır: `id` (UUID), `created_at`, `updated_at`, `is_synced`, `is_deleted`

## Geliştirme Komutları
```bash
# Tümünü başlat (Windows)
npm start               # start.ps1 çalıştırır

# Ayrı ayrı
cd backend && python main.py          # Backend: http://127.0.0.1:14532
cd frontend && npm run dev             # Frontend: http://localhost:5173
npm run electron:dev                   # Electron penceresi

# Migration
cd backend && alembic upgrade head
cd backend && alembic revision --autogenerate -m "aciklama"
```

## Önemli Kurallar
- Her feature **kendi klasöründe** bağımsız — çakışmadan çalışır
- Config değerleri `.env` dosyasından okunur, hardcode yok
- Soft delete kullanılır (`is_deleted` flag), gerçek silme yok
- UUID kullanılır (integer ID değil)
- `shared/` klasörüne dikkatli dokunulmalı (tüm feature'lar kullanıyor)

## Son Yapılan İşler (Git log)
- TypeScript build hataları düzeltildi (strict unused variable checks kapatıldı)
- Sales navigation hook düzeltildi
- PageHeader standardize component eklendi (5+ sayfaya uygulandı)
- Personel sayfası eklendi
- Büyük temizlik yapıldı (ölü dosyalar, debug scriptler silindi)

## Finansal Analitik API
`/api/finance/` altında gelişmiş finansal endpoint'ler mevcut:
- `net-profitability` — Gerçek karlılık analizi
- Detaylar: `backend/FINANCIAL_ANALYTICS_API.md`

## Bilinen Sorunlar / Yarım Kalanlar
- `ARCHITECTURE.md` dosyası boş (henüz yazılmadı)
- Production build süreci test edilmedi (PyInstaller/Nuitka)
- Git index.lock hatası mevcut (worktree kalıntısı)

## Claude'a Not
- Kullanıcı Türkçe konuşuyor, Türkçe yanıt ver
- Kod yazarken mevcut feature yapısına uy (models → repository → service → router)
- Yeni endpoint eklerken `backend/src/core/app.py`'e router kaydetmeyi unutma
- Frontend'de yeni sayfa eklerken `router/` klasörüne route ekle
