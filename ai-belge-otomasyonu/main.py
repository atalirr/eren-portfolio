#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KOOPERATİF OTOMASYONU - PURE CLAUDE AGENTS SISTEMI
Yapılacakları: Şablonları doldur, eksiklikleri rapor et
"""

import json
import os
import google.generativeai as genai
from datetime import datetime

# ============================================
# AGENT PROMPT'LARI (Her agentn in kendi talimatları)
# ============================================

MASTER_PROMPT = """
SEN: Kooperatif otomasyonu sisteminin başkomutanısın.

GOREV: Kullanıcının input'unu al ve aşağıdaki agentlara task dağıt:
1. FORMAT CONVERTER → Şablonları DOCX'e çevir
2. TEMPLATE ANALYZER → Field'leri tespit et
3. DATA VALIDATOR → Excel verilerini doğrula
4. DOCUMENT FILLER → Belgeler doldur
5. GAP REPORTER → Eksiklikleri rapor et

AGENTLARA TASK DAĞITMA:
Şu format'ta yanıt ver:

[AGENT_TASK]
agent_name: format_converter
input: <input_data>
[/AGENT_TASK]

Sonra çıktıyı:
[AGENT_RESULT]
agent_name: format_converter
result: <sonuç>
[/AGENT_RESULT]

