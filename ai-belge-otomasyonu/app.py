#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KOOPERATİF OTOMASYON - WEB ARAYÜZÜ (FLASK)
Agent ordusu ile belge doldurma sistemi
"""

import os
import json
import re
import shutil
import base64
import threading
import queue
import time
from datetime import datetime
from pathlib import Path

from flask import Flask, render_template, request, jsonify, send_file, Response, stream_with_context
import google.generativeai as genai
from docx import Document
from docx.shared import Pt
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

# ============ KURULUM ============
app = Flask(__name__, template_folder="templates")
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024  # 100 MB

BASE_DIR    = Path(__file__).parent
UPLOAD_DIR  = BASE_DIR / "uploads"
OUTPUT_DIR  = BASE_DIR / "cikti"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

API_KEY = os.environ.get("GEMINI_API_KEY", "")
if API_KEY:
    genai.configure(api_key=API_KEY)

# Global ilerleme kuyruğu (SSE için)
progress_queue = queue.Queue()

# ============ AGENT PROMPT'LARI ============

DATE_FIXER_PROMPT = """
Sen bir Türkçe hukuki belge uzmanısın.

GÖREV: Verilen belgedeki TÜM tarihleri bugünün tarihine uygun hale getir.
- Toplantı tarihleri → gelecek 30 gün içinde mantıklı bir tarih
- "Bugün" referanslı tarihler → bugünün tarihi
- Yıl referansları → 2025 veya 2026
- DD.MM.YYYY formatını koru

Sadece tarihleri güncelle, diğer alanları değiştirme.
JSON formatında döndür: {"updated_content": "...", "changes": ["değiştirilen tarihler listesi"]}
"""

ANALYZER_PROMPT = """
Sen bir Türkçe belge analiz uzmanısın.

GÖREV: Verilen belgenin içeriğini analiz et ve tüm doldurulabilir alanları tespit et.
{{alan_adi}} formatındaki alanları, noktalı boşlukları (......) ve boş satır yer tutucularını bul.

Her alan için şunları üret:
- id: Makine tarafından okunabilir İngilizce alan adı (snake_case)
- label: Türkçe etiket (kısa, net)
- description: Kullanıcıya bu alanda ne yazacağını açıklayan Türkçe cümle (1-2 cümle, anlaşılır)
- example: Bu alan için gerçekçi bir Türkçe örnek değer
- type: text | date | number | tc | phone | address
- required: true/false

JSON formatında döndür:
{
  "filename": "dosya adı",
  "fields": [
    {
      "id": "kooperatif_unvan",
      "label": "Kooperatif Unvanı",
      "description": "Kooperatifin ticaret siciline kayıtlı tam resmi unvanı. Genellikle S.S. ile başlar.",
      "example": "S.S. Ankara Tarım Kooperatifi",
      "type": "text",
      "required": true
    },
    {
      "id": "toplanti_tarihi",
      "label": "Toplantı Tarihi",
      "description": "Genel kurul toplantısının yapılacağı tarih. GG.AA.YYYY formatında girin.",
      "example": "15.06.2025",
      "type": "date",
      "required": true
    }
  ],
  "raw_content": "belgenin tam metni"
}

ÖNEMLI: Sadece JSON döndür, başka metin yazma.
"""

EXTRACTOR_PROMPT = """
Sen bir Türkçe belge ve kimlik bilgisi çıkarma uzmanısın.

GÖREV: Verilen dosyalardan (resimler, belgeler) kişisel bilgileri çıkar:
- Ad Soyad
- TC Kimlik No (11 hane)
- Doğum Tarihi
- Adres
- Telefon
- E-posta
- Diğer kişisel bilgiler

JSON formatında döndür:
{
  "persons": [
    {
      "ad_soyad": "...",
      "tc_no": "...",
      "dogum_tarihi": "...",
      "adres": "...",
      "telefon": "...",
      "email": "...",
      "diger": {}
    }
  ],
  "kooperatif_bilgi": {
    "unvan": "...",
    "sicil_no": "...",
    "adres": "..."
  },
  "diger_bilgiler": {}
}
"""

FILLER_PROMPT = """
Sen bir Türkçe hukuki belge doldurma uzmanısın.

GÖREV:
Sağlanan verileri kullanarak şablon belgedeki boşlukları, noktaları (......) veya yer tutucuları ({{alan}}) doldur.
Senden belgenin tümünü yeniden yazmanı istemiyoruz. Belgedeki orijinal biçimlendirmenin korunması için sadece değiştirilecek hedef metin parçalarını ve yeni değerlerini tespit etmelisin.

YÖNERGELER:
1. Şablondaki boş alanları veya yer tutucuları bul.
2. Bu alanların benzersiz şekilde değiştirilebilmesi için, gerekirse çevresindeki birkaç kelimeyi de içeren hedef metinleri ("target") belirle.
   Örnek:
   Şablon metni: "Müdürlüğünün ...... Sicil numarasında"
   Hedef (target): "Müdürlüğünün ...... Sicil"
   Yeni Değer (value): "Müdürlüğünün 12345 Sicil"
3. Tarih formatı için şablondaki ayracı kullan. Eğer şablonda tarih alanı slaşla ayrılmışsa (Örn: "……/……/202…"), "Bugünün tarihi (slaçlı)" değerini kullan. Eğer nokta ile ayrılmışsa, "Bugünün tarihi (noktalı)" değerini kullan.
4. EĞER BİR ALAN EKSİKSE (veri bulunamadıysa), o alanın şablondaki yerini de kesinlikle "replacements" listesine ekle! 
   Eksik alanın "value" değerini "[EKSİK: alan_adi]" şeklinde yaz.
   Örnek:
   Şablon: "MERSİS Talep No: ......" (veri yoksa)
   Hedef (target): "MERSİS Talep No: ......"
   Yeni Değer (value): "MERSİS Talep No: [EKSİK: MERSİS Talep Numarası]"
5. Dolduramadığın alanları ayrıca "missing_fields" dizisine ekle.
6. ÇOK ÖNEMLİ KURAL: "target" değerini belirlerken ASLA sadece boşluklardan (      ) veya sadece noktalardan (......) oluşan metinler kullanma! Hedef metin mutlaka öncesindeki veya sonrasındaki kelimeleri de içermelidir (Örn: "UNVANI                     :" veya "ORTAK SAYISI        :" veya "tarihinde \\nsaat......'de"). Aksi takdirde belgedeki tüm boşluklar birbirine karışacaktır!
7. İKİ NOKTA ÜST ÜSTE (:) KURALI: Eğer şablondaki hedef metinde iki nokta üst üste varsa, yeni değerde de bu iki noktayı ve sonrasındaki boşluğu mutlaka koru (Örn: hedef "UNVANI                     :" ise yeni değer "UNVANI: [değer]" olmalıdır). Böylece iki noktalar kaybolmaz veya kelimeye yapışmaz!
8. TABLO HÜCRESİ KURALI: Şablon içeriğindeki tabloların hücreleri " | " (dikey çizgi) karakterleriyle ayrılmıştır. Hedef metin ("target") ASLA " | " karakterini içermemelidir! Birden fazla tablo hücresini veya satırını birleştiren tek bir hedef metin yazma. Her hücredeki yer tutucuyu ayrı ayrı hedef metinler ("target") olarak tanımla.
9. İMZA TABLOSU KURALI: Şablonlardaki "(İSİM İMZA)" veya "İMZA" ifadeleri imza atılacak alanı belirtir. Kişilerin isimlerini bu hücrelerin içine doğrudan yazma; bunun yerine imza tablosunun hemen altındaki veya yakınındaki isim yer tutucularını (örn: "…..") veya ad-soyad alanlarını doldur. Tablodaki "(İSİM İMZA)" veya "İMZA" ifadelerini olduğu gibi koru.
10. YENİ SATIR / PARAGRAF KURALI: Şablon içeriğindeki paragraflar yeni satır ("\n") karakteriyle ayrılmıştır. Hedef metin ("target") ASLA "\n" (yeni satır) karakterini içermemelidir! Birden fazla paragrafı birleştiren tek bir hedef metin yazma. Her paragraftaki boşluk veya yer tutucuyu ayrı ayrı hedef metinler ("target") olarak tanımla.

Dönüş Formatı (Sadece JSON):
{{
  "replacements": [
    {{"target": "bulunacak_orijinal_metin_veya_noktalar", "value": "yazilacak_yeni_dolu_deger"}}
  ],
  "filled_content": "Belgenin doldurulmuş halinin tam metni (fallback için)",
  "filled_count": 5,
  "missing_fields": ["alan_adi"],
  "is_complete": true/false
}}
""".format(today=datetime.now().strftime("%d.%m.%Y"))

GAP_PROMPT = """
Sen bir Türkçe belge kalite kontrol uzmanısın.

GÖREV: Doldurulan belgeleri incele ve rapor oluştur.

Markdown formatında döndür:
## EKSİK ALANLAR RAPORU

### Belge: [belge adı]
**Doluluk:** X/Y (%Z)

| Alan | Sebep | Çözüm |
|------|-------|-------|
| alan_adi | Veri bulunamadı | Açıklama |

### ÖZET
- Toplam: X alan
- Dolduruldu: Y
- Eksik: Z
"""
LAYOUT_OPTIMIZER_PROMPT = """
Sen Kooperatif Otomasyonu Görsel Düzen Ajanısın (Layout Optimizer).

