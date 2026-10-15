import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, FileUp, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { inventoryApi, type Category, type ProductCreate } from '../services/inventoryApi';
import { getApiBaseUrl } from '@/shared/config/api.config';
import { cn } from '@/shared/utils/cn';
import { apiClient } from '@/shared/utils/api.client';

type ParsedCandidate = {
  name?: string | null;
  barcode?: string | null;
  brand?: string | null;
  category?: string | null;
  size?: string | null;
  quantity?: number | null;
  unit?: string | null;
  buy_price?: number | null;
  sell_price?: number | null;
  vat?: number | null;
};

type ResultRow =
  | { action: 'created'; name: string; id: string }
  | { action: 'updated'; name: string; id: string }
  | { action: 'skipped'; name: string; reason: string }
  | { action: 'failed'; name: string; reason: string };

type DraftRow = {
  id: string;
  include: boolean;
  name: string;
  barcode: string;
  category: string; // id veya isim
  brand: string;
  size: string;
  quantity: string; // string (editable)
  unit: string;
  buy_price: string;
  sell_price: string;
  tax_rate: string;
};

function normalizeBarcodeFromName(nameRaw: string, barcodeRaw: string): { name: string; barcode: string } {
  const name = (nameRaw || '').toString();
  const barcode = (barcodeRaw || '').toString();

  const stripLeadingPrefix = (n: string) => n.trim().replace(/^[-–—•]+\s*/, '').trim();

  // Eğer barkod zaten doluysa sadece isimde başta tekrar ediyorsa temizle.
  const cleanNameLeading = (n: string, bc: string) => {
    const trimmed = stripLeadingPrefix(n);
    if (!bc) return trimmed;
    const bcDigits = bc.replace(/\s+/g, '');
    if (!bcDigits) return trimmed;
    const re = new RegExp(`^${bcDigits}\\s+`, '');
    return trimmed.replace(re, '').trim();
  };

  if (barcode.trim()) {
    return { name: cleanNameLeading(name, barcode), barcode: barcode.trim() };
  }

  // İsim başında barkod yakala (8-14 haneli)
  const cleanedName = stripLeadingPrefix(name);
  const m = cleanedName.match(/^([0-9]{8,14})\s+(.+)$/);
  if (!m) return { name: cleanedName.trim(), barcode: '' };
  return { barcode: m[1], name: (m[2] || '').trim() };
}

function normalizeSizeFromName(nameRaw: string, sizeRaw: string): { name: string; size: string } {
  const name = (nameRaw || '').toString();
  const currentSize = (sizeRaw || '').toString().trim();
  const defaultSize = currentSize || 'Standart';

  // Beden zaten özel bir şeyse isimden sadece etiketleri temizlemeye çalışmayalım.
  const shouldDetect = defaultSize === 'Standart' || defaultSize === '';
  if (!shouldDetect) return { name: name.trim(), size: defaultSize };

  const candidates: Array<{ re: RegExp; size: string }> = [
    { re: /\b(xl|x-l|xlarge|x-large)\b/i, size: 'XL' },
    { re: /\b(l|large)\b/i, size: 'L' },
    { re: /\b(m|medium)\b/i, size: 'M' },
    { re: /\b(s|small)\b/i, size: 'S' },
    { re: /\b(standart|standard|std)\b/i, size: 'Standart' },
  ];

  for (const c of candidates) {
    if (c.re.test(name)) {
      const cleaned = name.replace(c.re, ' ').replace(/\s{2,}/g, ' ').trim();
      return { name: cleaned, size: c.size };
    }
  }
  return { name: name.trim(), size: 'Standart' };
}

function autoSellFromBuyIfEmpty(buyRaw: string, sellRaw: string): string {
  const buy = Number(String(buyRaw || '').replace(',', '.'));
  if (!Number.isFinite(buy) || buy <= 0) return sellRaw || '';
  const sell = Number(String(sellRaw || '').replace(',', '.'));
  // Satış fiyatı yoksa, 0 ise veya alış fiyatına eşit/düşükse 2x markup uygula
  if (!Number.isFinite(sell) || sell <= 0 || sell <= buy) {
    return (buy * 2).toFixed(2);
  }
  return sellRaw;
}

function generateAutoBarcode(): string {
  // 12 haneli benzersiz barkod üret (timestamp + random)
  const ts = Date.now().toString().slice(-7);
  const rnd = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return ts + rnd;
}

function extractPartsText(payload: any): string | null {
  try {
    const parts = payload?.content?.parts ?? payload?.data?.content?.parts ?? payload?.data?.data?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) return null;
    const texts = parts
      .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .filter((t: string) => t.trim() !== '');
    if (texts.length === 0) return null;
    return texts.join('');
  } catch {
    return null;
  }
}

