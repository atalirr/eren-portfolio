"""
Gemini AI Advisory Engine
Uses user's Google Gemini API key to generate executive retail & inventory insights.
"""

import json
import urllib.request
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from src.shared.config.settings import get_settings


def get_gemini_api_key(db: Optional[Session] = None) -> Optional[str]:
    """Kullanıcının veritabanındaki ayarından veya backend .env dosyasından Gemini API anahtarını alır."""
    if db:
        try:
            from src.features.settings.services import SettingService
            svc = SettingService(db)
            db_key = svc.get_value("gemini_api_key")
            if db_key == "disabled":
                return None
            if db_key and db_key.strip():
                return db_key.strip()
        except Exception:
            pass

    env_key = getattr(get_settings(), "GEMINI_API_KEY", None)
    if env_key and str(env_key).strip() and str(env_key).strip() != "disabled":
        return str(env_key).strip()
    return None


def generate_gemini_stock_insights(
    api_key: str,
    summary: Dict[str, Any],
    items: List[Dict[str, Any]],
    timeout: int = 30
) -> Optional[Dict[str, Any]]:
    """
    Google Gemini 2.5 Flash modelini kullanarak mağazanın stok, satış ve kârlılık
    verilerini analiz eder ve ürün adı bazında somut stratejik tavsiyeler üretir.
    """
    if not api_key:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

    # Daha fazla veri gönder — top 10 per category
    star_items = [it for it in items if it.get("classification") == "STAR" or it.get("is_star")][:10]
    critical_items = [it for it in items if it.get("classification") == "CRITICAL_ORDER" or it.get("is_critical")][:10]
    dead_items = [it for it in items if it.get("classification") == "DEAD_STOCK" or it.get("is_dead_stock")][:10]
    volume_items = [it for it in items if it.get("classification") == "VOLUME" or it.get("is_volume")][:10]

    # Satışa göre sıralı genel top 10
    top_by_sales = sorted(items, key=lambda x: x.get("sold_30d", 0), reverse=True)[:10]

    def fmt_star(it):
        return (
            f"- {it['name']} | Son 30g Satış: {it.get('sold_30d', 0)} adet | Son 90g: {it.get('sold_90d', 0)} adet | "
            f"Kâr Marjı: %{it.get('profitMargin', 0)} | Günlük Talep: {it.get('daily_demand', 0):.1f}/gün | "
            f"Mevcut Stok: {it.get('stock', 0)} adet | Satış Fiyatı: {it.get('sell_price', 0)} TL | "
            f"Alış Fiyatı: {it.get('buy_price', 0)} TL | Kalan Stok Ömrü: {it.get('days_remaining') or 'Belirsiz'} gün"
        )

    def fmt_critical(it):
        return (
            f"- {it['name']} | Mevcut Stok: {it.get('stock', 0)} adet | ROP Eşiği: {it.get('reorder_point', 0)} | "
            f"Güvenlik Stoğu: {it.get('safety_stock', 0)} | Önerilen Sipariş: {it.get('recommended_order_qty', 0)} adet | "
            f"Günlük Talep: {it.get('daily_demand', 0):.1f}/gün | Kalan Stok Ömrü: {it.get('days_remaining') or '0'} gün"
        )

    def fmt_dead(it):
        capital = round(it.get('stock', 0) * (it.get('buy_price') or 0.0), 2)
        return (
            f"- {it['name']} | Stok: {it.get('stock', 0)} adet | Alış: {it.get('buy_price', 0)} TL | "
            f"Satış: {it.get('sell_price', 0)} TL | Bağlı Sermaye: {capital:,.2f} TL | "
            f"Son 90g Satış: {it.get('sold_90d', 0)} adet"
        )

    def fmt_top(it):
        return (
            f"- {it['name']} | 30g Satış: {it.get('sold_30d', 0)} adet | 90g: {it.get('sold_90d', 0)} adet | "
            f"Stok: {it.get('stock', 0)} | Günlük Talep: {it.get('daily_demand', 0):.1f}/gün | "
            f"Marj: %{it.get('profitMargin', 0)}"
        )

    star_text = "\n".join([fmt_star(it) for it in star_items]) or "Yıldız ürün bulunamadı"
    critical_text = "\n".join([fmt_critical(it) for it in critical_items]) or "Acil sipariş yok"
    dead_text = "\n".join([fmt_dead(it) for it in dead_items]) or "Ölü stok yok"
    volume_text = "\n".join([fmt_top(it) for it in volume_items]) or "Yüksek hacimli ürün yok"
    top_sellers_text = "\n".join([fmt_top(it) for it in top_by_sales]) or "Satış verisi yok"

    prompt = f"""Sen medikal perakende mağaza yönetimi, stok ikmali, kârlılık optimizasyonu ve tedarik zinciri alanında uzman bir yapay zeka danışmanısın.
Aşağıda mağazanın GERÇEK veritabanından çekilen detaylı satış, stok hızı, talep ve kârlılık verileri bulunmaktadır.
Bu verileri derinlemesine inceleyerek mağaza sahibine SOMUT, ÜRÜN ADI BAZINDA, RAKAMSAL ve aksiyona dönüştürülebilir tavsiyeler üret.
Genel ve soyut cümleler KULLANMA. Her tavsiyede mutlaka ürün adı, adet ve tutar belirt.

═══════════════════════════════════════════
MAĞAZA GENEL DURUMU
═══════════════════════════════════════════
- Toplam Aktif Ürün: {summary.get('total_products', 0)} kalem
- Yıldız (Lokomotif) Ürün: {summary.get('star_count', 0)} kalem
- Yüksek Hacimli Sürüm Ürünü: {summary.get('volume_count', 0)} kalem
- Stok Tükenme Riski (Acil Sipariş): {summary.get('critical_count', 0)} kalem
- Ölü Stok (90 Gündür Satmayan): {summary.get('dead_stock_count', 0)} kalem
- Dengeli/Sağlıklı Stok: {summary.get('healthy_count', 0)} kalem
- Ölü Stoklardaki Toplam Atıl Sermaye: {summary.get('total_dead_stock_value', 0):,.2f} TL
- Sistemin Önerdiği Toplam İkmal Adedi: {summary.get('total_reorder_qty', 0)} adet

═══════════════════════════════════════════
SON 30 GÜNÜN EN ÇOK SATAN 10 ÜRÜNÜ
═══════════════════════════════════════════
{top_sellers_text}

═══════════════════════════════════════════
YILDIZ / LOKOMOTİF ÜRÜNLER (Yüksek Kâr + Yüksek Ciro)
═══════════════════════════════════════════
{star_text}

═══════════════════════════════════════════
YÜKSEK HACİMLİ SÜRÜM ÜRÜNLERİ (Çok Satılan Ama Düşük Marjlı)
═══════════════════════════════════════════
{volume_text}

═══════════════════════════════════════════
ACİL SİPARİŞ BEKLEYEN ÜRÜNLER (Stok Tükenme Riski)
═══════════════════════════════════════════
{critical_text}

═══════════════════════════════════════════
ÖLÜ STOK ÜRÜNLERİ (90+ Gündür Satmayan, Sermaye Bağlayan)
═══════════════════════════════════════════
{dead_text}

══════════════════════════════════════════════════════════════
TALİMAT: Aşağıdaki JSON şemasına BİREBİR uygun yanıt döndür.
Her alanda MUTLAKA ürün adı, adet ve tutar kullan. Soyut cümleler yazma.
Başka açıklama veya markdown ekleme, SADECE JSON döndür.
══════════════════════════════════════════════════════════════
{{
  "executive_summary": "Mağazanın genel durumunu 3-4 cümleyle özetle. Toplam ürün sayısını, en çok satanların adlarını, riskli durumları ve atıl sermaye tutarını belirt.",
  "top_sellers": [
    {{
      "name": "Ürün adı",
      "sold_30d": 0,
      "sold_90d": 0,
      "current_stock": 0,
      "recommended_stock": 0,
      "daily_demand": 0.0,
      "note": "Bu ürün için kısa öneri (ör: 'Stok 12 güne yeter, 50 adet sipariş verin')"
    }}
  ],
  "critical_orders": [
    {{
      "name": "Ürün adı",
      "current_stock": 0,
      "order_qty": 0,
      "urgency": "Acil/Orta/Düşük",
      "note": "Kaç günlük stok kaldı ve ne zaman sipariş vermek lazım"
    }}
  ],
  "quarterly_forecast": "Önümüzdeki 3 ay için detaylı tedarik planı. Her lokomotif ürünün adını ve aylık kaçar adet sipariş edilmesi gerektiğini yaz. Toplam tahmini sipariş maliyetini belirt.",
  "strategic_recommendations": [
    "Her tavsiye somut olsun. Ürün adı + adet + tutar + aksiyon belirt. En az 5, en fazla 8 madde yaz."
  ],
  "top_dead_stock": [
    {{
      "name": "Ürün adı",
      "stock": 0,
      "capital_tied": 0.0,
      "suggestion": "Bu ürün için özel tavsiye (indirim oranı, kampanya fikri vs.)"
    }}
  ],
  "dead_stock_strategy": "Tüm ölü stoktaki toplam sermayeyi (TL) belirterek somut kampanya, indirim yüzdesi ve tasfiye takvimi öner.",
  "risk_score": 0,
  "health_note": "Mağazanın genel sağlık durumu: 1 cümle (ör: 'İyi durumda ama 33 ürüne acil sipariş gerekiyor')",
  "gemini_powered": true,
  "model_name": "Google Gemini 2.5 Flash"
}}
"""

    request_body = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json"
        }
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(request_body).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            candidates = resp_data.get("candidates", [])
            if not candidates:
                return None
            content_part = candidates[0].get("content", {}).get("parts", [])[0].get("text", "")
            parsed = json.loads(content_part)
            parsed["gemini_powered"] = True
            parsed["model_name"] = "Google Gemini 2.5 Flash"
            return parsed
    except Exception as e:
        import traceback
        print(f"[GEMINI ADVISORY ERROR]: {str(e)}")
        print(traceback.format_exc())
        return {
            "executive_summary": "Yapay zeka analiz motoru hazır. Stok ikmal ve kârlılık metrikleri matematiksel modellerle hesaplandı.",
            "quarterly_forecast": "Lokomotif ürünlerde son 30 ve 90 günlük satış ivmesi korunmalıdır.",
            "top_sellers": [],
            "critical_orders": [],
            "top_dead_stock": [],
            "strategic_recommendations": [
                "Acil sipariş rozeti taşıyan ürünler için tedarikçiden ivedilikle sipariş geçiniz.",
                "Yüksek hacimli sürüm ürünlerinde toplu alım iskontosu talep ediniz.",
                "Ölü stok rozetli ürünler için indirim veya promosyon paketi kurgulayınız."
            ],
            "dead_stock_strategy": "Atıl stokları eritmek için çapraz kampanya ve sepet indirimi uygulayınız.",
            "risk_score": 50,
            "health_note": "Analiz motoru çalışıyor ancak canlı Gemini bağlantısı kurulamadı.",
            "gemini_powered": False,
            "error_note": f"Gemini API çağrısı sırasında geçici durum: {str(e)}",
            "model_name": "Kural Tabanlı Analiz Motoru"
        }

