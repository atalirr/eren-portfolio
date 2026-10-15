# Finansal Analitik API Dokümantasyonu

## Genel Bakış

Bu API, POS uygulaması için **eyleme dönüştürülebilir finansal içgörüler** sağlar. Vanity metrics (sadece ham gelir) yerine, gerçek karlılık, akıllı gider analizi ve gelişmiş trend projeksiyonları sunar.

---

## Modül 1: Gerçek Karlılık (Net Profitability)

### Endpoint
```
GET /api/finance/net-profitability
```

### Query Parameters
- `start_date` (optional): Başlangıç tarihi (YYYY-MM-DD)
- `end_date` (optional): Bitiş tarihi (YYYY-MM-DD)
- `days` (default: 30): Son N gün (start_date ve end_date verilmezse kullanılır)

### Örnek Request
```
GET /api/finance/net-profitability?days=30
```

### Örnek Response
```json
{
  "period": {
    "start": "2026-01-01T00:00:00",
    "end": "2026-01-30T23:59:59"
  },
  "revenue": 150000.00,
  "cost_of_goods_sold": 120000.00,
  "gross_profit": 30000.00,
  "gross_margin_percent": 20.00,
  "operational_expenses": 15000.00,
  "net_profit": 15000.00,
  "net_margin_percent": 10.00,
  "warning": "⚠️ Düşük Kar Marjı: Brüt kar marjınız %20.0. Bu, maliyetlerinizin çok yüksek olduğunu gösteriyor. Ürün fiyatlandırmasını veya maliyet yönetimini gözden geçirin."
}
```

