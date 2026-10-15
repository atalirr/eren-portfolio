# -*- coding: utf-8 -*-
"""
generate_mock_invoices.py
--------------------------
Çalıştırma:
    python generate_mock_invoices.py

POS 6 sistemindeki AI Fatura Analizi özelliğini test etmek için
15 farklı Türkçe fatura HTML şablonu üretir.

Her bir HTML dosyası tarayıcıda açılıp:
  - PDF olarak kaydedilebilir (Ctrl+P → PDF'e Kaydet)
  - Ekran görüntüsü alınarak PNG/JPG yapılabilir
  - Daha sonra sisteme yüklenip OCR doğruluğu test edilebilir
"""

import os
import sys
import random
from datetime import date, timedelta

# Windows konsolunda Türkçe/Unicode karakterlerin düzgün çıkması için
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # type: ignore

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "mock_invoices")


# ──────────────────────────────────────────────
# Yardımcı fonksiyonlar
# ──────────────────────────────────────────────

def rand_date(days_back: int = 60) -> str:
    d = date.today() - timedelta(days=random.randint(0, days_back))
    return d.strftime("%d.%m.%Y")

def rand_invoice_no(prefix: str = "ARŞ") -> str:
    return f"{prefix}2026{random.randint(100000, 999999)}"

def rand_vkn() -> str:
    return "".join([str(random.randint(0, 9)) for _ in range(10)])

def format_tl(val: float) -> str:
    return f"{val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") + " ₺"

def html_page(title: str, body: str, width: str = "210mm") -> str:
    return f"""<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<title>{title}</title>
<style>
  @page {{ size: A4; margin: 15mm; }}
  body {{ font-family: Arial, sans-serif; font-size: 10pt; color: #222; width: {width}; margin: 0 auto; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th, td {{ padding: 4px 6px; }}
  .bold {{ font-weight: bold; }}
  .right {{ text-align: right; }}
  .center {{ text-align: center; }}
  .border-table th, .border-table td {{ border: 1px solid #aaa; }}
  .header {{ margin-bottom: 10px; }}
  .totals td {{ padding: 3px 6px; }}
  .note {{ font-size: 8pt; color: #666; margin-top: 12px; }}
  .blue-band {{ background: #003e8c; color: white; padding: 8px 12px; }}
  .lite-band {{ background: #e8f0fb; padding: 6px 12px; }}
  h1, h2, h3 {{ margin: 0; }}
</style>
</head>
<body>
{body}
</body>
</html>"""


def row_html(sira, name, barcode, qty, unit, unit_price, vat_rate, color=""):
    vat_amt = unit_price * qty * vat_rate / 100
    total = unit_price * qty + vat_amt
    bc_str = f"<br/><small style='color:#888'>{barcode}</small>" if barcode else ""
    bg = f"background:{color};" if color else ""
    return (
        f"<tr style='{bg}'>"
        f"<td class='center'>{sira}</td>"
        f"<td>{name}{bc_str}</td>"
        f"<td class='center'>{qty}</td>"
        f"<td class='center'>{unit}</td>"
        f"<td class='right'>{format_tl(unit_price)}</td>"
        f"<td class='center'>%{vat_rate}</td>"
        f"<td class='right'>{format_tl(vat_amt)}</td>"
        f"<td class='right bold'>{format_tl(total)}</td>"
        f"</tr>"
    )


def build_totals(items):
    subtotal = sum(p * q for _, _, q, p, _ in items)
    vat_total = sum(p * q * v / 100 for _, _, q, p, v in items)
    grand = subtotal + vat_total
    return subtotal, vat_total, grand


def standard_invoice_table(items, header_color="#003e8c"):
    rows = ""
    for i, (name, barcode, qty, price, vat) in enumerate(items, 1):
        rows += row_html(i, name, barcode, qty, "Adet", price, vat, "#f9f9fb" if i % 2 == 0 else "")
    subtotal, vat_total, grand = build_totals(items)
    return f"""
<table class="border-table" style="margin-top:12px">
  <thead>
    <tr style="background:{header_color};color:white;">
      <th class="center" width="30">Sıra</th>
      <th>Mal / Hizmet Cinsi</th>
      <th class="center" width="45">Miktar</th>
      <th class="center" width="40">Birim</th>
      <th class="right" width="80">Birim Fiyat</th>
      <th class="center" width="50">KDV %</th>
      <th class="right" width="80">KDV Tutarı</th>
      <th class="right" width="90">Tutar</th>
    </tr>
  </thead>
  <tbody>{rows}</tbody>
</table>
<table class="totals" style="margin-top:8px;margin-left:auto;width:260px">
  <tr><td>Ara Toplam</td><td class="right bold">{format_tl(subtotal)}</td></tr>
  <tr><td>Toplam KDV</td><td class="right bold">{format_tl(vat_total)}</td></tr>
  <tr style="background:#003e8c;color:white;">
    <td class="bold">Ödenecek Tutar</td>
    <td class="right bold">{format_tl(grand)}</td>
  </tr>
</table>"""


