# 🚨 TRADE BOT PERFORMANS ANALİZİ & ÇÖZÜM RAPORU

**Analiz Tarihi:** 21 Mayıs 2026  
**Bot Durumu:** ❌ **BAŞARISIZ - Acil Düzeltmeler Gerekli**  
**Cüzdan Durumu:** -$500.58 (negatif PnL)

---

## 1️⃣ TEMEL SORUN: TRAILING STOP ZARARI

### Bulunan Veri
```
Çıkış Analizi (backtest_notes.md):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORE-DROP:     1010 işlem → +$151.95  (✓ KÂR)
TAKE-PROFIT:      23 işlem → +$105.06  (✓ ÇOOK KÂR!)
TRAILING-STOP:   171 işlem → -$503.19  (✗ ZARAR!!!)
```

### Sorun Nedir?
- **Trailing stop (-$503.19)** tek başına bot'u negative çekiyor
- Score-drop + take-profit çıkışları kârlı ama trailing stop onu mahvediyor
- Trailing stop fiyat düşerken **çok geç** devreye giriyor
- Rebound sırasında **fazla alan bırakıyor** ve tekrar zarar ediyor

### Çözüm
**Trailing stop'u KALDIRıN veya ATR-based yapın:**
```python
# ❌ ŞİMDİKİ (zararlı)
if drop >= 0.8:  # hard-coded, çok geç
    sell_at_market()

# ✅ YENİ (ATR-based)
atr_stop = entry_price - (2.0 * atr)  # dinamik
if current_price <= atr_stop:
    sell_at_market()
```

**Kısa vadede:** Trailing stop'u tamamen devre dışı bırakın:
```python
# backend.py :: run_market_radar() içinde
# Satırı bul: if drop >= 0.8 then ...
# Bunu yorum yapın: # if drop >= 0.8:
```

---

## 2️⃣ PIYASA REJİMİ UYUŞMAMASI

### Bulunan Veri
```
Rejim Dağılımı (son 1 yıl):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRENDING_DOWN:  83.4%  ⬇️ (çoğunluk)
CHOPPY:         14.6%  〰️
TRENDING_UP:     1.6%  ⬆️ (neredeyse hiç!)
```

### Sorun Nedir?
Bot **TRENDING_UP için optimize edilmiş** ama piyasa çoğunlukla **TRENDING_DOWN**:
- `buy_thresh=90` (çok yüksek → az al)
- `reversal_threshold=0.5` (reversal sıklığı az)
- Downtrend pozisyonları açarken korunmasız kalıyor

### Çözüm
1. **TRENDING_DOWN stratejisi oluşturun:**
   ```python
   # scoring_engine.py içinde
   if regime == "TRENDING_DOWN":
       # Short satış veya cash'de kal
       return {"signal": "HOLD", "reason": "downtrend_protection"}
   ```

2. **Win rate'i maksimize edin:**
   ```
   Eski (Sabit): %35.3 WR
   Yeni (Rejim): %48.5 WR  ← İyi, ama trailing stop bunu iptal ediyor
   ```

---

## 3️⃣ GÜVENLIK VE BUG'LAR

### A. Plaintext API Anahtarları ⚠️ KRITIK
```
.env dosyası OneDrive'da plaintext API anahtarları içeriyor:
- BINANCE_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5
- BINANCE_SECRET_KEY=x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5
```

**Yapılacak:**
- `.env.example` oluşturun (boş)
- `.gitignore`'a `.env` ekleyin
- Binance panelinden şu anahtarları **iptal edin** ve yenilerini üretin

### B. CORS Yanlış
```python
# ❌ WRONG - çelişkili
app.add_middleware(CORSMiddleware, 
    allow_origins=["*"], 
    allow_credentials=True,  # ← Tarayıcılar reddediyor
)
```

**Düzelti:**
```python
# ✅ RIGHT
app.add_middleware(CORSMiddleware, 
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=False,
)
```

### C. Silent Except Blokları
```python
# ❌ WRONG - hata yok olup gidiyor
try:
    exchange.create_market_order(symbol, 'buy', qty)
except:
    pass  # ← Ne hatası olduğunu bilmiyorsunuz!
```

**Düzelti:**
```python
# ✅ RIGHT
try:
    exchange.create_market_order(symbol, 'buy', qty)
except Exception as e:
    console.print(f"[bold red]ORDER FAILED {symbol}: {e}[/bold red]")
    add_log(f"ORDER_ERROR: {symbol} - {str(e)}")
```

---

## 4️⃣ TRADE MANTIGI TUTUŞMAMASI

### A. Hard-coded Eşikler
```python
# ❌ Üç ayrı yerde üç ayrı değer:
# 1. backend.py üst: TRAILING_STOP_PERCENT = 2.0 (KULLANILMIYOR!)
# 2. backend.py run_market_radar: if drop >= 0.8
# 3. frontend/App.jsx: "SABİT %2 RİSK AKTİF"

# ✅ Tek kaynaktan kontrol edin:
TRAILING_STOP_PERCENT = 2.0  # backend.py config
```

### B. EXIT_SCORE_THRESHOLD Ölü
```python
# ❌ Tanımlı ama kullanılmıyor:
EXIT_SCORE_THRESHOLD = 40

# ✅ Bunu kullanın:
if ai_score < EXIT_SCORE_THRESHOLD:
    sell_at_market(reason="SCORE_BELOW_THRESHOLD")
```