### Açıklama
- **revenue**: Toplam ciro (tamamlanmış siparişlerin final_amount toplamı)
- **cost_of_goods_sold**: Satılan malın maliyeti (OrderItem'dan unit_buy_price * quantity)
- **gross_profit**: Brüt kar (Ciro - COGS)
- **gross_margin_percent**: Brüt kar marjı % (Gross Profit / Revenue * 100)
- **operational_expenses**: Operasyonel giderler (Transaction tablosundan EXPENSE'ler)
- **net_profit**: Net kar (Gross Profit - OpEx)
- **net_margin_percent**: Net kar marjı %
- **warning**: Eğer brüt kar marjı %20'den düşükse uyarı mesajı

---

## Modül 2: Akıllı Gider Analizi (Expense Breakdown)

### Endpoint
```
GET /api/finance/expense-breakdown
```

### Query Parameters
- `start_date` (optional): Başlangıç tarihi (YYYY-MM-DD)
- `end_date` (optional): Bitiş tarihi (YYYY-MM-DD)
- `days` (default: 30): Son N gün

### Örnek Request
```
GET /api/finance/expense-breakdown?days=30
```

### Örnek Response
```json
{
  "period": {
    "start": "2026-01-01T00:00:00",
    "end": "2026-01-30T23:59:59"
  },
  "total_revenue": 150000.00,
  "total_expenses": 20000.00,
  "expense_to_revenue_ratio": 13.33,
  "categories": [
    {
      "category": "Kira",
      "amount": 5000.00,
      "percentage_of_revenue": 3.33,
      "percentage_of_total_expenses": 25.00,
      "is_anomaly": true,
      "anomaly_reason": "Bu gider kalemi, son 3 ayın ortalamasından %25.5 daha yüksek. Olağandışı bir artış var."
    },
    {
      "category": "Personel",
      "amount": 8000.00,
      "percentage_of_revenue": 5.33,
      "percentage_of_total_expenses": 40.00,
      "is_anomaly": false,
      "anomaly_reason": null
    },
    {
      "category": "Pazarlama",
      "amount": 3000.00,
      "percentage_of_revenue": 2.00,
      "percentage_of_total_expenses": 15.00,
      "is_anomaly": false,
      "anomaly_reason": null
    },
    {
      "category": "Tedarik",
      "amount": 4000.00,
      "percentage_of_revenue": 2.67,
      "percentage_of_total_expenses": 20.00,
      "is_anomaly": false,
      "anomaly_reason": null
    }
  ]
}
```

### Açıklama
- **total_revenue**: Toplam ciro
- **total_expenses**: Toplam giderler
- **expense_to_revenue_ratio**: Gider/Ciro oranı %
- **categories**: Gider kategorileri (en yüksekten en düşüğe sıralı)
  - **is_anomaly**: Son 3 ayın ortalamasından %20 fazlaysa `true`
  - **anomaly_reason**: Anomali varsa açıklama mesajı

---

## Modül 3: Gelişmiş Trend ve Projeksiyon (Advanced Projection)

### Endpoint
```
GET /api/finance/advanced-projection
```

### Query Parameters
- `target_month` (optional): Hedef ay (1-12). None ise mevcut ay.
- `target_year` (optional): Hedef yıl. None ise mevcut yıl.

### Örnek Request
```
GET /api/finance/advanced-projection?target_month=1&target_year=2026
```

### Örnek Response
```json
{
  "target_period": {
    "month": 1,
    "year": 2026
  },
  "pace_analysis": {
    "current_time": "14:30",
    "current_cumulative_revenue": 5000.00,
    "last_month_same_day_cumulative": 4500.00,
    "last_week_same_day_cumulative": 4800.00,
    "pace_vs_last_month_percent": 11.11,
    "pace_vs_last_week_percent": 4.17,
    "status": "ahead"
  },
  "month_end_projection": {
    "current_revenue": 120000.00,
    "days_completed": 15,
    "days_remaining": 16,
    "last_7_days_avg": 8500.00,
    "weighted_avg": 8500.00,
    "projected_revenue": 256000.00,
    "confidence": "high"
  },
  "seasonality": {
    "weekend_multiplier": 1.35,
    "weekday_avg": 5000.00,
    "weekend_avg": 6750.00
  }
}
```

### Açıklama

#### Pace Analysis
- **current_time**: Şu anki saat (HH:MM formatında)
- **current_cumulative_revenue**: Bugünün şu anki saatine kadar olan kümülatif ciro
- **last_month_same_day_cumulative**: Geçen ayın aynı hafta günlerinin (örn: tüm Salı günleri) bugünkü saatine kadar olan kümülatif cirosu
- **last_week_same_day_cumulative**: Geçen haftanın aynı gününün bugünkü saatine kadar olan kümülatif cirosu
- **pace_vs_last_month_percent**: Geçen aya göre pace farkı % (pozitif = daha hızlı, negatif = daha yavaş)
- **pace_vs_last_week_percent**: Geçen haftaya göre pace farkı %
- **status**: `"ahead"` (önünde), `"behind"` (geride), `"on_track"` (yolunda)

#### Month End Projection
- **current_revenue**: Mevcut ayın şu ana kadar olan cirosu
- **days_completed**: Tamamlanan gün sayısı
- **days_remaining**: Kalan gün sayısı
- **last_7_days_avg**: Son 7 günlük ağırlıklı ortalama (son günler daha yüksek ağırlık)
- **weighted_avg**: Ağırlıklı ortalama
- **projected_revenue**: Tahmini toplam ciro = `current_revenue + (days_remaining * weighted_avg)`
- **confidence**: `"high"` (ayın yarısı geçmişse), `"medium"` (7+ gün geçmişse), `"low"` (daha az)

#### Seasonality
- **weekend_multiplier**: Hafta sonu çarpanı (hafta sonu ortalama / hafta içi ortalama)
- **weekday_avg**: Hafta içi günlük ortalama ciro
- **weekend_avg**: Hafta sonu günlük ortalama ciro

---

## Backend Implementasyon Detayları

### Kullanılan Teknolojiler
- **SQLAlchemy ORM**: Veritabanı sorguları
- **Pandas**: Veri analizi (gelecekte genişletilebilir)
- **Window Functions**: SQL'de gelişmiş analitik sorgular

### Veritabanı Tabloları
- `orders`: Siparişler (final_amount, status)
- `order_items`: Sipariş kalemleri (unit_sell_price, unit_buy_price, quantity)
- `transactions`: Kasa hareketleri (type: EXPENSE, category, amount)
- `products`: Ürünler (sell_price, buy_price)

### Performans Notları
- Tüm sorgular index'lenmiş alanlar üzerinden çalışır
- Büyük veri setleri için pagination eklenebilir
- Cache mekanizması (Redis) eklenebilir

---

## Frontend Entegrasyonu

### Örnek Kullanım (TypeScript/React)

```typescript
// Net Profitability
const profitability = await apiClient.get('/finance/net-profitability?days=30');
console.log(`Brüt Kar Marjı: %${profitability.data.gross_margin_percent}`);

// Expense Breakdown
const expenses = await apiClient.get('/finance/expense-breakdown?days=30');
expenses.data.categories.forEach(cat => {
  if (cat.is_anomaly) {
    console.warn(`⚠️ ${cat.category}: ${cat.anomaly_reason}`);
  }
});

// Advanced Projection
const projection = await apiClient.get('/finance/advanced-projection');
console.log(`Tahmini Ay Sonu Ciro: ${projection.data.month_end_projection.projected_revenue} ₺`);
console.log(`Pace Durumu: ${projection.data.pace_analysis.status}`);
```

---

## Sonuç

Bu 3 modül, POS uygulaması için **actionable insights** sağlar:
1. **Gerçek Karlılık**: Sadece gelir değil, ürün bazlı kar marjı
2. **Akıllı Gider Analizi**: Anomali tespiti ile olağandışı gider artışlarını yakalama
3. **Gelişmiş Projeksiyon**: Pace analizi ve ağırlıklı ortalama ile ay sonu tahmini

Bu içgörüler, işletme sahiplerinin **karar vermesine** yardımcı olur.