GÖREV: Belgenin karakter sayısı, içerdiği paragraf ve tablo sayısına bakarak belgenin tek sayfaya en estetik şekilde sığmasını sağlayacak dikey boşluk (margin ve spacing) ayarlarını belirlemek.

Sana belgenin fiziksel metrikleri verilecek.
Eğer belge çok kısaysa (örn. 1000 karakterden az), boşlukları biraz genişlet.
Eğer belge normalse (örn. 1000-2000 karakter), standart ayarları kullan.
Eğer belge çok uzunsa (örn. 2000 karakterden fazla veya tablo varsa), tek sayfaya sığması için marjları ve satır aralıklarını daralt (ama okunabilirliği bozma).

Vereceğin kararlar şu sınırlar içinde olmalıdır:
- top_margin_cm: 1.0 ile 2.5 arası
- bottom_margin_cm: 0.8 ile 2.5 arası
- line_spacing: 1.0 ile 1.5 arası
- space_after_pt: 0 ile 6 arası

SADECE aşağıdaki JSON formatında yanıt ver:
{
  "top_margin_cm": 1.5,
  "bottom_margin_cm": 1.2,
  "line_spacing": 1.15,
  "space_after_pt": 2
}
"""

AUDITOR_PROMPT = """
Sen Kooperatif Otomasyonu Baş Denetçi Ajanısın (Quality Auditor).

GÖREV: Doldurulmuş kooperatif belgesi ile orijinal şablonu karşılaştırarak kalite kontrolü yap.
Şu kriterleri denetle:
1. **İçerik Bütünlüğü:** Orijinal şablondaki hukuki metinler aynen korunmuş mu? (Doldurulan değişkenler dışındaki kısımların değiştirilmemiş olması gerekir. Ajanın yanlışlıkla paragrafları silmediğinden veya değiştirmedinden emin ol).
2. **Karakter Hataları:** Türkçe karakter kodlama bozuklukları var mı (örn: , ý, þ gibi bozuk karakterler)?
3. **Tutarlılık:** Boş bırakılması gereken veya doldurulamayan alanlar [EKSİK: alan] şeklinde doğru etiketlenmiş mi?
4. **Biçimlendirme:** Tarih ve sayı formatları düzgün mü?

Eğer bir hata bulursan, hatayı detaylandır ve düzeltilmesi gereken talimatları yaz.
JSON formatında yanıt ver:
{
  "is_valid": true,
  "errors": ["hata açıklaması 1", "hata açıklaması 2"],
  "corrected_content": "Eğer ufak karakter hataları veya basit bozukluklar varsa, senin düzelttiğin nihai temiz metin."
}
"""

# ============ YARDIMCI FONKSİYONLAR ============

def emit_progress(step: int, name: str, status: str, detail: str = ""):
    """SSE'ye ilerleme gönder"""
    clean_detail = detail if step == 99 else detail[:200]
    msg = json.dumps({"step": step, "name": name, "status": status, "detail": clean_detail}, ensure_ascii=False)
    progress_queue.put(msg)

def read_file_content(filepath: Path) -> str:
    """Dosyayı oku (metin veya base64 görüntü/pdf)"""
    ext = filepath.suffix.lower()
    try:
        if ext in [".txt", ".md"]:
            return filepath.read_text(encoding="utf-8", errors="ignore")
        elif ext in [".docx"]:
            doc = Document(str(filepath))
            text_parts = []
            from docx.oxml.table import CT_Tbl
            from docx.oxml.text.paragraph import CT_P
            from docx.table import Table
            from docx.text.paragraph import Paragraph
            for child in doc.element.body:
                if isinstance(child, CT_P):
                    p = Paragraph(child, doc)
                    if p.text.strip():
                        text_parts.append(p.text)
                elif isinstance(child, CT_Tbl):
                    t = Table(child, doc)
                    for row in t.rows:
                        row_cells_text = []
                        for cell in row.cells:
                            cell_text = " ".join(p.text.strip() for p in cell.paragraphs if p.text.strip())
                            row_cells_text.append(cell_text)
                        text_parts.append(" | ".join(row_cells_text))
            return "\n".join(text_parts)
        elif ext in [".jpg", ".jpeg", ".png", ".bmp", ".webp"]:
            with open(filepath, "rb") as f:
                return f"[GÖRÜNTÜ:{filepath.name}|base64:{base64.b64encode(f.read()).decode()}]"
        elif ext in [".pdf"]:
            # Önce pypdf ile metin çıkarmayı deneyelim
            try:
                from pypdf import PdfReader
                reader = PdfReader(str(filepath))
                text = ""
                for page in reader.pages:
                    text += page.extract_text() or ""
                if text.strip():
                    return text
            except Exception as pdf_err:
                print(f"PDF metin okuma hatası (görsel moda geçiliyor): {pdf_err}")
            
            # Eğer PDF taratılmışsa (metin yoksa) veya hata aldıysak, 
            # PDF dosyasını base64 olarak Gemini'ye gönderelim (Gemini PDF'leri görebilir)
            with open(filepath, "rb") as f:
                return f"[PDF:{filepath.name}|base64:{base64.b64encode(f.read()).decode()}]"
        else:
            return filepath.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        return f"[HATA: {filepath.name} okunamadı: {e}]"

def call_gemini(system_prompt: str, user_content: str, step_name: str, max_retries=3) -> str:
    """Gemini API çağrısı (Limit aşıldığında yedek modellere geçer veya bekler, medya dosyalarını hazırlar)"""
    models_to_try = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite"
    ]
    
    # Aktif modeli hafızada tutalım
    if not hasattr(call_gemini, "current_model_idx"):
        call_gemini.current_model_idx = 0
        
    total_attempts = max_retries * len(models_to_try)
    
    # İçerikte base64 medya (GÖRÜNTÜ veya PDF) var mı diye kontrol et ve listeye dönüştür
    parts = []
    pattern = r"\[(GÖRÜNTÜ|PDF):([^|]+)\|base64:([^\]]+)\]"
    last_idx = 0
    
    for match in re.finditer(pattern, user_content):
        # Araya giren metin kısmını ekle
        parts.append(user_content[last_idx:match.start()])
        
        media_type = match.group(1)
        mime_type = "image/jpeg"
        if media_type == "PDF":
            mime_type = "application/pdf"
            
        data_b64 = match.group(3)
        try:
            parts.append({
                "mime_type": mime_type,
                "data": base64.b64decode(data_b64)
            })
        except Exception as e:
            print(f"Medya çözümleme hatası ({match.group(2)}): {e}")
            parts.append(match.group(0))
            
        last_idx = match.end()
        
    parts.append(user_content[last_idx:])
    contents = [p for p in parts if p != ""]
    
    # Eğer hiç medya bulunamadıysa düz metin olarak gönder
    if not contents:
        contents = user_content

    for attempt in range(total_attempts):
        model_name = models_to_try[call_gemini.current_model_idx]
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_prompt
            )
            response = model.generate_content(contents)
            return response.text
        except Exception as e:
            err_msg = str(e)
            # Günlük limit veya hız limiti aşıldığında (429 / quota exceeded)
            if "429" in err_msg or "quota" in err_msg.lower() or "limit" in err_msg.lower():
                old_model = model_name
                # Bir sonraki yedek modele geç
                call_gemini.current_model_idx = (call_gemini.current_model_idx + 1) % len(models_to_try)
                new_model = models_to_try[call_gemini.current_model_idx]
                
                emit_progress(0, "YEDEK MODEL", "running", 
                              f"{old_model} limiti doldu! Yedek model olan {new_model} deneniyor...")
                time.sleep(2) # Kısa bir geçiş süresi
                continue
            return json.dumps({"error": err_msg})
            
    return json.dumps({"error": "Üzgünüm, tüm yedek modellerin günlük limitleri doldu."})

def extract_json(text: str) -> dict:
    """Metinden JSON çıkar"""
    try:
        # Markdown code block varsa çıkar
        clean = re.sub(r"```(?:json)?\n?(.*?)\n?```", r"\1", text, flags=re.DOTALL).strip()
        return json.loads(clean)
    except:
        try:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                return json.loads(match.group())
        except:
            pass
        return {}

