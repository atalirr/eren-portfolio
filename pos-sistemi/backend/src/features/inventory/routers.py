"""
Inventory Routers
FastAPI Routes
"""

from typing import Any, List, Optional, Union
import json
import base64
import mimetypes
import uuid
import os
import re
import traceback
import time
from uuid import uuid4
from datetime import datetime
import socket
from urllib.request import Request as UrlRequest, urlopen
from urllib.error import HTTPError, URLError

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Request
from fastapi import Request as FastAPIRequest
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from src.shared.database.session import get_db, SessionLocal
from src.shared.config.settings import get_settings
from src.features.inventory import schemas
from src.features.inventory.services import CategoryService, ProductService
from src.features.inventory.statistics_service import InventoryStatisticsService
from src.features.settings.services import SettingService


router = APIRouter()

GEMINI_VERSION = "2026-05-20.1"


def _get_gemini_api_key() -> str | None:
    """DB settings tablosundan okur, yoksa .env'e fallback yapar."""
    db = SessionLocal()
    try:
        svc = SettingService(db)
        db_key = svc.get_value("gemini_api_key")
        if db_key == "disabled":
            return None
        if db_key and db_key.strip():
            return db_key.strip()
    finally:
        db.close()
    return getattr(get_settings(), "GEMINI_API_KEY", None)


@router.get("/invoice/parse/debug", response_model=Any)
async def invoice_parse_debug():
    """
    Debug endpoint - Gemini entegrasyon durumunu gösterir.
    Open in browser: http://127.0.0.1:14532/api/inventory/invoice/parse/debug
    """
    api_key = _get_gemini_api_key()
    return {
        "version": GEMINI_VERSION,
        "mode": "gemini_direct",
        "gemini_api_key_set": bool(api_key),
        "gemini_api_key_preview": (api_key[:8] + "...") if api_key else None,
        "note": "Fatura tarama artık Gemini Vision API üzerinden çalışıyor (n8n yok).",
        "key_source": "database" if api_key else "not_configured",
    }


# ============================================
# Helper Functions
# ============================================

def get_uploads_base_dir() -> str:
    """
    Backend/uploads klasörünün path'ini döndürür
    backend/src/features/inventory/routers.py -> backend/uploads
    """
    # backend/src/features/inventory/routers.py -> backend/uploads
    # 4 seviye yukarı çık: routers.py -> inventory -> features -> src -> backend
    current_file = os.path.abspath(__file__)
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(current_file))))
    uploads_dir = os.path.join(backend_dir, "uploads")
    return os.path.abspath(uploads_dir)


def _encode_multipart_formdata(
    fields: dict,
    files: list[tuple[str, str, bytes, str]],
) -> tuple[str, bytes]:
    """
    Minimal multipart/form-data encoder (stdlib only).
    files: [(fieldname, filename, content_bytes, content_type)]
    """
    boundary = uuid.uuid4().hex
    body = bytearray()

    def _add_line(line: str) -> None:
        body.extend(line.encode("utf-8"))
        body.extend(b"\r\n")

    for name, value in (fields or {}).items():
        _add_line(f"--{boundary}")
        _add_line(f'Content-Disposition: form-data; name="{name}"')
        _add_line("")
        _add_line(str(value))

    for fieldname, filename, content, content_type in files:
        _add_line(f"--{boundary}")
        _add_line(f'Content-Disposition: form-data; name="{fieldname}"; filename="{filename}"')
        _add_line(f"Content-Type: {content_type}")
        _add_line("")
        body.extend(content)
        body.extend(b"\r\n")

    _add_line(f"--{boundary}--")
    return boundary, bytes(body)


