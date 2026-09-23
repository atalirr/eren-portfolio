import os
import sys

# Windows gRPC DNS çözünürlük hatasını önle
os.environ["GRPC_DNS_RESOLVER"] = "native"

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

import requests
from dotenv import load_dotenv
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

load_dotenv()

# Env değişkenlerini al
CUSTOMER_ID = os.getenv("GOOGLE_ADS_CUSTOMER_ID", "").replace("-", "")
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def get_google_ads_client():
    config = {
        "developer_token": os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN"),
        "client_id": os.getenv("GOOGLE_ADS_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_ADS_CLIENT_SECRET"),
        "refresh_token": os.getenv("GOOGLE_ADS_REFRESH_TOKEN"),
        "use_proto_plus": True
    }
    return GoogleAdsClient.load_from_dict(config)

def send_telegram_notification(text):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": CHAT_ID,
        "text": text,
        "parse_mode": "Markdown"
    }
    requests.post(url, json=payload)

def fetch_and_report_campaigns():
    print("📡 Google Ads verileri çekiliyor...")
    client = get_google_ads_client()
    ga_service = client.get_service("GoogleAdsService")

    # GAQL Sorgusu: Son 30 günlük Kampanya Özetleri
    query = """
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
    """

    try:
        response = ga_service.search(customer_id=CUSTOMER_ID, query=query)
        
        total_impressions = 0
        total_clicks = 0
        total_cost = 0.0
        total_conversions = 0
        campaign_list = []

        for row in response:
            campaign_name = row.campaign.name
            status = row.campaign.status.name
            clicks = row.metrics.clicks
            impressions = row.metrics.impressions
            cost = row.metrics.cost_micros / 1000000.0  # Micro to Currency
            conversions = row.metrics.conversions

            total_impressions += impressions
            total_clicks += clicks
            total_cost += cost
            total_conversions += conversions

            status_icon = "🟢" if status == "ENABLED" else "⏸️"
            campaign_list.append(
                f"{status_icon} *{campaign_name}*\n"
                f"   👆 Tıklama: {clicks} | 👁️ Gösterim: {impressions}\n"
                f"   💰 Harcama: {cost:.2f} TL | 📞 Arama/Dönüşüm: {int(conversions)}"
            )

        print("✅ Veriler başarıyla çekildi!")

        # Telegram Rapor Formatı
        report = (
            f"📊 *Medikal Reklam Yönetim Botu – 30 Günlük Karne*\n"
            f"📅 Hesabın Son Durumu (ID: {CUSTOMER_ID})\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"💰 *Toplam Harcama:* {total_cost:.2f} TL\n"
            f"👆 *Toplam Tıklama:* {total_clicks} adet\n"
            f"👁️ *Toplam Gösterim:* {total_impressions} adet\n"
            f"📞 *Toplam Arama/Dönüşüm:* {int(total_conversions)} adet\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"📋 *Kampanyalarınız:*\n"
        )

        if campaign_list:
            report += "\n\n".join(campaign_list)
        else:
            report += "Henüz aktif/geçmiş kampanya verisi bulunamadı."

        send_telegram_notification(report)
        print("🎉 Rapor Telegram'a başarıyla gönderildi!")

    except GoogleAdsException as ex:
        error_msg = f"❌ Google Ads API Hatası:\n"
        for error in ex.failure.errors:
            error_msg += f"- {error.message}\n"
        print(error_msg)
        send_telegram_notification(error_msg)

if __name__ == "__main__":
    fetch_and_report_campaigns()
