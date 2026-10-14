# Original User Request

## 2026-09-05T14:01:29Z

Kelime Defterim mobil web uygulamasına gerçek, telifsiz ve niş magazinel içeriklerden beslenen, interaktif kelime öğrenme araçlarıyla donatılmış ve siber tehditlere (XSS, DOM enjeksiyonu) karşı tam korumalı modern bir "Makale / Okuma (Reading Comprehension)" modülünün geliştirilmesi.

Working directory: c:\Users\erena\OneDrive\Masaüstü\Projeler\kelime-uygulamasi
Integrity mode: development

## Requirements

### R1. Makale & Magazin Okuma Modülü
- Uygulamanın alt navigasyonuna (Bottom Tab Bar) 5. sekme olarak "Makaleler" (Article Reader) ekranı entegre edilmelidir.
- Seçilebilir ilgi çekici niş/magazin kategorileri (Popüler Bilim, Sinema & Kültür, İlginç Hikayeler, Teknoloji, Doğa & Gezi) sunulmalıdır.
- Gerçek ve telifsiz kaynaklardan derlenmiş veya güvenli açık kaynak içeriklerden beslenen, dil seviyesi (A2-C1) ve tahmini okuma süresi (WPM) belirtilmiş makaleler listelenmeli ve okunabilmelidir.

### R2. İnteraktif Okuma & Kelime Defteri Entegrasyonu
- Makale metnindeki herhangi bir kelimeye tıklandığında veya dokunulduğunda, kelimenin Türkçe karşılığını, telaffuzunu (TTS) ve "Kelime Defterime Ekle" butonunu içeren interaktif bir sözlük bilgi kartı açılmalıdır.
- Eklenen kelimeler doğrudan uygulamanın ana kelime kütüphanesine (`appState.words`) dahil edilmeli ve mevcut test/istatistik ekranlarıyla anında senkronize olmalıdır.
- Okuma deneyimi için kişiselleştirilebilir görünüm araçları (Font boyutu büyütme/küçültme, Serif / Sans-serif font tercihi, Aydınlık / Gece / Sepia okuma temaları) bulunmalıdır.
- Makale sonunda metni pekiştiren 2-3 soruluk çoktan seçmeli okuduğunu anlama (Comprehension Quiz) mini testi yer almalıdır.