# ══════════════════════════════════════════════
# FATURA ŞABLONLARI
# ══════════════════════════════════════════════

def inv_01_efatura_gida():
    """Standart e-Arşiv Fatura – Gıda Toptancısı"""
    items = [
        ("Ülker Çikolatalı Gofret 36g", "8690526000012", 48, 3.50, 20),
        ("Pınar Tam Yağlı Süt 1Lt", "8690718000023", 24, 12.90, 10),
        ("Eti Browni Kek 45g", "8690117000034", 36, 4.20, 20),
        ("Nestle Nescafe Classic 200g", "8690637000045", 12, 89.90, 20),
        ("Dimes Portakal Nektarı 1Lt", "8691193000056", 24, 18.50, 20),
        ("Coca-Cola Şişe 1.5Lt", "8690805000067", 12, 35.00, 20),
        ("Ülker Petibör Bisküvi 172g", "8690526000078", 60, 11.50, 20),
    ]
    table = standard_invoice_table(items)
    body = f"""
<div class="blue-band"><h2>e-Arşiv Fatura</h2><small>GİB Onaylı Elektronik Belge</small></div>
<div class="lite-band" style="display:flex;justify-content:space-between;margin-bottom:8px">
  <div>
    <b>SATIŞ YAPAN:</b><br/>
    Güven Gıda Toptancılık A.Ş.<br/>
    VKN: {rand_vkn()}<br/>
    Atatürk Cad. No:12, Bağcılar / İstanbul<br/>
    Tel: 0212 555 00 11
  </div>
  <div class="right">
    <b>Fatura No:</b> {rand_invoice_no()}<br/>
    <b>Fatura Tarihi:</b> {rand_date()}<br/>
    <b>Fatura Türü:</b> e-Arşiv<br/>
    <b>Senaryo:</b> Temel Fatura
  </div>
</div>
<div style="border:1px solid #ccc;padding:6px;margin-bottom:8px">
  <b>ALICI:</b> Ahmet Yılmaz Market – VKN/TCKN: {rand_vkn()}<br/>
  Çarşı Mah. Pazar Sk. No:5, Gaziosmanpaşa / İstanbul
</div>
{table}
<p class="note">Bu belge 5070 sayılı Elektronik İmza Kanunu kapsamında düzenlenmiştir.</p>"""
    return html_page("e-Arşiv Fatura – Gıda Toptancısı", body)


def inv_02_tekstil():
    """Tekstil / Giyim Faturası – Bedenler ile"""
    rows_html = ""
    items_data = [
        ("Basic Pamuk T-Shirt", "Beyaz", "S", 5, 45.00),
        ("Basic Pamuk T-Shirt", "Beyaz", "M", 8, 45.00),
        ("Basic Pamuk T-Shirt", "Beyaz", "L", 6, 45.00),
        ("Basic Pamuk T-Shirt", "Beyaz", "XL", 4, 45.00),
        ("Slim Fit Kot Pantolon", "Koyu Mavi", "30/32", 3, 180.00),
        ("Slim Fit Kot Pantolon", "Koyu Mavi", "32/34", 5, 180.00),
        ("Slim Fit Kot Pantolon", "Koyu Mavi", "34/34", 2, 180.00),
        ("Kapüşonlu Sweatshirt", "Gri Melanj", "M", 4, 220.00),
        ("Kapüşonlu Sweatshirt", "Gri Melanj", "L", 6, 220.00),
        ("Spor Çorap 5'li Set", None, "36-40", 12, 55.00),
    ]
    subtotal = 0
    for i, (name, color, size, qty, price) in enumerate(items_data, 1):
        vat = 20
        vat_amt = price * qty * vat / 100
        total = price * qty + vat_amt
        subtotal += total
        color_str = f" / {color}" if color else ""
        bg = "#f5f5ff" if i % 2 == 0 else ""
        rows_html += (
            f"<tr style='background:{bg}'>"
            f"<td class='center'>{i}</td>"
            f"<td>{name}{color_str}</td>"
            f"<td class='center'>{size}</td>"
            f"<td class='center'>{qty}</td>"
            f"<td class='center'>Adet</td>"
            f"<td class='right'>{format_tl(price)}</td>"
            f"<td class='center'>%{vat}</td>"
            f"<td class='right bold'>{format_tl(total)}</td>"
            f"</tr>"
        )
    body = f"""
<div style="display:flex;justify-content:space-between;border-bottom:3px solid #222;padding-bottom:8px">
  <div>
    <h2 style="color:#222">MOD TEKSTIL SAN. TİC. LTD. ŞTİ.</h2>
    <small>VKN: {rand_vkn()} | İkitelli OSB, İstanbul</small>
  </div>
  <div class="right">
    <h3>SEVK İRSALİYESİ / FATURA</h3>
    <b>No:</b> {rand_invoice_no("TEK")} | <b>Tarih:</b> {rand_date()}
  </div>
</div>
<p><b>Alıcı:</b> Butik Moda Mağazacılık – {rand_vkn()}</p>
<table class="border-table" style="margin-top:8px">
  <thead>
    <tr style="background:#222;color:#fff">
      <th class="center">#</th><th>Ürün Adı</th><th class="center">Beden</th>
      <th class="center">Adet</th><th class="center">Birim</th>
      <th class="right">B. Fiyat</th><th class="center">KDV</th><th class="right">Toplam</th>
    </tr>
  </thead>
  <tbody>{rows_html}</tbody>
</table>
<table class="totals" style="margin-top:8px;margin-left:auto;width:220px">
  <tr style="background:#222;color:#fff"><td class="bold">GENEL TOPLAM</td><td class="right bold">{format_tl(subtotal)}</td></tr>
</table>"""
    return html_page("Tekstil Faturası", body)