def generate_field_excel(session_id: str, fields_by_doc: dict) -> Path:
    """
    Tespit edilen alanları kullanıcı dostu bir Excel dosyasına dönüştür.
    fields_by_doc: {dosya_adi: [{"id":..,"label":..,"description":..,"example":..,"type":..,"required":..}, ...]}
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Veri Girişi"

    # ── Renkler ve stiller ────────────────────────────────
    header_fill   = PatternFill("solid", fgColor="1F3864")   # koyu lacivert
    doc_fill      = PatternFill("solid", fgColor="2E5090")   # orta lacivert (dosya satırı)
    input_fill    = PatternFill("solid", fgColor="FFFACD")   # açık sarı (kullanıcı giriş sütunu)
    req_fill      = PatternFill("solid", fgColor="FFF0F0")   # açık pembe (zorunlu alan satırı)
    opt_fill      = PatternFill("solid", fgColor="F0F8FF")   # açık mavi (opsiyonel alan satırı)
    white_fill    = PatternFill("solid", fgColor="FFFFFF")
    input_col_fill= PatternFill("solid", fgColor="FFFFE0")   # sarı - input hücresi

    header_font   = Font(name="Calibri", bold=True, color="FFFFFF", size=11)
    doc_font      = Font(name="Calibri", bold=True, color="FFFFFF", size=10)
    label_font    = Font(name="Calibri", bold=True, color="1F3864", size=10)
    desc_font     = Font(name="Calibri", color="444444", size=9)
    ex_font       = Font(name="Calibri", italic=True, color="666666", size=9)
    input_font    = Font(name="Calibri", color="000000", size=11)

    thin_side     = Side(style="thin", color="BBBBBB")
    thin_border   = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

    center_align  = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_align    = Alignment(horizontal="left",   vertical="center", wrap_text=True)

    # ── Sütun genişlikleri ────────────────────────────────
    ws.column_dimensions["A"].width = 22   # Dosya Adı
    ws.column_dimensions["B"].width = 24   # Alan Etiketi
    ws.column_dimensions["C"].width = 42   # Açıklama
    ws.column_dimensions["D"].width = 22   # Örnek Değer
    ws.column_dimensions["E"].width = 30   # ★ Sizin Değeriniz

    # ── Başlık satırı ─────────────────────────────────────
    headers = ["Dosya", "Alan", "Açıklama", "Örnek Değer", "★ Sizin Değeriniz"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill      = header_fill
        cell.font      = header_font
        cell.alignment = center_align
        cell.border    = thin_border

    # ── Başlık satırını dondur ────────────────────────────
    ws.freeze_panes = "A2"

    # ── Otomatik filtre ───────────────────────────────────
    ws.auto_filter.ref = "A1:E1"

    # ── Alan satırlarını doldur ───────────────────────────
    row = 2
    for doc_name, fields in fields_by_doc.items():
        if not fields:
            continue

        # Dosya başlığı satırı
        ws.merge_cells(f"A{row}:E{row}")
        doc_cell = ws.cell(row=row, column=1, value=f"📄  {doc_name}")
        doc_cell.fill      = doc_fill
        doc_cell.font      = doc_font
        doc_cell.alignment = left_align
        doc_cell.border    = thin_border
        ws.row_dimensions[row].height = 20
        row += 1

        for field in fields:
            is_req = field.get("required", True)
            row_fill = req_fill if is_req else opt_fill
            f_type   = field.get("type", "text")

            # A: Dosya (tekrar göster ama gri)
            cell_a = ws.cell(row=row, column=1, value=doc_name)
            cell_a.fill      = PatternFill("solid", fgColor="E8EEF8")
            cell_a.font      = Font(name="Calibri", color="666666", size=9)
            cell_a.alignment = left_align
            cell_a.border    = thin_border

            # B: Etiket
            label_text = field.get("label", field.get("id", ""))
            if is_req:
                label_text = "* " + label_text
            cell_b = ws.cell(row=row, column=2, value=label_text)
            cell_b.fill      = row_fill
            cell_b.font      = label_font
            cell_b.alignment = left_align
            cell_b.border    = thin_border

            # C: Açıklama
            cell_c = ws.cell(row=row, column=3, value=field.get("description", ""))
            cell_c.fill      = row_fill
            cell_c.font      = desc_font
            cell_c.alignment = left_align
            cell_c.border    = thin_border

            # D: Örnek
            cell_d = ws.cell(row=row, column=4, value=field.get("example", ""))
            cell_d.fill      = row_fill
            cell_d.font      = ex_font
            cell_d.alignment = left_align
            cell_d.border    = thin_border

            # E: Kullanıcı girişi — sarı arka plan
            cell_e = ws.cell(row=row, column=5, value="")
            cell_e.fill      = input_col_fill
            cell_e.font      = input_font
            cell_e.alignment = left_align
            cell_e.border    = Border(
                left=Side(style="medium", color="F59E0B"),
                right=Side(style="medium", color="F59E0B"),
                top=thin_side,
                bottom=thin_side
            )

            # TC doğrulama (11 hane)
            if f_type == "tc":
                dv = DataValidation(
                    type="textLength",
                    operator="equal",
                    formula1="11",
                    showErrorMessage=True,
                    errorTitle="Hatalı TC No",
                    error="TC Kimlik Numarası tam 11 hane olmalıdır."
                )
                ws.add_data_validation(dv)
                dv.add(cell_e)

            ws.row_dimensions[row].height = 22
            row += 1

        # Dosyalar arası boşluk
        row += 1

    # ── Açıklama notu ─────────────────────────────────────
    ws.merge_cells(f"A{row}:E{row}")
    note = ws.cell(row=row, column=1,
                   value="ℹ️  Yalnızca '★ Sizin Değeriniz' sütununu doldurun. * ile başlayan alanlar zorunludur.")
    note.font      = Font(name="Calibri", italic=True, color="888888", size=9)
    note.alignment = left_align

    # ── Kaydet ────────────────────────────────────────────
    out_dir  = OUTPUT_DIR / session_id
    out_dir.mkdir(exist_ok=True)
    xlsx_path = out_dir / "alan_veri_girisi.xlsx"
    wb.save(str(xlsx_path))
    return xlsx_path


def analyze_only_workflow(session_id: str, template_files: list):
    """
    Sadece Format Converter + Template Analyzer çalıştır, Excel üret.
    Kişisel belge gerektirmez.
    """
    session_dir = UPLOAD_DIR / session_id
    out_dir     = OUTPUT_DIR / session_id
    out_dir.mkdir(exist_ok=True)

    results = {"session_id": session_id, "status": "running", "fields_by_doc": {}}

    try:
        emit_progress(1, "Format Converter", "running", "Şablon dosyalar okunuyor...")
        time.sleep(0.3)

        template_contents = {}
        actual_files = []
        for tf in template_files:
            p = session_dir / "templates" / tf
            if not p.exists():
                continue
            if p.suffix.lower() == ".pdf":
                docx_name = p.stem + ".docx"
                docx_path = session_dir / "templates" / docx_name
                try:
                    from pdf2docx import Converter
                    cv = Converter(str(p)); cv.convert(str(docx_path)); cv.close()
                    p = docx_path; tf = docx_name
                except Exception as e:
                    print(f"PDF dönüşüm hatası: {e}")
            content = read_file_content(p)
            template_contents[tf] = content
            actual_files.append(tf)

        emit_progress(1, "Format Converter", "done",
                      f"{len(template_contents)} şablon hazır")

        emit_progress(2, "Template Analyzer", "running", "Alanlar tespit ediliyor...")
        time.sleep(0.3)

        fields_by_doc = {}
        for fname, content in template_contents.items():
            raw = call_gemini(
                ANALYZER_PROMPT,
                f"Dosya adı: {fname}\n\nİçerik:\n{content[:4000]}",
                "Template Analyzer"
            )
            parsed = extract_json(raw) or {}
            fields = parsed.get("fields", [])
            # field id'ye dosya adını da ekle (excel'de hangi alanda olduğunu bileceğiz)
            for f in fields:
                f["_doc"] = fname
            fields_by_doc[fname] = fields

        emit_progress(2, "Template Analyzer", "done",
                      f"{sum(len(v) for v in fields_by_doc.values())} alan tespit edildi")

        # Excel üret
        emit_progress(3, "Excel Üretici", "running", "Excel dosyası hazırlanıyor...")
        xlsx_path = generate_field_excel(session_id, fields_by_doc)
        emit_progress(3, "Excel Üretici", "done", "Excel hazır, indirebilirsiniz")

        results["status"]       = "done"
        results["fields_by_doc"] = fields_by_doc
        results["excel_file"]    = "alan_veri_girisi.xlsx"
        results["template_contents"] = template_contents   # filler için sakla

    except Exception as e:
        results["status"] = "error"
        results["error"]  = str(e)
        emit_progress(0, "HATA", "error", str(e))

    result_file = out_dir / "analyze_results.json"
    # template_contents büyük olabilir, kaydetmeyelim (zaten dosyada var)
    save_results = {k: v for k, v in results.items() if k != "template_contents"}
    with open(result_file, "w", encoding="utf-8") as f:
        json.dump(save_results, f, ensure_ascii=False, indent=2)

    emit_progress(99, "TAMAMLANDI", "done", json.dumps(save_results, ensure_ascii=False))
    return results


def fill_from_values_workflow(session_id: str, excel_values: dict):
    out_dir     = OUTPUT_DIR / session_id
    session_dir = UPLOAD_DIR / session_id

    # Analyze results'tan field haritasını al
    analyze_file = out_dir / "analyze_results.json"
    if not analyze_file.exists():
        emit_progress(0, "HATA", "error", "Önce 'Analiz Et' adımını çalıştırın.")
        return {"status": "error", "error": "analyze_results.json bulunamadı"}

    with open(analyze_file, encoding="utf-8") as f:
        analyze_data = json.load(f)

    fields_by_doc = analyze_data.get("fields_by_doc", {})

    results_file = out_dir / "results.json"
    if results_file.exists():
        try:
            with open(results_file, encoding="utf-8") as f:
                results = json.load(f)
        except Exception as e:
            print(f"Results okuma hatası: {e}")
            results = {"session_id": session_id, "filled_documents": [], "missing_documents": [], "status": "running"}
    else:
        results = {"session_id": session_id, "filled_documents": [], "missing_documents": [], "status": "running"}

    results["status"] = "running"
    if "filled_documents" not in results:
        results["filled_documents"] = []
    if "missing_documents" not in results:
        results["missing_documents"] = []

    for doc_name, field_values in excel_values.items():
        # Şablon dosyasını bul (templates klasöründe)
        src_template = session_dir / "templates" / doc_name
        if not src_template.exists():
            # pdf'den çevrilmiş docx olabilir
            stem = Path(doc_name).stem
            for ext in [".docx", ".doc"]:
                candidate = session_dir / "templates" / (stem + ext)
                if candidate.exists():
                    src_template = candidate
                    break

        # Şablon içeriğini oku
        content = read_file_content(src_template) if src_template.exists() else ""

        # FILLER prompt'u için veri hazırla
        fill_input = f"""