def _clean_json_string(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        lines = s.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    
    if s.lower().startswith("json"):
        s = s[4:].strip()
        
    # 1. Fix missing commas between adjacent objects/arrays
    s = re.sub(r'\}\s*\n*\s*\{', '},{', s)
    s = re.sub(r'\]\s*\n*\s*\[', '],[', s)
    
    # 2. Fix missing commas between key-value pairs on consecutive lines
    s = re.sub(r'("|\d|true|false|null)\s*\n+\s*(?="[^"]+"\s*:)', r'\1,\n', s)
    
    # 3. Fix trailing commas before closing braces/brackets
    s = re.sub(r',\s*([\]}])', r'\1', s)
    
    try:
        json.loads(s)
        return s
    except Exception:
        pass
        
    # 4. Escape unescaped quotes inside values using scanning state machine
    result = []
    i = 0
    n = len(s)
    while i < n:
        if s[i] == '"':
            start = i
            i += 1
            while i < n:
                if s[i] == '"' and s[i-1] != '\\':
                    break
                i += 1
            
            val = s[start+1:i]
            j = i + 1
            while j < n and s[j].isspace():
                j += 1
            
            if j < n and s[j] == ':':
                result.append(s[start:i+1])
                i = j + 1
                continue
            else:
                true_end = -1
                k = start + 1
                while k < n:
                    if s[k] == '"' and s[k-1] != '\\':
                        after = k + 1
                        while after < n and s[after].isspace():
                            after += 1
                        if after >= n or s[after] in (',', '}', ']'):
                            true_end = k
                            break
                    k += 1
                
                if true_end != -1:
                    raw_val = s[start+1:true_end]
                    escaped_val = re.sub(r'(?<!\\)"', r'\"', raw_val)
                    result.append(f'"{escaped_val}"')
                    i = true_end + 1
                else:
                    result.append(s[start:i+1])
                    i += 1
        else:
            result.append(s[i])
            i += 1
            
    s_repaired = "".join(result)
    
    try:
        json.loads(s_repaired)
        return s_repaired
    except Exception:
        return s


def _call_gemini_vision(api_key: str, image_bytes: bytes, mime_type: str) -> dict:
    """
    Google Gemini Vision API'yi stdlib urllib ile çağırır (dış bağımlılık yok).
    Fatura görselini analiz edip ürün listesini JSON olarak döndürür.
    """
    GEMINI_API_URL = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={api_key}"
    )

    prompt = """Sen bir fatura analiz uzmanısın. Bu fatura görselini analiz et ve içindeki ürün/mal bilgilerini çıkar.

Aşağıdaki JSON formatında yanıt ver. Sadece JSON döndür, başka açıklama ekleme:

{
  "products": [
    {
      "name": "Ürün adı (marka + model veya açıklama)",
      "barcode": "Barkod numarası (yoksa null)",
      "brand": "Marka adı (yoksa null)",
      "category": "Kategori (Gıda, Elektronik, Temizlik, vb.)",
      "size": "Boyut/hacim (250ml, L, XL vb. - yoksa null)",
      "quantity": Miktar sayısı (integer),
      "unit": "Birim (adet, kg, lt, kutu vb.)",
      "buy_price": Birim alış fiyatı (KDV hariç, float),
      "sell_price": Önerilen satış fiyatı (buy_price * 1.3 hesapla, float),
      "vat": KDV oranı (yüzde olarak, örn: 18 veya 8 veya 1, integer)
    }
  ]
}

Kurallar:
- Sadece ürünleri listele, firma adı/tarih/toplam gibi satırları atla
- Fiyatlar Türk Lirası cinsinden
- Eğer satış fiyatı yoksa alış fiyatının %30 fazlasını hesapla
- quantity mutlaka 0'dan büyük integer olsun
- Tüm sayısal değerleri gerçek sayı olarak ver (string değil)
- Ürün adı boş olmamalı"""

    # Görseli base64'e çevir
    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    request_body = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": b64_image,
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    body_bytes = json.dumps(request_body).encode("utf-8")
    req = UrlRequest(
        GEMINI_API_URL,
        data=body_bytes,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )

    with urlopen(req, timeout=120) as resp:
        resp_text = resp.read().decode("utf-8", errors="replace")

    gemini_response = json.loads(resp_text)

    # Gemini yanıtından text kısmını çek
    candidates = gemini_response.get("candidates", [])
    if not candidates:
        raise ValueError(f"Gemini yanıt boş geldi: {resp_text[:300]}")

    text_part = ""
    for part in candidates[0].get("content", {}).get("parts", []):
        if "text" in part:
            text_part += part["text"]

    if not text_part.strip():
        raise ValueError("Gemini yanıtında metin bulunamadı")

    # JSON'ı çıkar - Gemini farklı formatlarda döndürebilir
    # 1. Markdown code block dene: ```json ... ``` veya ``` ... ```
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text_part)
    if json_match:
        json_str = json_match.group(1).strip()
    else:
        clean = text_part.strip()
        # 2. "json" öneki varsa kaldır (Gemini bazen "json {...}" döndürür)
        if clean.lower().startswith("json"):
            clean = clean[4:].strip()
        # 3. İlk { veya [ karakterinden başlayarak al
        start_idx = next((i for i, ch in enumerate(clean) if ch in ('{', '[')), -1)
        json_str = clean[start_idx:] if start_idx != -1 else clean

    # JSON string'i temizle ve parse et
    try:
        json_str = _clean_json_string(json_str)
        parsed = json.loads(json_str)
    except Exception as e:
        # Son çare: regex ile JSON objesi/dizisi bul
        match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', json_str)
        if match:
            try:
                cleaned_match = _clean_json_string(match.group(1))
                parsed = json.loads(cleaned_match)
            except Exception:
                raise ValueError(f"JSON parsing error: {str(e)}. String was: {json_str[:500]}")
        else:
            raise ValueError(f"JSON parsing error: {str(e)}. String was: {json_str[:500]}")

    return parsed