def inv_03_elektronik():
    """Elektronik & Teknoloji Faturası – Barkod + Seri No"""
    items = [
        ("ASUS VivoBook 15 Laptop (i5/8GB/512GB SSD)", "8699292038499", 2, 18500.00, 20),
        ("Logitech MX Master 3S Kablosuz Mouse", "5099206103696", 5, 1850.00, 20),
        ("Samsung 27\" Curved IPS Monitör", "8806092904552", 3, 5400.00, 20),
        ("Kingston 16GB DDR4 3200MHz RAM", "0740617326857", 10, 750.00, 20),
        ("WD Blue 1TB SSD (M.2 NVMe)", "0718037872247", 8, 1250.00, 20),
        ("TP-Link AX5400 Wi-Fi 6 Router", "6935364089672", 4, 2200.00, 20),
        ("Logitech C920 HD Pro Webcam", "5099206064201", 6, 1480.00, 20),
    ]
    table = standard_invoice_table(items, header_color="#1a1a2e")
    body = f"""
<div style="display:flex;justify-content:space-between;background:#1a1a2e;color:white;padding:12px">
  <div><h2>TEKNOPAZAR ELEKTRONİK LTD. ŞTİ.</h2><small>VKN: {rand_vkn()} | Maslak, İstanbul</small></div>
  <div class="right"><h3>e-FATURA</h3><small>No: {rand_invoice_no("ELK")} | {rand_date()}</small></div>
</div>
<p style="margin:6px 0"><b>Alıcı:</b> Bilgisayar Dünyası Mağazacılık A.Ş. – VKN: {rand_vkn()}</p>
{table}
<p class="note">Ürünler garantili olup seri numaraları ürün kutusunda mevcuttur.</p>"""
    return html_page("Elektronik Faturası", body)


def inv_04_market_fisi():
    """Market / Süpermarket Fişi (Termal Yazıcı Formatı)"""
    items = [
        ("Pınar Tam Yağlı Süt 1Lt", 1, 28.90, 10),
        ("Migros Domates Salçası 830g", 2, 45.00, 10),
        ("Ülker Çikolata Bar 30g", 3, 6.50, 20),
        ("Fairy Sıvı Bulaşık Det. 1Lt", 1, 59.90, 20),
        ("Sana Margarin 500g", 1, 38.50, 10),
        ("Beypazarı Maden Suyu 6x1Lt", 1, 65.00, 20),
        ("Pringles Original 165g", 2, 49.90, 20),
        ("Hazır Köfte 500g", 1, 89.90, 10),
    ]
    rows = ""
    total = 0
    for name, qty, price, _ in items:
        line_total = qty * price
        total += line_total
        rows += f"<tr><td>{name}</td><td class='right'>{qty}x{format_tl(price)}</td><td class='right'>{format_tl(line_total)}</td></tr>"
    kdv = total * 0.18
    body = f"""
<div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px">
  <h3 style="margin:0">🛒 MİGROS SÜPERMARKET</h3>
  <small>Atatürk Mah. Alışveriş Cad. No:1 Kadıköy/İST</small><br/>
  <small>Tel: 0850 200 0 200 | VKN: {rand_vkn()}</small>
</div>
<small><b>Fiş No:</b> {random.randint(10000,99999)} &nbsp; <b>Tarih:</b> {rand_date()} &nbsp; <b>Kasa:</b> 03</small>
<table style="margin-top:6px;width:100%">
  <thead><tr><th>Ürün</th><th class="right">Adet×Fiyat</th><th class="right">Tutar</th></tr></thead>
  <tbody>{rows}</tbody>
</table>
<hr style="border:none;border-top:1px dashed #000"/>
<table style="width:100%">
  <tr><td>ARA TOPLAM</td><td class="right">{format_tl(total-kdv)}</td></tr>
  <tr><td>KDV (Ort.%18)</td><td class="right">{format_tl(kdv)}</td></tr>
  <tr><td class="bold">TOPLAM</td><td class="right bold">{format_tl(total)}</td></tr>
  <tr><td>NAKİT</td><td class="right">{format_tl(round(total/50)*50)}</td></tr>
  <tr><td>PARA ÜSTÜ</td><td class="right">{format_tl(round(total/50)*50-total)}</td></tr>
</table>
<div style="text-align:center;margin-top:8px;border-top:1px dashed #000;padding-top:6px;font-size:9pt">
  Bizi tercih ettiğiniz için teşekkür ederiz!<br/>
  migros.com.tr | Müşteri Hizmetleri: 0850 200 0 200
</div>"""
    return html_page("Market Fişi", body, width="80mm")


