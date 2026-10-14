# TRADE BOT - Düzeltme Promptu

> Bu metni doğrudan bir AI ajana (Claude, Cursor, Copilot vb.) prompt olarak verebilirsin. Ajanın tüm projeye (`backend.py`, `scoring_engine.py`, `watcher.py`, `frontend/src/App.jsx`, `frontend/src/main.jsx`, `frontend/src/index.css`, `frontend/package.json`, `.env`) erişimi olduğunu varsayıyor.

---

## ROL VE BAĞLAM

Sen kıdemli bir full-stack geliştiricisin. Aşağıdaki "ANTIGRAVITY AI" trade bot projesi (FastAPI backend + React/Vite frontend + ccxt/Binance) bir denetimden geçti ve **kritik güvenlik açıkları, ölü kod, hayalet bağımlılıklar, frontend ↔ backend veri yolu kopuklukları ve tehlikeli trade mantığı hataları** tespit edildi.

Görev: Aşağıdaki listeyi **öncelik sırasına göre** düzelt. Her madde için: (a) dosyayı oku, (b) tam olarak belirtilen değişikliği uygula, (c) regresyon riski varsa açıkla. Kod stilini koruyarak minimum invaziv yamalar yap. Yorum satırlarını Türkçe tut (mevcut stille uyumlu).

Düzeltme bittiğinde:
- Backend için: `python -m py_compile backend.py scoring_engine.py watcher.py` ile syntax doğrula.
- Frontend için: `cd frontend && npm install && npm run lint && npm run build` ile build doğrula.
- Sonunda her madde için "DÜZELTİLDİ / ATLANDI / KISMEN" şeklinde özet rapor ver.

---

## ÖNCELİK 1 — GÜVENLİK (BUGÜN)

### 1.1 Sızdırılmış API anahtarları
- `.env` dosyası gerçek görünümlü `BINANCE_API_KEY` ve `BINANCE_SECRET_KEY` içeriyor ve OneDrive klasöründe plaintext.
- Yapılacak:
  - Repo köküne (`C:\Users\erena\OneDrive\Masaüstü\TRADE BOT\`) bir `.gitignore` oluştur ve içine en azından şunları ekle: `.env`, `bot_ledger.json`, `bot_state.json`, `__pycache__/`, `*.pyc`, `frontend/node_modules/`, `frontend/dist/`, `scratch/`.
  - Repo köküne bir `.env.example` oluştur; içinde anahtarlar boş olsun:
    ```
    BINANCE_API_KEY=
    BINANCE_SECRET_KEY=
    BINANCE_TESTNET=true
    ```
  - Mevcut `.env`'i SİLME (kullanıcının çalışan kopyası olabilir) ama README'ye "bu anahtarları derhal Binance panelinden iptal et ve yenile" notu ekle.

### 1.2 CORS yanlış konfigüre
- `backend.py` içinde:
  ```python
  app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, ...)
  ```
- `allow_origins=["*"]` ile `allow_credentials=True` kombinasyonu hem güvensiz hem de tarayıcılar tarafından reddediliyor.
- Yapılacak: `allow_credentials=False` yap **veya** origin'i sadece geliştirme için kısıtla:
  ```python
  allow_origins=["http://localhost:5173", "http://localhost:3000"],
  allow_credentials=True,
  ```

### 1.3 Sandbox/Testnet doğrulaması
- `exchange.set_sandbox_mode(True)` çağrılıyor ama anahtarların testnet mi mainnet mi olduğu belirsiz. Mainnet anahtarıyla sandbox modu açık olsa bile bazı çağrılar gerçek hesaba düşebilir.
- Yapılacak: `.env`'e `BINANCE_TESTNET=true` flag'i ekle, `backend.py` başlangıcında log at:
  ```python
  is_testnet = os.getenv("BINANCE_TESTNET", "true").lower() == "true"
  if is_testnet:
      exchange.set_sandbox_mode(True)
      console.print("[bold yellow]⚠ TESTNET MODE ACTIVE[/bold yellow]")
  else:
      console.print("[bold red]⚠⚠⚠ MAINNET / LIVE TRADING ⚠⚠⚠[/bold red]")
  ```

---

## ÖNCELİK 2 — TRADE MANTIĞI (PARA KAYBETTİREBİLİR)

### 2.1 Stop-loss tutarsızlığı (3 farklı gerçek)
Üç ayrı yerde üç ayrı stop değeri var:

- `backend.py` üst kısımda: `TRAILING_STOP_PERCENT = 2.0` (kullanılmıyor!)
- `backend.py` `run_market_radar` içinde: `if drop >= 0.8` (gerçekte etkili olan)
- `frontend/src/App.jsx` sağ panelde sabit metin: `"SABİT %2 RİSK AKTİF"`

Yapılacak:
- `backend.py` içinde `if drop >= 0.8` satırını `if drop >= TRAILING_STOP_PERCENT` ile değiştir.
- Aynı blokta `reason = "ULTRA-STOP" if drop >= 0.8 else "STRENGTH-LOSS"` satırını `if drop >= TRAILING_STOP_PERCENT` ile değiştir.
- `frontend/src/App.jsx` sağ panelde `"SABİT %2 RİSK AKTİF"` yerine dinamik göster: backend `/get-status` cevabına `"trailing_stop_pct": TRAILING_STOP_PERCENT` ekle, frontend `ticker?.trailing_stop_pct` ile yazdır.

### 2.2 EXIT_SCORE_THRESHOLD ölü
- `EXIT_SCORE_THRESHOLD = 40` tanımlı ama hiç okunmuyor. Satış kararı `ai_score < 60` olarak hard-code.
- Yapılacak: `backend.py` içinde `or ai_score < 60` ifadesini `or ai_score < EXIT_SCORE_THRESHOLD` ile değiştir. (40 olmasını mı 60 olmasını mı istediğine kullanıcı karar versin; sabiti tek yerden tut.)

### 2.3 `except: pass` blokları
`backend.py` içinde alım/satım emirlerinin etrafında **çıplak** `except: pass` var:
```python
try:
    exchange.create_market_order(curr_symbol, 'buy', qty)
    ...