@router.post("/invoice/parse", response_model=Any)
async def parse_invoice_with_gemini(
    request: Request,
    data: UploadFile = File(None),
    file: UploadFile = File(None),
    image: UploadFile = File(None),
):
    """
    Fatura görseli → Google Gemini Vision API → Ürün listesi JSON

    Direkt Gemini API entegrasyonu (n8n yok).
    Backend env: GEMINI_API_KEY
    """
    upload = data or file or image
    if not upload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="data veya file veya image zorunludur")

    origin = None
    filename = "invoice.jpg"
    content_type = "image/jpeg"
    content = b""

    try:
        settings = get_settings()
        content = await upload.read()
        filename = upload.filename or "invoice.jpg"
        content_type = upload.content_type or mimetypes.guess_type(filename)[0] or "image/jpeg"

        origin = None
        try:
            origin = request.headers.get("origin")
        except Exception:
            origin = None

        print(
            f"[GEMINI v{GEMINI_VERSION}] invoice/parse called: "
            f"filename={filename} size={len(content)} content_type={content_type}"
        )

        api_key = _get_gemini_api_key()

        if not api_key:
            # API key yoksa açıklayıcı hata döndür
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "detail": "GEMINI_API_KEY yapılandırılmamış. backend/.env dosyasına GEMINI_API_KEY=... ekleyin.",
                    "_version": GEMINI_VERSION,
                },
                headers={
                    "Access-Control-Allow-Origin": origin or "*",
                    "Access-Control-Allow-Methods": "*",
                    "Access-Control-Allow-Headers": "*",
                },
            )

        # Gemini Vision API'yi çağır
        print(f"[GEMINI v{GEMINI_VERSION}] Calling Gemini Vision API...")
        result = _call_gemini_vision(api_key, content, content_type)
        print(f"[GEMINI v{GEMINI_VERSION}] Success: {len(result.get('products', []))} ürün bulundu")

        return JSONResponse(
            status_code=200,
            content={
                "data": result,
                "_version": GEMINI_VERSION,
                "_mode": "gemini_direct",
            },
            headers={
                "Access-Control-Allow-Origin": origin or "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            },
        )

    except HTTPError as e:
        try:
            err_body = e.read().decode("utf-8", errors="replace")
        except Exception:
            err_body = str(e)
        http_code = getattr(e, "code", 502)
        print(f"[GEMINI] HTTPError code={http_code} body={err_body[:500]}")

        detail = f"Gemini API hatası (HTTP {http_code}): {err_body}"
        if http_code == 400:
            detail = f"Gemini API geçersiz istek: {err_body[:300]}"
        elif http_code == 403:
            detail = "Gemini API anahtarı geçersiz veya yetkisiz. API key'i kontrol edin."
        elif http_code == 429:
            detail = "Gemini API kota aşımı. Lütfen bir süre bekleyin."

        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"detail": detail, "_version": GEMINI_VERSION},
            headers={
                "Access-Control-Allow-Origin": origin or "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            },
        )

    except (TimeoutError, socket.timeout) as e:
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content={
                "detail": f"Gemini API yanıt vermedi (timeout): {str(e)}",
                "_version": GEMINI_VERSION,
            },
            headers={
                "Access-Control-Allow-Origin": origin or "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            },
        )

    except json.JSONDecodeError as e:
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "detail": f"Gemini yanıtı JSON formatında değil: {str(e)}",
                "_version": GEMINI_VERSION,
            },
            headers={
                "Access-Control-Allow-Origin": origin or "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            },
        )

    except Exception as e:
        traceback_str = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
        print(f"[ERROR] Gemini invoice parse hatası: {str(e)}")
        print(f"[TRACEBACK]\n{traceback_str}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": f"Fatura işlenirken hata oluştu: {str(e)}",
                "_version": GEMINI_VERSION,
                "_debug": {
                    "filename": filename,
                    "content_type": content_type,
                    "size": len(content),
                    "traceback": traceback_str,
                },
            },
            headers={
                "Access-Control-Allow-Origin": origin or "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            },
        )


