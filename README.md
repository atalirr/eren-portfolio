# 🚀 Eren Atlı — Proje Portföyü (Developer Showcase)

Bu depo; masaüstü uygulamaları, yapay zeka entegrasyonları, algoritmik sistemler, çoklu ortam işleme ve veri yönetimi araçlarını içeren kişisel projelerimi ve teknik çalışmalarımı sergilemek amacıyla hazırlanmıştır.

---

## 📌 Proje Özeti ve Durum Tablosu

| # | Proje | Alan / Kapsam | Kullanılan Teknolojiler | Geliştirme Dönemi | Durum |
|---|---|---|---|---|---|
| 1 | **[ATLI Medikal POS 6](./pos-sistemi)** | Masaüstü Satış & AI Fatura | React (TS), Python FastAPI, Electron, Gemini AI | Ağustos 2026 | 🟢 `Kararlı (v6.0)` |
| 2 | **[AI Belge & Evrak Otomasyonu](./ai-belge-otomasyonu)** | OCR & Resmi Evrak Üretim Sistemi | Python Flask, Gemini Vision AI, EasyOCR, docx/openpyxl | Mayıs 2026 | 🟢 `Kararlı` |
| 3 | **[VibeBot AI Dublaj](./vibebot-ai-dublaj)** | Video Çeviri & Seslendirme Motoru | Python, yt-dlp, OpenAI Whisper, Edge-TTS, FFmpeg, n8n | Şubat 2026 | 🟢 `Çalışır Durumda` |
| 4 | **[Google Ads Yönetim Araçları](./google-ads-yonetim-araclari)** | Reklam Denetim, Keşif & Analiz | Node.js (Puppeteer), Python, Google Ads GAQL, Telegram | Eylül 2026 | 🟢 `Çalışır Durumda` |
| 5 | **[VocabFlow](./vocabflow-kelime)** | AI Destekli İngilizce Okuma & Kelime | JavaScript (SPA), Gemini 2.5 AI API, Responsive UI | Eylül 2026 | 🟡 `Beta / Aktif` |
| 6 | **[Antigravity Trade Bot](./kripto-trade-bot)** | Kripto Algoritmik Ticaret & Sinyal | Python 3, Pandas, Technical Indicators, Telegram Bot | Ağustos 2026 | 🔵 `Algoritmik Prototip` |
| 7 | **[HabitPulse](./aliskanlik-takip)** | Alışkanlık & Rutin Takip Uygulaması | React 19, Vite, Tailwind CSS, Framer Motion | Eylül 2026 | 🟡 `Ön Yüz / Aktif` |

---

## 🛠️ Projeler Hakkında Detaylar

### 1. 🛒 ATLI Medikal POS 6 (`/pos-sistemi`)
Modern, offline-first masaüstü satış, stok ve yapay zeka destekli fatura işleme sistemi (Electron + React TypeScript + Python FastAPI).
* **Öne Çıkanlar:**
  * **Frontend:** React 18, TypeScript, Tailwind CSS, Vite ile ultra hızlı kullanıcı arayüzü.
  * **Backend:** Python FastAPI mimarisi, SQLite ve Alembic veri tabanı yönetimi.
  * **Yapay Zeka & OCR:** Google Gemini Vision AI ile kamera veya görselden otomatik fatura okuma ve stok eşleme.
  * **Finansal Analiz:** Tedarikçi borç/alacak yönetimi, kâr/zarar ve ciro raporlaması.
* **Hızlı Başlatma:** Klasördeki `baslat.bat` dosyasına çift tıklayın.

---

### 2. 📑 AI Belge & Evrak Otomasyonu (`/ai-belge-otomasyonu`)
Kimlik, adli sicil, diploma ve resmi evrakları yapay zeka destekli OCR ile okuyup, değişken şablonlu Word ve Excel resmi evraklarına hatasız işleyen kurumsal belge yönetim sistemi.
* **Öne Çıkanlar:**
  * **OCR & AI:** EasyOCR ve Google Gemini AI entegrasyonu ile taranmış belgelerden yapılandırılmış veri çıkarımı.
  * **Şablon Motoru:** `python-docx` ve `openpyxl` kullanarak karmaşık resmi matbu evrakları otomatik doldurma.
  * **Arayüz:** Web tabanlı Flask arayüzü ile sürükle-bırak evrak yükleme ve anlık Word/Excel indirme.
* **Hızlı Başlatma:** Klasördeki `baslat.bat` dosyasına çift tıklayın.