function newDraftRow(seed?: Partial<DraftRow>): DraftRow {
  const id = (globalThis.crypto as any)?.randomUUID?.() ?? `row_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return {
    id,
    include: false,
    name: '',
    barcode: '',
    category: '',
    brand: '',
    size: 'Standart',
    quantity: '0',
    unit: 'adet',
    buy_price: '',
    sell_price: '',
    tax_rate: '18',
    ...seed,
  };
}

function candidateToDraftRow(c: ParsedCandidate, useSystemBarcode: boolean): DraftRow {
  const buy = c.buy_price != null ? String(c.buy_price) : '';
  const sell = c.sell_price != null ? String(c.sell_price) : '';
  const b1 = normalizeBarcodeFromName((c.name || '').toString(), (c.barcode || '').toString());
  const s1 = normalizeSizeFromName(b1.name, (c.size || 'Standart').toString());
  const sellFilled = autoSellFromBuyIfEmpty(buy, sell);
  // Barkod yoksa veya Sistem Barkodu seçeneği aktifse otomatik üret
  const finalBarcode = (useSystemBarcode ? '' : b1.barcode.trim()) || generateAutoBarcode();
  return newDraftRow({
    include: true,
    name: s1.name,
    barcode: finalBarcode,
    category: (c.category || '').toString(),
    brand: (c.brand || '').toString(),
    size: s1.size,
    quantity: c.quantity != null ? String(c.quantity) : '0',
    unit: (c.unit || 'adet').toString(),
    buy_price: buy,
    sell_price: sellFilled,
    tax_rate: c.vat != null ? String(c.vat) : '18',
  });
}

async function ensureJpegIfNeeded(input: File): Promise<File> {
  // n8n / AI nodes bazen webp ile sorun yaşayabiliyor; webp -> jpeg çevir.
  if (!input?.type) return input;
  const t = input.type.toLowerCase();
  if (t !== 'image/webp') return input;

  const blobToFile = (blob: Blob, name: string) =>
    new File([blob], name, { type: blob.type || 'image/jpeg', lastModified: Date.now() });

  // createImageBitmap varsa en stabil
  if ('createImageBitmap' in window && typeof (window as any).createImageBitmap === 'function') {
    const bmp: ImageBitmap = await (window as any).createImageBitmap(input);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return input;
    ctx.drawImage(bmp, 0, 0);
    const outBlob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    );
    if (!outBlob) return input;
    const outName = input.name.replace(/\.webp$/i, '.jpg') || 'invoice.jpg';
    return blobToFile(outBlob, outName);
  }

  // Fallback: Image element
  const url = URL.createObjectURL(input);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || (img as any).width;
    canvas.height = img.naturalHeight || (img as any).height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return input;
    ctx.drawImage(img, 0, 0);
    const outBlob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    );
    if (!outBlob) return input;
    const outName = input.name.replace(/\.webp$/i, '.jpg') || 'invoice.jpg';
    return blobToFile(outBlob, outName);
  } catch {
    return input;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function isTextFile(f: File): boolean {
  const name = String(f?.name || '').toLowerCase();
  const type = String(f?.type || '').toLowerCase();
  return (
    name.endsWith('.html') ||
    name.endsWith('.xml') ||
    name.endsWith('.txt') ||
    name.endsWith('.csv') ||
    name.endsWith('.json') ||
    name.endsWith('.xhtml') ||
    type.startsWith('text/') ||
    type === 'application/json' ||
    type === 'application/xml'
  );
}

function safeNumber(v: any): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function safeString(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function tryParseJsonString(v: any): any | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  if (!(s.startsWith('{') || s.startsWith('['))) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function repairTruncatedJson(str: string): string {
  const s = str.trim();
  if (!s) return str;
  try {
    JSON.parse(s);
    return s;
  } catch {}

  let cleaned = s;
  // 1. Tırnak işaretlerini dengele (Eğer tek sayıda çift tırnak varsa, tırnağı kapatmak için ekle)
  const quoteCount = (cleaned.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    cleaned += '"';
  }

  // 2. Yığın (stack) ile açılış/kapanış parantezlerini dengele
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') stack.pop();
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') stack.pop();
      }
    }
  }

  let suffix = '';
  const stackCopy = [...stack];
  while (stackCopy.length > 0) {
    const open = stackCopy.pop();
    if (open === '{') suffix += '}';
    else if (open === '[') suffix += ']';
  }

  // Sondaki gereksiz virgülleri temizle
  let candidate = cleaned.replace(/,\s*$/, '') + suffix;
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {}

  // 3. Eğer hâlâ geçersizse, en son yarım kalan objeyi { ... kesip çıkararak diziyi kapat
  const lastOpenBrace = cleaned.lastIndexOf('{');
  const lastCloseBrace = cleaned.lastIndexOf('}');
  if (lastOpenBrace > lastCloseBrace) {
    cleaned = cleaned.substring(0, lastOpenBrace).replace(/,\s*$/, '');
    
    // Tekrar parantez dengelemesi yap
    const stack2: string[] = [];
    let inString2 = false;
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (char === '"') inString2 = !inString2;
      if (!inString2) {
        if (char === '{' || char === '[') stack2.push(char);
        else if (char === '}') { if (stack2[stack2.length - 1] === '{') stack2.pop(); }
        else if (char === ']') { if (stack2[stack2.length - 1] === '[') stack2.pop(); }
      }
    }
    let suffix2 = '';
    while (stack2.length > 0) {
      const open = stack2.pop();
      if (open === '{') suffix2 += '}';
      else if (open === '[') suffix2 += ']';
    }
    candidate = cleaned.replace(/,\s*$/, '') + suffix2;
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {}
  }

  return str;
}


function tryExtractJsonFromText(v: any): any | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;

  // ```json ... ``` veya ``` ... ``` blokları
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const parsed = tryParseJsonString(fenced[1]);
    if (parsed != null) return parsed;
  }

  // Metnin içinde JSON gömülü olabilir
  const firstObj = s.indexOf('{');
  const lastObj = s.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) {
    const parsed = tryParseJsonString(s.slice(firstObj, lastObj + 1));
    if (parsed != null) return parsed;
  }

  const firstArr = s.indexOf('[');
  const lastArr = s.lastIndexOf(']');
  if (firstArr !== -1 && lastArr > firstArr) {
    const parsed = tryParseJsonString(s.slice(firstArr, lastArr + 1));
    if (parsed != null) return parsed;
  }

  return null;
}

function tryExtractItemsArrayFromText(v: any): any | null {
  if (typeof v !== 'string') return null;
  const s = v;
  const idxItems = s.search(/"items"\s*:/i);
  if (idxItems === -1) return null;
  const idxArrStart = s.indexOf('[', idxItems);
  if (idxArrStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = idxArrStart; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (depth === 0) {
      const arrText = s.slice(idxArrStart, i + 1);
      const parsedArr = tryParseJsonString(arrText);
      if (parsedArr != null && Array.isArray(parsedArr)) return { items: parsedArr };
      return null;
    }
  }
  return null;
}

function looksLikeLineObject(x: any): boolean {
  return (
    !!x &&
    typeof x === 'object' &&
    ('urun_adi' in x ||
      'barkod' in x ||
      'name' in x ||
      'barcode' in x ||
      'product_name' in x ||
      'productName' in x ||
      'ean' in x ||
      'gtin' in x ||
      'sku' in x)
  );
}

function mapLineToCandidate(it: any): ParsedCandidate {
  const name =
    safeString(it?.urun_adi) ||
    safeString(it?.name) ||
    safeString(it?.product_name) ||
    safeString(it?.productName) ||
    safeString(it?.title) ||
    safeString(it?.description);

  const barcode =
    safeString(it?.barkod) ||
    safeString(it?.barcode) ||
    safeString(it?.ean) ||
    safeString(it?.gtin) ||
    safeString(it?.sku) ||
    null;

  const brand = safeString(it?.marka) || safeString(it?.brand) || safeString(it?.manufacturer) || null;
  const category = safeString(it?.kategori) || safeString(it?.category) || safeString(it?.categoryName) || null;
  const size = safeString(it?.beden) || safeString(it?.size) || safeString(it?.variant) || null;
  const quantity = safeNumber(it?.baslangic_stogu) ?? safeNumber(it?.quantity ?? it?.qty ?? it?.count ?? it?.adet);
  const unit = safeString(it?.birim) || safeString(it?.unit) || safeString(it?.unit_name) || null;
  const buy = safeNumber(it?.alis_fiyati) ?? safeNumber(it?.buy_price ?? it?.buyPrice ?? it?.unit_cost ?? it?.unitCost ?? it?.cost);
  const sell = safeNumber(it?.satis_fiyati) ?? safeNumber(it?.sell_price ?? it?.sellPrice ?? it?.unit_price ?? it?.unitPrice ?? it?.price);
  const vat = safeNumber(it?.vat ?? it?.kdv ?? it?.tax);

  return { name, barcode, brand, category, size, quantity, unit, buy_price: buy, sell_price: sell, vat };
}

function unwrapN8nPayload(payload: any): any {
  // n8n bazen JSON'u string olarak döndürebilir (ör: "text" alanında)
  if (typeof payload === 'string') {
    const parsed =
      tryParseJsonString(payload) ??
      tryExtractJsonFromText(payload) ??
      tryExtractItemsArrayFromText(payload);
    return parsed ?? payload;
  }

  // Bazı AI node çıktıları: { content: { parts: [{ text: "{...json...}" }] } }
  // (Gemini / LLM benzeri). Öncelikle buradan JSON'u yakalamaya çalış.
  const partsText = extractPartsText(payload);
  if (typeof partsText === 'string') {
    const parsed =
      tryParseJsonString(partsText) ??
      tryExtractJsonFromText(partsText) ??
      tryExtractItemsArrayFromText(partsText);
    if (parsed != null) return parsed;
  }

  const candidates = [
    payload,
    payload?.json,
    payload?.data,
    payload?.result,
    payload?.output,
    payload?.body,
    payload?.text,
    payload?.content,
    payload?.message,
  ].filter((x) => x != null);

  for (const c of candidates) {
    if (typeof c === 'string') {
      const parsed = tryParseJsonString(c) ?? tryExtractJsonFromText(c);
      if (parsed) return parsed;
    }
    if (typeof c === 'object' && c) {
      // en iyi ihtimal: direkt { items: [...] }
      if (Array.isArray((c as any).items)) return c;
    }
  }

  return payload;
}

function findItemsArray(node: any, depth: number = 0): any[] | null {
  if (depth > 8 || node == null) return null;

  if (typeof node === 'string') {
    const parsed =
      tryParseJsonString(node) ??
      tryExtractJsonFromText(node) ??
      tryExtractItemsArrayFromText(node);
    if (parsed) return findItemsArray(parsed, depth + 1);
    return null;
  }

  if (Array.isArray(node)) {
    // Dizi doğrudan ürün satırları olabilir
    const looksLikeLine = node.some((x) => looksLikeLineObject(x));
    if (looksLikeLine) return node as any[];

    // n8n item dizisi olabilir -> içeriği tara
    for (const el of node) {
      const found = findItemsArray(el, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof node === 'object') {
    // direkt { items: [...] }
    if (Array.isArray((node as any).items)) return (node as any).items;

    // AI node formatı: { content: { parts: [{ text: "{...}" }] } }
    const partsText = extractPartsText(node);
    if (typeof partsText === 'string') {
      const parsed =
        tryParseJsonString(partsText) ??
        tryExtractJsonFromText(partsText) ??
        tryExtractItemsArrayFromText(partsText);
      const found = findItemsArray(parsed, depth + 1);
      if (found) return found;
    }

    // n8n item formatı: { json: {...} }
    if ((node as any).json) {
      const found = findItemsArray((node as any).json, depth + 1);
      if (found) return found;
    }

    // yaygın wrapperlar
    for (const k of ['data', 'result', 'output', 'body', 'text', 'content', 'message'] as const) {
      const v = (node as any)[k];
      const found = findItemsArray(v, depth + 1);
      if (found) return found;
    }

    // son çare: tüm değerleri tarama (limitli)
    const values = Object.values(node as Record<string, any>).slice(0, 40);
    for (const v of values) {
      const found = findItemsArray(v, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function extractCandidates(payload: any): ParsedCandidate[] {
  const unwrapped = unwrapN8nPayload(payload);

  const roots = [
    unwrapped,
    unwrapped?.data,
    unwrapped?.result,
    unwrapped?.output,
    unwrapped?.body,
  ].filter(Boolean);

  // Önce kesin şema: { items: [...] } / wrapper içinden items array'ini bul
  const directItems = findItemsArray(unwrapped);
  if (directItems && directItems.length > 0) {
    return (directItems as any[]).map(mapLineToCandidate).filter((x: ParsedCandidate) => !!x.name || !!x.barcode);
  }

  // Çok yaygın n8n formatı: [{ json: {...} }, { json: {...} }]
  if (Array.isArray(unwrapped)) {
    const jsonItems = (unwrapped as any[])
      .map((x) => (x && typeof x === 'object' ? (x as any).json : null))
      .filter((x) => x != null);

    if (jsonItems.length > 0) {
      // json içindeki items array varsa onu al
      for (const j of jsonItems) {
        const maybeParsed = typeof j === 'string' ? tryParseJsonString(j) ?? tryExtractJsonFromText(j) ?? j : j;
        const found = findItemsArray(maybeParsed);
        if (found && found.length > 0) {
          return found.map(mapLineToCandidate).filter((x: ParsedCandidate) => !!x.name || !!x.barcode);
        }
      }

      // Her bir json satır objesi ise, direkt satır listesi gibi davran
      const lines = jsonItems
        .map((j) => (typeof j === 'string' ? tryParseJsonString(j) ?? tryExtractJsonFromText(j) ?? null : j))
        .filter((j) => looksLikeLineObject(j));

      if (lines.length > 0) {
        return (lines as any[]).map(mapLineToCandidate).filter((x: ParsedCandidate) => !!x.name || !!x.barcode);
      }
    }
  }

  const arrays: any[] = [];
  for (const r of roots) {
    if (Array.isArray(r)) arrays.push(r);
    if (Array.isArray(r?.products)) arrays.push(r.products);
    if (Array.isArray(r?.items)) arrays.push(r.items);
    if (Array.isArray(r?.lines)) arrays.push(r.lines);
    if (Array.isArray(r?.line_items)) arrays.push(r.line_items);
    if (Array.isArray(r?.products?.items)) arrays.push(r.products.items);
  }

  const rawItems = arrays.length > 0 ? arrays[0] : [];
  const normalized = (Array.isArray(rawItems) ? rawItems : [])
    .map((it: any) => {
      const name =
        // n8n workflow output keys (TR)
        safeString(it?.urun_adi) ||
        safeString(it?.name) ||
        safeString(it?.product_name) ||
        safeString(it?.productName) ||
        safeString(it?.title) ||
        safeString(it?.description);

      const barcode =
        // n8n workflow output keys (TR)
        safeString(it?.barkod) ||
        safeString(it?.barcode) ||
        safeString(it?.ean) ||
        safeString(it?.gtin) ||
        safeString(it?.sku) ||
        null;

      const brand =
        safeString(it?.marka) ||
        safeString(it?.brand) ||
        safeString(it?.manufacturer) ||
        null;

      const category =
        safeString(it?.kategori) ||
        safeString(it?.category) ||
        safeString(it?.category_name) ||
        safeString(it?.categoryName) ||
        null;

      const quantity =
        safeNumber(it?.baslangic_stogu) ??
        safeNumber(it?.quantity ?? it?.qty ?? it?.count ?? it?.adet);

      const unit =
        safeString(it?.birim) ||
        safeString(it?.unit) ||
        safeString(it?.unit_name) ||
        null;

      const buy =
        safeNumber(it?.alis_fiyati) ??
        safeNumber(it?.buy_price ?? it?.buyPrice ?? it?.unit_cost ?? it?.unitCost ?? it?.cost ?? it?.purchase_price);
      const sell =
        safeNumber(it?.satis_fiyati) ??
        safeNumber(it?.sell_price ?? it?.sellPrice ?? it?.unit_price ?? it?.unitPrice ?? it?.price);
      const vat = safeNumber(it?.vat ?? it?.kdv ?? it?.tax);

      return { name, barcode, brand, category, quantity, unit, buy_price: buy, sell_price: sell, vat };
    })
    .filter((x: ParsedCandidate) => !!x.name || !!x.barcode);

  // Eğer array bulunamadıysa tek ürün gibi davran
  if (normalized.length === 0) {
    const single = roots
      .map((r: any) => ({
        name: safeString(r?.urun_adi || r?.name || r?.product_name || r?.productName),
        barcode: safeString(r?.barkod || r?.barcode || r?.ean || r?.gtin || r?.sku),
        brand: safeString(r?.marka || r?.brand),
        category: safeString(r?.kategori || r?.category || r?.categoryName),
        quantity: safeNumber(r?.baslangic_stogu || r?.quantity || r?.qty),
        unit: safeString(r?.birim || r?.unit),
        buy_price: safeNumber(r?.alis_fiyati || r?.buy_price || r?.unit_cost || r?.cost),
        sell_price: safeNumber(r?.satis_fiyati || r?.sell_price || r?.unit_price || r?.price),
        vat: safeNumber(r?.vat || r?.kdv),
      }))
      .find((x: any) => x.name || x.barcode);

    if (single) return [single];
  }

  return normalized;
}

export function QuickInvoiceAddModal({
  isOpen,
  onClose,
  onCompleted,
  categories,
  selectedCategoryId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void | Promise<void>;
  categories: Category[];
  selectedCategoryId: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'analyzed' | 'review' | 'saving' | 'done'>('idle');
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [useSystemBarcode, setUseSystemBarcode] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    // PDF veya metin dosyaları için resim önizlemesi üretmeyelim
    if (
      String(file.type || '').toLowerCase() === 'application/pdf' ||
      isTextFile(file)
    ) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (phase !== 'analyzing') return;
    setAnalyzeProgress(0);

    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      // 0 -> 90 arası yavaşça ilerlesin (gerçek istek bitince 100'e çekiyoruz)
      const next = Math.min(90, Math.round((elapsed / 25000) * 90));
      setAnalyzeProgress((p) => (p >= next ? p : next));
    }, 200);

    return () => window.clearInterval(id);
  }, [phase]);

  // Electron/Chromium'un sürüklenen dosyayı otomatik açmasını engelle
  // SADECE preventDefault — stopPropagation KULLANMA, yoksa React onDrop hiç tetiklenmez
  useEffect(() => {
    const preventBrowserNav = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventBrowserNav);
    window.addEventListener('drop', preventBrowserNav);
    return () => {
      window.removeEventListener('dragover', preventBrowserNav);
      window.removeEventListener('drop', preventBrowserNav);
    };
  }, []);

  if (!isOpen) return null;

  const pickFile = () => fileInputRef.current?.click();

  const isAllowedFile = (f: File) => {
    return true; // Her türlü fatura dosya formatını (resim, PDF, HTML, XML, metin) kabul et
  };

  const setPickedFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (!isAllowedFile(f)) {
      setError('Sadece PDF veya görsel dosyaları (JPG/PNG/WebP) kabul edilir.');
      return;
    }
    setError(null);
    setResults(null);
    setDraftRows([]);
    setPhase('idle');
    setHasAnalyzed(false);
    setFile(f);
  };

  const onDragEnterContainer = (e: React.DragEvent<any>) => {
    e.preventDefault();
    const types = Array.from(e.dataTransfer?.types || []);
    console.log('[InvoiceDrag] dragenter, types:', types);
    if (types.includes('Files') || types.includes('application/x-moz-file') || types.length === 0) {
      dragCounter.current++;
      setIsDragOver(true);
    }
  };

  const onDragOverContainer = (e: React.DragEvent<any>) => {
    e.preventDefault();
  };

  const onDragLeaveContainer = (e: React.DragEvent<any>) => {
    e.preventDefault();
    dragCounter.current--;
    console.log('[InvoiceDrag] dragleave, counter:', dragCounter.current);
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const onDropFile = (e: React.DragEvent<any>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[InvoiceDrag] drop event triggered');
    dragCounter.current = 0;
    setIsDragOver(false);
    
    const dropped = e.dataTransfer?.files?.[0] || null;
    console.log('[InvoiceDrag] dropped file:', dropped ? { name: dropped.name, type: dropped.type, size: dropped.size } : 'null');
    setPickedFile(dropped);
  };
  const ensureCategoryId = async (categoryNameOrId: string | null): Promise<string> => {
    // 1) ID olarak gönderildiyse ve geçerliyse kullan
    if (categoryNameOrId && categories.some((c) => c.id === categoryNameOrId)) return categoryNameOrId;

    // 2) isim olarak ara
    const name = (categoryNameOrId || '').trim();
    if (name) {
      const found = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (found) return found.id;

      // Kategori oluşturmadan önce bir kez daha kontrol et (concurrent calls için)
      try {
        const created = await inventoryApi.createCategory({ name });
        // Not: setCategories yok çünkü categories props olarak geliyor
        // Parent component categories'i güncelleyecek
        return created.id;
      } catch (error: any) {
        // Eğer duplicate hata alırsak, kategoriyi tekrar ara ve var olanı kullan
        const isIntegrityError = 
          error?.response?.data?.type === 'IntegrityError' || 
          error?.response?.data?.detail?.includes('UNIQUE constraint failed') ||
          error?.response?.data?.detail?.includes('IntegrityError');
          
        if (isIntegrityError) {
          console.warn('⚠️ Kategori zaten var, mevcut olanı kullanılıyor:', name);
          // Cache'de ara, bulamazsa hata fırlat (parent component yeniden yükleyecek)
          const retryFound = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
          if (retryFound) return retryFound.id;
        }
        throw error;
      }
    }

    // 3) sayfada seçili kategori varsa
    if (selectedCategoryId && categories.some((c) => c.id === selectedCategoryId)) return selectedCategoryId;

    // 4) ilk kategori
    if (categories.length > 0) return categories[0].id;

    // 5) son çare: Genel kategori oluştur (duplicate kontrolü ile)
    try {
      const created = await inventoryApi.createCategory({ name: 'Genel' });
      // Not: setCategories yok çünkü categories props olarak geliyor
      return created.id;
    } catch (error: any) {
      // Genel kategori varsa onu kullan
      const isIntegrityError = 
        error?.response?.data?.type === 'IntegrityError' || 
        error?.response?.data?.detail?.includes('UNIQUE constraint failed') ||
        error?.response?.data?.detail?.includes('IntegrityError');
        
      if (isIntegrityError) {
        console.warn('⚠️ Genel kategori zaten var, mevcut olanı kullanılıyor');
        const generalFound = categories.find((c) => c.name.toLowerCase() === 'genel');
        if (generalFound) return generalFound.id;
      }
      throw error;
    }
  };

  const updateDraft = (id: string, patch: Partial<DraftRow>) => {
    setDraftRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addDraftRow = () => setDraftRows((prev) => [...prev, newDraftRow()]);

  const removeDraftRow = (id: string) => setDraftRows((prev) => prev.filter((r) => r.id !== id));

  const setAllDraftInclude = (include: boolean) => {
    setDraftRows((prev) => prev.map((r) => ({ ...r, include })));
  };

  const analyzeInvoice = async () => {
    if (!file) {
      setError('Lütfen bir fatura dosyası seçin (PDF veya görsel).');
      return;
    }

    const LOG = '[InvoiceImport]';
    const requestId = `inv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    setHasAnalyzed(true);
    setIsSubmitting(true);
    setError(null);
    setResults(null);
    setPhase('analyzing');
    setAnalyzeProgress(0);

    try {
      console.group(`${LOG} submit ${requestId}`);
      const isPdf = String(file.type || '').toLowerCase() === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf');
      const isText = isTextFile(file);
      const uploadFile = isPdf || isText ? file : await ensureJpegIfNeeded(file);
      const tPrepared = typeof performance !== 'undefined' ? performance.now() : Date.now();
      console.log('file:', { name: file.name, size: file.size, type: file.type, isPdf, isText });
      console.log('uploadFile:', { name: uploadFile.name, size: uploadFile.size, type: uploadFile.type });
      console.log('timing(ms): prepareFile=', Math.round(tPrepared - t0));

      let payload: any = null;
      let proxyFailureHint: string | null = null;
      let didTimeout = false;

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
          didTimeout = true;
          controller.abort();
        }, 120000);

        const geminiPrompt = `Faturadaki TÜM ürün satırlarını JSON formatında çıkar.

ÇIKARMA KURALLARI:
- Faturadaki HER ürün/mal satırını dahil et, hiç atlama.
- Firma adı, tarih, toplam, KDV toplamı, adres gibi satırları dahil etme.
- Fiyatlar sayısal (TL, string değil).
- quantity her zaman en az 1 olsun.
- sell_price faturada açıkça belirtilmemişse null bırak — uydurmayı yasak.
- JSON GÜVENLİĞİ: Ürün isimlerinde veya diğer metin alanlarında kesinlikle çift tırnak (") karakteri kullanma. Eğer faturada çift tırnak varsa (örn. 2.5" SSD veya "Tablet"), bunu tek tırnakla (') değiştir veya tırnakları tamamen sil. Bu kural JSON yapısının bozulmasını önlemek için hayati önem taşır.


ÜRÜN ADI İÇİNDEKİ BİRLEŞİK BİLGİLERİ AYRIŞTIRMA KURALLARI (ÇOK ÖNEMLİ):
Sıklıkla ürün adı kolonunda marka, beden/boyut, renk, hacim veya paket bilgileri tire (-), bölü (/), parantez () gibi işaretlerle birleşik yazılır (örn: "Adidas Stan Smith - 42 - Beyaz", "LCW Tişört / L / Mavi", "Dimes Şeftali Suyu 1Lt"). Bu durumlarda şu kurallara göre ayrıştır:
1. Ürün Adını Temizle (name): Ürün adının içindeki beden (XL, 42 vb.) ve marka (Adidas, LCW vb.) ifadelerini temizle. Temizlenmiş, sade ürün adını yaz.
   - Örnek: "Mavi Jean Pantolon - 32/32 - Mavi" -> name: "Mavi Jean Pantolon", size: "32/32", brand: "Mavi"
   - Örnek: "Nike Air Max (44 Numara / Siyah)" -> name: "Nike Air Max Siyah", size: "44", brand: "Nike"
   - Örnek: "Coca Cola 330ml 6lı Paket" -> name: "Coca Cola", size: "330ml 6lı", brand: "Coca Cola"
2. Markayı Çıkar (brand): Ürün adının başında veya içinde açıkça geçen marka adını yakala ve "brand" alanına yaz (örn: "Adidas", "Nike", "Dimes"). Yoksa null bırak.
3. Bedeni/Boyutu Çıkar (size): Ürün adında geçen beden (S, M, L, XL, 38, 42 vb.), boyut/hacim (250ml, 1.5Lt, 500gr vb.) veya paketleme (6'lı, 12'li vb.) bilgisini yakala ve "size" alanına yaz. Yoksa null bırak.

ALAN DOLDURMA KURALLARI:
- name: Ayrıştırılmış ve temizlenmiş ürün adını yaz.
- barcode: Satırda EAN/GTIN/barkod rakamı (8-14 hane) varsa yaz. Yoksa null.
- brand: Ayrıştırılmış marka adını yaz. 
  * DİKKAT (ÜRETİCİ vs ARACI): Eğer faturayı düzenleyen firma kendi markasını veya kendi özel ürettiği butik/özel markalı ürünleri fatura ediyorsa (örn: Fatura başlığında/logosunda "Heal Point" yazıyor ve faturadaki ürünlerin başka bir markası yoksa), marka alanına bu firma adını (örn. "Heal Point") yazabilirsin.
  * UYARI: Eğer satıcı firma genel/aracı bir toptancı veya distribütör ise (birden fazla farklı markanın ürünlerini satıyorsa, örn: "Öz Gıda Toptan"), fatura başlığını marka olarak YAZMA, boş (null) bırak.
- category: Ürün adından mantıklı bir kategori çıkartabiliyorsan yaz (örn: "Süt ürünleri", "Elektronik"). Emin değilsen null.
- size: Ayrıştırılmış beden/boyut/hacim/paket bilgisini yaz. Yoksa null.
- unit: Faturadaki birim ("Adet", "Kg", "Lt" vb.). Yoksa "adet".
- buy_price: Birim alış/maliyet fiyatı. Yoksa 0.
- sell_price: Birim satış fiyatı faturada varsa yaz. Yoksa null.
- vat: KDV oranı (yüzde olarak, örn: 20). Yoksa 20.

ONAY: Bir alanı dolduracak bilgi faturada yoksa null yaz. Uydurmak yasak.`;

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('prompt', geminiPrompt);

        const fetchStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        console.log('gemini:backend_fetch:start', { requestId, atMs: Math.round(fetchStartedAt - t0) });

        const response = await apiClient.post('/inventory/invoice/parse', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: controller.signal,
          timeout: 120000,
        });

        console.log('gemini response:', { ok: true, status: response.status });
        payload = { data: response.data };
      } catch (e: any) {
        const msg = String(e?.response?.data?.detail || e?.message || e || '');
        const tErr = typeof performance !== 'undefined' ? performance.now() : Date.now();
        console.error(`${LOG} gemini backend fetch failed`, { requestId, error: e, message: msg, elapsedMs: Math.round(tErr - t0) });
        if (msg.toLowerCase().includes('abort')) {
          proxyFailureHint = didTimeout ? 'Gemini API zaman aşımına uğradı (120 sn).' : 'İstek iptal edildi.';
        } else {
          proxyFailureHint = `Fatura analizi başarısız: ${msg}`;
        }
        payload = null;
      }

      console.log('payload:', payload);

      try {
        (window as any).__invoiceImportLast = {
          requestId,
          file: { name: file.name, size: file.size, type: file.type },
          uploadFile: { name: uploadFile.name, size: uploadFile.size, type: uploadFile.type },
          payload,
        };
        console.log(`${LOG} saved debug snapshot to window.__invoiceImportLast`);
      } catch {
        // ignore
      }

      // Gemini başarısız olduysa gerçek hata mesajını göster
      if (!payload) {
        const errorMsg = proxyFailureHint || 'Gemini API yanit vermedi. Lutfen tekrar deneyin.';
        setError(errorMsg);
        setPhase('analyzed');
        setAnalyzeProgress(100);
        setResults([{ action: 'failed', name: 'Gemini', reason: errorMsg.slice(0, 80) }]);
        console.groupEnd();
        return;
      }

      const candidates = payload ? extractCandidates(payload) : [];
      console.log('extracted candidates:', { count: candidates.length, first: candidates[0] });

      if (candidates.length === 0 && payload && typeof payload === 'object') {
        const partsText = extractPartsText(payload);
        if (typeof partsText === 'string' && partsText.trim()) {
          const parsedFromParts =
            tryParseJsonString(partsText) ??
            tryExtractJsonFromText(partsText) ??
            tryExtractItemsArrayFromText(partsText);
          const recoveredItems = tryExtractItemsArrayFromText(partsText);
          console.warn(`${LOG} candidates=0 but found content.parts[0].text`, {
            partsTextLength: partsText.length,
            partsTextPreview: partsText.slice(0, 250),
            parsedFromPartsType: parsedFromParts == null ? null : Array.isArray(parsedFromParts) ? 'array' : typeof parsedFromParts,
            parsedFromPartsKeys: parsedFromParts && typeof parsedFromParts === 'object' ? Object.keys(parsedFromParts).slice(0, 20) : null,
            recoveredItems: recoveredItems && Array.isArray((recoveredItems as any).items) ? (recoveredItems as any).items.length : null,
            partsTextTail: partsText.slice(-120),
          });
        }
      }

      // Review screen: veriler henüz DB'ye yazılmaz.
      const rows = candidates.length > 0 ? candidates.map(c => candidateToDraftRow(c, useSystemBarcode)) : [newDraftRow()];
      setDraftRows(rows);
      setPhase('analyzed');
      setAnalyzeProgress(100);
      if (candidates.length === 0) {
        setError(
          payload == null
            ? `${proxyFailureHint ? `${proxyFailureHint} ` : ''}Gemini API\'ye ulaşılamadı. Taslak tabloya manuel satır ekleyebilirsin.`
            : 'Gemini yanıtı geldi ama ürün satırları çıkarılamadı. Taslak tabloya manuel satır ekleyebilirsin.'
        );
      }
      console.groupEnd();
    } catch (e: any) {
      const msg = e?.message || 'İşlem başarısız';
      console.error('[InvoiceImport] fatal error', e);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmAndSave = async () => {
    const active = draftRows.filter((r) => r.include);
    if (active.length === 0) {
      setError('En az 1 satır seçmelisin.');
      return;
    }

    // Basit validasyon
    const invalid = active.find((r) => !r.name.trim() && !r.barcode.trim());
    if (invalid) {
      setError('Ürün adı veya barkod boş olamaz (en az biri dolu olmalı).');
      return;
    }

    setIsSubmitting(true);
    setPhase('saving');
    setError(null);
    setResults(null);

    const out: ResultRow[] = [];

    // Varyant gruplama: aynı isimli ürünleri bul
    const nameGroups = new Map<string, DraftRow[]>();
    for (const r of active) {
      const key = r.name.trim().toLowerCase();
      if (!nameGroups.has(key)) nameGroups.set(key, []);
      nameGroups.get(key)!.push(r);
    }
    // Birden fazla farklı bedeni olan gruplar varyant grubudur
    const variantGroupKeys = new Set<string>();
    for (const [key, rows] of nameGroups) {
      const sizes = new Set(rows.map((r) => (r.size || 'Standart').trim()));
      if (rows.length > 1 && sizes.size > 1) variantGroupKeys.add(key);
    }
    // name → parent product id (ilk oluşturulan parent olur)
    const variantParentIds = new Map<string, string>();

    try {
      for (const r of active) {
        const name = (r.name || r.barcode || 'Ürün').toString().trim();
        const barcode = (r.barcode || '').toString().trim();
        const qty = Math.max(0, Math.round(safeNumber(r.quantity) ?? 0));
        const unit = (r.unit || 'adet').toString().trim() || 'adet';
        const buy = safeNumber(r.buy_price);
        const incomingSell = safeNumber(r.sell_price);
        const sell =
          incomingSell != null && incomingSell > 0
            ? incomingSell
            : buy != null
              ? Number((buy * 2).toFixed(2))
              : 0;
        const nameKey = name.toLowerCase();
        const isVariantGroup = variantGroupKeys.has(nameKey);
        const sizeVal = (r.size || '').trim() && r.size.trim() !== 'Standart' ? r.size.trim() : undefined;

        try {
          // Barkod varsa önce mevcut ürünü bulup stok ekle
          if (barcode) {
            const existing = await inventoryApi.getProductByBarcode(barcode).catch(() => null);
            if (existing) {
              if (qty > 0) {
                await inventoryApi.updateStock(
                  existing.id,
                  { amount: qty, reason: 'RESTOCK', notes: 'Fatura import' },
                  'default-user-id'
                );
              }
              // fiyat/cost/size güncellemesi
              const update: any = {};
              if (sell != null && sell > 0) update.price = sell;
              if (buy != null && buy >= 0) update.cost = buy;
              if (sizeVal) update.size = sizeVal;
              // Varyant grubundaysa parent_id güncelle
              if (isVariantGroup && variantParentIds.has(nameKey)) {
                update.parent_id = variantParentIds.get(nameKey);
              }
              if (Object.keys(update).length > 0) {
                await inventoryApi.updateProduct(existing.id, update).catch(() => null);
              }
              // İlk varyantsa parent olarak kaydet
              if (isVariantGroup && !variantParentIds.has(nameKey)) {
                variantParentIds.set(nameKey, existing.id);
              }
              out.push({ action: 'updated', name: existing.name, id: existing.id });
              continue;
            }
          }

          const category_id = await ensureCategoryId(r.category);
          // Varyant grubundaysa parent_id ata (ilk oluşturulan parent olur)
          const parentId = isVariantGroup ? variantParentIds.get(nameKey) : undefined;
          const productData: ProductCreate = {
            category_id,
            name: (r.name || barcode || '').toString().trim() || 'Yeni Ürün',
            barcode: barcode || undefined,
            brand: r.brand?.trim() ? (r.brand.trim() as any) : undefined,
            price: sell != null ? sell : 0,
            cost: buy != null ? buy : undefined,
            stock_quantity: qty,
            critical_level: 10,
            unit,
            size: sizeVal,
            parent_id: parentId,
            tax_rate: parseFloat(r.tax_rate) || 18,
            is_active: true,
          };

          try {
            const created = await inventoryApi.createProduct(productData);
            console.log('✅ Ürün oluşturuldu:', created.name, sizeVal ? `[${sizeVal}]` : '', parentId ? `parent:${parentId}` : '');
            // Varyant grubunun ilk ürünüyse parent olarak kaydet
            if (isVariantGroup && !variantParentIds.has(nameKey)) {
              variantParentIds.set(nameKey, created.id);
              console.log('📦 Varyant parent kaydedildi:', created.name, created.id);
            }
            out.push({ action: 'created', name: created.name + (sizeVal ? ` [${sizeVal}]` : ''), id: created.id });
          } catch (e: any) {
            console.error('❌ Ürün oluşturma hatası:', e?.response?.data || e?.message);
            // Eğer duplicate barcode hatası alırsak, ürünü tekrar kontrol et
            const isIntegrityError = 
              e?.response?.data?.type === 'IntegrityError' || 
              e?.response?.data?.detail?.includes('UNIQUE constraint failed: products.barcode') ||
              e?.response?.data?.detail?.includes('IntegrityError');
            
            if (isIntegrityError && barcode) {
              console.warn('⚠️ Ürün zaten oluşturulmuş, mevcut olanı kullanılıyor:', barcode);
              try {
                const existing = await inventoryApi.getProductByBarcode(barcode);
                if (existing) {
                  console.log('✅ Mevcut ürün bulundu, güncelleniyor:', existing.name);
                  if (qty > 0) {
                    await inventoryApi.updateStock(
                      existing.id,
                      { amount: qty, reason: 'RESTOCK', notes: 'Fatura import (n8n)' },
                      'default-user-id'
                    );
                  }
                  // fiyat/cost güncellemesi
                  const update: any = {};
                  if (sell != null && sell > 0) update.price = sell;
                  if (buy != null && buy >= 0) update.cost = buy;
                  if (r.size && r.size.trim() && r.size.trim() !== 'Standart') {
                    update.description = `Beden: ${r.size.trim()}`;
                  }
                  if (Object.keys(update).length > 0) {
                    await inventoryApi.updateProduct(existing.id, update).catch(() => null);
                  }
                  out.push({ action: 'updated', name: existing.name, id: existing.id });
                  continue;
                } else {
                  console.warn('⚠️ Ürün hala bulunamadı, tekrar oluşturuluyor:', barcode);
                  // Ürün hala yoksa tekrar dene (başka bir thread oluşturmuş olabilir)
                  try {
                    const retryCreated = await inventoryApi.createProduct(productData);
                    console.log('✅ İkinci denemede ürün oluşturuldu:', retryCreated.name);
                    out.push({ action: 'created', name: retryCreated.name, id: retryCreated.id });
                    continue;
                  } catch (retryError: any) {
                    console.error('❌ İkinci deneme de başarısız:', retryError?.response?.data || retryError?.message);
                    out.push({ action: 'failed', name, reason: retryError?.response?.data?.detail || retryError?.message || 'İkinci deneme başarısız' });
                    continue;
                  }
                }
              } catch (retryError: any) {
                console.error('❌ Retry de başarısız:', retryError?.response?.data || retryError?.message);
                // Eğer retry de 404 verirse, ürün gerçekten yok demektir - son bir deneme daha yap
                if (retryError?.response?.status === 404) {
                  console.warn('⚠️ Ürün gerçekten yok, son deneme:', barcode);
                  try {
                    const finalCreated = await inventoryApi.createProduct(productData);
                    console.log('✅ Son denemede ürün oluşturuldu:', finalCreated.name);
                    out.push({ action: 'created', name: finalCreated.name, id: finalCreated.id });
                    continue;
                  } catch (finalError: any) {
                    console.error('❌ Son deneme de başarısız:', finalError?.response?.data || finalError?.message);
                    out.push({ action: 'failed', name, reason: finalError?.response?.data?.detail || finalError?.message || 'Son deneme başarısız' });
                    continue;
                  }
                } else {
                  out.push({ action: 'failed', name, reason: retryError?.response?.data?.detail || retryError?.message || 'Retry başarısız' });
                  continue;
                }
              }
            }
            out.push({ action: 'failed', name, reason: e?.response?.data?.detail || e?.message || 'Bilinmeyen hata' });
          }
        } catch (e: any) {
          out.push({ action: 'failed', name, reason: e?.message || 'Bilinmeyen hata' });
        }
      }

      setResults(out);
      setPhase('done');
    } catch (e: any) {
      setError(e?.message || 'Kaydetme sırasında hata');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createdCount = results?.filter((r) => r.action === 'created').length ?? 0;
  const updatedCount = results?.filter((r) => r.action === 'updated').length ?? 0;
  const failedCount = results?.filter((r) => r.action === 'failed').length ?? 0;

  const stepIndex =
    results ? 3 : phase === 'saving' ? 2 : phase === 'review' ? 2 : hasAnalyzed ? 1 : file ? 0 : 0;
  const steps = ['Dosya', 'Analiz', 'Kontrol', 'Sonuç'];
  
  // Check if current step has errors
  const hasStepErrors = results && results.some(r => r.action === 'failed');
  const phaseLabel = results
    ? 'Sonuç'
    : phase === 'saving'
      ? 'Kaydediliyor'
      : phase === 'review'
        ? 'Kontrol'
        : phase === 'analyzed'
          ? 'Analiz Tamamlandı'
          : phase === 'analyzing'
            ? 'Analiz'
            : file
              ? 'Hazır'
              : 'Dosya Seç';

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      onDragEnter={onDragEnterContainer}
      onDragOver={onDragOverContainer}
      onDragLeave={onDragLeaveContainer}
      onDrop={onDropFile}
    >
      {isDragOver && (
        <div 
          className="fixed inset-0 z-[2000] bg-slate-950/40 backdrop-blur-[4px] flex items-center justify-center cursor-copy"
          onDragEnter={onDragEnterContainer}
          onDragOver={onDragOverContainer}
          onDragLeave={onDragLeaveContainer}
          onDrop={onDropFile}
        >
          <div className="bg-slate-900 text-white px-8 py-5 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3.5 border border-slate-700/80 scale-105 pointer-events-none transition-all duration-300">
            <FileUp className="w-5 h-5 animate-bounce" />
            Faturayı Buraya Bırakın
          </div>
        </div>
      )}
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={isSubmitting ? undefined : onClose} 
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-[0_24px_70px_-10px_rgba(15,23,42,0.3)] border border-slate-200/85 overflow-hidden flex flex-col animate-in zoom-in-[0.98] duration-300 max-h-[80vh]">
        
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-slate-100 flex items-center justify-end bg-white/50 backdrop-blur-md">
          <div className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-1">
            {steps.map((s, idx) => {
              const done = idx < stepIndex;
              const active = idx === stepIndex;
              return (
                <div key={s} className="flex items-center gap-1">
                  <div
                    className={cn(
                      'h-6 px-3 rounded-full flex items-center justify-center gap-1.5 text-[10px] font-black transition-all duration-300 uppercase tracking-wider',
                      done
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        : active
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-400 border border-slate-100/50'
                    )}
                  >
                    {done ? <Check className="w-3 h-3" /> : <span>{idx + 1}</span>}
                    <span>{s}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className="w-5 h-px bg-slate-200 mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>

          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all active:scale-90"
            disabled={isSubmitting}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div 
          className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar relative"
        >
          {phase === 'analyzing' || phase === 'saving' ? (
            /* Aesthetic Futuristic AI Loading State */
            <div className="max-w-md mx-auto py-16 flex flex-col items-center justify-center text-center gap-6 animate-in fade-in duration-300">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 animate-ping duration-1000" />
                <div className="absolute inset-2 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 blur-sm" />
                <div className="relative w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shadow-xl">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              </div>
              <div>
                <h3 className="text-[14px] font-black text-slate-800 tracking-wider uppercase">{phaseLabel}...</h3>
                <p className="text-xs text-slate-450 font-semibold mt-2 leading-relaxed max-w-xs mx-auto">
                  {phase === 'analyzing' 
                    ? 'Yapay zeka faturanızdaki ürünleri, barkodları, fiyatları ve KDV oranlarını çıkarıyor. Lütfen bekleyin.'
                    : 'Seçtiğiniz ürünler envanter stoğunuza kaydediliyor.'}
                </p>
              </div>
              <div className="w-full max-w-xs space-y-2 mt-2">
                <div className="flex justify-between text-[9px] font-black text-slate-400 tracking-widest uppercase">
                  <span>İŞLENİYOR</span>
                  <span>{analyzeProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200/50 shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-300"
                    style={{ width: `${analyzeProgress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : !hasAnalyzed ? (
            /* Dropzone / Upload state */
            <div className="max-w-xl mx-auto py-12">
              <div 
                onClick={pickFile}
                className={cn(
                  'relative border-2 border-dashed rounded-2xl p-14 transition-all duration-350 flex flex-col items-center text-center gap-5 bg-gradient-to-b from-slate-50/50 to-white shadow-sm cursor-pointer group',
                  isDragOver 
                    ? 'border-indigo-500 bg-indigo-50/10' 
                    : 'border-slate-300 hover:border-indigo-500 hover:shadow-md hover:from-indigo-50/5 hover:to-white'
                )}
              >
                <div className={cn(
                  "w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300 border-2 shadow-inner",
                  file 
                    ? "border-emerald-100 bg-emerald-50/80 text-emerald-600 shadow-emerald-50" 
                    : "border-slate-100 bg-slate-50 text-slate-400 group-hover:border-indigo-100 group-hover:bg-indigo-50 group-hover:text-indigo-650"
                )}>
                  {file ? <Check className="w-9 h-9" /> : <FileUp className="w-9 h-9" />}
                </div>

                <div>
                  <h3 className="text-[15.5px] font-black text-slate-800 mb-1 group-hover:text-indigo-950 transition-colors">
                    {file ? 'Fatura Dosyası Seçildi' : 'Fatura Belgesini Yükleyin'}
                  </h3>
                  <p className="text-xs text-slate-550 font-semibold leading-relaxed max-w-sm mx-auto">
                    {file 
                      ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)`
                      : 'Faturanızdaki ürün adı, barkod, fiyat ve KDV oranlarını otomatik olarak çıkarmak için sürükleyin veya tıklayın.'}
                  </p>
                </div>

                {file && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPickedFile(null); }}
                    className="mt-2 text-[10px] font-black text-rose-650 hover:text-rose-700 underline underline-offset-4 tracking-wider uppercase"
                  >
                    DOSYAYI DEĞİŞTİR
                  </button>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => setPickedFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          ) : error ? (
            /* Error state wrapper */
            <div className="max-w-xl mx-auto py-12 space-y-4">
              <div className="rounded-2xl bg-rose-50 border border-rose-100/80 p-5 flex items-start gap-3.5 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-rose-550 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-black text-rose-900 uppercase tracking-wider">HATA OLUŞTU</h5>
                  <p className="text-[11px] text-rose-700 font-bold mt-1 leading-relaxed">{error}</p>
                </div>
              </div>
            </div>
          ) : phase === 'analyzed' ? (
            /* Success Feedback Card after analysis */
            <div className="max-w-md mx-auto py-16 flex flex-col items-center justify-center text-center gap-6 animate-in fade-in duration-300">
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-md shadow-emerald-500/10">
                <Check className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-[14px] font-black text-slate-800 tracking-wider uppercase">ANALİZ TAMAMLANDI</h3>
                <p className="text-xs text-slate-550 font-semibold mt-2 leading-relaxed">
                  Faturanız başarıyla tarandı ve **{draftRows.length} adet** ürün listelendi. Ürün bilgilerini gözden geçirmek için kontrole geçebilirsiniz.
                </p>
              </div>
            </div>
          ) : phase === 'review' ? (
            /* Review and edit list table view */
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-3 bg-amber-500 rounded-full" />
                  Çıkarılan Ürünler ({draftRows.length})
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAllDraftInclude(true)}
                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black text-slate-650 hover:bg-slate-50 transition-all active:scale-95"
                  >
                    HEPSİNİ SEÇ
                  </button>
                  <button
                    onClick={() => setAllDraftInclude(false)}
                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black text-slate-655 hover:bg-slate-50 transition-all active:scale-95"
                  >
                    SEÇİMİ TEMİZLE
                  </button>
                  <button
                    onClick={addDraftRow}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-900 text-[10px] font-black text-white hover:bg-slate-800 transition-all ml-2 flex items-center gap-1 active:scale-95"
                  >
                    <Plus className="w-3 h-3" /> YENİ SATIR EKLE
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="max-h-[350px] overflow-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-250">
                      <tr>
                        <th className="p-3 w-10 text-center"><X className="w-3 h-3 text-slate-300 mx-auto" /></th>
                        <th className="px-2 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ürün Adı</th>
                        <th className="px-2 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Barkod</th>
                        <th className="px-2 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Marka</th>
                        <th className="px-2 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Beden</th>
                        <th className="px-2 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Miktar</th>
                        <th className="px-2 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Alış Fiyatı</th>
                        <th className="px-2 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Satış Fiyatı</th>
                        <th className="px-2 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">KDV</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {draftRows.map((r) => (
                        <tr key={r.id} className={cn("transition-colors hover:bg-slate-50/40", r.include ? "bg-white" : "bg-slate-50/20 opacity-50")}>
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={r.include}
                              onChange={(e) => updateDraft(r.id, { include: e.target.checked })}
                              className="w-4 h-4 rounded border-slate-350 text-black focus:ring-black"
                            />
                          </td>
                          <td className="px-2 py-2 min-w-[220px]">
                            <input
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:border-black focus:ring-1 focus:ring-black/10 outline-none text-slate-800 transition-all"
                              value={r.name}
                              onChange={(e) => {
                                const v = e.target.value;
                                const b1 = normalizeBarcodeFromName(v, r.barcode);
                                const s1 = normalizeSizeFromName(b1.name, r.size);
                                updateDraft(r.id, { name: s1.name, barcode: b1.barcode, size: s1.size });
                              }}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:border-black focus:ring-1 focus:ring-black/10 outline-none text-slate-800 transition-all font-mono"
                              value={r.barcode}
                              onChange={(e) => {
                                const v = e.target.value;
                                const b1 = normalizeBarcodeFromName(r.name, v);
                                updateDraft(r.id, { barcode: b1.barcode, name: b1.name });
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 w-32">
                            <input
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:border-black focus:ring-1 focus:ring-black/10 outline-none text-slate-800 transition-all"
                              value={r.brand}
                              onChange={(e) => updateDraft(r.id, { brand: e.target.value })}
                            />
                          </td>
                          <td className="px-2 py-2 w-28">
                            <select
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:border-black focus:ring-1 focus:ring-black/10 outline-none text-slate-800 transition-all bg-white"
                              value={r.size}
                              onChange={(e) => updateDraft(r.id, { size: e.target.value })}
                            >
                              {['Standart', 'S', 'M', 'L', 'XL'].map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2 w-20">
                            <input
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-black text-center focus:border-black focus:ring-1 focus:ring-black/10 outline-none text-slate-800 transition-all"
                              value={r.quantity}
                              onChange={(e) => updateDraft(r.id, { quantity: e.target.value })}
                            />
                          </td>
                          <td className="px-2 py-2 w-24">
                            <input
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-black focus:border-black focus:ring-1 focus:ring-black/10 outline-none text-emerald-650 transition-all"
                              value={r.buy_price}
                              onChange={(e) => {
                                const nextBuy = e.target.value;
                                const nextSell = autoSellFromBuyIfEmpty(nextBuy, r.sell_price);
                                updateDraft(r.id, { buy_price: nextBuy, sell_price: nextSell });
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 w-24">
                            <input
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-black focus:border-black focus:ring-1 focus:ring-black/10 outline-none text-indigo-650 transition-all"
                              value={r.sell_price}
                              onChange={(e) => updateDraft(r.id, { sell_price: e.target.value })}
                            />
                          </td>
                          <td className="px-2 py-2 w-24">
                            <select
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-black focus:border-black focus:ring-1 focus:ring-black/10 outline-none text-slate-850 transition-all bg-white"
                              value={r.tax_rate}
                              onChange={(e) => updateDraft(r.id, { tax_rate: e.target.value })}
                            >
                              <option value="20">%20</option>
                              <option value="18">%18</option>
                              <option value="10">%10</option>
                              <option value="1">%1</option>
                            </select>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                              onClick={() => removeDraftRow(r.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : results ? (
            /* Results phase layout */
            <div className="space-y-4 animate-in fade-in duration-300 max-w-xl mx-auto py-4">
              <div className="flex flex-col items-center text-center gap-3.5 mb-6">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-md shadow-emerald-500/5">
                  <Check className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-[14px] font-black text-slate-850 tracking-wider uppercase">İŞLEM BAŞARIYLA TAMAMLANDI</h3>
                  <p className="text-xs text-slate-550 font-bold mt-1">
                    Aktarılan ürünler envanter listesinde güncellenmiştir.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="max-h-56 overflow-auto divide-y divide-slate-100 custom-scrollbar">
                  {results.map((r, idx) => (
                    <div key={idx} className="px-5 py-3 flex items-center justify-between text-xs transition-colors hover:bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          r.action === 'created' ? "bg-emerald-500" :
                          r.action === 'updated' ? "bg-indigo-500" : "bg-rose-500"
                        )} />
                        <div>
                          <span className="font-bold text-slate-800 mr-2">{r.name}</span>
                          {r.action === 'failed' && r.reason && <span className="text-[10px] text-rose-500 font-medium italic">{r.reason}</span>}
                        </div>
                      </div>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                        r.action === 'created' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                        r.action === 'updated' ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "bg-rose-50 text-rose-700 border border-rose-100"
                      )}>
                        {r.action === 'created' ? 'Yeni Eklendi' : r.action === 'updated' ? 'Güncellendi' : 'Hata'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-8 pt-5 pb-6 border-t border-slate-100 bg-white flex items-center justify-end">
          <div className="flex items-center gap-2">
            {results ? (
              <button
                onClick={async () => { await onCompleted(); }}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[10.5px] font-black transition-all uppercase tracking-widest active:scale-95 shadow-lg shadow-amber-600/15"
                type="button"
              >
                STOĞA KAYDET VE BİTİR
              </button>
            ) : phase === 'analyzed' ? (
              <button
                onClick={() => setPhase('review')}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[10.5px] font-black transition-all uppercase tracking-widest active:scale-95 shadow-lg shadow-amber-600/15"
                type="button"
                disabled={isSubmitting}
              >
                KONTROLE GEÇ
              </button>
            ) : phase === 'review' ? (
              <>
                <button
                  onClick={() => { setPhase('analyzed'); setResults(null); }}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-650 text-[10.5px] font-black hover:bg-slate-50 transition-all uppercase tracking-widest rounded-xl active:scale-95"
                  type="button"
                  disabled={isSubmitting}
                >
                  GERİ
                </button>
                <button
                  onClick={confirmAndSave}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 text-white font-black text-[10.5px] hover:bg-amber-700 transition-all active:scale-[0.98] flex items-center gap-1.5 shadow-lg shadow-amber-600/15 disabled:opacity-70 uppercase tracking-widest"
                  type="button"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>KAYDET VE DEVAM ET<Sparkles className="w-3.5 h-3.5" /></>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={analyzeInvoice}
                disabled={!file || isSubmitting || phase === 'analyzing'}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[10.5px] transition-all active:scale-[0.98] flex items-center gap-1.5 shadow-lg shadow-amber-600/15 disabled:opacity-50 uppercase tracking-widest"
                type="button"
              >
                {phase === 'analyzing' ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analiz ediliyor...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" />DEVAM ET</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}