# ============================================
@router.get("/categories", response_model=List[schemas.CategoryResponse])
async def get_categories(
    include_deleted: bool = False,
    db: Session = Depends(get_db)
):
    """Tüm kategorileri getir"""
    service = CategoryService(db)
    return service.get_all(include_deleted=include_deleted)


@router.get("/categories/{category_id}", response_model=schemas.CategoryResponse)
async def get_category(
    category_id: str,
    db: Session = Depends(get_db)
):
    """ID'ye göre kategori getir"""
    service = CategoryService(db)
    category = service.get_by_id(category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kategori bulunamadı: {category_id}"
        )
    return category


@router.post("/categories", response_model=schemas.CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: schemas.CategoryCreate,
    db: Session = Depends(get_db)
):
    """Yeni kategori oluştur — idempotent: aynı isim varsa mevcut kaydı döndür."""
    from sqlalchemy.exc import IntegrityError, OperationalError

    name = category_data.name.strip()
    print(f"\n[CREATE_CATEGORY] Request for Name: '{name}'")

    # ── 1. Önce isme göre ara (hem aktif hem silinmiş) ──────────────────────
    try:
        service = CategoryService(db)
        existing = service.get_by_name(name, include_deleted=True)
    except Exception as pre_err:
        print(f"[CREATE_CATEGORY] Pre-check error: {pre_err}")
        existing = None

    if existing:
        if existing.is_deleted:
            # Silinmiş → reaktive et
            try:
                existing.is_deleted = False
                existing.is_synced = False
                db.commit()
                db.refresh(existing)
                print(f"[CREATE_CATEGORY] Reactivated: {existing.id}")
                return existing
            except Exception as reac_err:
                db.rollback()
                print(f"[CREATE_CATEGORY] Reactivation error: {reac_err}")
        else:
            print(f"[CREATE_CATEGORY] Already exists: {existing.id}")
            return existing

    # ── 2. Yeni kategori oluştur (SQLite locked retry) ──────────────────────
    MAX_RETRIES = 3
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            service = CategoryService(db)
            category = service.create(category_data)
            print(f"[CREATE_CATEGORY] Created: {category.id}")
            return category

        except IntegrityError:
            db.rollback()
            print(f"[CREATE_CATEGORY] IntegrityError attempt {attempt} — retrying lookup")
            service2 = CategoryService(db)
            found = service2.get_by_name(name)
            if found:
                return found
            if attempt == MAX_RETRIES:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"'{name}' kategorisi zaten mevcut."
                )

        except OperationalError as op_err:
            db.rollback()
            err_str = str(op_err).lower()
            if "locked" in err_str and attempt < MAX_RETRIES:
                print(f"[CREATE_CATEGORY] DB locked, retry {attempt}/{MAX_RETRIES}…")
                time.sleep(0.15 * attempt)
                continue
            print(f"[CREATE_CATEGORY] OperationalError: {op_err}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Veritabanı meşgul, lütfen tekrar deneyin."
            )

        except Exception as e:
            db.rollback()
            err_trace = traceback.format_exc()
            print(f"\n{'#'*60}\n[CREATE_CATEGORY] CRITICAL (attempt {attempt}): {e}\n{err_trace}\n{'#'*60}\n")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Kategori oluşturma hatası: {str(e)}"
            )

    # Buraya normalde gelinmez
    raise HTTPException(status_code=500, detail="Kategori oluşturulamadı.")


