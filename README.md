# 🚀 Eren Atlı — Proje Portföyü (Developer Showcase)

Bu depo, masaüstü uygulamaları, algoritmik ticaret sistemleri, modern web arayüzleri ve yapay zeka entegrasyonlarını içeren kişisel projelerimi ve teknik çalışmalarımı sergilemek amacıyla hazırlanmıştır.

---

## 📌 Proje Özeti ve Durum Tablosu

| # | Proje | Alan / Kapsam | Kullanılan Teknolojiler | Durum |
|---|---|---|---|---|
| 1 | **[ATLI Medikal POS 6](./pos-sistemi)** | Masaüstü Satış & AI Fatura | React (TS), Python FastAPI, Electron, Gemini AI | 🟢 `Kararlı (v6.0)` |
| 2 | **[VocabFlow](./vocabflow-kelime)** | AI Destekli İngilizce Okuma & Kelime | JavaScript (SPA), Gemini 2.5 AI API, Responsive UI | 🟡 `Beta / Aktif Geliştirme` |
| 3 | **[Antigravity Trade Bot](./kripto-trade-bot)** | Kripto Algoritmik Ticaret & Sinyal | Python 3, Pandas, Technical Indicators, Telegram Bot | 🔵 `Algoritmik Prototip` |
| 4 | **[HabitPulse](./aliskanlik-takip)** | Alışkanlık & Rutin Takip Uygulaması | React 19, Vite, Tailwind CSS, Framer Motion | 🟡 `Ön Yüz / Aktif Geliştirme` |

---

## 🛠️ Projeler Hakkında Detaylar

### 1. 🛒 ATLI Medikal POS 6 (`/pos-sistemi`)
Modern, offline-first masaüstü satış, stok ve yapay zeka destekli fatura işleme sistemi (Electron + React TypeScript + Python FastAPI).
* **Öne Çıkanlar:**
  * **Frontend:** React 18, TypeScript, Tailwind CSS, Vite ile ultra hızlı kullanıcı arayüzü.
  * **Backend:** Python FastAPI mimarisi, SQLite ve Alembic veri tabanı yönetimi.
  * **Yapay Zeka & OCR:** Google Gemini Vision AI ile kamera veya görselden otomatik fatura okuma ve stok eşleme.
  * **Finansal Analiz:** Tedarikçi borç/alacak yönetimi, kâr/zarar ve ciro raporlaması.
* **Hızlı Başlatma:**
  * **Kolay Yol (Windows):** Klasördeki `baslat.bat` dosyasına çift tıklayın (gerekli Python ve Frontend kurulumlarını otomatik yapar, tarayıcıyı ve servisleri açar).
  * **Manuel Yol:**
    ```bash
    cd pos-sistemi
    pip install -r backend/requirements.txt
    cd frontend && npm install && npm run build
    python launcher.py
    ```

---

### 2. 📚 VocabFlow — Akıllı Kelime & Okuma Uygulaması (`/vocabflow-kelime`)
Google Gemini AI gücüyle İngilizce makale okuma, tek tıkla kelime analizi, fonetik telaffuz ve SRS (Aralıklı Tekrar) ile kelime öğrenme platformu.
* **Öne Çıkanlar:**
  * Çift dilli interaktif okuyucu modu ve anlık çeviri motoru.
  * Gemini LLM API entegrasyonu ile bağlamsal kelime anlamı çıkarma.
  * Çevrimdışı hazır sözlük ve telaffuz motoru desteği.
* **Hızlı Başlatma:**
  * **Kolay Yol (Windows):** Klasördeki `baslat.bat` dosyasına çift tıklayın (tarayıcıyı ve sunucuyu otomatik açar).
  * **Manuel Yol:**
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
  * **Kolay Yol (Windows):** Klasördeki `baslat.bat` dosyasına çift tıklayın (kütüphaneleri kontrol eder, frontend ve backend'i başlatır).
  * **Manuel Yol:**
    ```bash
    cd kripto-trade-bot
    pip install -r requirements.txt
    cp .env.example .env
    python backend.py
    ```

---

### 4. ⚡ HabitPulse — Alışkanlık Takip (`/aliskanlik-takip`)
Kullanıcıların günlük hedeflerini, odaklanma sürelerini ve alışkanlık zincirlerini takip etmelerini sağlayan modern kullanıcı arayüzü.
* **Öne Çıkanlar:**
  * React 19 ve Vite altyapısıyla yıldırım hızında bileşen mimarisi.
  * Framer Motion ile akıcı mikro etkileşimler ve animasyonlar.
  * Odaklanma zamanlayıcısı (Pomodoro) ve ortam sesleri (ambient sound).
* **Hızlı Başlatma:**
  * **Kolay Yol (Windows):** Klasördeki `baslat.bat` dosyasına çift tıklayın (kurulumu yapar ve tarayıcıda açar).
  * **Manuel Yol:**
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