ŞABLON DOSYASI: {doc_name}

ŞABLON İÇERİĞİ:
{content[:3000]}

KULLANICININ GİRDİĞİ VERİLER (alan_id: değer):
{json.dumps(field_values, ensure_ascii=False, indent=2)}

ALAN AÇIKLAMALARI (hangi alan ne anlama geliyor):
{json.dumps([{"id": f.get("id"), "label": f.get("label"), "description": f.get("description")}
             for f in fields_by_doc.get(doc_name, [])], ensure_ascii=False, indent=2)}

Bugünün tarihi (noktalı): {datetime.now().strftime("%d.%m.%Y")}
Bugünün tarihi (slaçlı): {datetime.now().strftime("%d/%m/%Y")}
"""
        filled_raw  = call_gemini(FILLER_PROMPT, fill_input, "Document Filler")
        filled_data = extract_json(filled_raw) or {}

        filled_content  = filled_data.get("filled_content", "")
        missing_fields  = filled_data.get("missing_fields", [])
        replacements    = filled_data.get("replacements", [])
        is_complete     = filled_data.get("is_complete", len(missing_fields) == 0)

        stem     = Path(doc_name).stem
        out_name = f"{stem}_DOLU.docx"
        out_path = out_dir / out_name

        # Layout optimizer
        char_count = len(filled_content)
        layout_raw = call_gemini(
            LAYOUT_OPTIMIZER_PROMPT,
            f"Karakter Sayısı: {char_count}\nParagraf Sayısı: {filled_content.count(chr(10))}\n",
            "Layout Optimizer"
        )
        layout_settings = extract_json(layout_raw) or {}

        fill_template_docx(src_template, out_path,
                           replacements=replacements,
                           filled_content=filled_content,
                           layout_settings=layout_settings)

        missing_excel_name = None
        if not is_complete and len(missing_fields) > 0:
            try:
                fields_for_excel = []
                for mf in missing_fields:
                    fields_for_excel.append({
                        "id":          mf,
                        "label":       mf,
                        "description": "Girilmesi zorunlu veya eksik alan.",
                        "example":     "",
                        "type":        "text",
                        "required":    True,
                    })
                xlsx_name = f"{stem}_eksik_alanlar.xlsx"
                generate_field_excel(
                    session_id,
                    {doc_name: fields_for_excel}
                )
                generic = out_dir / "alan_veri_girisi.xlsx"
                specific = out_dir / xlsx_name
                import shutil as _shutil
                _shutil.copy2(str(generic), str(specific))
                missing_excel_name = xlsx_name
            except Exception as xe:
                print(f"Eksik alan Excel güncelleme hatası: {xe}")

        doc_result = {
            "original": doc_name,
            "output": out_name,
            "filled_count": filled_data.get("filled_count", len(field_values)),
            "missing_fields": missing_fields,
            "missing_excel": missing_excel_name,
            "is_complete": is_complete,
            "content_preview": filled_content[:300]
        }
        # Eski kayıtları temizle
        results["filled_documents"] = [d for d in results["filled_documents"] if d.get("original") != doc_name]
        results["missing_documents"] = [d for d in results["missing_documents"] if d.get("original") != doc_name]

        if is_complete:
            results["filled_documents"].append(doc_result)
        else:
            results["missing_documents"].append(doc_result)

    emit_progress(2, "Document Filler", "done",
                  f"{len(results['filled_documents'])} belge dolduruldu")

    results["status"] = "done"
    result_file = out_dir / "results.json"
    with open(result_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    emit_progress(99, "TAMAMLANDI", "done", json.dumps(results, ensure_ascii=False))
    return results


def fill_from_excel_workflow(session_id: str, excel_path: Path):
    """
    Kullanıcının doldurduğu Excel'i oku, şablonları doldur.
    """
    out_dir     = OUTPUT_DIR / session_id
    session_dir = UPLOAD_DIR / session_id

    # Analyze results'tan field haritasını al
    analyze_file = out_dir / "analyze_results.json"
    if not analyze_file.exists():
        emit_progress(0, "HATA", "error", "Önce 'Analiz Et' adımını çalıştırın.")
        return {"status": "error", "error": "analyze_results.json bulunamadı"}

    with open(analyze_file, encoding="utf-8") as f:
        analyze_data = json.load(f)

    fields_by_doc = analyze_data.get("fields_by_doc", {})

    # ── Excel'i oku ──────────────────────────────────────
    emit_progress(1, "Excel Okuyucu", "running", "Doldurulmuş Excel okunuyor...")
    wb   = openpyxl.load_workbook(str(excel_path))
    ws   = wb.active

    # row → (doc_name, field_id, value) eşlemesi yap
    # Satır yapısı: A=dosya, B=alan etiketi (*zorunlu), C=açıklama, D=örnek, E=değer
    # Dosya başlık satırlarını atla (A hücresinde 📄 var)
    excel_values = {}   # {doc_name: {field_id: value}}

    current_doc = None
    # fields_by_doc'tan label → id haritası yap
    label_to_id = {}
    for doc_name, fields in fields_by_doc.items():
        for fld in fields:
            clean_label = fld.get("label", "").lstrip("* ").strip()
            label_to_id[(doc_name, clean_label)] = fld.get("id", "")

    for row in ws.iter_rows(min_row=2, values_only=True):
        a_val = str(row[0] or "").strip()
        e_val = row[4]  # kullanıcı değeri (E sütunu)

        # Dosya başlık satırı
        if a_val.startswith("📄"):
            current_doc = a_val.replace("📄", "").strip()
            if current_doc not in excel_values:
                excel_values[current_doc] = {}
            continue

        if not current_doc or e_val is None or str(e_val).strip() == "":
            continue

        # B sütununda etiket var
        b_val = str(row[1] or "").lstrip("* ").strip()
        field_id = label_to_id.get((current_doc, b_val), b_val)

        excel_values[current_doc][field_id] = str(e_val).strip()

    emit_progress(1, "Excel Okuyucu", "done",
                  f"{sum(len(v) for v in excel_values.values())} değer okundu")

    # ── Her şablon için FILLER çalıştır ──────────────────
    emit_progress(2, "Document Filler", "running", "Belgeler dolduruluyor...")
    return fill_from_values_workflow(session_id, excel_values)


def target_to_regex(target):
    import re
    pattern_parts = []
    i = 0
    while i < len(target):
        char = target[i]
        if char in ['.', '…', '\u2026', ' ', '\t', '\n', '\r', '\x1f', '_']:
            if char in ['.', '…', '\u2026']:
                chars_class = r'[\.\u2026\u2026]'
                chars_set = {'.', '…', '\u2026'}
            elif char in [' ', '\t', '\x1f']:
                chars_class = r'[ \t\x1f]'
                chars_set = {' ', '\t', '\x1f'}
            elif char == '_':
                chars_class = r'_'
                chars_set = {'_'}
            else:
                chars_class = r'[\r\n]'
                chars_set = {'\r', '\n'}
                
            cnt = 0
            while i < len(target) and target[i] in chars_set:
                cnt += 1
                i += 1
            # Boşluk/nokta serisi uzunsa, benzer uzunlukta eşleşmesini zorunlu tutarak kısa noktaları (örn imza altı ..) ezmeyi önlüyoruz.
            if cnt >= 4:
                min_len = max(2, cnt - 4)
                pattern_parts.append(rf'{chars_class}{{{min_len},}}')
            else:
                pattern_parts.append(rf'{chars_class}+')
        else:
            c_lower = char.lower()
            if c_lower in ['i', 'ı', 'i̇']:
                pattern_parts.append('[iİıI]')
            elif c_lower in ['s', 'ş']:
                pattern_parts.append('[sşSŞ]')
            elif c_lower in ['c', 'ç']:
                pattern_parts.append('[cçCÇ]')
            elif c_lower in ['g', 'ğ']:
                pattern_parts.append('[gğGĞ]')
            elif c_lower in ['o', 'ö']:
                pattern_parts.append('[oöOÖ]')
            elif c_lower in ['u', 'ü']:
                pattern_parts.append('[uüUÜ]')
            else:
                pattern_parts.append(re.escape(char))
            i += 1
            
    return re.compile("".join(pattern_parts), re.IGNORECASE)

def set_run_text_with_newlines(run, text):
    run.text = ""
    parts = text.split("\n")
    for i, part in enumerate(parts):
        if i > 0:
            run.add_break()
        if part:
            run.add_text(part)

def replace_text_in_runs(paragraph, target, value):
    """
    Paragraftaki bir hedef metni (target) bulur ve run biçimlendirmelerini bozmadan
    değerle (value) değiştirir. Sadece hedef metnin yayıldığı run'ları birleştirir.
    """
    text = paragraph.text
    
    # Kısa yer tutucuların (örn: "…..") uzun boşlukları (örn: adres satırları) ezmesini önlemek için koruma
    is_all_dots = all(c in ['.', '…', '\u2026', ' ', '\t', '_'] for c in target)
    if is_all_dots and target.strip():
        p_dots_count = sum(1 for c in text if c in ['.', '…', '\u2026', '_'])
        target_dots_count = sum(1 for c in target if c in ['.', '…', '\u2026', '_'])
        if p_dots_count > max(15, target_dots_count * 3):
            return False
    regex = target_to_regex(target)
    match = regex.search(text)
    if not match:
        return False

    # Eğer paragrafın runs listesi boşsa ve hedef metin varsa fallback yap
    if not paragraph.runs:
        adjusted_value = value
        if match.start() > 0:
            char_before = text[match.start() - 1]
            if char_before.isalnum() and not adjusted_value.startswith(" "):
                adjusted_value = " " + adjusted_value
        if match.end() < len(text):
            char_after = text[match.end()]
            if char_after.isalnum() and not adjusted_value.endswith(" "):
                adjusted_value = adjusted_value + " "
        paragraph.text = regex.sub(adjusted_value, text, count=1)
        return True

    # Target metninin tüm başlangıç indekslerini bulup değiştirelim (sonsuz döngü koruması ile)
    search_offset = 0
    match = regex.search(text, search_offset)
    iterations = 0
    while match and iterations < 100:
        iterations += 1
        start_idx = match.start()
        end_idx = match.end()

        # Her bir run'ın başlangıç ve bitiş indekslerini güncel metne göre hesapla
        run_ranges = []
        current_char = 0
        for r in paragraph.runs:
            start = current_char
            end = start + len(r.text)
            run_ranges.append((start, end, r))
            current_char = end

        # Hangi run'ların bu aralığa girdiğini bulalım
        intersecting_runs = []
        for start, end, r in run_ranges:
            if not (end <= start_idx or start >= end_idx):
                intersecting_runs.append((start, end, r))

        if not intersecting_runs:
            break

        first_idx = intersecting_runs[0][0]
        last_idx = intersecting_runs[-1][1]
        
        combined_orig_text = "".join(x[2].text for x in intersecting_runs)
        local_start = start_idx - first_idx
        local_end = end_idx - first_idx
        
        # Akıllı Boşluk Düzeltici: Kelime birleşmelerini/yapışmalarını önlemek için
        adjusted_value = value
        if start_idx > 0:
            char_before = text[start_idx - 1]
            if char_before.isalnum() and not adjusted_value.startswith(" "):
                adjusted_value = " " + adjusted_value
        if end_idx < len(text):
            char_after = text[end_idx]
            if char_after.isalnum() and not adjusted_value.endswith(" "):
                adjusted_value = adjusted_value + " "

        new_text = combined_orig_text[:local_start] + adjusted_value + combined_orig_text[local_end:]
        
        # Tüm kesişen runs'ları temizle (ilk run hariç)
        for _, _, r in intersecting_runs[1:]:
            r.text = ""
            
        first_run = intersecting_runs[0][2]
        
        # Eğer değer içinde [EKSİK: varsa, metni bölelim ve sadece eksik kısmı kırmızı yapalım
        if "[EKSİK:" in new_text:
            parts = []
            temp_text = new_text
            while "[EKSİK:" in temp_text:
                start_eksik = temp_text.find("[EKSİK:")
                end_eksik = temp_text.find("]", start_eksik)
                if end_eksik == -1:
                    break
                
                before = temp_text[:start_eksik]
                eksik_val = temp_text[start_eksik:end_eksik+1]
                temp_text = temp_text[end_eksik+1:]
                
                if before:
                    parts.append((before, False))
                parts.append((eksik_val, True))
            
            if temp_text:
                parts.append((temp_text, False))
            
            # Runs'ları güncelle. İlk parçayı first_run'a yazalım.
            # Sonraki parçaları first_run'dan sonra yeni XML runs olarak ekleyelim.
            from docx.shared import RGBColor
            from docx.oxml import OxmlElement
            from docx.text.run import Run
            
            # Kaynak biçimleri alalım
            orig_bold = first_run.bold
            orig_italic = first_run.italic
            orig_font_name = first_run.font.name
            orig_font_size = first_run.font.size
            orig_color = None
            try:
                if first_run.font.color and first_run.font.color.rgb:
                    orig_color = first_run.font.color.rgb
            except:
                pass
            
            current_run = first_run
            first_text_written = False
            for txt, is_eksik in parts:
                if not first_text_written:
                    set_run_text_with_newlines(current_run, txt)
                    if is_eksik:
                        try:
                            current_run.font.color.rgb = RGBColor(255, 0, 0)
                            current_run.bold = True
                        except Exception as color_err:
                            print(f"Renk atama hatası: {color_err}")
                    else:
                        current_run.bold = orig_bold
                        current_run.italic = orig_italic
                        if orig_font_name:
                            current_run.font.name = orig_font_name
                        if orig_font_size:
                            current_run.font.size = orig_font_size
                        if orig_color:
                            current_run.font.color.rgb = orig_color
                    first_text_written = True
                else:
                    new_r = OxmlElement('w:r')
                    current_run._r.addnext(new_r)
                    new_run = Run(new_r, paragraph)
                    set_run_text_with_newlines(new_run, txt)
                    
                    new_run.bold = orig_bold
                    new_run.italic = orig_italic
                    if orig_font_name:
                        new_run.font.name = orig_font_name
                    if orig_font_size:
                        new_run.font.size = orig_font_size
                    if orig_color:
                        new_run.font.color.rgb = orig_color
                        
                    if is_eksik:
                        try:
                            new_run.font.color.rgb = RGBColor(255, 0, 0)
                            new_run.bold = True
                        except Exception as color_err:
                            print(f"Renk atama hatası: {color_err}")
                    current_run = new_run
        else:
            set_run_text_with_newlines(first_run, new_text)

        # Yeniden analiz et ve arama offsetini kaydır
        text = paragraph.text
        search_offset = start_idx + len(adjusted_value)
        match = regex.search(text, search_offset)
        
    return True

def fill_template_docx(template_path: Path, output_path: Path, replacements: list = None, filled_content: str = "", layout_settings: dict = None):
    """Şablonu verilerle doldur ve DOCX olarak kaydet (biçimlendirmeyi koruyarak)"""
    try:
        doc = Document(str(template_path))

        # ─── TABLO HÜCRELERİNDEKİ MÜKERRER YAZILARI TEMİZLE (pdf2docx hatası koruması) ───
        try:
            import re
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        txt = cell.text.strip()
                        # Örn: "(İSİM İMZA)(İSİM İMZA)" -> "(İSİM İMZA)" veya "İMZA İMZA" -> "İMZA"
                        match = re.match(r'^(.{3,})\s*\1$', txt)
                        if match:
                            clean_val = match.group(1)
                            for pi, p_cell in enumerate(cell.paragraphs):
                                if pi == 0:
                                    p_cell.text = clean_val
                                else:
                                    p_cell.text = ""
        except Exception as tbl_clean_err:
            print(f"Tablo temizleme hatası: {tbl_clean_err}")

        # ─── PARAGRAF BÖLÜCÜ (Yeni satır içeren paragrafları gerçek Word paragraflarına dönüştür) ───
        try:
            from docx.oxml import OxmlElement
            from docx.text.paragraph import Paragraph
            import docx
            qn = docx.oxml.ns.qn
            i = 0
            while i < len(doc.paragraphs):
                p = doc.paragraphs[i]
                if "\n" in p.text and len(p.runs) > 0:
                    runs_info = []
                    for r in p.runs:
                        runs_info.append({
                            "text": r.text,
                            "bold": r.bold,
                            "italic": r.italic,
                            "font_name": r.font.name,
                            "font_size": r.font.size,
                            "color": r.font.color.rgb if r.font.color else None
                        })
                    
                    groups = [[]]
                    for r_info in runs_info:
                        txt = r_info["text"]
                        if "\n" in txt:
                            parts = txt.split("\n")
                            if parts[0]:
                                groups[-1].append({**r_info, "text": parts[0]})
                            for part in parts[1:]:
                                groups.append([])
                                if part:
                                    groups[-1].append({**r_info, "text": part})
                        else:
                            groups[-1].append(r_info)
                    
                    if len(groups) > 1:
                        orig_style = p.style
                        orig_format = {
                            "space_before": p.paragraph_format.space_before,
                            "space_after": p.paragraph_format.space_after,
                            "line_spacing": p.paragraph_format.line_spacing,
                            "alignment": p.paragraph_format.alignment
                        }
                        
                        # Mevcut paragrafı temizle ve ilk grubu ekle
                        p_element = p._p
                        for r_elem in p_element.findall(qn('w:r')):
                            p_element.remove(r_elem)
                        
                        from docx.shared import Pt
                        p.paragraph_format.space_before = Pt(0)
                        p.paragraph_format.space_after = Pt(2)
                        p.paragraph_format.line_spacing = 1.0
                        
                        for r_info in groups[0]:
                            new_r = p.add_run(r_info["text"])
                            new_r.bold = r_info["bold"]
                            new_r.italic = r_info["italic"]
                            if r_info["font_name"]:
                                new_r.font.name = r_info["font_name"]
                            if r_info["font_size"]:
                                new_r.font.size = r_info["font_size"]
                            if r_info["color"]:
                                new_r.font.color.rgb = r_info["color"]
                        
                        # Sonraki her grubu yeni bir paragraf olarak ekle
                        current_p = p
                        for gp in groups[1:]:
                            new_p_elem = OxmlElement('w:p')
                            current_p._p.addnext(new_p_elem)
                            new_para = Paragraph(new_p_elem, p._parent)
                            new_para.style = orig_style
                            
                            new_para.paragraph_format.space_before = Pt(0)
                            new_para.paragraph_format.space_after = Pt(2)
                            new_para.paragraph_format.line_spacing = 1.0
                            new_para.paragraph_format.alignment = orig_format["alignment"]
                            
                            for r_info in gp:
                                new_r = new_para.add_run(r_info["text"])
                                new_r.bold = r_info["bold"]
                                new_r.italic = r_info["italic"]
                                if r_info["font_name"]:
                                    new_r.font.name = r_info["font_name"]
                                if r_info["font_size"]:
                                    new_r.font.size = r_info["font_size"]
                                if r_info["color"]:
                                    new_r.font.color.rgb = r_info["color"]
                            current_p = new_para
                i += 1
        except Exception as split_err:
            print(f"Paragraf bölme hatası: {split_err}")

        # ─── OTOMATİK TARİH DOLDURUCU (mismatch ve encoding koruması) ───
        import re
        from datetime import datetime
        # Gün/Ay/Yıl içeren tarih yer tutucularını yakalar. Örn: "../../202..", "___/___/____", "   /   /    "
        date_pattern = re.compile(r'(?:[_\.…\x1f]|\s){2,}/(?:[_\.…\x1f]|\s){2,}/(?:202[_\.…\x1f\s]*|(?:[_\.…\x1f]|\s){2,})')
        
        today_slashed = datetime.now().strftime("%d/%m/%Y")
        today_dotted = datetime.now().strftime("%d.%m.%Y")
        
        # Paragrafları tara
        for p in doc.paragraphs:
            match = date_pattern.search(p.text)
            if match:
                placeholder = match.group(0)
                date_val = today_slashed if "/" in placeholder else today_dotted
                replace_text_in_runs(p, placeholder, date_val)
                
        # Tabloları tara (tarih alanı tablonun içindeyse orayı da doldurabilmek için)
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        match = date_pattern.search(p.text)
                        if match:
                            placeholder = match.group(0)
                            date_val = today_slashed if "/" in placeholder else today_dotted
                            replace_text_in_runs(p, placeholder, date_val)

        if replacements and isinstance(replacements, list):
            # Hedef metin uzunluğuna göre azalan sırada sıralayalım. Böylece daha uzun yer tutucular
            # (örn. tüm paragrafı veya adresi kaplayan noktalar), daha kısa olan "….." gibi yer tutuculardan
            # önce değiştirilir ve kısa olanların uzun olanları bozması/önce kapması engellenir.
            sorted_replacements = sorted(replacements, key=lambda x: len(x.get("target", "")), reverse=True)
            for r in sorted_replacements:
                target = r.get("target", "")
                value = r.get("value", "")
                if not target:
                    continue
                
                # Paragrafları tara ve değiştir
                for p in doc.paragraphs:
                    replace_text_in_runs(p, target, value)
                                    
                # Tabloları tara ve değiştir
                for table in doc.tables:
                    for row in table.rows:
                        for cell in row.cells:
                            for p in cell.paragraphs:
                                replace_text_in_runs(p, target, value)
        else:
            # Eski usul satır satır değiştir (fallback)
            lines = filled_content.split("\n")
            for i, para in enumerate(doc.paragraphs):
                if i < len(lines):
                    if lines[i].strip():
                        para.text = lines[i]

        # Dengeli ve milimetrik sayfa sığdırma (Ajanın belirlediği estetik ayarlara göre)
        try:
            from docx.shared import Cm, Pt
            
            top_m = 1.8
            bot_m = 1.5
            
            if layout_settings:
                top_m = float(layout_settings.get("top_margin_cm", 1.8))
                bot_m = float(layout_settings.get("bottom_margin_cm", 1.5))

            for section in doc.sections:
                section.top_margin = Cm(top_m)
                section.bottom_margin = Cm(bot_m)
                section.left_margin = Cm(1.6)   # Sol ve sağ marjları daraltarak taşmayı önlüyoruz
                section.right_margin = Cm(1.6)
                
            for p in doc.paragraphs:
                p_text = p.text.strip()
                # Sadece EKLER bölümündeki boş nokta satırlarını daraltalım (böylece sayfa taşması önlenir)
                # Normal metinlerin orijinal şablon dikey boşluklarına (tarih arası vb.) kesinlikle dokunmayalım
                if p_text == ".":
                    p.paragraph_format.space_before = Pt(0)
                    p.paragraph_format.space_after = Pt(1)
                    p.paragraph_format.line_spacing = 1.0
                    for r in p.runs:
                        r.font.size = Pt(8)
                else:
                    if layout_settings:
                        # Estetik ajanın verdiği satır arası boşluklarını uygulayalım
                        # Fakat büyük dikey boşlukları (tasarım gereği bırakılmış boş satır veya araları) koruyalım
                        l_spacing = float(layout_settings.get("line_spacing", 1.15))
                        p.paragraph_format.line_spacing = l_spacing
                        
                        s_after = int(layout_settings.get("space_after_pt", 2))
                        orig_space_after = p.paragraph_format.space_after
                        if orig_space_after is not None and orig_space_after.pt > 6:
                            p.paragraph_format.space_after = Pt(orig_space_after.pt * 0.8)
                        else:
                            p.paragraph_format.space_after = Pt(s_after)
        except Exception as layout_err:
            print(f"Düzen sığdırma hatası: {layout_err}")

        # ─── PROGRAMMATİK İMZA BLOKU HİZALAMA VE DÜZENLEME ───
        try:
            for table in doc.tables:
                is_sig_table = False
                for row in table.rows:
                    for cell in row.cells:
                        txt_upper = cell.text.upper()
                        if "İMZA" in txt_upper or "İSİM" in txt_upper:
                            is_sig_table = True
                            break
                    if is_sig_table:
                        break
                
                if is_sig_table:
                    tbl_element = table._tbl
                    next_element = tbl_element.getnext()
                    if next_element is not None and next_element.tag.endswith('p'):
                        from docx.text.paragraph import Paragraph
                        p_next = Paragraph(next_element, doc)
                        p_text = p_next.text.strip()
                        # Eğer bu paragraf bir isim/yer tutucu içeriyorsa (ve bir sonraki bölüm başlığı değilse)
                        if p_text and not p_text.startswith("KOOPERATİFİN") and len(p_text) < 100:
                            import re
                            parts = re.split(r'\s{2,}', p_text)
                            if parts:
                                new_row = table.add_row()
                                p_next.text = "" # Orijinal paragrafı temizleyerek çift yazılmayı önlüyoruz
                                num_cols = len(table.columns)
                                if len(parts) == 1:
                                    target_col = num_cols - 1
                                    cell = new_row.cells[target_col]
                                    cell.text = parts[0]
                                    for p_cell in cell.paragraphs:
                                        p_cell.alignment = 1 # Center
                                else:
                                    for col_idx in range(min(len(parts), num_cols)):
                                        cell = new_row.cells[col_idx]
                                        cell.text = parts[col_idx]
                                        for p_cell in cell.paragraphs:
                                            p_cell.alignment = 1 # Center
        except Exception as sig_align_err:
            print(f"İmza hizalama hatası: {sig_align_err}")

        doc.save(str(output_path))
        return True
    except Exception as e:
        print(f"DOCX doldurma hatası: {e}")
        # Hata olursa düz metin olarak kaydet
        try:
            doc = Document()
            doc.add_heading("Kooperatif Belgesi", 0)
            for line in filled_content.split("\n"):
                doc.add_paragraph(line)
            doc.save(str(output_path))
            return True
        except:
            return False

# ============ ANA İŞLEM FONKSİYONU ============

def run_agent_workflow(session_id: str, template_files: list, personal_files: list):
    """
    5 agentlı iş akışını çalıştır
    """
    session_dir = UPLOAD_DIR / session_id
    out_dir     = OUTPUT_DIR / session_id
    out_dir.mkdir(exist_ok=True)

    results = {
        "session_id": session_id,
        "filled_documents": [],
        "missing_documents": [],
        "gap_report": "",
        "status": "running"
    }

    try:
        # ─── AJAN 1: FORMAT CONVERTER ───────────────────────────────
        emit_progress(1, "Format Converter", "running", "Dosyalar okunuyor ve PDF'ler Word'e çevriliyor...")
        time.sleep(0.5)

        template_contents = {}
        actual_template_files = []
        for tf in template_files:
            p = session_dir / "templates" / tf
            if p.exists():
                # Eğer şablon PDF ise onu önce DOCX'e çevirerek şablon yapalım
                if p.suffix.lower() == ".pdf":
                    docx_name = p.stem + ".docx"
                    docx_path = session_dir / "templates" / docx_name
                    try:
                        from pdf2docx import Converter
                        cv = Converter(str(p))
                        cv.convert(str(docx_path))
                        cv.close()
                        
                        # --- Kayıp Metin Kurtarıcı ---
                        try:
                            from pypdf import PdfReader
                            import docx as dx
                            reader = PdfReader(str(p))
                            pdf_text = ""
                            for page in reader.pages:
                                pdf_text += page.extract_text() or ""
                            
                            if pdf_text.strip():
                                doc_test = dx.Document(str(docx_path))
                                docx_texts = [para.text.strip() for para in doc_test.paragraphs if len(para.text.strip()) > 5]
                                if docx_texts:
                                    search_snippet = docx_texts[0][:30]
                                    idx = pdf_text.find(search_snippet)
                                    if idx > 0:
                                        missing_text = pdf_text[:idx].rstrip()
                                        if missing_text:
                                            # Eksik metinleri en başa ekleyelim (ters sırayla)
                                            lines = missing_text.split("\n")
                                            for line in reversed(lines):
                                                new_p = doc_test.paragraphs[0].insert_paragraph_before(line)
                                                # Orijinal font boyutu
                                                for r in new_p.runs:
                                                    r.font.name = 'Times New Roman'
                                                    r.font.size = dx.shared.Pt(11)
                                            doc_test.save(str(docx_path))
                                            print(f"[RECOVERY] pdf2docx tarafından atlanan {len(missing_text)} karakter geri eklendi.")
                        except Exception as rec_err:
                            print(f"[RECOVERY ERROR] {rec_err}")
                            
                        p = docx_path
                        tf = docx_name
                    except Exception as conv_err:
                        print(f"PDF'den DOCX'e çevrim hatası: {conv_err}")
                
                content = read_file_content(p)
                template_contents[tf] = content
                actual_template_files.append(tf)

        template_files = actual_template_files

        personal_data_raw = {}
        for pf in personal_files:
            p = session_dir / "personal" / pf
            if p.exists():
                content = read_file_content(p)
                personal_data_raw[pf] = content

        emit_progress(1, "Format Converter", "done",
                      f"{len(template_contents)} şablon, {len(personal_data_raw)} kişisel dosya hazır")

        # ─── AJAN 2: TEMPLATE ANALYZER ──────────────────────────────
        emit_progress(2, "Template Analyzer", "running", "Şablonlar analiz ediliyor...")
        time.sleep(0.5)

        analyzed_templates = {}
        for fname, content in template_contents.items():
            raw = call_gemini(
                ANALYZER_PROMPT,
                f"Dosya adı: {fname}\n\nİçerik:\n{content[:3000]}",
                "Template Analyzer"
            )
            analyzed_templates[fname] = {"raw_response": raw, "content": content}

        emit_progress(2, "Template Analyzer", "done",
                      f"{len(analyzed_templates)} şablon analiz edildi")

        # Şablonlardaki alanların detaylarını kaydet (Web / Excel düzeltme formu için)
        fields_by_doc = {}
        for fname, tdata in analyzed_templates.items():
            parsed = extract_json(tdata["raw_response"]) or {}
            fields = parsed.get("fields", [])
            for f in fields:
                f["_doc"] = fname
            fields_by_doc[fname] = fields
        results["fields_by_doc"] = fields_by_doc

        # ─── AJAN 3: DATA EXTRACTOR ─────────────────────────────────
        emit_progress(3, "Data Extractor", "running", "Kişisel veriler çıkarılıyor...")
        time.sleep(0.5)

        personal_summary = "\n\n".join([
            f"--- {fn} ---\n{content[:2000]}"
            for fn, content in personal_data_raw.items()
        ])

        extracted_raw = call_gemini(
            EXTRACTOR_PROMPT,
            f"Aşağıdaki dosyalardan kişisel bilgileri çıkar:\n\n{personal_summary}",
            "Data Extractor"
        )
        extracted_data = extract_json(extracted_raw) or {"raw": extracted_raw}

        emit_progress(3, "Data Extractor", "done", "Kişisel veriler hazır")

        # ─── AJAN 4: DOCUMENT FILLER ────────────────────────────────
        emit_progress(4, "Document Filler", "running", "Belgeler dolduruluyor...")
        time.sleep(0.5)

        filled_results = []
        missing_results = []

        for fname, tdata in analyzed_templates.items():
            fill_input = f"""