def map_product_to_response(p) -> schemas.ProductResponse:
    """SQLAlchemy Product modelini ProductResponse'a eksiksiz map eder"""
    return schemas.ProductResponse(
        id=p.id,
        category_id=p.category_id,
        name=p.name,
        barcode=p.barcode,
        sku=p.sku,
        brand=p.brand,
        price=p.sell_price,
        cost=p.buy_price,
        stock_quantity=p.stock_quantity,
        critical_level=p.critical_level,
        unit=p.unit,
        description=p.description,
        image_url=p.image_url,
        parent_id=p.parent_id,
        color=p.color,
        size=p.size,
        material=p.material,
        tax_rate=p.tax_rate if (hasattr(p, 'tax_rate') and p.tax_rate is not None) else 18.0,
        is_active=p.is_active,
        created_at=p.created_at,
        updated_at=p.updated_at,
        is_synced=p.is_synced,
        is_deleted=p.is_deleted,
    )


@router.put("/categories/{category_id}", response_model=schemas.CategoryResponse)
async def update_category(
    category_id: str,
    category_data: schemas.CategoryUpdate,
    db: Session = Depends(get_db)
):
    """Kategoriyi güncelle"""
    service = CategoryService(db)
    category = service.update(category_id, category_data)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kategori bulunamadı: {category_id}"
        )
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    db: Session = Depends(get_db)
):
    """Kategoriyi sil (soft delete)"""
    service = CategoryService(db)
    if not service.delete(category_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kategori bulunamadı: {category_id}"
        )
    return None


# ============================================
# Product Routes
# ============================================

@router.get("/products", response_model=List[schemas.ProductResponse])
async def get_products(
    category_id: Optional[str] = Query(None, description="Kategori ID ile filtrele"),
    brand: Optional[str] = Query(None, description="Marka ile filtrele"),
    stock_status: Optional[str] = Query(None, description="Stok durumu: 'low' (kritik seviyede), 'in_stock' (stokta), 'out_of_stock' (stokta yok)"),
    include_deleted: bool = Query(False, description="Silinenleri dahil et"),
    db: Session = Depends(get_db)
):
    """
    Tüm ürünleri getir
    
    Filtreleme:
    - Kategori: category_id
    - Marka: brand
    - Stok Durumu: stock_status (low, in_stock, out_of_stock)
    """
    try:
        service = ProductService(db)
        
        # Kategori filtresi
        if category_id:
            products = service.get_by_category(category_id, include_deleted=include_deleted)
        else:
            products = service.get_all(include_deleted=include_deleted)
        
        # Marka filtresi
        if brand:
            products = [p for p in products if p.brand and brand.lower() in p.brand.lower()]
        
        # Stok durumu filtresi
        if stock_status:
            if stock_status == "low":
                products = [p for p in products if p.stock_quantity <= p.critical_level]
            elif stock_status == "in_stock":
                products = [p for p in products if p.stock_quantity > 0]
            elif stock_status == "out_of_stock":
                products = [p for p in products if p.stock_quantity == 0]
        
        # ProductResponse'a dönüştür (helper mapping ile)
        return [map_product_to_response(p) for p in products]
        
    except Exception as e:
        import traceback
        print(f"[ERROR] Products endpoint hatasi: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ürünler alınamadı: {str(e)}"
        )


