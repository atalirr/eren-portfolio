# Adaptive Regime Backtest Analizi

## Bulgular

### 1. Rejim Dağılımı Problemi
- **TRENDING_DOWN:** %83.4 (!!!!)
- **CHOPPY:** %14.6
- **TRENDING_UP:** %1.6 (neredeyse hiç yok)

Son 1 yıl içinde piyasa neredeyse tamamen DOWNTREND'te.
Bu demek ki modelimiz %83 oranında `REVERSAL_ONLY` modunda çalışıyor ve `buy_thresh=90` gibi çok yüksek bir eşik uyguluyor.
AMA hâlâ çok fazla işlem açıyor (1204 işlem!).

### 2. Çıkış Sebepleri — En Önemli Bulgu
- **SCORE_DROP:** 1010 işlem, TOPLAM +$151.95, ortalama +$0.15 (**KÂRLI!**)
- **TAKE_PROFIT:** 23 işlem, TOPLAM +$105.06, ortalama +$4.57 (**ÇOK KÂRLI!**)
- **TRAILING:** 171 işlem, TOPLAM -$503.19, ortalama -$2.94 (**ZARAR!**)

**TRAILING STOP ZARAR KAYNAĞI!**
Score-drop ve take-profit çıkarsan model kârlı.
Trailing stop fiyat düşerken çok geç devreye giriyor veya fiyat yükseldikten sonra geri gelince fazla alan bırakıyor.

### 3. Çözüm
- Trailing stop'u tamamen kaldır veya ATR-based yap.
- Sadece score-drop + take-profit ile çıkış yap.

## Eski vs Yeni Karşılaştırma
- **ESKİ (Sabit):** 677 işlem, %35.3 WR, -$215.50, ETH+BTC kârlı
- **YENİ (Rejim):** 1204 işlem, %48.5 WR, -$245.99, ETH+DOT kârlı

Win rate %35 -> %48.5'e çıktı! (Büyük gelişme)
Ama trailing stop ZARARI arttı.
Score-drop bazlı çıkışlar KÂR üretiyor!