ŞABLON DOSYASI: {fname}

ŞABLON İÇERİĞİ:
{tdata['content'][:3000]}

ÇIKARILAN KİŞİSEL VERİLER:
{json.dumps(extracted_data, ensure_ascii=False, indent=2)[:2000]}

Bugünün tarihi (noktalı): {datetime.now().strftime("%d.%m.%Y")}
Bugünün tarihi (slaçlı): {datetime.now().strftime("%d/%m/%Y")}
"""
            filled_raw = call_gemini(FILLER_PROMPT, fill_input, "Document Filler")
            filled_data = extract_json(filled_raw) or {}

            filled_content = filled_data.get("filled_content", filled_raw)
            missing_fields = filled_data.get("missing_fields", [])
            is_complete    = filled_data.get("is_complete", len(missing_fields) == 0)

            # Kaynak şablon yolu ve çıktı yolu
            stem = Path(fname).stem
            out_name = f"{stem}_DOLU.docx"
            out_path = out_dir / out_name
            src_template = session_dir / "templates" / fname

            replacements_list = filled_data.get("replacements", [])

            # ── Eksik alanlar varsa otomatik Excel üret ──────────────
            missing_excel_name = None
            if missing_fields:
                try:
                    # Analyzer cevabından alan açıklamalarını al (varsa)
                    analyzer_raw  = analyzed_templates[fname].get("raw_response", "")
                    analyzer_data = extract_json(analyzer_raw) or {}
                    known_fields  = {f.get("id", ""): f
                                     for f in analyzer_data.get("fields", [])}

                    # Eksik alanları fields_by_doc formatına çevir
                    fields_for_excel = []
                    for mf in missing_fields:
                        info = known_fields.get(mf, {})
                        fields_for_excel.append({
                            "id":          mf,
                            "label":       info.get("label", mf),
                            "description": info.get("description",
                                           f"'{mf}' alanı doldurulamadı, lütfen girin."),
                            "example":     info.get("example", ""),
                            "type":        info.get("type", "text"),
                            "required":    True,
                        })

                    xlsx_name = f"{stem}_eksik_alanlar.xlsx"
                    generate_field_excel(
                        session_id,
                        {fname: fields_for_excel}
                    )
                    # generate_field_excel "alan_veri_girisi.xlsx" adıyla kaydeder;
                    # belgeye özgü isimle kopyalayalım
                    generic = out_dir / "alan_veri_girisi.xlsx"
                    specific = out_dir / xlsx_name
                    import shutil as _shutil
                    _shutil.copy2(str(generic), str(specific))
                    missing_excel_name = xlsx_name
                except Exception as xe:
                    print(f"Eksik alan Excel hatası ({fname}): {xe}")

            doc_result = {
                "original":      fname,
                "output":        out_name,
                "out_path":      str(out_path),
                "src_template":  str(src_template),
                "replacements_list": replacements_list,
                "filled_count":  filled_data.get("filled_count", 0),
                "missing_fields": missing_fields,
                "missing_excel": missing_excel_name,   # ← YENİ
                "is_complete":   is_complete,
                "full_content":  filled_content,
                "content_preview": filled_content[:500]
            }

            if is_complete or len(missing_fields) == 0:
                filled_results.append(doc_result)
            else:
                missing_results.append(doc_result)

        emit_progress(4, "Document Filler", "done",
                      f"{len(filled_results)} belge dolduruldu, {len(missing_results)} eksik")

        # ─── AJAN 5: LAYOUT OPTIMIZER ────────────────────────────────
        emit_progress(5, "Layout Optimizer", "running", "Estetik düzen ayarları hesaplanıyor...")
        time.sleep(0.5)

        all_docs = filled_results + missing_results
        for doc in all_docs:
            char_count = len(doc["full_content"])
            table_count = doc["full_content"].count("EKSİK: ") # Kaba bir tablo tahmini
            para_count = len(doc["full_content"].split("\n"))
            
            layout_input = f"""
