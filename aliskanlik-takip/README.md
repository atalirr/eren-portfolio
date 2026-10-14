# ⚡ HabitPulse — Alışkanlık Takip Uygulaması

> Alışkanlıklarını takip et, hedeflerine ulaş. Günlük rutinlerin için akıllı bir refakatçi.

---

## 🗺️ Proje Haritası

```
TODO2/
├── index.html                          ← HTML kök dosyası (SEO meta etiketleri)
├── vite.config.js                      ← Vite + Tailwind yapılandırması
├── package.json                        ← Proje bağımlılıkları
└── src/
    ├── main.jsx                        ← React giriş noktası (root render)
    ├── index.css                       ← Global stiller, CSS değişkenleri
    ├── AnaUygulama (App).jsx           ← Merkezi bileşen (sayfa yönetimi)
    ├── YanMenu (Sidebar).jsx           ← Sol navigasyon menüsü
    └── [gelecek özellikler...]
```

---

## 🛠️ Teknoloji Yığını

| Teknoloji | Sürüm | Kullanım Amacı |
|-----------|-------|----------------|
| **React** | 19 | UI bileşen kütüphanesi |
| **Vite** | 8 | Geliştirme sunucusu ve bundler |
| **Tailwind CSS** | 4 | Utility-first CSS framework |
| **Framer Motion** | ≥11 | Sayfa/bileşen animasyonları |
| **Lucide React** | latest | SVG ikon kütüphanesi |

---

## 🎨 Tasarım Sistemi

### Renk Paleti
| Değişken | Değer | Kullanım |
|----------|-------|---------|
| `--renk-birincil` | `#6C63FF` | Mor-mavi ana vurgu |
| `--renk-ikincil` | `#F472B6` | Pembe ikincil vurgu |
| `--renk-arkaplan` | `#F8FAFC` | Sayfa arka planı |
| `--renk-kart` | `#FFFFFF` | Kart yüzeyleri |
| `--renk-yazi` | `#1E293B` | Ana metin |

### Mimari Kurallar
- **Özellik Tabanlı (Feature-Based)** klasör yapısı
- Dosya adları: `TurkceAd (EnglishName).jsx`
- Fonksiyon/değişken adları: tamamen **Türkçe**
- Her kod satırı: `//` ile **Türkçe açıklama**
- Tema token'ları: her dosyada `TemaAyarlari` objesi

---

## 🚀 Geliştirme Ortamını Başlatma

```bash
# Bağımlılıkları yükle (ilk kurulumda bir kez)
npm install

# Geliştirme sunucusunu başlat
npm run dev
# → http://localhost:5173
```

---

## 📦 Bağımlılıkları Kurma

```bash
npm install tailwindcss @tailwindcss/vite framer-motion lucide-react --legacy-peer-deps
```

---

## 🗺️ Sayfa Yapısı

| Sayfa ID | Türkçe Adı | Durum |
|----------|-----------|-------|
| `pano` | Kontrol Paneli | 🚧 Geliştiriliyor |
| `bugun` | Bugünün Görevleri | 🚧 Geliştiriliyor |
| `hedefler` | Hedefler | 🚧 Geliştiriliyor |
| `istatistikler` | İstatistikler | 🚧 Geliştiriliyor |
| `basarilar` | Başarılar | 🚧 Geliştiriliyor |
| `ayarlar` | Ayarlar | 🚧 Geliştiriliyor |

---

## ✨ Animasyon Sistemi (Framer Motion)

- **Menü açılışı**: `staggerChildren` ile sıralı giriş animasyonu
- **Aktif öğe**: `layoutId="aktifCubuk"` ile akıcı geçiş
- **Hover**: `whileHover={{ x: 4 }}` ile renk ve kayma efekti
- **Sayfa geçişi**: `AnimatePresence` + `mode="wait"` ile fade+slide

---

## 🔮 Planlanan Özellikler

- [ ] Alışkanlık oluşturma / düzenleme formu
- [ ] Günlük tamamlama takibi (checkbox/streak)
- [ ] Haftalık ve aylık istatistik grafikleri
- [ ] Kategori bazlı alışkanlık renk kodlama
- [ ] Bildirim sistemi (Electron ile masaüstü bildirimi)
- [ ] Veri kalıcılığı (localStorage / SQLite)

---

*HabitPulse — küçük adımlar, büyük değişimler. 🌱*
