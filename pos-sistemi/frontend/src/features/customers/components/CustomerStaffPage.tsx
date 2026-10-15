/**
 * CustomerStaffPage
 * Müşteri & Personel Yönetimi
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, UserPlus, Search, Phone, MapPin, Package,
  Clock, CheckCircle, AlertTriangle, XCircle,
  ChevronRight, Edit2, Trash2, X, Calendar,
  Loader2, RefreshCw, Construction, ChevronDown, Building2, UserCheck,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { customersApi, type Customer, type CustomerCreate } from '@/features/sales/services/customersApi';
import { inventoryApi, type Product } from '@/features/inventory/services/inventoryApi';
import { PersonnelPage } from '@/features/personnel/components/PersonnelPage';

// ─────────────────────────────────────────────────────────────
// Yardımcı fonksiyonlar
// ─────────────────────────────────────────────────────────────

function calcDaysLeft(nextDate?: string): number | null {
  if (!nextDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(nextDate);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / 86400000);
}

function calcNextDate(lastDate: string, periodDays: number): string {
  const d = new Date(lastDate);
  d.setDate(d.getDate() + periodDays);
  return d.toISOString().split('T')[0];
}

function calcLastDate(nextDate: string, periodDays: number): string {
  const d = new Date(nextDate);
  d.setDate(d.getDate() - periodDays);
  return d.toISOString().split('T')[0];
}

function formatDate(d?: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

function formatPhoneNumber(value: string): string {
  if (!value) return '';
  const digits = value.replace(/[^\d]/g, '');
  if (digits.length === 0) return '';
  
  let cleaned = digits;
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  const len = cleaned.length;
  if (len === 0) return '0';
  if (len <= 3) return `0 (${cleaned}`;
  if (len <= 6) return `0 (${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  if (len <= 8) return `0 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  return `0 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
}

function getFriendlyMaterialName(materialStr?: string): string {
  if (!materialStr) return '—';
  if (materialStr.startsWith('[') || materialStr.startsWith('JSON:')) {
    try {
      const raw = materialStr.startsWith('JSON:') ? materialStr.substring(5) : materialStr;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(item => `${item.name} (${item.quantity} adet)`).join(', ');
      }
    } catch (e) {
      // ignore
    }
  }
  return materialStr;
}

type StatusInfo = {
  label: string; textColor: string;
  bgColor: string; borderColor: string;
  icon: React.ReactNode;
};

function getStatus(days: number | null): StatusInfo {
  if (days === null)
    return { label: 'Tarih Girilmemiş', textColor: 'text-slate-400', bgColor: 'bg-slate-50', borderColor: 'border-slate-200', icon: <Clock className="w-3.5 h-3.5" /> };
  if (days < 0)
    return { label: `${Math.abs(days)} Gün Gecikti`, textColor: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', icon: <XCircle className="w-3.5 h-3.5" /> };
  if (days === 0)
    return { label: 'Bugün Teslim Edilmeli!', textColor: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', icon: <AlertTriangle className="w-3.5 h-3.5" /> };
  if (days <= 3)
    return { label: `${days} Gün Kaldı`, textColor: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', icon: <AlertTriangle className="w-3.5 h-3.5" /> };
  return { label: `${days} Gün Kaldı`, textColor: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', icon: <CheckCircle className="w-3.5 h-3.5" /> };
}

// ─────────────────────────────────────────────────────────────
// Input stilleri
// ─────────────────────────────────────────────────────────────
const inputCls =
  'w-full border border-slate-200 rounded px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-400 bg-white';

// ─────────────────────────────────────────────────────────────
// Manuel Fiyat Modalı
// ─────────────────────────────────────────────────────────────

interface ManualPriceModalProps {
  customer: Customer;
  onConfirm: (price: number, method: 'CASH' | 'CARD') => void;
  onClose: () => void;
}

function ManualPriceModal({ customer, onConfirm, onClose }: ManualPriceModalProps) {
  const [price, setPrice] = useState('');
  const [method, setMethod] = useState<'CASH' | 'CARD'>('CASH');
  const qty = customer.quantity || 1;
  const suggested = (customer.unit_price || 0) * qty;

  const friendlyName = getFriendlyMaterialName(customer.needed_material);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-slate-900 font-bold text-sm">Ürün Stokta Yok</h3>
              <p className="text-slate-500 text-xs">{friendlyName} — Manuel fiyat girin</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-2">
            {[
              ['Müşteri', `${customer.name} ${customer.last_name || ''}`],
              ['Ürün', friendlyName],
              ['Adet', String(qty)],
            ].map(([lbl, val]) => (
              <div key={lbl} className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">{lbl}</span>
                <span className="text-slate-800 font-semibold">{val}</span>
              </div>
            ))}
            {suggested > 0 && (
              <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                <span className="text-slate-500">Önerilen</span>
                <button onClick={() => setPrice(suggested.toFixed(2))} className="text-blue-600 font-bold hover:text-blue-700">
                  ₺{suggested.toFixed(2)} (Kullan)
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-slate-600 font-semibold mb-1.5 block">Toplam Fiyat (₺)</label>
            <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="0.00" className={inputCls} autoFocus />
          </div>
          <div>
            <label className="text-xs text-slate-600 font-semibold mb-1.5 block">Ödeme Yöntemi</label>
            <div className="flex gap-2">
              {(['CASH', 'CARD'] as const).map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={cn('flex-1 py-2.5 rounded border text-xs font-bold uppercase tracking-wide transition-all',
                    method === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  )}>
                  {m === 'CASH' ? 'Nakit' : 'Kart'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all">İptal</button>
            <button
              onClick={() => { const p = parseFloat(price); if (!isNaN(p) && p >= 0) onConfirm(p, method); }}
              disabled={!price || isNaN(parseFloat(price))}
              className="flex-1 py-2.5 rounded bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 transition-all"
            >Teslim Et & Kaydet</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Ürün Autocomplete Bileşeni
// ─────────────────────────────────────────────────────────────

interface ProductAutocompleteProps {
  value: string;
  onChange: (name: string, productId?: string, price?: number) => void;
  onEnter?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

function ProductAutocomplete({ value, onChange, onEnter, inputRef }: ProductAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [loadingProds, setLoadingProds] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Ürünleri bir kez yükle
  useEffect(() => {
    inventoryApi.getProducts().then(p => setAllProducts(p)).catch(() => {});
  }, []);

  useEffect(() => {
    if (value.length >= 2) {
      setLoadingProds(true);
      const q = value.toLowerCase();
      const matched = allProducts.filter(p =>
        (p.name || '').toLowerCase().includes(q) && !p.parent_id
      ).slice(0, 8);
      setSuggestions(matched);
      setShowDrop(matched.length > 0);
      setLoadingProds(false);
    } else {
      setSuggestions([]);
      setShowDrop(false);
    }
  }, [value, allProducts]);

  // Dışarı tıklanınca kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <label className="text-xs text-slate-600 font-semibold mb-1.5 block">Ürün / Malzeme Adı</label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value, undefined, undefined); }}
          onFocus={() => { if (suggestions.length > 0) setShowDrop(true); }}
          onKeyDown={e => {
            if (e.key === 'Escape') setShowDrop(false);
            if (e.key === 'Enter' && !showDrop) { e.preventDefault(); onEnter?.(); }
          }}
          placeholder="Molfix Hasta Bezi L Boy"
          className={inputCls}
          autoComplete="off"
        />
        {loadingProds && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
        )}
      </div>

      {/* Dropdown */}
      {showDrop && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg z-50 overflow-hidden max-h-52 overflow-y-auto">
          <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stoktan Seç</p>
          </div>
          {suggestions.map(p => (
            <button
              key={p.id}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                onChange(p.name, p.id, p.price);
                setShowDrop(false);
                onEnter?.();
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-slate-900 text-sm font-semibold truncate">{p.name}</p>
                <p className="text-slate-400 text-xs">Stok: {p.stock_quantity} {p.unit}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-emerald-600 font-bold text-sm">₺{p.price.toFixed(2)}</p>
                {p.stock_quantity <= 0 && (
                  <p className="text-red-500 text-[10px] font-bold">Stok Yok</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Enter ile sonraki alana geç yardımcısı
// ─────────────────────────────────────────────────────────────

function focusNext(refs: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>[], current: number) {
  for (let i = current + 1; i < refs.length; i++) {
    const el = refs[i].current;
    if (el && !el.disabled) {
      el.focus();
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Müşteri Ekleme/Düzenleme Modalı
// ─────────────────────────────────────────────────────────────

interface CustomerModalProps {
  editCustomer: Customer | null;
  onSave: (data: CustomerCreate) => Promise<void>;
  onClose: () => void;
}

const emptyForm = (): CustomerCreate => ({
  name: '', last_name: '', phone: '', address: '', notes: '',
  needed_material: '', product_id: undefined,
  quantity: 1, unit_price: undefined,
  period_days: 30, last_delivery_date: '', next_delivery_date: '',
});

function CustomerModal({ editCustomer, onSave, onClose }: CustomerModalProps) {
  const [form, setForm] = useState<CustomerCreate>(() =>
    editCustomer
      ? {
          name: editCustomer.name,
          last_name: editCustomer.last_name || '',
          phone: formatPhoneNumber(editCustomer.phone || ''),
          address: editCustomer.address || '',
          notes: editCustomer.notes || '',
          needed_material: editCustomer.needed_material || '',
          product_id: editCustomer.product_id,
          quantity: editCustomer.quantity || 1,
          unit_price: editCustomer.unit_price,
          period_days: editCustomer.period_days || 30,
          last_delivery_date: editCustomer.last_delivery_date || '',
          next_delivery_date: editCustomer.next_delivery_date || '',
        }
      : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [searchProductText, setSearchProductText] = useState('');
  const [deliveryItems, setDeliveryItems] = useState<{
    name: string;
    product_id?: string;
    quantity: number;
    unit_price: number;
  }[]>(() => {
    if (editCustomer && editCustomer.needed_material) {
      const mat = editCustomer.needed_material;
      if (mat.startsWith('[') || mat.startsWith('JSON:')) {
        try {
          const raw = mat.startsWith('JSON:') ? mat.substring(5) : mat;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } catch (e) {
          // ignore
        }
      }
      return [{
        name: editCustomer.needed_material,
        product_id: editCustomer.product_id,
        quantity: editCustomer.quantity || 1,
        unit_price: editCustomer.unit_price || 0,
      }];
    }
    return [];
  });

  // Ref dizisi — Enter ile sırayla geçiş
  const r = {
    name:              useRef<HTMLInputElement>(null),
    last_name:         useRef<HTMLInputElement>(null),
    phone:             useRef<HTMLInputElement>(null),
    address:           useRef<HTMLInputElement>(null),
    needed_material:   useRef<HTMLInputElement>(null),
    quantity:          useRef<HTMLInputElement>(null),
    unit_price:        useRef<HTMLInputElement>(null),
    period_days:       useRef<HTMLInputElement>(null),
    last_delivery_date:useRef<HTMLInputElement>(null),
    notes:             useRef<HTMLTextAreaElement>(null),
  };

  const fieldOrder: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>[] = [
    r.name, r.last_name, r.phone, r.address,
    r.needed_material, r.quantity, r.unit_price,
    r.period_days, r.last_delivery_date, r.notes,
  ];

  const handleEnter = (idx: number) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      focusNext(fieldOrder, idx);
    }
  };

  const set = (k: keyof CustomerCreate, v: string | number | undefined) => {
    setSaveError('');
    setForm(f => {
      const updated = { ...f, [k]: v };
      if (k === 'next_delivery_date' && updated.next_delivery_date && updated.period_days) {
        updated.last_delivery_date = calcLastDate(
          updated.next_delivery_date as string,
          updated.period_days as number
        );
      } else if (k === 'period_days' && updated.next_delivery_date && updated.period_days) {
        updated.last_delivery_date = calcLastDate(
          updated.next_delivery_date as string,
          updated.period_days as number
        );
      }
      return updated;
    });
  };

  const handleProductAutocompleteChange = (name: string, productId?: string, price?: number) => {
    setSearchProductText(name);
    if (productId) {
      setDeliveryItems(items => {
        const existing = items.find(x => x.product_id === productId);
        if (existing) {
          return items.map(x => x.product_id === productId ? { ...x, quantity: x.quantity + 1 } : x);
        }
        return [...items, { name, product_id: productId, quantity: 1, unit_price: price || 0 }];
      });
      setSearchProductText('');
    }
  };

  const handleAddManualProduct = () => {
    if (!searchProductText.trim()) return;
    setDeliveryItems(items => {
      const name = searchProductText.trim();
      const existing = items.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        return items.map(x => x.name.toLowerCase() === name.toLowerCase() ? { ...x, quantity: x.quantity + 1 } : x);
      }
      return [...items, { name, quantity: 1, unit_price: 0 }];
    });
    setSearchProductText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setSaveError('Ad alanı zorunludur.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      let needed_material = '';
      let product_id: string | undefined = undefined;
      let quantity = 1;
      let unit_price: number | undefined = undefined;

      if (deliveryItems.length === 1) {
        needed_material = deliveryItems[0].name;
        product_id = deliveryItems[0].product_id;
        quantity = deliveryItems[0].quantity;
        unit_price = deliveryItems[0].unit_price;
      } else if (deliveryItems.length > 1) {
        needed_material = 'JSON:' + JSON.stringify(deliveryItems);
        product_id = undefined;
        quantity = 1;
        unit_price = deliveryItems.reduce((acc, x) => acc + (x.quantity * x.unit_price), 0);
      }

      await onSave({
        ...form,
        needed_material,
        product_id,
        quantity,
        unit_price,
      });
    } catch (err: unknown) {
      console.error('[CustomerModal] Kaydetme hatası:', err);
      const axiosErr = err as { response?: { data?: { detail?: unknown; message?: string } }; message?: string };
      const detail = axiosErr?.response?.data?.detail;
      const fallback = axiosErr?.message || 'Kayıt sırasında bir hata oluştu.';
      const msg = detail
        ? (typeof detail === 'string' ? detail : JSON.stringify(detail))
        : fallback;
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = inputCls; // rounded (dikdörtgen)

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Modal: flex-col + max-h → header her zaman görünür, gövde kaydırılabilir */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: 'calc(100vh - 32px)' }}>

        {/* Header — sabit, kaymaz */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <h3 className="text-slate-900 font-bold text-sm">
                {editCustomer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri Ekle'}
              </h3>
              <p className="text-slate-400 text-xs">Düzenli teslimat takibi</p>
            </div>
          </div>
          {/* X BUTONU — her zaman görünür */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Kaydırılabilir form gövdesi */}
        <div className="overflow-y-auto flex-1">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Hata mesajı */}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-600 text-xs font-medium">{saveError}</p>
            </div>
          )}

          {/* Kişisel Bilgiler */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Kişisel Bilgiler</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 font-semibold mb-1.5 block">Ad *</label>
                <input
                  ref={r.name}
                  type="text" value={form.name}
                  onChange={e => set('name', e.target.value)}
                  onKeyDown={handleEnter(0)}
                  placeholder="Ahmet"
                  required
                  className={fieldCls}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-semibold mb-1.5 block">Soyad</label>
                <input
                  ref={r.last_name}
                  type="text" value={form.last_name || ''}
                  onChange={e => set('last_name', e.target.value)}
                  onKeyDown={handleEnter(1)}
                  placeholder="Yılmaz"
                  className={fieldCls}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-600 font-semibold mb-1.5 block">Telefon</label>
                <input
                  ref={r.phone}
                  type="tel" value={form.phone || ''}
                  onChange={e => set('phone', formatPhoneNumber(e.target.value))}
                  onKeyDown={handleEnter(2)}
                  placeholder="0555 000 00 00"
                  className={fieldCls}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-600 font-semibold mb-1.5 block">Adres</label>
                <input
                  ref={r.address}
                  type="text" value={form.address || ''}
                  onChange={e => set('address', e.target.value)}
                  onKeyDown={handleEnter(3)}
                  placeholder="Mahalle, ilçe, şehir"
                  className={fieldCls}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Düzenli Teslimat Bilgileri</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Ürün Arama ve Listesi */}
              <div className="col-span-2 space-y-3">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <ProductAutocomplete
                      value={searchProductText}
                      onChange={handleProductAutocompleteChange}
                      onEnter={handleAddManualProduct}
                      inputRef={r.needed_material as React.RefObject<HTMLInputElement>}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddManualProduct}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 h-9 transition-colors shrink-0 cursor-pointer"
                  >
                    + Ekle
                  </button>
                </div>

                {deliveryItems.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teslim Edilecek Malzemeler ({deliveryItems.length})</p>
                    
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full">
                      {deliveryItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800/80 border border-slate-150 dark:border-slate-700/60 rounded-lg p-2.5 shadow-sm">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                            {item.product_id && (
                              <span className="text-[9px] bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 px-1 py-0.2 rounded font-semibold mt-0.5 inline-block">Bağlı Ürün</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] font-bold text-slate-455 uppercase tracking-wide leading-none mb-1">Adet</span>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={e => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1);
                                  setDeliveryItems(prev => prev.map((x, i) => i === idx ? { ...x, quantity: val } : x));
                                }}
                                className="w-12 text-center text-xs font-semibold py-1 px-1 border border-slate-250 dark:border-slate-700 rounded bg-white dark:bg-slate-900 outline-none"
                              />
                            </div>
                            
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] font-bold text-slate-455 uppercase tracking-wide leading-none mb-1">Fiyat</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_price}
                                onChange={e => {
                                  const val = Math.max(0, parseFloat(e.target.value) || 0);
                                  setDeliveryItems(prev => prev.map((x, i) => i === idx ? { ...x, unit_price: val } : x));
                                }}
                                className="w-18 text-center text-xs font-semibold py-1 px-1 border border-slate-250 dark:border-slate-700 rounded bg-white dark:bg-slate-900 outline-none"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setDeliveryItems(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 mt-3.5 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 flex items-center justify-between font-bold text-xs">
                      <span className="text-slate-400 uppercase tracking-widest text-[9px]">Toplam Tutar</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ₺{deliveryItems.reduce((acc, x) => acc + (x.quantity * x.unit_price), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-600 font-semibold mb-1.5 block">Kaç Günde Bir?</label>
                <input
                  ref={r.period_days}
                  type="number" min="1" value={form.period_days || 30}
                  onChange={e => set('period_days', parseInt(e.target.value) || 30)}
                  onKeyDown={handleEnter(7)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-semibold mb-1.5 block">Sonraki Teslimat Tarihi</label>
                <input
                  ref={r.last_delivery_date}
                  type="date" value={form.next_delivery_date || ''}
                  onChange={e => set('next_delivery_date', e.target.value)}
                  onKeyDown={handleEnter(8)}
                  className={fieldCls}
                />
              </div>
              {form.last_delivery_date && (
                <div className="col-span-2 bg-emerald-50 border border-emerald-200 rounded px-4 py-2.5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs text-emerald-700 font-semibold">
                    Önceki teslimat: <strong>{formatDate(form.last_delivery_date)}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <label className="text-xs text-slate-600 font-semibold mb-1.5 block">Notlar</label>
            <textarea
              ref={r.notes}
              value={form.notes || ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Özel istekler, dikkat edilmesi gerekenler..."
              rows={2}
              className={`${fieldCls} resize-none`}
            />
          </div>

          <div className="flex gap-2 pt-2 pb-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all">
              İptal
            </button>
            <button type="submit" disabled={saving || !form.name.trim()}
              className="flex-1 py-2.5 rounded bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editCustomer ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>

        </form>
        </div>{/* /overflow-y-auto */}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// Müşteri Kartı
// ─────────────────────────────────────────────────────────────

interface CustomerCardProps {
  customer: Customer;
  onDeliver: (c: Customer) => void;
  onEdit: (c: Customer) => void;
  onDelete: (c: Customer) => void;
  delivering: boolean;
}

function CustomerCard({ customer, onDeliver, onEdit, onDelete, delivering }: CustomerCardProps) {
  const days = calcDaysLeft(customer.next_delivery_date);
  const status = getStatus(days);
  const qty = customer.quantity || 1;
  const unitP = customer.unit_price || 0;
  const total = unitP * qty;
  const todayStr = new Date().toLocaleDateString('en-CA');
  const showDeliverButton = customer.needed_material && days !== null && days <= 3 && customer.last_delivery_date !== todayStr;

  const parsedMaterials = (() => {
    if (customer.needed_material && (customer.needed_material.startsWith('[') || customer.needed_material.startsWith('JSON:'))) {
      try {
        const raw = customer.needed_material.startsWith('JSON:') ? customer.needed_material.substring(5) : customer.needed_material;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return null;
  })();

  return (
    <div className="bg-white rounded-xl border border-slate-400 dark:border-slate-700/80 shadow-sm hover:shadow-md hover:border-slate-500 dark:hover:border-slate-600 transition-all p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <span className="text-slate-700 font-black text-sm">{(customer.name[0] || '?').toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-slate-900 font-bold text-sm truncate leading-tight">
              {customer.name} {customer.last_name || ''}
            </p>
            {customer.phone && (
              <div className="flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-slate-400" />
                <p className="text-slate-500 text-xs">{customer.phone}</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onEdit(customer)} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(customer)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {customer.needed_material && (
        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded p-3 space-y-2">
          {parsedMaterials ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                <Package className="w-3 h-3" />
                <span>Malzeme Listesi</span>
              </div>
              <div className="max-h-[100px] overflow-y-auto pr-1 space-y-1.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-250 [&::-webkit-scrollbar-thumb]:rounded-full">
                {parsedMaterials.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="text-slate-750 dark:text-slate-300 truncate flex-1 mr-2 font-medium">
                      {item.name} <span className="text-[10px] text-slate-400 font-bold">({item.quantity} adet)</span>
                    </span>
                    <span className="text-slate-500 font-bold shrink-0">₺{((item.unit_price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center text-xs font-bold border-t border-slate-250 pt-1.5 mt-1.5">
                <span className="text-slate-455 text-[10px] uppercase tracking-wider">Toplam Tutar</span>
                <span className="text-emerald-605">₺{customer.unit_price?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold pt-1">
                her {customer.period_days || 30} günde bir
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <Package className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-slate-800 text-xs font-semibold truncate">{customer.needed_material}</p>
                <p className="text-slate-400 text-xs">{qty} adet · her {customer.period_days || 30} günde bir</p>
              </div>
              {total > 0 && <span className="text-emerald-605 font-bold text-xs shrink-0">₺{total.toFixed(2)}</span>}
            </div>
          )}
          <div className="flex items-center justify-between text-xs border-t border-slate-200 pt-2">
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3 h-3" />
              <span>Son: {formatDate(customer.last_delivery_date)}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500">
              <ChevronRight className="w-3 h-3" />
              <span>Sonraki: {formatDate(customer.next_delivery_date)}</span>
            </div>
          </div>
        </div>
      )}

      {customer.needed_material && days !== null && (
        <div className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded border text-xs font-semibold',
          status.bgColor, status.borderColor, status.textColor
        )}>
          {status.icon}
          <span>{status.label}</span>
        </div>
      )}

      {customer.address && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{customer.address}</span>
        </div>
      )}

      {showDeliverButton && (
        <button
          onClick={() => onDeliver(customer)}
          disabled={delivering}
          className="w-full py-2.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
          {delivering ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Teslim Edildi ✓
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Boş durum
// ─────────────────────────────────────────────────────────────

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-slate-300">{icon}</div>
      <h3 className="text-slate-700 font-bold text-sm mb-1">{title}</h3>
      <p className="text-slate-400 text-xs max-w-xs leading-relaxed">{desc}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Ana Sayfa
// ─────────────────────────────────────────────────────────────

type Tab = 'customers' | 'staff' | 'suppliers';
type CustomerTab = 'delivery' | 'all';

export function CustomerStaffPage() {
  const [tab, setTab] = useState<Tab>('customers');
  const [customerTab, setCustomerTab] = useState<CustomerTab>('delivery');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [manualPriceFor, setManualPriceFor] = useState<Customer | null>(null);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customersApi.getAll(search || undefined);
      setCustomers(data);
    } catch {
      showToast('Müşteriler yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: CustomerCreate) => {
    // Burada hata yönetimi CustomerModal içinde yapılıyor
    // Bu fonksiyon hata fırlatırsa modal hata gösterecek
    if (editCustomer) {
      await customersApi.update(editCustomer.id, data);
      showToast('Müşteri güncellendi');
    } else {
      await customersApi.create(data);
      showToast('Yeni müşteri eklendi');
    }
    setShowModal(false);
    setEditCustomer(null);
    load();
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`"${c.name} ${c.last_name || ''}" silinsin mi?`)) return;
    try {
      await customersApi.delete(c.id);
      showToast('Müşteri silindi');
      load();
    } catch {
      showToast('Silme işlemi başarısız', 'error');
    }
  };

  const attemptDeliver = useCallback(async (c: Customer, manualPrice?: number) => {
    setDeliveringId(c.id);
    try {
      await customersApi.deliver(
        c.id,
        manualPrice !== undefined ? { manual_price: manualPrice, payment_method: 'CASH' } : {}
      );
      setManualPriceFor(null);
      showToast(`${c.name} ${c.last_name || ''} — Teslimat kaydedildi ✓`);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '';
      if (typeof msg === 'string' && msg.toLowerCase().includes('stok')) {
        setManualPriceFor(c);
      } else {
        showToast('Teslimat işlemi başarısız', 'error');
      }
    } finally {
      setDeliveringId(null);
    }
  }, [load]);

  const handleManualConfirm = (price: number, method: 'CASH' | 'CARD') => {
    if (!manualPriceFor) return;
    const c = manualPriceFor;
    setManualPriceFor(null);
    setDeliveringId(c.id);
    customersApi
      .deliver(c.id, { manual_price: price, payment_method: method })
      .then(() => { showToast(`Teslimat — ₺${price.toFixed(2)} kasaya işlendi ✓`); load(); })
      .catch(() => showToast('Teslimat kaydedilemedi', 'error'))
      .finally(() => setDeliveringId(null));
  };

  const filterAndSort = (list: Customer[]) =>
    list
      .filter(c =>
        !search ||
        `${c.name} ${c.last_name || ''} ${c.phone || ''} ${getFriendlyMaterialName(c.needed_material)}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
      .sort((a, b) => {
        const da = calcDaysLeft(a.next_delivery_date) ?? 9999;
        const db = calcDaysLeft(b.next_delivery_date) ?? 9999;
        return da - db;
      });

  const deliveryCustomers = filterAndSort(customers.filter(c => c.needed_material));
  const allCustomers = filterAndSort(customers);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans antialiased text-slate-800">

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl text-sm font-semibold shadow-lg flex items-center gap-2.5 border',
          toast.type === 'success'
            ? 'bg-white border-emerald-200 text-emerald-700'
            : 'bg-white border-red-200 text-red-600'
        )}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 text-emerald-500" />
            : <XCircle className="w-4 h-4 text-red-500" />}
          {toast.msg}
        </div>
      )}

      {manualPriceFor && (
        <ManualPriceModal
          customer={manualPriceFor}
          onConfirm={handleManualConfirm}
          onClose={() => setManualPriceFor(null)}
        />
      )}

      {showModal && (
        <CustomerModal
          editCustomer={editCustomer}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditCustomer(null); }}
        />
      )}

      {/* HEADER */}
      <header className="sticky top-0 bg-white border-b border-slate-200 shrink-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-slate-900 rounded-lg" />
            <h1 className="text-sm font-bold tracking-tight text-slate-900 uppercase">
              Müşteri &amp; Personel Yönetimi
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 border border-slate-200 rounded-lg p-1 bg-white">
              {([
                ['customers', 'Müşteri Yönetimi', Users],
                ['staff', 'Personel Yönetimi', UserCheck],
              ] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setTab(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide transition-all',
                    tab === id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  )}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>


      {/* PERSONEL */}
      {tab === 'staff' && <PersonnelPage />}

      {/* MÜŞTERİ */}
      {tab === 'customers' && (
        <div className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <button
              onClick={() => { setEditCustomer(null); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider hover:bg-slate-800 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />Yeni Müşteri Ekle
            </button>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  data-barcode-target="true"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="İsim, telefon veya ürün..."
                  className="bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 w-56"
                />
              </div>
              <button onClick={load} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-7 h-7 text-slate-400 animate-spin" />
            </div>
          ) : deliveryCustomers.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-400 dark:border-slate-700/80 shadow-sm">
              <EmptyState icon={<Package className="w-12 h-12" />}
                title="Düzenli teslimat müşterisi yok"
                desc="Yeni Müşteri Ekle butonuna basarak kayıt yapabilirsiniz." />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {deliveryCustomers.map(c => (
                <CustomerCard key={c.id} customer={c}
                  onDeliver={attemptDeliver}
                  onEdit={c => { setEditCustomer(c); setShowModal(true); }}
                  onDelete={handleDelete}
                  delivering={deliveringId === c.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