Karakter Sayısı: {char_count}
Paragraf Sayısı: {para_count}
Eksik/Tablo tahmini: {table_count}
"""
            layout_raw = call_gemini(LAYOUT_OPTIMIZER_PROMPT, layout_input, "Layout Optimizer")
            layout_settings = extract_json(layout_raw) or {}
            
            # DOCX dosyasını oluştur ve layout ayarlarını uygula
            fill_template_docx(
                Path(doc["src_template"]), 
                Path(doc["out_path"]), 
                replacements=doc["replacements_list"], 
                filled_content=doc["full_content"],
                layout_settings=layout_settings
            )
            
            # Geçici verileri temizle
            doc.pop("out_path", None)
            doc.pop("src_template", None)
            doc.pop("replacements_list", None)
            
        emit_progress(5, "Layout Optimizer", "done", "Estetik düzen ayarları uygulandı")

        # ─── AJAN 6: QUALITY AUDITOR ────────────────────────────────
        emit_progress(6, "Quality Auditor", "running", "Belgelerin kalitesi denetleniyor ve karakterler düzeltiliyor...")
        time.sleep(0.5)


        audited_filled_results = []
        audited_missing_results = []
        all_to_audit = filled_results + missing_results

        for doc in all_to_audit:
            orig_name = doc["original"]
            orig_content = template_contents[orig_name]
            
            audit_input = f"""