@router.put("/products/{product_id}/image", response_model=schemas.ProductResponse)
async def update_product_image(
    product_id: str,
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Ürün resmini güncelle"""
    try:
        service = ProductService(db)
        product = service.get_by_id(product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ürün bulunamadı: {product_id}"
            )
        
        # Dosya kontrolü
        if not image:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Resim dosyası bulunamadı"
            )
        
        # Dosya uzantısını al
        ext = os.path.splitext(image.filename or "image.jpg")[1] if image.filename else ".jpg"
        if not ext or ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            ext = ".jpg"
        
        # Upload dizinini oluştur (yıl/ay klasör yapısı)
        now = datetime.utcnow()
        year = now.year
        month = f"{now.month:02d}"
        
        # Backend klasöründen uploads klasörüne git
        base_upload_dir = get_uploads_base_dir()
        save_dir = os.path.join(base_upload_dir, str(year), month)
        os.makedirs(save_dir, exist_ok=True)
        
        # Benzersiz dosya adı oluştur
        filename = f"{uuid4()}{ext}"
        file_path = os.path.join(save_dir, filename)
        
        # Dosyayı kaydet
        with open(file_path, "wb") as f:
            content = await image.read()
            f.write(content)
        
        # URL'yi oluştur
        image_url = f"/uploads/{year}/{month}/{filename}"
        
        # Ürünü güncelle
        update_data = schemas.ProductUpdate(image_url=image_url)
        updated_product = service.update(product_id, update_data)
        
        if not updated_product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ürün güncellenirken hata oluştu"
            )
        
        return map_product_to_response(updated_product)
    except HTTPException:
        raise
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        traceback_str = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
        print(f"[ERROR] update_product_image hatası [{error_type}]: {error_msg}")
        print(f"[TRACEBACK]\n{traceback_str}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Resim güncellenirken hata oluştu: {str(e)}"
        )


@router.get("/products/{product_id}", response_model=schemas.ProductResponse)
async def get_product(
    product_id: str,
    db: Session = Depends(get_db)
):
    """ID'ye göre ürün getir"""
    service = ProductService(db)
    product = service.get_by_id(product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ürün bulunamadı: {product_id}"
        )
    # ProductResponse'a dönüştür
    return map_product_to_response(product)


@router.get("/products/barcode/{barcode}", response_model=schemas.ProductResponse)
async def get_product_by_barcode(
    barcode: str,
    db: Session = Depends(get_db)
):
    """Barkod'a göre ürün getir"""
    service = ProductService(db)
    product = service.get_by_barcode(barcode)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ürün bulunamadı (barkod: {barcode})"
        )
    # ProductResponse'a dönüştür
    return map_product_to_response(product)

# ============================================
# Product Creation & Management
# ============================================