### C. Allocated Capital Hesabı Yanlış
```python
# ❌ WRONG
allocated += (bot_settings["fleet_state"][symbol].get('entry', 0) * v)
# v = cüzdandaki bakiye, ama fleet_state'deki qty'yi kullanmalı

# ✅ RIGHT
qty_state = bot_settings["fleet_state"][symbol].get('qty', 0)
allocated += bot_settings["fleet_state"][symbol].get('entry', 0) * qty_state
```

---

## 5️⃣ BROKEN FEATURES

| Feature | Status | Sorun |
|---------|--------|-------|
| `/backtest/{symbol}` | ❌ Yok | Frontend 404 alıyor |
| `/trade-history/{symbol}` | ⚠️ Dummy | Her zaman `[]` döneryor |
| AI_SCORE (ilk yükleme) | ⚠️ Geç | Sadece WebSocket'te var, HTTP'de yok |
| Volatility göstergesi | ⚠️ Yok | Backend göndermiyor |
| WebSocket timestamp | ⚠️ Parse hatası | Frontend `data.timestamp.split(/\s+/)` bekliyor |

---

## 6️⃣ UYGULANACAK ÇÖZÜMLER (SIRASINA GÖRE)

### 1️⃣ ACIL (Bu Haftaiçi)
```
1. Trailing stop'u devre dışı bırakın
   - backend.py satır ~2100: # if drop >= 0.8: (yorum yapın)
   
2. API anahtarlarını değiştirin (Binance'de)
   - Mevcut anahtarları iptal edin
   - Yenilerini .env dosyasına yazın
   
3. CORS'u düzeltin
   - allow_credentials=False yap
   
4. Silent except'leri düzeltin
   - Tüm order blokları try-except-log olsun
```

### 2️⃣ ÖNEMLI (Sonraki 2 gün)
```
5. Trending-down rejimi ekleyin
   - TRENDING_DOWN sırasında buy kısıtlaması
   - Short satış veya cash hold
   
6. Hard-coded eşikleri birleştirin
   - EXIT_SCORE_THRESHOLD = 60 (veya 40?)
   - TRAILING_STOP_PERCENT ile sync et
   
7. Backtest endpoint ekleyin
   - /backtest/{symbol} fonksiyonel hale getirin
   
8. Trade history'yi doldurun
   - Her buy/sell trade_log'a ekleyin
```

### 3️⃣ NORMAL (Sonraki 1 hafta)
```
9. Allocated capital hesabını düzeltin
10. Race condition (radar_lock) ekleyin
11. Frontend bileşenleri temizleyin (unused imports)
12. .env örneğini git'e ekleyin
```

---

## 7️⃣ HIZLI TEST CHECKLIST

Bot'u düzeltmeden sonra:

```bash
# Backend test
python -m py_compile backend.py scoring_engine.py  ✓

# Endpoints test
curl http://localhost:5000/get-status  ✓ (portfolio değerleri doğru mu?)
curl http://localhost:5000/get-wallet   ✓ (USDT + altcoin bakiyeleri)
curl http://localhost:5000/backtest/BTC-USDT  ✓ (404 değil mi?)

# Frontend test
cd frontend && npm install && npm run build  ✓

# UI test
- Sayfa açıldığında Divergence Index sayı gösteriyor mu?
- Trailing stop % sağ panelde doğru görünüyor mu?
- "SİMÜLASYON" butonu veri dönüyor mu?
```

---

## 8️⃣ TARAF NOTLARI

### Win Rate İstatistikleri
```
Old Fixed:  35.3% WR → 677 trades → -$215.50 PnL
New Regime: 48.5% WR → 1204 trades → -$245.99 PnL

↑ Win rate %13 arttı (iyi)
↑ Trade sayısı %78 arttı (fazla)
↓ Ama trailing stop zarar arttırdı (kötü)

SONUÇ: Rejim sistemi prometli ama trailing stop
       onu mahvediyor. Trailing stop kaldırılırsa
       potansiyel kâr: +$151.95 + $105.06 = +$257 olur
```

### Risk Puanı
```
TRAILING STOP zarar: -$503.19 → KRITIK
KORUMA EKSIKLIKLERI → BİLINMEYEN RISK
API KEY LEAKED → ÇOK YÜKSEK RİSK
DOWNTREND KORUMASI YOK → YÜKSEK RİSK
```

---

## 📋 ÖZET

**Bot neden başarısız:**
1. ❌ Trailing stop zarar ediyor (-$503.19)
2. ❌ Piyasa TRENDING_DOWN ama bot TRENDING_UP optimize
3. ❌ API anahtarları plaintext (güvenlik riski)
4. ❌ Hard-coded eşikler (kontrol imkansız)
5. ❌ Broken endpoints (backtest yok, history dummy)

**Çözüm başladığında:**
1. ✅ Trailing stop'u kaldırın (hemen)
2. ✅ Trending-down logic ekleyin
3. ✅ Hard-coded değerleri birleştirin
4. ✅ Endpoints'i düzeltin
5. ✅ Güvenlik açıklarını kapatın

**Beklenen sonuç** (yapılırsa):
- Win Rate: %48.5 (zaten iyiye gitti)
- PnL: -$245.99 → **+$257** tahmini (trailing stop kaldırınca)
- Güvenlik: Açık kalkan