ORİJİNAL ŞABLON:
{orig_content[:3000]}

DOLDURULMUŞ METİN:
{doc['full_content'][:3000]}
"""
            audit_raw = call_gemini(AUDITOR_PROMPT, audit_input, "Quality Auditor")
            audit_data = extract_json(audit_raw) or {}
            
            # Eğer denetçi düzeltilmiş temiz metin sunduysa onu kullanalım
            final_content = audit_data.get("corrected_content", doc["full_content"])
            
            # Kalite denetimi tamamlandı, biçimlendirmeyi korumak için belgeyi tekrar ezmiyoruz
            out_path = out_dir / doc["output"]
            
            doc["full_content"] = final_content
            doc["content_preview"] = final_content[:500]
            doc["audit_errors"] = audit_data.get("errors", [])
            doc["is_valid"] = audit_data.get("is_valid", True)
            
            if doc["is_complete"]:
                audited_filled_results.append(doc)
            else:
                audited_missing_results.append(doc)

        results["filled_documents"] = audited_filled_results
        results["missing_documents"] = audited_missing_results

        emit_progress(6, "Quality Auditor", "done", 
                      f"{len(all_to_audit)} belge kalite denetiminden geçti")

        # ─── AJAN 7: GAP REPORTER ───────────────────────────────────
        emit_progress(7, "Gap Reporter", "running", "Eksiklik raporu hazırlanıyor...")
        time.sleep(0.5)

        gap_input = f"""