except: pass
```
Yapılacak: bunları
```python
except Exception as e:
    add_log(f"ORDER-FAILED: {curr_symbol} BUY error: {e}")
    console.print(f"[bold red]ORDER ERROR: {e}[/bold red]")
```
şeklinde değiştir. **Sessizce yutma yok.** Aynı şey satış bloğu için de geçerli.

### 2.4 Yanlış allocated capital hesabı
`backend.py` `/get-status` içinde:
```python
allocated += (bot_settings["fleet_state"][symbol].get('entry', 0) * v)
```
`v` cüzdandaki bakiye; doğrusu fleet_state içindeki `qty`. Düzelt:
```python
qty_state = bot_settings["fleet_state"][symbol].get('qty', 0)
allocated += bot_settings["fleet_state"][symbol].get('entry', 0) * qty_state
```

### 2.5 `total_val` cüzdanın tamamını yansıtmıyor
`/get-status` içinde sadece `bot_settings["fleet_state"]`'de olan coin'ler `total_val`'a ekleniyor. Bot kapalıyken USDT dışı varlıklar görünmüyor.

Yapılacak:
```python
for k, v in balance['total'].items():
    if v > 0:
        if k == 'USDT':
            total_val += v
        else:
            symbol = f"{k}/USDT"
            if symbol in tickers:
                price = tickers[symbol]['last']
                total_val += v * price  # her durumda ekle
                if symbol in bot_settings["fleet_state"]:
                    qty_state = bot_settings["fleet_state"][symbol].get('qty', 0)
                    allocated += bot_settings["fleet_state"][symbol].get('entry', 0) * qty_state
```

### 2.6 Race condition - radar_data
`radar_data["top_picks"]` `run_market_radar` içinde güncellenirken WS okuyabiliyor.

Yapılacak: bir `asyncio.Lock` ekle:
```python
radar_lock = asyncio.Lock()
# yazma:
async with radar_lock:
    radar_data["top_picks"] = sorted(...)
# okuma (WS endpoint):
async with radar_lock:
    picks_snapshot = list(radar_data["top_picks"][:20])
```

### 2.7 PnL yuvarlamasız büyüyor
`db["total_pnl"] += pnl` floating-point biriktiriyor. Save öncesi yuvarlama yok.
Yapılacak: `db["total_pnl"] = round(db["total_pnl"] + pnl, 2)` yap.

### 2.8 Bot kapatıldığında pozisyonlar açık kalıyor
`/toggle-bot` `active=False` olduğunda mevcut pozisyonlar otomatik kapatılmıyor.
Yapılacak: davranışı netleştir; en azından log at: `add_log(f"BOT-DISENGAGED: {len(fleet_state)} positions remain open")`. Otomatik kapatma istenirse opsiyonel `close_all` parametresi ekle.

---

## ÖNCELİK 3 — KIRIK ÖZELLİKLER

### 3.1 `/backtest` endpoint yok
Frontend `runBacktest` `http://127.0.0.1:5000/backtest/${activeSymbol}` çağırıyor ama backend'de bu endpoint **tanımlı değil** → her zaman 404.