def inv_05_nalbur_insaat():
    """Nalburiye / İnşaat Malzemeleri Faturası"""
    items = [
        ("Portland Çimento 50kg Çuval", None, 30, 185.00, 20),
        ("Mermer Tozu (Beyaz) 25kg", None, 10, 145.00, 20),
        ("PVC Su Borusu Ø110 6m", "8694540000099", 12, 220.00, 20),
        ("Elektrik Kablosu NYY 2x2.5 (metre)", None, 200, 12.50, 20),
        ("Plastik Vida Dubel 10mm (100 Adet Paket)", None, 20, 55.00, 20),
        ("Alçı Alçıpan 120x260 cm", None, 40, 95.00, 20),
        ("Silikonlu Akrilik Macun 500ml", None, 15, 68.00, 20),
    ]
    rows_html = ""
    for i, (name, barcode, qty, price, vat) in enumerate(items, 1):
        bc = f" ({barcode})" if barcode else ""
        vat_amt = price * qty * vat / 100
        total = price * qty + vat_amt
        bg = "#fffbf0" if i % 2 == 0 else ""
        rows_html += f"<tr style='background:{bg}'><td>{i}</td><td>{name}{bc}</td><td class='right'>{qty}</td><td>Adet/Mt</td><td class='right'>{format_tl(price)}</td><td class='center'>%{vat}</td><td class='right'>{format_tl(total)}</td></tr>"
    body = f"""
<div style="display:flex;justify-content:space-between;border-bottom:2px solid #cc7700;padding:8px 0">
  <div><h2 style="color:#cc7700">YILMAZ NALBUR & İNŞAAT MALZEMELERİ</h2>
  <small>VKN: {rand_vkn()} | Sanayi Sit. 4. Cad. No:22, Ankara</small></div>
  <div class="right"><h3>FATURA</h3><small>{rand_invoice_no("NLB")} / {rand_date()}</small></div>
</div>
<p><b>Alıcı:</b> Güneş İnşaat Taahhüt – VKN: {rand_vkn()}</p>
<table class="border-table" style="margin-top:8px">
  <thead><tr style="background:#cc7700;color:#fff">
    <th>#</th><th>Malzeme Adı</th><th class="right">Miktar</th><th>Birim</th><th class="right">B.Fiyat</th><th class="center">KDV</th><th class="right">Toplam</th>
  </tr></thead>
  <tbody>{rows_html}</tbody>
</table>
<p class="note">Ürünler teslim alındıktan sonra iade kabul edilmez. İrsaliye ile birlikte geçerlidir.</p>"""
    return html_page("Nalbur & İnşaat Faturası", body)


def inv_06_eczane():
    """Eczane / Tıbbi Malzeme Faturası"""
    items = [
        ("Parol 500mg Tablet (Blister 24'lü)", "8699514020012", 50, 42.50, 10),
        ("Voltaren Emulgel 150g", "8699514031223", 20, 185.00, 10),
        ("Strepsil Portakal&C Tablet 24'lü", "8699514005897", 30, 98.50, 10),
        ("Bepanthen Yara Pansuman Krem 30g", "8699514040651", 15, 145.00, 10),
        ("Omeprazol 20mg Kapsül (28'li)", "8699514012345", 40, 65.00, 10),
        ("Cetirizin 10mg Tablet (20'li)", "8699514011111", 25, 48.00, 10),
        ("Bepanthol Losyon 400ml", "8699514022222", 10, 220.00, 10),
    ]
    table = standard_invoice_table(items, header_color="#006633")
    body = f"""
<div style="background:#006633;color:#fff;padding:10px;display:flex;justify-content:space-between">
  <div><h2>SAĞLIK ECZANESİ</h2><small>VKN: {rand_vkn()} | Cumhuriyet Cad. 88, Şişli/İST</small></div>
  <div class="right"><h3>İrsaliyeli Fatura</h3><small>{rand_invoice_no("ECZ")} / {rand_date()}</small></div>
</div>
<div style="background:#e8f5e9;padding:6px;margin:6px 0">
  <b>Alıcı:</b> Yeşilay Sağlık Koop. – VKN: {rand_vkn()}
</div>
{table}
<p class="note">⚕ Reçeteli ilaçlar hekimin tavsiyesi dışında kullanılmamalıdır.</p>"""
    return html_page("Eczane Faturası", body)


