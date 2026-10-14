# 🚀 Eren Atlı — Proje Portföyü (Developer Showcase)

Bu depo, masaüstü uygulamaları, algoritmik ticaret sistemleri, modern web arayüzleri ve yapay zeka entegrasyonlarını içeren kişisel projelerimi ve teknik çalışmalarımı sergilemek amacıyla hazırlanmıştır.

---

## 📌 Proje Özeti ve Durum Tablosu

| # | Proje | Alan / Kapsam | Kullanılan Teknolojiler | Durum |
|---|---|---|---|---|
| 1 | **[ATLI Medikal POS](./pos-sistemi)** | Masaüstü Satış & Stok Yönetimi | Electron, Node.js, SQLite, Chart.js | 🟢 `Kararlı (v1.0)` |
| 2 | **[VocabFlow](./vocabflow-kelime)** | AI Destekli İngilizce Okuma & Kelime | JavaScript (SPA), Gemini 2.5 AI API, Responsive UI | 🟡 `Beta / Aktif Geliştirme` |
| 3 | **[Antigravity Trade Bot](./kripto-trade-bot)** | Kripto Algoritmik Ticaret & Sinyal | Python 3, Pandas, Technical Indicators, Telegram Bot | 🔵 `Algoritmik Prototip` |
| 4 | **[HabitPulse](./aliskanlik-takip)** | Alışkanlık & Rutin Takip Uygulaması | React 19, Vite, Tailwind CSS, Framer Motion | 🟡 `Ön Yüz / Aktif Geliştirme` |

---

## 🛠️ Projeler Hakkında Detaylar

### 1. 🛒 ATLI Medikal POS Sistemi (`/pos-sistemi`)
Masaüstü ortamında hızlı ve kesintisiz perakende satış, stok yönetimi ve ciro takibi sağlayan POS uygulaması.
* **Öne Çıkanlar:**
  * Güvenli Electron mimarisi (`contextIsolation: true`, `nodeIntegration: false`, IPC Bridge).
  * Yerel SQLite3 veritabanı ile offline çalışabilme kabiliyeti.
  * Dinamik dashboard, haftalık ciro grafikleri, kritik stok uyarıları.
  * Barkod okuyucu ve fiş/fatura entegrasyonu hazırlığı.
* **Hızlı Başlatma:**
  ```bash
  cd pos-sistemi
  npm install
  npm start
  ```

---

### 2. 📚 VocabFlow — Akıllı Kelime & Okuma Uygulaması (`/vocabflow-kelime`)
Google Gemini AI gücüyle İngilizce makale okuma, tek tıkla kelime analizi, fonetik telaffuz ve SRS (Aralıklı Tekrar) ile kelime öğrenme platformu.
* **Öne Çıkanlar:**
  * Çift dilli interaktif okuyucu modu ve anlık çeviri motoru.
  * Gemini LLM API entegrasyonu ile bağlamsal kelime anlamı çıkarma.
  * Çevrimdışı hazır sözlük ve telaffuz motoru desteği.
* **Hızlı Başlatma:**
  ```bash
  cd vocabflow-kelime
  # .env.example dosyasını .env olarak kopyalayıp Gemini API anahtarınızı girin:
  cp .env.example .env
  # Doğrudan index.html'i tarayıcıda açabilir veya server ile çalıştırabilirsiniz:
  node server.cjs
  ```

---

### 3. 📈 Antigravity AI Radar & Trade Bot (`/kripto-trade-bot`)
Kripto para piyasalarında teknik analiz indikatörleri, makro filtreler ve risk yönetimi kurallarını kullanarak otomatik sinyal üreten algoritmik ticaret botu.
* **Öne Çıkanlar:**
  * Trend, hacim ve momentum indikatörlerinin (RSI, MACD, Bollinger vb.) çoklu zaman dilimi taraması.
  * Telegram bildirim motoru (anlık alım-satım ve kâr/zarar raporları).
  * Paper trading (sanal bakiye simülasyonu) ve backtest motoru.
  * Dinamik risk ve sermaye yönetimi (Stop-loss / Take-profit optimizasyonu).
* **Hızlı Başlatma:**
  ```bash
  cd kripto-trade-bot
  pip install -r requirements.txt
  # .env.example dosyasını .env olarak kopyalayıp parametrelerinizi ayarlayın:
  cp .env.example .env
  python radar_loop.py
  ```

---

### 4. ⚡ HabitPulse — Alışkanlık Takip (`/aliskanlik-takip`)
Kullanıcıların günlük hedeflerini, odaklanma sürelerini ve alışkanlık zincirlerini takip etmelerini sağlayan modern kullanıcı arayüzü.
* **Öne Çıkanlar:**
  * React 19 ve Vite altyapısıyla yıldırım hızında bileşen mimarisi.
  * Framer Motion ile akıcı mikro etkileşimler ve animasyonlar.
  * Odaklanma zamanlayıcısı (Pomodoro) ve ortam sesleri (ambient sound).
* **Hızlı Başlatma:**
  ```bash
  cd aliskanlik-takip
  npm install
  npm run dev
  ```

---

## 🔒 Güvenlik ve Gizlilik Notu
Bu depodaki tüm projeler sürüm kontrolüne girmeden önce taranmış; hiçbir özel API anahtarı, ticari veritabanı, bakiye bilgisi veya müşteri verisi depoya dahil edilmemiştir. Hassas servisler `.env.example` şablonları üzerinden yapılandırılmaktadır.

---

## 📬 İletişim
* **Geliştirici:** Eren Atlı
* **E-posta:** erenatli008@gmail.com