Yapılacak: `backend.py`'a basit bir backtest endpoint'i ekle:
```python
@app.get("/backtest/{symbol}")
async def backtest(symbol: str):
    clean_symbol = symbol.replace("-", "/")
    engine = TechnicalScoringEngine(clean_symbol, exchange=exchange)
    df = await asyncio.to_thread(engine.fetch_data, '1h', 500)
    if df.empty:
        return {"error": "no_data"}
    
    balance = 10000.0
    position = None
    trades = []
    wins = 0
    
    # Çubuk başına basit skor simülasyonu
    for i in range(50, len(df)):
        window = df.iloc[:i+1]
        # ... (engine.calculate_score'u rolling olarak uygula veya basit RSI tabanlı sinyal)
        # Buraya gerçek strateji simülasyonunu yaz
        pass
    
    final_balance = balance
    profit_pct = round((final_balance - 10000) / 100, 2)
    win_rate = round((wins / max(len(trades), 1)) * 100, 2)
    
    return clean_data({
        "final_balance": round(final_balance, 2),
        "profit_pct": profit_pct,
        "win_rate": win_rate,
        "total_trades": len(trades),
        "trades": trades[-50:]  # son 50
    })
```
**Not:** Strateji simülasyonunu `scoring_engine.py`'daki RSI/EMA/MACD/BB mantığıyla tutarlı şekilde uygula. Eğer yapılamazsa frontend'deki "SİMÜLASYON" sekmesini geçici olarak gizle.