def inv_07_kitap():
    """Kitabevi / Kırtasiye Faturası – ISBN Barkod"""
    items = [
        ("Ince Memed 1 – Yaşar Kemal (Roman)", "9789750728914", 5, 85.00, 0),
        ("Devlet ve Sınıflar – Ellen M. Wood (Siyaset)", "9786058175242", 3, 120.00, 0),
        ("Python ile Veri Bilimi (Teknik)", "9786054926831", 4, 195.00, 0),
        ("Spiralli Not Defteri A5 (80 Yaprak)", "8690555112345", 20, 38.00, 20),
        ("Staedtler 0.7mm Versatil Kalem", "4007817022283", 15, 22.00, 20),
        ("Post-it Yapışkan Not Kağıdı 100'lük", "0021200691227", 10, 55.00, 20),
    ]
    rows_html = ""
    for i, (name, isbn, qty, price, vat) in enumerate(items, 1):
        vat_amt = price * qty * vat / 100
        total = price * qty + vat_amt
        bg = "#fefbf0" if i % 2 == 0 else ""
        rows_html += f"<tr style='background:{bg}'><td class='center'>{i}</td><td>{name}<br/><small style='color:#888'>ISBN/Barkod: {isbn}</small></td><td class='center'>{qty}</td><td class='right'>{format_tl(price)}</td><td class='center'>%{vat}</td><td class='right bold'>{format_tl(total)}</td></tr>"
    body = f"""
<div style="display:flex;justify-content:space-between;border-bottom:2px solid #8B4513;padding:6px 0">
  <div><h2 style="color:#8B4513">📚 KÜLTÜR KİTABEVİ</h2>
  <small>VKN: {rand_vkn()} | Bağdat Cad. No:55, Kadıköy</small></div>
  <div class="right"><b>Fatura No:</b> {rand_invoice_no("KİT")}<br/><b>Tarih:</b> {rand_date()}</div>
</div>
<p><b>Alıcı:</b> Bilgi Yuvası Okul Koop. – VKN: {rand_vkn()}</p>
<table class="border-table" style="margin-top:8px">
  <thead><tr style="background:#8B4513;color:#fff">
    <th class="center">#</th><th>Ürün Adı / ISBN</th><th class="center">Adet</th><th class="right">Fiyat</th><th class="center">KDV</th><th class="right">Toplam</th>
  </tr></thead>
  <tbody>{rows_html}</tbody>
</table>"""
    return html_page("Kitabevi Faturası", body)


def inv_08_temizlik():
    """Temizlik & Hijyen Ürünleri Toptancısı"""
    items = [
        ("Ariel Toz Çamaşır Det. 9kg", "8001090107251", 10, 395.00, 20),
        ("Domestos Temizlik Çamaşır Suyu 3.6Lt", "8690637540012", 24, 65.00, 20),
        ("Fairy Bulaşık Deterjanı Limon 1350ml", "8001090637772", 12, 95.00, 20),
        ("Selpak Premium Tuvalet Kağıdı 32'li", "8690530074543", 6, 210.00, 20),
        ("Bingo Softlan Çamaşır Yumu. 1.5Lt", "8693495036412", 18, 75.00, 20),
        ("Cif Krem Banyo Temizleyici 750ml", "8690637002214", 15, 55.00, 20),
    ]
    table = standard_invoice_table(items, header_color="#2980b9")
    body = f"""
<div style="background:#2980b9;color:#fff;padding:10px;display:flex;justify-content:space-between">
  <div><h2>PARLAK TEMİZLİK TOPTANCILIK</h2><small>VKN: {rand_vkn()} | İkitelli, İstanbul</small></div>
  <div class="right"><h3>Toptan Satış Faturası</h3><small>{rand_invoice_no("TMZ")} / {rand_date()}</small></div>
</div>
<p style="background:#ebf5fb;padding:6px;margin:6px 0"><b>Alıcı:</b> Yıldız Market Zinciri – VKN: {rand_vkn()}</p>
{table}
<p class="note">Toptan sipariş minimum 100 koli olup teslim süresi 2 iş günüdür.</p>"""
    return html_page("Temizlik Ürünleri Faturası", body)


