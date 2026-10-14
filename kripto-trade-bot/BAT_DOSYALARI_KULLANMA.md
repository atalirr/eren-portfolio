# 🖱️ BAT DOSYALARI KULLANMA REHBERI

## 📋 SENİN 3 BAT DOSYAN

```
1. guncelle_YENİ.bat    → Sunucuya kod yükleme & başlatma
2. START_YENİ.bat       → Local'de bot'u başlatma
3. veri_cek_YENİ.bat    → Sunucudan veri indirme
```

---

## 🔧 ADIM 1: HAZIRLIK (Bir kez yap)

### 1.1: Sunucunun IP'sini Bul

**AWS Console → EC2 → Instances**

```
Tabloda "Public IPv4 address" sütununu bul
Örnek: 34.238.12.45
```

### 1.2: Bat Dosyalarını Düzenle

3 dosyanın hepsinde şu satırı değiştir:

```batch
set SERVER_IP=34.238.12.45
        ↑ SENİN IP'Nİ YAZ
```

**Dosyalardaki satırları:**
- Line 8: `guncelle_YENİ.bat`
- Line 11: `veri_cek_YENİ.bat`
- (START_YENİ.bat'ın IP'si yok, local'de çalışıyor)

**Nasıl düzenle:**
```
1. Dosyayı Not Defteri ile aç
2. Ctrl+H (Find & Replace)
3. Bul: 34.238.12.45
4. Yerine Yaz: SENIN IP'N
5. Replace All
6. Kaydet (Ctrl+S)
```

### 1.3: PEM Dosyasını Kontrol Et

Masaüstüne koy:
```
C:\Users\erena\Desktop\tradebot-key.pem
```

(Bat dosyasından ..\ ile üst klasöre bakıyor)

✅ Hazırlandı!

---

## 🚀 ADIM 2: SUNUCUYA KOD YÜKLEME

### Şey 1: guncelle_YENİ.bat'a Çift Tıkla

```
C:\Users\erena\OneDrive\Masaüstü\TRADE BOT\guncelle_YENİ.bat
                                                    ↓
                                            ÇİFT TIKLA
```

### İşlem Otomatik Olur:

```
[ADIM 1/4] SSH bağlantı kontrol
[ADIM 2/4] Python dosyaları yükleniyor (SCP)
[ADIM 3/4] Bağımlılıklar güncelleniyor
[ADIM 4/4] Bot yeniden başlatılıyor
```

### Beklenen Sonuç:

```
✅ GÜNCELLEME BAŞARILI!

SUNUCU BİLGİLERİ:
• IP:       34.238.12.45
• Klasör:   /home/ubuntu/trade-bot
• Service:  trade-bot
• Port:     8000
```

### ❌ Sorun Olursa:

```
HATA: PEM dosyası bulunamadı!
→ Masaüstüne tradebot-key.pem koy

HATA: Dosyalar yüklenemedi!
→ IP doğru mu?
→ PEM dosyası adı doğru mu?
→ Sunucu çalışıyor mu?
```

✅ **Başarılıysa, sunucuda güncellenmiş kod çalışıyor!**

---

## 💻 ADIM 3: LOCAL'DE BOT'U BAŞLATMA

### Şey 1: START_YENİ.bat'a Çift Tıkla

```
C:\Users\erena\OneDrive\Masaüstü\TRADE BOT\START_YENİ.bat
                                                  ↓
                                          ÇİFT TIKLA
```

### İşlem Otomatik Olur:

```
[1/3] Eski Python süreçleri temizleniyor
[2/3] Backend başlatılıyor (Port: 8000)
[3/3] Frontend başlatılıyor (Port: 5173)
```

### 2 Komut Pencereleri Açılır:

```
Pencere 1: "ANTIGRAVITY BACKEND"  (port 8000)
Pencere 2: "ANTIGRAVITY FRONTEND" (port 5173)
```

### Browser Açılır:

```
http://localhost:5173
↓
Dashboard görmek istiyorsun
```

### ❌ Çalışmazsa:

```
Pencereler kapanıyor?
→ Dosyalara bak, Python path doğru mu?
→ Python 3.12 kurulu mu?
→ Virtual environment varsa activate et

Port 8000 zaten kullanılıyor?
→ Komutu çalıştır: netstat -ano | findstr :8000
→ Kill et: taskkill /PID xxxx /F
```

✅ **Başarılıysa, local'de bot çalışıyor!**

---

## 📥 ADIM 4: SUNUCUDAN VERİ İNDİRME

### Şey 1: veri_cek_YENİ.bat'a Çift Tıkla

```
C:\Users\erena\OneDrive\Masaüstü\TRADE BOT\veri_cek_YENİ.bat
                                                    ↓
                                            ÇİFT TIKLA
```

### İşlem Otomatik Olur:

```
[1/2] Sunucu bağlantısı kontrol
[2/2] Dosyalar indiriliyor (SCP)
```

### İndirilen Dosyalar:

```
✅ bot_state.json       (Bot durum)
✅ bot_ledger.json      (İşlem defterleri)
✅ fleet_state.json     (Pozisyon durumu)
✅ trade_log.json       (İşlem geçmişi)
✅ signal_log.json      (Sinyal geçmişi)
✅ backtest_results.json (Backtest sonuçları)
```

### Nereye İndirilir?

```
C:\Users\erena\OneDrive\Masaüstü\TRADE BOT\
```

✅ **Başarılıysa, sunucudaki veriler local'de!**

---

## 📊 KONTROL LİSTESİ

### ✅ Hazırlama
```
☐ AWS'den IP aldım
☐ Bat dosyalarında IP güncelledim
☐ PEM dosyası Masaüstünde var
☐ PEM dosyası adı doğru (tradebot-key.pem)
```

### ✅ Sunucuya Yükleme
```
☐ guncelle_YENİ.bat çalıştırdım
☐ ✅ GÜNCELLEME BAŞARILI mesajı gördüm
☐ Bot sunucuda çalışıyor (status: active)
☐ Telegram'dan /status komut geliyor
```

### ✅ Local Başlatış
```
☐ START_YENİ.bat çalıştırdım
☐ 2 komut penceresi açıldı
☐ Browser http://localhost:5173 açıldı
☐ Dashboard görüyorum
```

### ✅ Veri İndirme
```
☐ veri_cek_YENİ.bat çalıştırdım
☐ JSON dosyaları indirildı
☐ Klasörde bot_state.json var
```

---

## 🎯 NORMAL KULLANIM

### Sunucuda Kod Güncellemek (Her Gün):

```
1. Kodu lokal'de değiştir
2. guncelle_YENİ.bat'a çift tıkla
3. Sunucuda güncellenmiş kod çalışıyor!

Bitti! 30 saniye!
```

### Local'de Test Etmek:

```
1. START_YENİ.bat'a çift tıkla
2. http://localhost:5173'de çalışıyor
3. Değişiklikleri gör
4. Pencereleri kapat (Ctrl+C)

Bitti! 1 dakika!
```

### Sunucudaki Veriyi Kontrol Etmek:

```
1. veri_cek_YENİ.bat'a çift tıkla
2. JSON dosyaları yerel'de
3. Excel, Not Defteri'nde aç
4. İstatistikleri gör

Bitti! 30 saniye!
```

---

## 🔗 İLAVE KOMUTLAR (Terminal'de)

Eğer bat'lar çalışmazsa, terminal'de manuel çalıştır:

### SSH ile Sunucuya Bağlan:
```bash
ssh -i C:\Users\erena\Desktop\tradebot-key.pem ubuntu@34.238.12.45
```

### Bot Durumunu Kontrol Et:
```bash
sudo systemctl status trade-bot
```

### Log'u İzle:
```bash
sudo journalctl -u trade-bot -f
```

### Bot'u Durdur:
```bash
sudo systemctl stop trade-bot
```

### Bot'u Başlat:
```bash
sudo systemctl start trade-bot
```

---

## 💡 PRO TIPS

### Tip 1: Batch İçinde Hata Varsa
```batch
Dosyayı Not Defteri ile aç
Düz metin olarak kaydet (ANSI, UTF-8 değil)
Türkçe karakter varsa dikkat et
```

### Tip 2: SSH Timeout
```batch
Bat dosyasında timeout 10 olarak artır
set SSH_TIMEOUT=10
```

### Tip 3: Hızlandırmak İçin
```batch
Dosyalardaki echo komutlarını sil (hızlılaşır)
veya
echo.>nul ile yap (sessiz olur)
```

### Tip 4: Yeni Dosya Eklersem
```batch
guncelle_YENİ.bat'a satır ekle:
scp -i "%PEM_FILE%" -q yeni_dosya.py %SSH_USER%@%SERVER_IP%:%SERVER_PATH%/ 2>nul
```

---

## 🎯 ÖZET

| İşlem | Dosya | Zaman | Sıklık |
|-------|-------|-------|--------|
| Kod yükle + başlat | guncelle_YENİ.bat | 1 dakika | Her değişiklik sonrası |
| Local test | START_YENİ.bat | 10 saniye | Yeni feature test etme |
| Veri indir | veri_cek_YENİ.bat | 30 saniye | İstatistik kontrol |

---

## ✨ BAŞARILI OLDUĞUN ZAMAN

```
SUNUCU:
✅ Bot çalışıyor (trade-bot service)
✅ API çalışıyor (port 8000)
✅ Telegram komutları geliyor

LOCAL:
✅ Dashboard açılıyor (port 5173)
✅ Real-time veriler geliyor
✅ WebSocket bağlı

VERİ:
✅ JSON dosyaları indirildi
✅ İstatistikler görülüyor
✅ PnL hesaplanıyor
```

---

**HER ŞEY HAZIR! KULLAN!** 🚀

---

*Son Güncelleme: 2026-05-21*