@router.post("/products", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Yeni ürün oluştur (JSON veya multipart/form-data)
    """
    import traceback
    print(f"\n{'='*50}\n[CREATE_PRODUCT] Request Received")
    try:
        # Content-Type'a göre isteği ayır
        content_type = request.headers.get("content-type", "").lower()
        print(f"[DEBUG] Content-Type: {content_type}")
        
        # JSON isteği mi Form isteği mi kontrol et
        if "application/json" in content_type:
            # JSON isteği - body'den oku
            body = await request.json()
            product_data = schemas.ProductCreate(**body)
            final_product_data = product_data
            image_url = None
        else:
            # Form isteği - form data'dan oku
            form = await request.form()
            
            category_id = form.get("category_id")
            name = form.get("name")
            price_str = form.get("price")
            
            print(f"[DEBUG] Form Data -> Name: {name}, Cat: {category_id}, Price: {price_str}")
            
            if not category_id or not name or not price_str:
                print(f"[ERROR] Required fields missing in form data")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="category_id, name ve price zorunludur"
                )
            
            try:
                price = float(price_str)
            except (ValueError, TypeError):
                print(f"[ERROR] Price conversion error for: {price_str}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="price geçerli bir sayı olmalıdır"
                )
            

            # Kategori var mı kontrol et
            category_service = CategoryService(db)
            category = category_service.get_by_id(category_id)
            if not category:
                print(f"[ERROR] Category ID {category_id} NOT FOUND")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Kategori bulunamadı: {category_id}",
                )

            image_url: Optional[str] = None

            # Görsel yükleme (basit disk kaydı - uploads klasörü)
            image_file = form.get("image")
            if image_file and hasattr(image_file, 'file'):
                print(f"[DEBUG] Image detected: {getattr(image_file, 'filename', 'unknown')}")
                try:
                    import os
                    from uuid import uuid4
                    from datetime import datetime

                    now = datetime.utcnow()
                    year = now.year
                    month = f"{now.month:02d}"
                    base_upload_dir = get_uploads_base_dir()
                    save_dir = os.path.join(base_upload_dir, str(year), month)
                    os.makedirs(save_dir, exist_ok=True)

                    ext = os.path.splitext(image_file.filename or "")[1] if hasattr(image_file, 'filename') else ".jpg"
                    if not ext:
                        ext = ".jpg"
                    filename = f"{uuid4()}{ext}"
                    file_path = os.path.join(save_dir, filename)

                    print(f"[DEBUG] Saving image to: {file_path}")
                    with open(file_path, "wb") as f:
                        content = await image_file.read()
                        f.write(content)

                    # API tarafından dönecek relative path
                    image_url = f"/uploads/{year}/{month}/{filename}"
                    print(f"[DEBUG] Image saved. URL: {image_url}")
                except Exception as img_err:
                    print(f"[ERROR] Gorsel kaydedilirken hata: {str(img_err)}")
                    print(traceback.format_exc())
                    # Görsel hatası ürün kaydını tamamen engellemesin

            # Pydantic schema oluştur
            print("[DEBUG] Constructing schemas.ProductCreate")
            final_product_data = schemas.ProductCreate(
                category_id=category_id,
                name=name,
                barcode=form.get("barcode") or None,
                sku=form.get("sku") or None,
                brand=form.get("brand") or None,
                price=price,
                cost=float(form.get("cost")) if (form.get("cost") and form.get("cost").strip()) else None,
                stock_quantity=int(form.get("stock_quantity") or 0),
                critical_level=int(form.get("critical_level") or 10),
                unit=form.get("unit") or "adet",
                description=form.get("description") or None,
                image_url=image_url,
                tax_rate=float(form.get("tax_rate")) if (form.get("tax_rate") and form.get("tax_rate").strip()) else 18.0,
                is_active=form.get("is_active", "true").lower() == "true" if form.get("is_active") else True,
                # Variant Fields
                parent_id=form.get("parent_id") or None,
                color=form.get("color") or None,
                size=form.get("size") or None,
                material=form.get("material") or None,
            )
            print(f"[DEBUG] final_product_data: {final_product_data.model_dump()}")
        
        # Kategori kontrolü (JSON isteği için)
        if final_product_data.category_id:
            category_service = CategoryService(db)
            category = category_service.get_by_id(final_product_data.category_id)
            if not category:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Kategori bulunamadı: {final_product_data.category_id}",
                )

        print("[DEBUG] Calling ProductService.create...")
        service = ProductService(db)
        product = service.create(final_product_data)
        print(f"[DEBUG] Product Service SUCCESS. ID: {product.id}")
        
        return map_product_to_response(product)
    except HTTPException as http_exc:
        print(f"[WARNING] HTTPException in create_product: {http_exc.detail}")
        raise
    except Exception as e:
        import traceback
        print(f"\n{'#'*60}")
        print(f"[FATAL ERROR] create_product CRASHED: {str(e)}")
        print(traceback.format_exc())
        print(f"{'#'*60}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ürün oluşturulamadı: {str(e)}",
        )


@router.put("/products/{product_id}", response_model=schemas.ProductResponse)
async def update_product(
    product_id: str,
    product_data: schemas.ProductUpdate,
    db: Session = Depends(get_db)
):
    """Ürünü güncelle"""
    print(f"\n[UPDATE_PRODUCT] ID: {product_id}")
    print(f"[DEBUG] Received data: {product_data.model_dump(exclude_unset=True)}")
    
    service = ProductService(db)
    # Kategori değiştiriliyorsa kontrol et
    if product_data.category_id:
        category_service = CategoryService(db)
        category = category_service.get_by_id(product_data.category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Kategori bulunamadı: {product_data.category_id}"
            )
    product = service.update(product_id, product_data)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ürün bulunamadı: {product_id}"
        )
    # ProductResponse'a dönüştür
    return map_product_to_response(product)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    db: Session = Depends(get_db)
):
    """Ürünü sil (soft delete)"""
    service = ProductService(db)
    success = service.delete(product_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ürün bulunamadı: {product_id}"
        )


@router.post("/products/batch/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_products_batch(
    product_ids: List[str],
    db: Session = Depends(get_db)
):
    """Birden fazla ürünü sil (soft delete)"""
    service = ProductService(db)
    failed_ids = []
    for pid in product_ids:
        success = service.delete(pid)
        if not success:
            failed_ids.append(pid)
    
    if failed_ids and len(failed_ids) == len(product_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Belirtilen ürünlerin hiçbiri silinemedi."
        )
    return None



@router.patch("/products/{product_id}/stock", response_model=schemas.ProductResponse)
async def update_stock(
    product_id: str,
    stock_data: schemas.StockUpdateSchema,
    user_id: str = Query(default="default-user-id", description="Kullanıcı ID"),  # TODO: Gerçek uygulamada JWT token'dan alınmalı
    db: Session = Depends(get_db)
):
    """
    Hızlı stok değişimi
    
    Frontend'deki [+] ve [-] butonları bu endpoint'i çağıracak.
    
    Body:
    {
      "amount": 1,  // + veya - değer
      "reason": "CORRECTION",  // SALE, RESTOCK, RETURN, CORRECTION, WASTE
      "notes": "Manuel düzeltme"  // Opsiyonel
    }
    """
    try:
        service = ProductService(db)
        product = service.update_stock(
            product_id=product_id,
            amount=stock_data.amount,
            reason=stock_data.reason,
            user_id=user_id,
            notes=stock_data.notes
        )
        
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ürün bulunamadı: {product_id}"
            )
        
        # ProductResponse'a dönüştür
        return map_product_to_response(product)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        print(f"[ERROR] Stok guncelleme hatasi: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Stok güncelleme sırasında hata oluştu: {str(e)}"
        )


@router.get("/products/{product_id}/history", response_model=List[schemas.StockMovementResponse])
async def get_product_history(
    product_id: str,
    db: Session = Depends(get_db)
):
    """
    Bir ürünün stok geçmişini getir (Loglar)
    
    Tüm stok hareketlerini tarih sırasına göre (en yeni önce) döner.
    """
    try:
        service = ProductService(db)
        
        # Ürün var mı kontrol et
        product = service.get_by_id(product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ürün bulunamadı: {product_id}"
            )
        
        # Stok geçmişini getir
        history = service.get_stock_history(product_id)
        
        # Response formatı
        return [
            {
                "id": movement.id,
                "product_id": movement.product_id,
                "user_id": movement.user_id,
                "quantity_change": movement.quantity_change,
                "reason": movement.reason.value,
                "notes": movement.notes,
                "created_at": movement.created_at,
            }
            for movement in history
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[ERROR] Stok gecmisi getirme hatasi: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Stok geçmişi alınamadı: {str(e)}"
        )


@router.get("/products/critical/list", response_model=List[schemas.ProductResponse])
async def get_critical_products(
    db: Session = Depends(get_db)
):
    """
    Kritik stok seviyesindeki ürünleri getir
    
    Dashboard'daki Ticker ve Raporlar için kullanılır.
    stock_quantity <= critical_level olan tüm aktif ürünleri döner.
    """
    try:
        service = ProductService(db)
        critical_products = service.get_critical_products()
        # ProductResponse'a dönüştür
        return [map_product_to_response(p) for p in critical_products]
        
    except Exception as e:
        import traceback
        print(f"[ERROR] Kritik stok urunleri getirme hatasi: {str(e)}")
        import traceback; traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Kritik stok urunleri alinamadi: {str(e)}"
        )