---

### 3. 🎙️ VibeBot — AI Video İndirme & Türkçe Dublaj Stüdyosu (`/vibebot-ai-dublaj`)
Yabancı dildeki video içeriklerini saniyeler içinde analiz edip konuşmaları Türkçe nöral sesle dublajlayan çoklu ortam otomasyonu.
* **Öne Çıkanlar:**
  * **İndirme & Ayrıştırma:** `yt-dlp` ve `FFmpeg` ile yüksek hızlı video ve ses akışı ayrıştırma.
  * **Konuşma Tanıma & Çeviri:** `OpenAI Whisper` ile konuşmayı metne dökme ve akıllı çeviri modülü.
  * **Nöral Seslendirme:** `Edge-TTS` (AhmetNeural / EmelNeural) ile doğal Türkçe ses sentezi.
  * **Entegrasyon:** n8n iş akışları ve Telegram botu üzerinden video bağlantısı alıp otomatik dublaj gönderebilme.
* **Hızlı Başlatma:** Klasördeki `baslat.bat` dosyasına çift tıklayın.

---

### 4. 📊 Google Ads AI Denetim & Yönetim Araçları (`/google-ads-yonetim-araclari`)
Google Ads kampanyalarının performansını denetleyen, hesap envanterini çıkaran ve AI destekli analizler üreten yardımcı araçlar ve script paketi.
* **Öne Çıkanlar:**
  * **Tarayıcı & Keşif Ajanı:** Puppeteer tabanlı keşif scripti ile hesap yapısını ve menüleri tarama.
  * **Metrik & Performans Raporlama:** Google Ads API (GAQL) üzerinden 30 günlük harcama, tıklama ve dönüşüm metriklerini çekip Telegram üzerinden günlük karne iletme.
  * **Komut & Analiz Konsolu:** Koyu mod web dashboard üzerinden anomali tespiti ve reklam optimizasyon kontrolleri.
* **Hızlı Başlatma:** Klasördeki `baslat.bat` dosyasına çift tıklayın.

---

### 5. 📚 VocabFlow — Akıllı Kelime & Okuma Uygulaması (`/vocabflow-kelime`)
Google Gemini AI gücüyle İngilizce makale okuma, tek tıkla kelime analizi, fonetik telaffuz ve SRS (Aralıklı Tekrar) ile kelime öğrenme platformu.
* **Öne Çıkanlar:**
  * Çift dilli interaktif okuyucu modu ve anlık çeviri motoru.
  * Gemini LLM API entegrasyonu ile bağlamsal kelime anlamı çıkarma.
* **Hızlı Başlatma:** Klasördeki `baslat.bat` dosyasına çift tıklayın.

---

### 6. 📈 Antigravity AI Radar & Trade Bot (`/kripto-trade-bot`)
Kripto para piyasalarında teknik analiz indikatörleri, makro filtreler ve risk yönetimi kurallarını kullanarak otomatik sinyal üreten algoritmik ticaret botu.
* **Öne Çıkanlar:**
  * RSI, MACD, Bollinger bantları üzerinden çoklu zaman dilimi taraması.
  * Telegram bildirim motoru (anlık alım-satım ve kâr/zarar raporları).
* **Hızlı Başlatma:** Klasördeki `baslat.bat` dosyasına çift tıklayın.

---

### 7. ⚡ HabitPulse — Alışkanlık Takip (`/aliskanlik-takip`)
Kullanıcıların günlük hedeflerini, odaklanma sürelerini ve alışkanlık zincirlerini takip etmelerini sağlayan modern kullanıcı arayüzü.
* **Öne Çıkanlar:**
  * React 19 ve Vite altyapısıyla bileşen mimarisi.
  * Framer Motion ile akıcı mikro etkileşimler ve Pomodoro zamanlayıcısı.
* **Hızlı Başlatma:** Klasördeki `baslat.bat` dosyasına çift tıklayın.

---

## 🔒 Güvenlik ve Gizlilik Notu
Bu depodaki tüm projeler sürüm kontrolüne girmeden önce taranmış; hiçbir özel API anahtarı, ticari veritabanı, gerçek kimlik bilgisi, bakiye bilgisi veya müşteri verisi depoya dahil edilmemiştir. Hassas servisler `.env.example` şablonları üzerinden yapılandırılmaktadır.

---

## 📬 İletişim
* **Geliştirici:** Eren Atlı
* **E-posta:** erenatli008@gmail.com