def inv_09_oto_parca():
    """Oto Yedek Parça Faturası"""
    items = [
        ("Bosch Ateşleme Bujisi (4'lü Set) – Honda Civic Uyumlu", "0258003476", 8, 850.00, 20),
        ("Mann-Filter Yağ Filtresi W712/73", "4011558313457", 15, 145.00, 20),
        ("Brembo Ön Fren Diski Çifti (Volkswagen Golf)", "0986479312", 6, 1850.00, 20),
        ("Denso Radyatör Soğutma Suyu 1Lt (Kırmızı)", "0019893500010", 20, 55.00, 20),
        ("Castrol Edge 5W-30 Motor Yağı 5Lt", "5010024000024", 10, 1450.00, 20),
        ("Gates Kanallı V Kayışı 6PK1540", "5420005757044", 12, 320.00, 20),
    ]
    table = standard_invoice_table(items, header_color="#555")
    body = f"""
<div style="display:flex;justify-content:space-between;border-bottom:3px solid #555;padding:8px 0">
  <div><h2>🔧 YILDIRIM OTO YEDEK PARÇA</h2><small>VKN: {rand_vkn()} | Ostim OSB, Ankara</small></div>
  <div class="right"><h3>FATURA</h3><small>{rand_invoice_no("OTO")} / {rand_date()}</small></div>
</div>
<p><b>Alıcı:</b> Güven Oto Servis Merk. – VKN: {rand_vkn()}</p>
{table}
<p class="note">Orijinal parçalar için fatura zorunludur. Garanti süresi 2 yıldır.</p>"""
    return html_page("Oto Yedek Parça Faturası", body)


def inv_10_kahve_restoran():
    """Kahve Dükkanı / Pastane Hammadde Faturası"""
    items = [
        ("Lavazza Qualita Rossa Espresso Çekirdeği 1kg", "8000070018258", 10, 485.00, 20),
        ("İtalyan Tam Buğday Unu 25kg Çuval", None, 5, 325.00, 10),
        ("Valrhona Noir Extra Brut Bitter Çikolata 1kg", "3346840000228", 4, 650.00, 20),
        ("Lurpak Tuzlu Tereyağı 200g (Koli 10 Adet)", "5740900484481", 6, 520.00, 10),
        ("Philadelphia Krem Peynir 1kg", "0021000005475", 8, 280.00, 10),
        ("Silikomart Muffin Kalıbı (12'li Seti)", None, 5, 185.00, 20),
        ("Bambu Dondurma Çubuğu 1000 Adet", None, 3, 75.00, 20),
    ]
    table = standard_invoice_table(items, header_color="#5d3a00")
    body = f"""
<div style="background:#5d3a00;color:#fff;padding:10px;display:flex;justify-content:space-between">
  <div><h2>☕ AROMALAND KAHVE & GIDA TOPTANCILIK</h2><small>VKN: {rand_vkn()} | Bostancı, İstanbul</small></div>
  <div class="right"><h3>Tedarik Faturası</h3><small>{rand_invoice_no("KHV")} / {rand_date()}</small></div>
</div>
<p style="background:#fdf3e4;padding:6px;margin:6px 0"><b>Alıcı:</b> Bonbon Pastane Ltd. – VKN: {rand_vkn()}</p>
{table}"""
    return html_page("Kahve & Pastane Hammadde Faturası", body)


def inv_11_pet_shop():
    """Pet Shop / Evcil Hayvan Ürünleri Faturası"""
    items = [
        ("Royal Canin Medium Adult Köpek Maması 15kg", "3182550402521", 5, 1250.00, 20),
        ("Whiskas Tavuklu Kedi Maması 300g (24'lü Koli)", "5900951261497", 4, 580.00, 20),
        ("Purina Pro Plan Kedi İnce Kıyma Poşet 85g ×20", "7613034578709", 6, 320.00, 20),
        ("Vitakraft Hamster Granül Mama 600g", "4008239048202", 10, 85.00, 20),
        ("Trixie Kedi Tırmalama Sütunu 60cm", "4011905430980", 8, 280.00, 20),
        ("Biossi Köpek Pati Temizleme Eldiveni", None, 15, 55.00, 20),
        ("Versele-Laga Muhabbet Kuşu Yemi 1kg", "5410340600954", 12, 65.00, 20),
    ]
    table = standard_invoice_table(items, header_color="#2ecc71")
    body = f"""
<div style="background:#2ecc71;color:#fff;padding:10px;display:flex;justify-content:space-between">
  <div><h2>🐾 PATILIM PET TOPTANCILIK</h2><small>VKN: {rand_vkn()} | Çerkezköy, Tekirdağ</small></div>
  <div class="right"><h3>Toptan Fatura</h3><small>{rand_invoice_no("PET")} / {rand_date()}</small></div>
</div>
<p style="background:#eafaf1;padding:6px;margin:6px 0"><b>Alıcı:</b> Hayvan Severlerin Pet Shop – VKN: {rand_vkn()}</p>
{table}"""
    return html_page("Pet Shop Faturası", body)


