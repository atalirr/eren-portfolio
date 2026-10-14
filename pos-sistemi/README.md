# ATLI Medikal POS Sistemi

Modern ve kullanıcı dostu bir Point of Sale (POS) sistemi. Electron tabanlı masaüstü uygulaması olarak geliştirilmiştir.

## 🚀 Özellikler

- **Dashboard**: Günlük ve haftalık satış istatistikleri
- **Stok Yönetimi**: Ürün ekleme, düzenleme, silme ve takip
- **Satış İşlemleri**: Hızlı satış yapma ve geçmiş satışları görüntüleme
- **Raporlar**: Detaylı satış ve stok raporları
- **Grafikler**: Görsel analiz araçları
- **Kategori Yönetimi**: Ürün kategorilerini organize etme
- **Veri Tabanı**: SQLite ile güvenli veri saklama

## 📋 Gereksinimler

- Node.js (v16 veya üzeri)
- npm veya yarn

## 🛠️ Kurulum

1. Projeyi klonlayın:

```bash
git clone <repository-url>
cd pos
```

2. Bağımlılıkları yükleyin:

```bash
npm install
```

3. Uygulamayı başlatın:

```bash
npm start
```

## 🔧 Geliştirme

Geliştirme modunda çalıştırmak için:

```bash
npm run dev
```

Bu komut DevTools'u açar ve geliştirme sırasında yardımcı olur.

## 📦 Build

Uygulamayı dağıtım için paketlemek:

```bash
npm run build
```

Bu komut `dist` klasöründe kurulum dosyalarını oluşturur.

## 🏗️ Proje Yapısı

```
pos/
├── main.js              # Electron main process
├── preload.js           # Preload script (güvenlik)
├── database.js          # Veritabanı işlemleri
├── index.html           # Ana HTML dosyası
├── styles.css           # CSS stilleri
├── script.js            # Frontend JavaScript
├── package.json         # Proje konfigürasyonu
├── assets/              # Resimler ve ikonlar
└── README.md           # Bu dosya
```

## 🔒 Güvenlik

- `nodeIntegration: false` - Renderer process'te Node.js API'leri devre dışı
- `contextIsolation: true` - Context isolation aktif
- Preload script ile güvenli API bridge
- IPC handler'lar ile güvenli iletişim

## 📊 Veritabanı

SQLite veritabanı kullanılmaktadır. Tablolar:

- `products` - Ürün bilgileri
- `sales` - Satış kayıtları
- `categories` - Kategori bilgileri

## 🎨 Tasarım

- Modern ve temiz arayüz
- Responsive tasarım
- Tek renk kullanımı (gradient yok)
- Font Awesome ikonları
- Chart.js grafikleri

## 🚀 Kullanım

### Dashboard

- Haftalık satış istatistikleri
- Ürün sayıları
- Stoğu biten ürünler
- Satış ve kategori grafikleri

### Satış İşlemleri

- Yeni satış oluşturma
- Ürün seçimi ve miktar belirleme
- Müşteri bilgileri
- Ödeme yöntemi seçimi
- Otomatik stok güncelleme

### Ürün Yönetimi

- Ürün ekleme/düzenleme/silme
- Barkod sistemi
- Stok takibi
- Kategori organizasyonu
- Arama ve filtreleme

### Raporlar

- Satış raporları
- Stok raporları
- Tarih aralığı filtreleme

## 🔧 Konfigürasyon

`package.json` dosyasında aşağıdaki ayarları değiştirebilirsiniz:

- Uygulama adı ve versiyonu
- Build konfigürasyonu
- Bağımlılıklar

## 🐛 Sorun Giderme

### Yaygın Sorunlar

1. **Uygulama başlamıyor**

   - Node.js versiyonunu kontrol edin
   - `npm install` komutunu tekrar çalıştırın

2. **Veritabanı hatası**

   - `pos_database.db` dosyasını silin ve yeniden başlatın
   - SQLite3 bağımlılığını kontrol edin

3. **Grafikler görünmüyor**
   - Chart.js CDN bağlantısını kontrol edin
   - İnternet bağlantısını kontrol edin

## 📝 Lisans

MIT License

## 👥 Geliştirici

ATLI Medikal

## 🔄 Güncellemeler

### v1.0.0

- İlk sürüm
- Temel POS özellikleri
- Modern arayüz
- SQLite veritabanı
- Güvenlik önlemleri

## 📞 Destek

Sorunlarınız için issue açabilir veya iletişime geçebilirsiniz.