Doldurma ve Denetim sonuçları:
Tamamlanan: {json.dumps(audited_filled_results, ensure_ascii=False)[:1000]}
Eksik kalan: {json.dumps(audited_missing_results, ensure_ascii=False)[:1000]}
"""
        gap_report = call_gemini(GAP_PROMPT, gap_input, "Gap Reporter")
        results["gap_report"] = gap_report

        emit_progress(7, "Gap Reporter", "done", "Rapor hazır")

        results["status"] = "done"

    except Exception as e:
        results["status"] = "error"
        results["error"]  = str(e)
        emit_progress(0, "HATA", "error", str(e))

    # Sonuçları kaydet
    result_file = out_dir / "results.json"
    with open(result_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    emit_progress(99, "TAMAMLANDI", "done", json.dumps(results, ensure_ascii=False))
    return results

# ============ FLASK ROUTE'LARI ============

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/upload", methods=["POST"])
def upload_files():
    """Dosyaları yükle"""
    session_id = f"session_{int(time.time())}"
    session_dir = UPLOAD_DIR / session_id
    template_dir = session_dir / "templates"
    personal_dir = session_dir / "personal"
    template_dir.mkdir(parents=True, exist_ok=True)
    personal_dir.mkdir(parents=True, exist_ok=True)

    template_names = []
    personal_names = []

    # Şablon dosyaları
    for f in request.files.getlist("templates"):
        if f.filename:
            safe = Path(f.filename).name
            f.save(str(template_dir / safe))
            template_names.append(safe)

    # Kişisel dosyalar
    for f in request.files.getlist("personal"):
        if f.filename:
            safe = Path(f.filename).name
            f.save(str(personal_dir / safe))
            personal_names.append(safe)

    return jsonify({
        "session_id": session_id,
        "templates": template_names,
        "personal": personal_names
    })

@app.route("/process", methods=["POST"])
def process():
    """Ajan iş akışını başlat"""
    data = request.json
    session_id     = data.get("session_id")
    template_files = data.get("templates", [])
    personal_files = data.get("personal", [])

    # Arka planda çalıştır
    thread = threading.Thread(
        target=run_agent_workflow,
        args=(session_id, template_files, personal_files),
        daemon=True
    )
    thread.start()
    return jsonify({"status": "started", "session_id": session_id})

@app.route("/stream")
def stream():
    """SSE: Canlı ilerleme akışı"""
    def generate():
        while True:
            try:
                msg = progress_queue.get(timeout=30)
                yield f"data: {msg}\n\n"
                data = json.loads(msg)
                if data.get("step") == 99:
                    break
            except queue.Empty:
                yield "data: {\"step\":0,\"name\":\"ping\",\"status\":\"wait\"}\n\n"
    return Response(stream_with_context(generate()),
                    mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.route("/results/<session_id>")
def get_results(session_id):
    """Sonuçları getir"""
    out_dir = OUTPUT_DIR / session_id
    result_file = out_dir / "results.json"
    if result_file.exists():
        with open(result_file, encoding="utf-8") as f:
            data = json.load(f)
        
        # Eğer analyze_results.json varsa fields_by_doc ekle
        analyze_file = out_dir / "analyze_results.json"
        if analyze_file.exists():
            try:
                with open(analyze_file, encoding="utf-8") as af:
                    adata = json.load(af)
                    if "fields_by_doc" in adata:
                        data["fields_by_doc"] = adata["fields_by_doc"]
            except Exception as e:
                print(f"Analyze results okuma hatası: {e}")
                
        return jsonify(data)
    return jsonify({"error": "Sonuç bulunamadı"}), 404

@app.route("/download/<session_id>/<filename>")
def download_file(session_id, filename):
    """Dosya indir"""
    filepath = OUTPUT_DIR / session_id / filename
    if filepath.exists():
        return send_file(str(filepath), as_attachment=True, download_name=filename)
    return "Dosya bulunamadı", 404

@app.route("/analyze", methods=["POST"])
def analyze_templates():
    """Sadece şablonları analiz et ve Excel üret (kişisel dosya gerekmez)"""
    data           = request.json
    session_id     = data.get("session_id")
    template_files = data.get("templates", [])

    thread = threading.Thread(
        target=analyze_only_workflow,
        args=(session_id, template_files),
        daemon=True
    )
    thread.start()
    return jsonify({"status": "started", "session_id": session_id})


@app.route("/get_excel/<session_id>")
def get_excel(session_id):
    """Üretilen Excel şablonunu indir"""
    xlsx_path = OUTPUT_DIR / session_id / "alan_veri_girisi.xlsx"
    if xlsx_path.exists():
        return send_file(
            str(xlsx_path),
            as_attachment=True,
            download_name="alan_veri_girisi.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    return jsonify({"error": "Excel bulunamadı. Önce analiz yapın."}), 404


@app.route("/fill_from_excel", methods=["POST"])
def fill_from_excel():
    """Kullanıcının doldurduğu Excel ile belgeleri doldur"""
    session_id = request.form.get("session_id")
    doc_name   = request.form.get("doc_name")  # tek belge güncellemesi için
    if not session_id:
        return jsonify({"error": "session_id eksik"}), 400

    excel_file = request.files.get("excel")
    if not excel_file:
        return jsonify({"error": "Excel dosyası yüklenmedi"}), 400

    # Excel'i geçici kaydet
    out_dir    = OUTPUT_DIR / session_id
    out_dir.mkdir(exist_ok=True)
    excel_path = out_dir / f"filled_by_user_{doc_name or 'all'}.xlsx"
    excel_file.save(str(excel_path))

    if doc_name:
        # Tek belge güncelleniyorsa senkron çalış ve sonucu dön
        try:
            res = fill_from_excel_workflow(session_id, excel_path)
            return jsonify(res)
        except Exception as e:
            return jsonify({"status": "error", "error": str(e)}), 500
    else:
        # Tüm şablonlar ise arka planda çalıştır
        thread = threading.Thread(
            target=fill_from_excel_workflow,
            args=(session_id, excel_path),
            daemon=True
        )
        thread.start()
        return jsonify({"status": "started", "session_id": session_id})


@app.route("/fix_missing", methods=["POST"])
def fix_missing():
    """Eksik belgeleri düzelt - yeni bilgilerle"""
    data = request.json
    session_id  = data.get("session_id")
    extra_info  = data.get("extra_info", {})
    doc_name    = data.get("doc_name", "")

    if not session_id or not doc_name:
        return jsonify({"error": "Parametreler eksik"}), 400

    try:
        # Senkron olarak sadece bu belgeyi doldur ve güncel sonuçları dön
        res = fill_from_values_workflow(session_id, {doc_name: extra_info})
        return jsonify({"status": "fixed", "results": res})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route("/fill_from_json", methods=["POST"])
def fill_from_json():
    """Kullanıcının gönderdiği JSON değerleriyle tüm belgeleri doldur"""
    data = request.json
    session_id = data.get("session_id")
    values_by_doc = data.get("values_by_doc", {})

    if not session_id:
        return jsonify({"error": "session_id eksik"}), 400

    try:
        res = fill_from_values_workflow(session_id, values_by_doc)
        return jsonify({"status": "done", "results": res})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

if __name__ == "__main__":
    print("=" * 60)
    print(" KOOPERATİF OTOMASYON SİSTEMİ - WEB ARAYÜZÜ")
    print("=" * 60)
    print(" Adres: http://localhost:5000")
    print(" Kapatmak için: CTRL+C")
    print("=" * 60)
    app.run(debug=False, port=5000, threaded=True)