SIRAYLA ÇAĞIR:
1. Format converter
2. Template analyzer (format converter'ın çıktısını input al)
3. Data validator (template analyzer'ın çıktısını input al)
4. Document filler + Gap reporter paralel (validator'ın çıktısını input al)

Her adımda başarı kontrol et. BAŞARILI olursa sonraki adıma geç.
"""

FORMAT_CONVERTER_PROMPT = """
SEN: Dosya format dönüştürme uzmanısın.

GOREV:
Gelen dosya listesini oku. Her dosya için:
1. Format tespit et (extension'dan)
2. Dönüştürme yöntemi belirle:
   - .pdf → Açıkla nasıl DOCX'e çevirileceğini
   - .xlsx → Excel → DOCX (tablo koru)
   - .doc → Eski Word → Yeni DOCX
   - .docx → Zaten DOCX, değiştirme

3. Simüle et dönüştürmeyi (gerçekten yapma, aç-kapa yap sadece)
4. Başarı rapor et

OUTPUT (JSON):
{
  "success": true/false,
  "files": [
    {
      "original_name": "template.pdf",
      "converted_name": "template.docx",
      "method": "pandoc",
      "status": "success"
    }
  ]
}
"""

TEMPLATE_ANALYZER_PROMPT = """
SEN: Şablon analiz uzmanısın. DOCX dosyalarını oku ve field'leri tespit et.

GOREV:
Gelen dosyaların içeriğini analiz et:
1. {{field_name}} şeklinde değişkenleri bul
2. Tablo hücrelerindeki alanları tespit et
3. Her alan için:
   - Adı
   - Tipi (text/date/number)
   - Zorunlu olup olmadığı
   - Konumu

ÖRNEK DOCX içeriği verilecek, sen analiz et.

OUTPUT (JSON):
{
  "templates": [
    {
      "filename": "dilekçe.docx",
      "fields": [
        {
          "id": "kooperatif_unvan",
          "type": "text",
          "required": true,
          "example": "XYZ Kooperatifi"
        },
        {
          "id": "toplanti_tarihi",
          "type": "date",
          "format": "DD.MM.YYYY",
          "required": true
        }
      ]
    }
  ]
}
"""

DATA_VALIDATOR_PROMPT = """
SEN: Veri doğrulama uzmanısın.

GOREV:
Template mapping ve Excel verilerini al. Kontrol et:
1. Gerekli alanlar var mı?
2. Format doğru mu? (TC=11 hane, Tarih=DD.MM.YYYY)
3. Eksik veriler neler?

VALIDATION RULES:
- tc_no: 11 hane, numeric
- tarih: DD.MM.YYYY format
- email: @ içermeli
- telefon: 10-11 hane

OUTPUT (JSON):
{
  "valid_records": [
    {
      "person_name": "Ahmet Yılmaz",
      "kooperatif_unvan": "XYZ Kooperatifi",
      ...
    }
  ],
  "errors": [
    {
      "row": 2,
      "field": "tc_no",
      "value": "123456789",
      "error": "11 hane olmalı",
      "solution": "Excel'i kontrol et"
    }
  ],
  "summary": {
    "total": 5,
    "valid": 4,
    "invalid": 1
  }
}
"""

DOCUMENT_FILLER_PROMPT = """
SEN: Şablonları verilerle doldurma uzmanısın.

GOREV:
1. Her kişi için şablonu doldur
2. {{field}} → data.field ile eşle
3. Smart matching:
   - {{uye_1_isim}} → 1. kişi
   - {{uye_2_isim}} → 2. kişi
4. Doldurulamayanlar: [MISSING: field_name] yaz

OUTPUT (JSON):
{
  "filled_documents": [
    {
      "cooperative": "XYZ Kooperatifi",
      "template": "dilekçe.docx",
      "output": "XYZ_dilekçe_DOLU.docx",
      "fields_filled": 10,
      "fields_missing": 1,
      "missing": ["toplanti_tarihi"],
      "content": "Dokümantasyon içeriğinin {{field}} yerine data doldurulmuş hali..."
    }
  ]
}
"""

GAP_REPORTER_PROMPT = """
SEN: Eksiklik raporu uzmanısın.

GOREV:
Doldurulamayan alanları raporla. Her biri için:
- Alan adı
- Neden doldurulamadı
- Çözüm önerisi

OUTPUT (Markdown):
# EKSIKLIK RAPORU
**Tarih:** DD.MM.YYYY

## Kooperatif Adı

**Doldurma Oranı:** X/Y (%Z)

### ❌ Doldurulamayan Alanlar

**Alan:** toplanti_tarihi
**Sebep:** Veri sağlanmadı
**Çözüm:** Excel'e tarih ekle (DD.MM.YYYY)

---

**ÖZET**
- Toplam gerekli alan: X
- Dolduruldu: Y
- Eksik: Z
"""

# ============================================
# MAIN SISTEM
# ============================================

class KoopAutomationSystem:
    def __init__(self):
        # 1. ADIM: GEMINI API KEY BURAYA EKLENECEK
        api_key = os.environ.get("GEMINI_API_KEY", "")
        genai.configure(api_key=api_key)
        
        self.step_results = {}

    def call_agent(self, agent_name, agent_prompt, input_data, step_number):
        """
        Bir agenti çağır ve cevabını al
        """
        print(f"\n{'='*60}")
        print(f"--- ADIM {step_number}: {agent_name.upper()}")
        print(f"{'='*60}")

        try:
            # Gemini modelini her agent için kendi sistem promptu ile oluşturuyoruz
            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=agent_prompt
            )

            user_prompt = f"""
            YAPACAĞIN GOREVİN INPUT'U:

            {json.dumps(input_data, ensure_ascii=False, indent=2)}

            Lütfen bu görev için çıktı ver.
            Mümkün olduğunca JSON format'ta yaz, parse edilebilir olsun.
            Türkçe karakterleri koru.
            """
            
            response = model.generate_content(user_prompt)
            response_text = response.text
            
            print(f"Basarili!")
            print(f"\n Cikti (ilk 500 karakter):\n{response_text[:500]}...")

            return response_text

        except Exception as e:
            print(f"HATA: {str(e)}")
            return None

    def run_workflow(self, templates_input, excel_data_input):
        """
        Tüm workflow'u çalıştır
        """
        print("\n" + "---" * 20)
        print("KOOPERATİF OTOMASYONU BAŞLIYOR")
        print("---" * 20)

        # STEP 1: Format Converter
        step1_result = self.call_agent(
            agent_name="Format Converter",
            agent_prompt=FORMAT_CONVERTER_PROMPT,
            input_data={
                "task": "Şablonları DOCX'e çevir",
                "templates": templates_input
            },
            step_number=1
        )
        self.step_results["format_converter"] = step1_result

        if not step1_result:
            return {"error": "Format converter başarısız oldu"}

        # STEP 2: Template Analyzer
        step2_result = self.call_agent(
            agent_name="Template Analyzer",
            agent_prompt=TEMPLATE_ANALYZER_PROMPT,
            input_data={
                "task": "Şablonları analiz et ve field'leri tespit et",
                "converted_files": step1_result,
                "sample_content": templates_input
            },
            step_number=2
        )
        self.step_results["template_analyzer"] = step2_result

        if not step2_result:
            return {"error": "Template analyzer başarısız oldu"}

        # STEP 3: Data Validator
        step3_result = self.call_agent(
            agent_name="Data Validator",
            agent_prompt=DATA_VALIDATOR_PROMPT,
            input_data={
                "task": "Excel verilerini doğrula",
                "field_mapping": step2_result,
                "excel_data": excel_data_input
            },
            step_number=3
        )
        self.step_results["data_validator"] = step3_result

        if not step3_result:
            return {"error": "Data validator başarısız oldu"}

        # STEP 4: Document Filler
        step4_result = self.call_agent(
            agent_name="Document Filler",
            agent_prompt=DOCUMENT_FILLER_PROMPT,
            input_data={
                "task": "Şablonları verilerle doldur",
                "templates": step1_result,
                "valid_data": step3_result,
                "mapping": step2_result
            },
            step_number=4
        )
        self.step_results["document_filler"] = step4_result

        # STEP 5: Gap Reporter (Paralel çalışıyor ama sıra sıra yazıyoruz)
        step5_result = self.call_agent(
            agent_name="Gap Reporter",
            agent_prompt=GAP_REPORTER_PROMPT,
            input_data={
                "task": "Eksiklikleri rapor et",
                "validation_errors": step3_result,
                "filled_documents": step4_result
            },
            step_number=5
        )
        self.step_results["gap_reporter"] = step5_result

        # FINAL SUMMARY
        print("\n" + "="*60)
        print("ISLEM TAMAMLANDI!")
        print("="*60)

        return {
            "status": "success",
            "filled_documents": step4_result,
            "gap_report": step5_result,
            "all_steps": self.step_results
        }

# ============================================
# TEST VERİSİ (KOPYA-YAPIŞTUR)
# ============================================

SAMPLE_TEMPLATES = {
    "dilekçe_genel_kurul.docx": """
    ANKARA VALİLİĞİNE
    (Ticaret İl Müdürlüğü)

    Konu: Temsilci İsteği

    S.S. {{kooperatif_unvan}} Kooperatifinin {{olagan_olaganustu}}
    genel kurul toplantısı; {{toplanti_tarihi}} tarihinde
    saat {{toplanti_saati}}'de {{toplanti_adresi}} adresinde yapılacaktır.

    Bilgi edinilmesini arz ederim.

    {{kurul_adi}} KURULU ÜYELERİ

    1. {{uye_1_ad_soyad}} (TC: {{uye_1_tc}})
    2. {{uye_2_ad_soyad}} (TC: {{uye_2_tc}})

    KOOPERATİFİN:
    UNVANI: {{kooperatif_unvan}}
    TİCARET SİCİL NO: {{ticaret_sicil_no}}
    TELEFON: {{telefon}}
    YAZIŞMA ADRESİ: {{yazisma_adresi}}
    """
}

SAMPLE_EXCEL_DATA = {
    "rows": [
        {
            "kooperatif_unvan": "XYZ Tarım Kooperatifi",
            "toplanti_tarihi": "15.06.2024",
            "toplanti_saati": "10:00",
            "toplanti_adresi": "Ankara Ticaret Odası",
            "olagan_olaganustu": "Olağan",
            "kurul_adi": "Yönetim Kurulu",
            "uye_1_ad_soyad": "Ahmet Yılmaz",
            "uye_1_tc": "12345678901",
            "uye_2_ad_soyad": "Fatma Kaya",
            "uye_2_tc": "98765432109",
            "ticaret_sicil_no": "12345",
            "telefon": "0312-1234567",
            "yazisma_adresi": "Ankara, Çankaya"
        },
        {
            "kooperatif_unvan": "ABC İthalatçılar Kooperatifi",
            "toplanti_tarihi": "20.06.2024",
            "toplanti_saati": "14:00",
            "toplanti_adresi": "ABC Ofis",
            "olagan_olaganustu": "Olağanüstü",
            "kurul_adi": "Denetim Kurulu",
            "uye_1_ad_soyad": "Mehmet Demir",
            "uye_1_tc": "11111111111",
            "uye_2_ad_soyad": "Ayşe Şahin",
            "uye_2_tc": "",  # EKSIK - Test için
            "ticaret_sicil_no": "67890",
            "telefon": "0312-9876543",
            "yazisma_adresi": "Ankara, Keçiören"
        }
    ]
}

# ============================================
# ÇALIŞTI!
# ============================================

if __name__ == "__main__":
    system = KoopAutomationSystem()

    result = system.run_workflow(
        templates_input=SAMPLE_TEMPLATES,
        excel_data_input=SAMPLE_EXCEL_DATA
    )

    # 1. JSON kaydet
    output_file = "koop_automation_result.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n Sonuclar kaydedildi: {output_file}")

    # 2. HTML RAPOR olustur - tarayicida ac
    gap_report  = result.get("gap_report", "Rapor olusturulamadi.") or ""
    filled_docs = result.get("filled_documents", "") or ""

    all_steps = result.get("all_steps", {})
    s1 = (all_steps.get("format_converter",   "") or "")[:400]
    s2 = (all_steps.get("template_analyzer",  "") or "")[:400]
    s3 = (all_steps.get("data_validator",     "") or "")[:400]
    s4 = (all_steps.get("document_filler",    "") or "")[:400]
    s5 = (all_steps.get("gap_reporter",       "") or "")[:400]
    tarih = datetime.now().strftime("%d.%m.%Y %H:%M")

    html_content = """<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kooperatif Otomasyon Raporu</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; min-height: 100vh; padding: 30px; }
    h1 { font-size: 2rem; text-align: center; margin-bottom: 8px;
         background: linear-gradient(90deg, #6ee7b7, #3b82f6);
         -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { text-align: center; color: #64748b; margin-bottom: 30px; }
    .card { background: #1e2433; border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 1px solid #2d3748; }
    .card h2 { font-size: 1.2rem; margin-bottom: 16px; color: #6ee7b7; border-bottom: 1px solid #2d3748; padding-bottom: 10px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 0.8rem;
             background: #22c55e22; color: #22c55e; border: 1px solid #22c55e44; margin-bottom: 12px; }
    .badge.warn { background: #f59e0b22; color: #f59e0b; border-color: #f59e0b44; }
    pre { background: #0d1117; border-radius: 10px; padding: 16px; overflow-x: auto;
          font-size: 0.85rem; color: #94a3b8; border: 1px solid #2d3748; white-space: pre-wrap; word-wrap: break-word; }
    .steps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .step { background: #161b27; border-radius: 12px; padding: 16px; border: 1px solid #2d3748; }
    .step h3 { font-size: 0.95rem; color: #93c5fd; margin-bottom: 10px; }
    .step pre { font-size: 0.75rem; max-height: 200px; overflow-y: auto; }
    .footer { text-align: center; color: #475569; margin-top: 30px; font-size: 0.85rem; }
  </style>
</head>
<body>
  <h1>Kooperatif Otomasyon Sistemi</h1>
  <p class="subtitle">Gemini 2.5 Flash Agent Ordusu - """ + tarih + """</p>

  <div class="card">
    <h2>Eksiklik Raporu (Gap Reporter)</h2>
    <span class="badge warn">Ajan 5 / 5</span>
    <pre>""" + gap_report + """</pre>
  </div>

  <div class="card">
    <h2>Doldurulan Belgeler (Document Filler)</h2>
    <span class="badge">Ajan 4 / 5</span>
    <pre>""" + filled_docs + """</pre>
  </div>

  <div class="card">
    <h2>Tum Ajan Adimlar</h2>
    <div class="steps-grid">
      <div class="step"><h3>1 - Format Converter</h3><pre>""" + s1 + """</pre></div>
      <div class="step"><h3>2 - Template Analyzer</h3><pre>""" + s2 + """</pre></div>
      <div class="step"><h3>3 - Data Validator</h3><pre>""" + s3 + """</pre></div>
      <div class="step"><h3>4 - Document Filler</h3><pre>""" + s4 + """</pre></div>
      <div class="step"><h3>5 - Gap Reporter</h3><pre>""" + s5 + """</pre></div>
    </div>
  </div>

  <p class="footer">Kooperatif Otomasyon Sistemi - Tum haklar saklidir.</p>
</body>
</html>"""

    html_file = "rapor.html"
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f" HTML Rapor olusturuldu: {html_file}")
    print(" Tarayicida acmak icin: rapor.html dosyasina cift tiklayin!")

    # Tarayicida otomatik ac
    import webbrowser
    webbrowser.open(os.path.abspath(html_file))
