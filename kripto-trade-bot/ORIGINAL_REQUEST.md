# Original User Request

## Initial Request — 2026-09-25T14:53:42Z

Antigravity AI otonom trading botunun kapsamlı teknik teşhis raporu hazırlanacaktır. Bot, XGBoost tabanlı bir ML sinyal filtresi, kural tabanlı skorlama stratejisi, çok katmanlı sinyal doğrulama, ve dinamik risk yönetimi motorlarından oluşmaktadır. ML filtresi 337 etiketli örnekle sürekli öğrenmesine rağmen %51.5 CV AUC (yazı-tura seviyesi) performans göstermektedir. Ayrıca temel stratejinin tüm parametre kombinasyonları negatif PnL üretmektedir. Tüm alt sistemlerin kök neden analizi yapılmalı ve öncelik sıralı bir teşhis raporu üretilmelidir. **Bu bir analiz/audit görevi olup kod düzeltmesi yapılmayacaktır.**

Working directory: c:\users\erena\OneDrive\Masaüstü\Projeler\TradeBot\TRADE BOT
Integrity mode: development

## Requirements

### R1. ML Sinyal Filtresinin Tam Teşhisi
Aşağıdaki dosyaları derinlemesine inceleyerek ML filtresinin neden yazı-tura seviyesinde kaldığını teşhis edin:
- `train_model.py` — model eğitim pipeline'ı
- `ml_backtest.py` — backtest sistemi
- `signal_filter.json`, `signal_filter_meta.json` — kayıtlı model ve meta verisi
- `signal_log.json` — eğitim veri havuzu
- `signal_tracker.py` — sinyal takip ve etiketleme
- `model_report.txt` — mevcut performans raporu

Teşhis edilecek konular: etiketleme mantığı (hedef tanımı), veri sızıntısı (data leakage), feature mühendisliği sorunları, train/test bölme yöntemi, örneklem yanlılığı (survivorship/selection bias), feedback loop / model collapse, feature set tutarsızlıkları, dummy değerler, örneklem yetersizliği.

### R2. Temel Stratejinin (Kural Tabanlı Skorlama) Teşhisi
Aşağıdaki dosyaları inceleyerek skorlama ve sinyal doğrulama katmanlarının etkinliğini değerlendirin:
- `scoring_engine.py` — rejim adaptif skorlama motoru
- `signal_engine.py` — çoklu sinyal doğrulama katmanı
- `indicators.py` — teknik indikatör hesaplamaları
- `optimization_result.json` — grid search sonuçları (tüm kombinasyonlar negatif PnL)
- `coin_scanner.py` — coin tarama ve seçim

Teşhis edilecek konular: negatif beklenti kaynağı, rejim tespitinin doğruluğu, indikatör hesaplama hataları (RSI smoothing vb.), filtre katmanlarının etkinliği, skor eşik değerlerinin kalibrasyonu.

### R3. Risk Yönetimi ve Pozisyon Boyutlandırma Teşhisi
Aşağıdaki dosyaları inceleyerek risk mekanizmalarını değerlendirin:
- `risk_engine.py` — risk motoru
- `trade_executor.py` — emir yürütme
- `radar_loop.py` — ML tabanlı dinamik pozisyon çarpanı (2x) ve eşik mantığı
- `bot_state.json` — canlı pozisyon durumu
- `trade_history.jsonl` — gerçek işlem geçmişi (666 satır)

Teşhis edilecek konular: ML güvenine dayalı pozisyon büyütmenin etkisi, stop-loss / trailing stop parametreleri, tutma sürelerinin dağılımı, gerçek vs beklenen PnL sapması.

### R4. Veri Pipeline ve Altyapı Teşhisi
Aşağıdaki dosyaları inceleyerek veri akışını değerlendirin:
- `radar_loop.py` — ana döngü, thread yapısı, CCXT kullanımı
- `scoring_engine.py` — 4H cache mekanizması ve rate-limit davranışı
- `state_manager.py` — durum yönetimi
- `backend.py` — API backend

Teşhis edilecek konular: CCXT thread-safety ve rate-limit etkileri, 4H verilerinin dummy değerlerle doldurulma sıklığı, veri bütünlüğü, cache TTL'lerin uygunluğu.

### R5. Sorunlar Arası Bağımlılık Haritası ve Öncelik Sıralaması
Tüm tespit edilen sorunları öncelik sırasına göre sıralayın ve aralarındaki bağımlılıkları haritalayın. Hangi sorunun çözülmesi hangi başka sorunları da ortadan kaldırır veya etkisini azaltır? En yüksek kaldıraç etkisi olan düzeltmeler en üstte olsun.

## Acceptance Criteria

### Teşhis Kapsamlılığı
- [ ] ML filtresinin her bir alt bileşeni (etiketleme, feature pipeline, eğitim, doğrulama, çalışma zamanı entegrasyonu) için ayrı ayrı kök neden tespiti yapılmış
- [ ] Temel stratejinin negatif beklentisinin kaynağı somut veriyle desteklenmiş (grid search sonuçlarına referansla)
- [ ] Risk yönetiminde ML güven çarpanının gerçek işlem geçmişindeki etkisi ölçülmüş
- [ ] Veri pipeline sorunları (dummy değer oranı, rate-limit sıklığı) kanıtlarıyla belgelenmiş

### Kanıt Kalitesi
- [ ] Her tespit, ilgili dosya ve satır numarası referansıyla desteklenmeli
- [ ] Performans iddiaları sayısal metriklerle kanıtlanmalı (AUC, accuracy, PnL, örnek sayısı vb.)
- [ ] signal_log.json ve trade_history.jsonl'den somut örnekler gösterilmeli

### Bağımlılık Haritası
- [ ] Tüm sorunlar etkilerine göre "kritik / yüksek / orta / düşük" olarak sınıflandırılmış
- [ ] Sorunlar arası bağımlılıklar açıkça belirtilmiş (X düzeltilmeden Y'yi düzeltmenin etkisi olmaz gibi)
- [ ] En yüksek kaldıraç etkili 3 düzeltme açıkça vurgulanmış
- [ ] Önerilen düzeltme sırası gerekçesiyle sunulmuş

### Doğrulama
- [ ] Rapordaki tüm dosya referansları mevcut dosyalarla eşleşmeli
- [ ] Rapordaki metrikler dosyalardaki gerçek değerlerle tutarlı olmalı
- [ ] Bağımsız bir gözden geçirici, rapordaki bulguları ilgili dosyalara bakarak doğrulayabilmeli