### R3. Siber Güvenlik Savunması & Veri Güvenliği
- Harici kaynaklardan veya dinamik içerikten gelen makale metinleri DOM'a basılmadan önce katı bir HTML sanitization (DOMPurify veya güvenli DOM parser) süzgecinden geçirilmeli; XSS saldırıları (`<script>`, `onerror`, `onload`, `javascript:` URI'leri) engellenmelidir.
- Mevcut `index.html` dosyasındaki inline string birleştirme ve `innerHTML` kullanımları güvenlik denetiminden geçirilmeli; güvenli DOM manipülasyonu yöntemlerine (`textContent`, `createElement` veya sanitize edilmiş güvenli fragment'lar) dönüştürülmelidir.
- Content Security Policy (CSP) standartlarına uygun yapı kurulmalı; yetkisiz harici kaynaklardan komut dosyası çalıştırılması veya veri sızdırılması (exfiltration) engellenmelidir.

### R4. Tasarım & UI/UX Bütünlüğü
- Mevcut iPhone 17 dikey mockup arayüzü, Tailwind CSS tasarım sistemi, yumuşak cam (glassmorphism) efektleri ve koyu/açık tema geçişiyle tam görsel uyum sağlanmalıdır.
- Mobilde pürüzsüz kaydırma (smooth scroll), okunabilirlik odaklı satır aralıkları ve dokunmatik ekran optimizasyonu sağlanmalıdır.

## Acceptance Criteria

### Fonksiyonel Doğrulama
- [ ] Alt sekmede "Makaleler" sekmesi tıklanabilir olmalı, seçilen kategoriye göre makale listesini ve detay okuyucusunu sorunsuz açabilmelidir.
- [ ] Makale metni içindeki herhangi bir kelime tıklandığında sözlük modalı açılmalı ve "Kelime Defterime Ekle" tıklandığında kelime ana listeye (`appState.words`) başarıyla eklenmelidir.
- [ ] Okuma ayarlarında font boyutu, Serif/Sans yazı tipi ve Sepia/Gece/Gündüz temaları değiştirildiğinde makale görünümü anında güncellenmelidir.
- [ ] Makale sonu kavrama testinde (Quiz) seçenek seçildiğinde doğru/yanlış geribildirimi ve başarı puanı görüntülenmelidir.

### Güvenlik Doğrulaması (Security Testing)
- [ ] XSS Enjeksiyon Testi: Makale içeriğine veya parametrelerine enjekte edilen `<script>alert('XSS')</script>`, `<img src=x onerror=alert(1)>`, `<svg onload=alert(1)>` ve `javascript:alert(1)` içeren kötü niyetli payload'ların hiçbiri çalıştırılmamalı, script'ler nötralize edilmeli veya temizlenmelidir.
- [ ] DOM Clobbering & Injection Testi: Inline event handler veya güvensiz `innerHTML` üzerinden kod yürütülmediği doğrulanmalıdır.
- [ ] Güvenlik başlığı ve CSP uyumluluğu kontrol edilmelidir.

## 2026-09-05T16:14:04Z

This is a single self-contained fix; keep it small and focused.

Uygulamanın genel görsel kimliğini ve temasını sevilen orijinal **VocabFlow** markasına ve canlı turuncu (Orange/Amber) renk paletine dönüştürürken, geliştirilen siber güvenlik altyapısını ve yeni makale okuma modülünü kusursuz şekilde korumak.

Working directory: c:\Users\erena\OneDrive\Masaüstü\Projeler\kelime-uygulamasi
Integrity mode: development

## Requirements

### R1. VocabFlow Marka & İsim Restorasyonu
- Uygulama başlığı (`<title>`), üst bar logosu ve karşılama metinleri "Kelime Defterim" yerine orijinal **"VocabFlow"** olarak güncellenmelidir.
- Profil avatarı / logo rozetinde VocabFlow kimliğine uygun şık tipografi ve simgeler kullanılmalıdır.

### R2. Canlı Turuncu & Amber (Orange) Tema Dönüşümü
- Mevcut soğuk lacivert/mor (indigo/violet) renk şeması, VocabFlow'un enerjik ve sıcak turuncu paletine (`#ea580c`, `#f97316`, `#fb923c`, `amber-500`) dönüştürülmelidir.
- Arka plan ambiyans parlamaları (aura glow), ilerleme çemberi, aktif navigasyon butonları, birincil eylem butonları (`+ Ekle`, `Çalışmaya Başla`, `Makaleyi Oku`) ve kart vurguları turuncu tasarım diliyle uyumlu hale getirilmelidir.

### R3. Doğrudan Ana Sayfa (Dashboard) Açılışı
- Sayfa yüklendiğinde kullanıcıyı engelleyen tanıtım (onboarding) zorunluluğu kaldırılarak, uygulama doğrudan **Ana Sayfa (`switchTab('home')`)** ve görünür alt menü (`bottomTabBar`) ile açılmalıdır.

### R4. Siber Güvenlik & Yeni Makale Modülünün Korunması
- CSP başlığı, DOMPurify SRI entegrasyonu, güvenli DOM metotları (`replaceChildren`, `createElement`) ve TreeWalker kelime ayrıştırma altyapısı eksiksiz korunmalıdır.
- 5. sekmedeki "Makaleler" okuma modülü, sözlük modalı ve okuduğunu anlama testi turuncu VocabFlow temasıyla kusursuz bütünleşmelidir.

## Acceptance Criteria

### Görsel & Marka Doğrulama
- [ ] Uygulama başlığında ve arayüzde "VocabFlow" ismi görüntülenmelidir.
- [ ] Birincil butonlar, aktif sekme vurgusu ve günlük hedef çemberi turuncu (`orange`/`amber`) tonlarında render edilmelidir.
- [ ] Sayfa ilk açıldığında doğrudan Ana Sayfa (`screenHome`) ve alt navigasyon çubuğu aktif olmalıdır.

### Güvenlik & Fonksiyonel Bütünlük
- [ ] Tüm otomatik testler (`test_m1_security`, `test_m2_navigation_articles`, `test_m3_interactive_reader`, `test_m3_challenger_stress`) hatasız geçmelidir.
- [ ] Sıfır güvensiz `innerHTML` kuralı korunmalıdır.