def inv_12_oyuncak():
    """Oyuncak Mağazası Faturası"""
    items = [
        ("LEGO Technic Offroad Araç 4×4 (42139) 6-12 Yaş", "5702017117782", 3, 1850.00, 20),
        ("Hasbro Monopoly Türkçe (Aile Kutu Oyunu)", "5010994956660", 5, 620.00, 20),
        ("Barbie Balerin Bebek + Aksesuar Seti", "0194735072521", 8, 385.00, 20),
        ("Matchbox Araç Koleksiyonu 5'li Set", "0194735000004", 10, 145.00, 20),
        ("Pilsan Büyük Blok Set 100 Parça (1-3 Yaş)", "8693461050003", 6, 230.00, 20),
        ("Eğitici Parmak Boyaları 6 Renk Seti", None, 15, 65.00, 20),
    ]
    table = standard_invoice_table(items, header_color="#e74c3c")
    body = f"""
<div style="background:#e74c3c;color:#fff;padding:10px;display:flex;justify-content:space-between">
  <div><h2>🎁 RENKLER OYUNCAK TOPTANCILIK</h2><small>VKN: {rand_vkn()} | İkitelli, İstanbul</small></div>
  <div class="right"><h3>Satış Faturası</h3><small>{rand_invoice_no("OYN")} / {rand_date()}</small></div>
</div>
<p style="background:#fdf2f2;padding:6px;margin:6px 0"><b>Alıcı:</b> Çocuk Dünyası Mağazacılık – VKN: {rand_vkn()}</p>
{table}
<p class="note">Ürünler CE sertifikalıdır. 0-3 yaş altı çocuklar için küçük parça içerebilir, dikkatli olunuz.</p>"""
    return html_page("Oyuncak Faturası", body)


def inv_13_icecek_toptanci():
    """İçecek Toptancısı – Koli/Şişe Birimleri"""
    rows_html = ""
    items = [
        ("Coca-Cola Şişe 1.5Lt", "8690805000067", 6, 24, 35.00, 20),
        ("Fanta Portakal Kutu 330ml", "5449000131553", 6, 24, 22.50, 20),
        ("Sprite Limon Şişe 250ml", "5449000054227", 6, 24, 18.00, 20),
        ("Çamlıca Gazlı İçecek 200ml Cam Şişe", "8699543000099", 12, 24, 14.00, 20),
        ("Erikli Doğal Kaynak Suyu 0.5Lt", "8690611000088", 12, 24, 6.50, 20),
        ("Nestle Pure Life 1.5Lt", "6300000013027", 6, 12, 14.00, 20),
        ("Lipton Ice Tea Şeftali 1Lt Karton", "8690605017234", 6, 12, 28.00, 20),
    ]
    subtotal = 0
    for i, (name, barcode, koli, adet_per_koli, price, vat) in enumerate(items, 1):
        line_total = koli * price
        vat_amt = line_total * vat / 100
        total = line_total + vat_amt
        subtotal += total
        bg = "#f0f8ff" if i % 2 == 0 else ""
        rows_html += (
            f"<tr style='background:{bg}'>"
            f"<td class='center'>{i}</td>"
            f"<td>{name}<br/><small style='color:#888'>{barcode}</small></td>"
            f"<td class='center'>{koli} Koli</td>"
            f"<td class='center'>{adet_per_koli} Adet/Koli</td>"
            f"<td class='right'>{format_tl(price)}/Koli</td>"
            f"<td class='right'>{format_tl(line_total)}</td>"
            f"<td class='center'>%{vat}</td>"
            f"<td class='right bold'>{format_tl(total)}</td>"
            f"</tr>"
        )
    body = f"""
<div style="display:flex;justify-content:space-between;background:#c0392b;color:#fff;padding:10px">
  <div><h2>ANADOLU İÇECEK DAĞITICISI</h2><small>VKN: {rand_vkn()} | Bayrampaşa, İstanbul</small></div>
  <div class="right"><h3>Toptan Fatura</h3><small>{rand_invoice_no("İÇK")} / {rand_date()}</small></div>
</div>
<p style="background:#fdecea;padding:6px"><b>Alıcı:</b> Yıldız Bayi Tic. – VKN: {rand_vkn()}</p>
<table class="border-table" style="margin-top:8px">
  <thead><tr style="background:#c0392b;color:#fff">
    <th class="center">#</th><th>Ürün</th><th class="center">Miktar</th><th class="center">Adet/Koli</th>
    <th class="right">Birim Fiyat</th><th class="right">Ara Toplam</th><th class="center">KDV</th><th class="right">Toplam</th>
  </tr></thead>
  <tbody>{rows_html}</tbody>
</table>
<table class="totals" style="margin-top:8px;margin-left:auto;width:220px">
  <tr style="background:#c0392b;color:#fff"><td class="bold">GENEL TOPLAM</td><td class="right bold">{format_tl(subtotal)}</td></tr>
</table>"""
    return html_page("İçecek Toptancısı Faturası", body)