### 3.2 `/trade-history/{symbol}` dummy `[]` dönüyor
Frontend "LIVE ORDER LOG" tablosu hiç dolmuyor.
Yapılacak: Tüm gerçekleşen alım/satışları `db` içinde `trade_log` listesine ekle (run_market_radar'daki başarılı emirlerin ardından), endpoint o listeyi döndürsün:
```python
# db içine
db.setdefault("trade_log", [])
# alım sonrası:
db["trade_log"].insert(0, {"time": datetime.now().strftime("%H:%M:%S"), "symbol": curr_symbol, "side": "BUY", "price": price, "qty": qty})
db["trade_log"] = db["trade_log"][:100]
save_db(db)
```
```python
@app.get("/trade-history/{symbol}")
async def get_trade_history(symbol: str):
    clean_symbol = symbol.replace("-", "/")
    return [t for t in db.get("trade_log", []) if t.get("symbol") == clean_symbol][:50]
```
Frontend'de `fetchLiveTrades` ana interval'a da eklenmeli (şu an sadece ilk yüklemede çağrılıyor).

### 3.3 `volatility` UI'da var, backend göndermiyor
`App.jsx`: `{ticker?.volatility?.toFixed(1) || '0.0'} / 100` her zaman 0 görünür.
Yapılacak: WS mesajına volatility ekle. `scoring_engine.py`'a basit bir volatility metriği ekle:
```python
df['returns'] = close.pct_change()
volatility = round(df['returns'].std() * 100 * 10, 1)  # 0-100 ölçeğine
```
ve `metrics` içinde döndür; backend WS bunu `data["volatility"]` olarak yollasın.
**Yapamazsan:** UI'dan volatility kartını kaldır.

### 3.4 WS timestamp parse hatası
Backend gönderiyor: `datetime.now().strftime("%H:%M:%S")` (tek parça).
Frontend bekliyor: `data.timestamp.split(/\s+/)` sonra `timeParts[3]` → her zaman undefined.

Yapılacak: `App.jsx`'te ilgili satırı şununla değiştir:
```javascript
const timeStr = (data.timestamp && typeof data.timestamp === 'string') ? data.timestamp : new Date().toLocaleTimeString();
setHistory(prev => [...prev, { time: timeStr, price: data.last }].slice(-30));
```

### 3.5 `ai_score` ilk yüklemede yok
`/get-status` HTTP cevabında `ai_score` döndürülmüyor; sadece WS'de var. Sayfa açıldığında "DIVERGENCE INDEX" "---" görünür.
Yapılacak: `/get-status` cevabına `ticker?.ai_score` ekle (örnek olarak `BTC/USDT` için varsayılan, ya da `activeSymbol` query param'ıyla iste). Veya frontend'i WS bağlanana kadar "calculating..." göstermesi için güncelle.

### 3.6 `history` symbol değişiminde temizlenmiyor
`App.jsx`'te `activeSymbol` değiştiğinde `history` state eski sembolün noktalarıyla karışıyor.
Yapılacak: `activeSymbol` değişen `useEffect` içinde `setHistory([])` çağır.

### 3.7 `fetchDemoBalance` ölü kod
`demoBalance` state'i set ediliyor ama hiçbir UI bileşeninde kullanılmıyor.
Yapılacak: ya UI'a bir kart ekle ya state ve fetch fonksiyonunu sil.

---

## ÖNCELİK 4 — BAĞIMLILIKLAR & BUILD

### 4.1 `frontend/package.json` hayalet sürümler
Şu sürümler **gerçekte yok** (npm install latest çekiyor olabilir, deterministic değil):

| Paket | Mevcut (hayali) | Gerçek son sürüm (~Nisan 2026 öncesi) |
|---|---|---|
| react | ^19.2.5 | ^19.0.x veya ^18.3.x |
| react-dom | ^19.2.5 | ^19.0.x veya ^18.3.x |
| vite | ^8.0.10 | ^6.x |
| eslint | ^10.2.1 | ^9.x |
| lucide-react | ^1.11.0 | ^0.4xx |
| framer-motion | ^12.38.0 | ^11.x veya yeni adıyla `motion` ^12 |
| recharts | ^3.8.1 | ^2.12.x |
| eslint-plugin-react-hooks | ^7.1.1 | ^5.x |
| globals | ^17.5.0 | ^15.x |
| @vitejs/plugin-react | ^6.0.1 | ^4.x |

Yapılacak:
- `frontend/node_modules`'u sil.
- `package.json`'daki sürümleri **gerçek** ve güncel sürümlerle değiştir. (Web'den son sürümleri doğrula.)
- `npm install` çalıştır, `package-lock.json` üretsin.
- `npm run build` ile build'in geçtiğini doğrula.

### 4.2 Kullanılmayan import'lar
`App.jsx` üstünde lucide-react'ten `Wallet, Settings, LogOut, ShieldCheck, ChevronUp, PieChart as PieChartIcon, Bell, Terminal, Globe` import ediliyor — JSX'te kullanılmıyor. Bundle yükü.
Yapılacak: kullanılmayanları kaldır. (Sadece `Cpu, LayoutDashboard, Zap, TrendingUp, Activity` kullanılıyorsa onları bırak.)

`recharts`'tan `ReferenceLine` import ediliyor ama kullanılmıyor — kaldır.

---

## ÖNCELİK 5 — STİL VE TEMİZLİK

### 5.1 `App.css` ölü dosya
`main.jsx` sadece `index.css` import ediyor; `App.css` hiçbir yerden import edilmiyor ve içeriği Vite template'inden kalıntı (`#docs`, `.hero`, `#next-steps`).
Yapılacak: `frontend/src/App.css`'i sil.

### 5.2 `index.css` muhtemelen eksik
`App.jsx` JSX'te şu class'lar kullanılıyor: `app-container`, `header`, `glass-panel`, `logo-section`, `logo-text`, `status-badge`, `status-dot`, `sidebar`, `nav-item`, `main-content`, `chart-section`, `market-select`, `right-panel`, `ai-gauge`. Ancak `index.css`'te (okunan kısımda) sadece `:root` değişkenleri ve scrollbar var.

Yapılacak: `frontend/src/index.css`'in tamamını oku. Eksikse:
- `app-container`: `display: grid; grid-template-columns: 220px 1fr 360px; grid-template-rows: 70px 1fr; grid-template-areas: "header header header" "sidebar main right"; height: 100vh; gap: 1rem; padding: 1rem;`
- `header`: `grid-area: header; display: flex; justify-content: space-between; align-items: center; padding: 0 1.5rem;`
- `glass-panel`: `background: var(--panel-bg); backdrop-filter: blur(12px); border: 1px solid var(--glass-border); border-radius: 1rem;`
- `sidebar`: `grid-area: sidebar; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;`
- `main-content`: `grid-area: main; overflow-y: auto;`
- `right-panel`: `grid-area: right; overflow-y: auto;`
- `nav-item`: `display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.5rem; cursor: pointer; transition: background 0.2s;`
- `nav-item.active`: `background: var(--accent-glow); color: var(--accent-color);`
- `nav-item:hover`: `background: rgba(255,255,255,0.05);`
- `status-badge`: `display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 700;`
- `status-dot`: `width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px currentColor;`
- `logo-section`: `display: flex; align-items: center; gap: 0.75rem;`
- `logo-text`: `font-size: 1.1rem; font-weight: 950; letter-spacing: 1px;`
- `market-select`: `background: rgba(0,0,0,0.4); color: white; border: 1px solid var(--glass-border); padding: 0.5rem 1rem; border-radius: 0.5rem;`
- `chart-section`: `flex: 1;`
- `ai-gauge`: `min-width: 120px;`

(Mevcut renk paleti `:root`'tan miras alır. Değerleri zevkle ayarla.)

### 5.3 `index.html` başlığı
`<title>frontend</title>` → `<title>ANTIGRAVITY AI - Trade Bot</title>` yap.

### 5.4 Brand sürüm tutarsızlığı
`App.jsx`: `V8.0-QUANT`, `watcher.py`: `v5.0`. Tek bir sürüm sayısında karar ver.

---

## ÖNCELİK 6 — KÜÇÜK İYİLEŞTİRMELER

### 6.1 `last_total_val` yanlış başlatılıyor
`backend.py`:
```python
last_total_val = load_db().get("start_balance", 10000.0)
```
`start_balance` ile `last_total_val` farklı kavramlar. Yapılacak:
```python
last_total_val = 0.0  # ilk /get-status çağrısında doğru hesaplanacak
```

### 6.2 Frontend'da NaN riski
`App.jsx`:
```javascript
(((ticker?.total_val - ticker?.start_bal) / ticker?.start_bal) * 100).toFixed(2)
```
`start_bal` undefined ise NaN. Düzelt:
```javascript
const startBal = ticker?.start_bal || 1;
const growth = (((ticker?.total_val || 0) - (ticker?.start_bal || 0)) / startBal) * 100;
// kullanım: {growth.toFixed(2)}%
```

### 6.3 `useEffect` deps eksik (eslint-react-hooks uyarısı)
`App.jsx`'te status fetch eden `useEffect`'in deps `[activeSymbol]` ama içeride `fetchDemoBalance` ve `fetchLiveTrades` referansları kullanılıyor. Ya bu fonksiyonları `useCallback` ile sarmala ya `// eslint-disable-next-line react-hooks/exhaustive-deps` yorumu ekle (geçici çözüm).

### 6.4 `scratch/` klasörü
`recover_trade.py`, `precision_recover.py`, `deep_recovery.py`, `trade_forensics.py` — geçmiş trade recovery scriptleri. Repoya commit edilmemeli (anahtar/PII içerebilir).
Yapılacak: `.gitignore`'a `scratch/` ekle.

---

## TESLİM KRİTERLERİ

Bittiğinde:

1. `python backend.py` hatasız başlamalı, `/get-status`, `/get-wallet`, `/backtest/BTC-USDT`, `/trade-history/BTC-USDT`, `/toggle-bot` (POST) endpoint'leri 200 dönmeli.
2. `cd frontend && npm install && npm run build` hatasız geçmeli, `dist/` üretilmeli.
3. `npm run lint` 0 hata, ≤5 uyarı.
4. UI açıldığında: Divergence Index ilk 5 saniyede sayı göstermeli, "SİMÜLASYON" butonu çalışan veri döndürmeli, "TOTAL PORTFOLIO" cüzdandaki tüm varlıkları (USDT + altcoin) yansıtmalı, sağ paneldeki stop yüzdesi backend'deki `TRAILING_STOP_PERCENT` ile eşleşmeli.
5. `.env`'in repoya gitmediğini, `.env.example`'ın gittiğini doğrula.
6. Sonunda dosya bazında **tüm değişikliklerin diff özetini** ve hangi maddenin DÜZELTİLDİ/ATLANDI/KISMEN olduğunu raporla.

---

## EKLER — FİZİBİLİTE NOTU

- `EXIT_SCORE_THRESHOLD` 40 mı 60 mı olmalı, kullanıcıya sor (40 daha agresif tutar, 60 daha hızlı çıkar).
- Backtest endpoint'i için strateji simülasyonu kompleks; minimum çalışan versiyon yeterli, mükemmellik şart değil.
- CSS sınıflarını yazarken tasarım sistemi kararlarını tek seferde dokümante et (`index.css` üst yorum bloğu olarak).