def inv_14_kozmetik():
    """Kozmetik / Parfümeri Faturası"""
    items = [
        ("L'Oréal Paris Excellence Saç Boyası No:6 Koyu Kumral", "3600523015313", 12, 145.00, 20),
        ("Maybelline Fit Me Pudra 220 Natural Beige", "3600531447625", 8, 185.00, 20),
        ("Neutrogena Hydro Boost Su Jeli Nemlendirici 50ml", "0070501104063", 6, 320.00, 20),
        ("Dove Nem Etkisi Vücut Losyonu 400ml", "8714789946312", 10, 125.00, 20),
        ("Nivea Güneş Losyonu SPF50 200ml", "4005808742462", 8, 195.00, 20),
        ("Head & Shoulders Kepek Karşıtı Şampuan 600ml", "4015600835827", 6, 165.00, 20),
        ("Oral-B Pro 3 Şarjlı Diş Fırçası", "4210201394808", 4, 850.00, 20),
    ]
    table = standard_invoice_table(items, header_color="#9b59b6")
    body = f"""
<div style="background:#9b59b6;color:#fff;padding:10px;display:flex;justify-content:space-between">
  <div><h2>💄 BEAUTY LINE KOZMETİK TOPTANCILIK</h2><small>VKN: {rand_vkn()} | Nişantaşı, İstanbul</small></div>
  <div class="right"><h3>Satış Faturası</h3><small>{rand_invoice_no("KOZ")} / {rand_date()}</small></div>
</div>
<p style="background:#f5eef8;padding:6px;margin:6px 0"><b>Alıcı:</b> Güzellik Merkezi Tic. – VKN: {rand_vkn()}</p>
{table}"""
    return html_page("Kozmetik Faturası", body)


def inv_15_tarim_tohum():
    """Tarım & Tohum / Zirai İlaç Faturası"""
    items = [
        ("Seminis Domates Tohumu F1 Hibrit 500 Adet", None, 10, 285.00, 10),
        ("Syngenta Biber Tohumu 100 Adet Paket", None, 8, 195.00, 10),
        ("Yara-Mila Granül NPK 15-15-15 Gübre 50kg", "8690700001234", 20, 320.00, 10),
        ("Basudin Zirai İlaç 500ml (Böcek İlacı)", None, 15, 185.00, 20),
        ("Tarnet Mantar İlacı 100g", None, 12, 95.00, 20),
        ("Damla Sulama Borusu Ø16 (Rulo 100m)", None, 5, 450.00, 20),
        ("Siyah Toprak Örtü Malçı 1.2m × 100m Rulo", None, 3, 850.00, 20),
    ]
    table = standard_invoice_table(items, header_color="#27ae60")
    body = f"""
<div style="background:#27ae60;color:#fff;padding:10px;display:flex;justify-content:space-between">
  <div><h2>🌱 TOPRAK ZİRAİ TARIM LTD. ŞTİ.</h2><small>VKN: {rand_vkn()} | Antalya Organize Sanayi</small></div>
  <div class="right"><h3>Zirai Satış Faturası</h3><small>{rand_invoice_no("TAR")} / {rand_date()}</small></div>
</div>
<p style="background:#eafaf1;padding:6px;margin:6px 0"><b>Alıcı:</b> Bereketli Çiftlik Kooperatifi – VKN: {rand_vkn()}</p>
{table}
<p class="note">Zirai ilaçlar Tarım Bakanlığı ruhsatlıdır. Kullanım talimatına uyunuz.</p>"""
    return html_page("Tarım & Tohum Faturası", body)


# ══════════════════════════════════════════════
# ANA ÇALIŞTIRICI
# ══════════════════════════════════════════════

INVOICES = [
    ("01_efatura_gida",         inv_01_efatura_gida),
    ("02_tekstil_giyim",        inv_02_tekstil),
    ("03_elektronik",           inv_03_elektronik),
    ("04_market_fisi",          inv_04_market_fisi),
    ("05_nalbur_insaat",        inv_05_nalbur_insaat),
    ("06_eczane",               inv_06_eczane),
    ("07_kitap_kirtasiye",      inv_07_kitap),
    ("08_temizlik_hijyen",      inv_08_temizlik),
    ("09_oto_parca",            inv_09_oto_parca),
    ("10_kahve_pastane",        inv_10_kahve_restoran),
    ("11_pet_shop",             inv_11_pet_shop),
    ("12_oyuncak",              inv_12_oyuncak),
    ("13_icecek_toptanci",      inv_13_icecek_toptanci),
    ("14_kozmetik",             inv_14_kozmetik),
    ("15_tarim_tohum",          inv_15_tarim_tohum),
]


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"[INFO] Faturalar suraya kaydedilecek: {OUTPUT_DIR}\n")

    for slug, fn in INVOICES:
        out_path = os.path.join(OUTPUT_DIR, f"fatura_{slug}.html")
        try:
            html = fn()
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(html)
            print(f"  [OK] {slug}.html")
        except Exception as e:
            print(f"  [HATA] {slug}: {e}")

    print(f"\n[TAMAM] {len(INVOICES)} fatura olusturuldu.")
    print("   Tarayicida acip PDF olarak kaydedip sisteme yukleyebilirsiniz.")


if __name__ == "__main__":
    main()
