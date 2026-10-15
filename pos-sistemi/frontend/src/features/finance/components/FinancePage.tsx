/**
 * Finance Page — Gelir & Gider Dashboard
 */

import { useEffect, useMemo, useState, useRef } from 'react';
import {
  AreaChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Target,
  Plus, ChevronDown, X, Calendar, Loader2, Trash2, Filter, Users,
  Store, Globe, RotateCcw, FileText, Search, Percent, Coins, Printer, Download,
  AlertTriangle, CheckCircle, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  financeApi,
  type NetProfitabilityResponse,
  type CashflowTrendResponse,
  type ExpenseBreakdownResponse,
} from '@/features/finance/services/financeApi';
import { transactionsApi, type CategoryStatistics, type Transaction } from '@/features/transactions/services/transactionsApi';
import { salesApi } from '@/features/sales/services/salesApi';
import { customersApi } from '@/features/sales/services/customersApi';
import { cn } from '@/shared/utils/cn';

// ── FORMAT ──
const fmt = (n: number) =>
  n >= 1_000_000 ? `₺${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `₺${(n / 1_000).toFixed(1)}B`
  : `₺${n.toFixed(0)}`;

const fmtFull = (n: number) =>
  `₺${Math.abs(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatXAxisLabel(key: string): string {
  // If format is YYYY-MM-DD (e.g., 2026-07-11)
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const [year, month, day] = key.split('-');
    const monthsShortTR = [
      'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
      'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${parseInt(day, 10)} ${monthsShortTR[mIdx]}`;
  }

  // If format is YYYY-MM (e.g., 2026-07)
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split('-');
    const monthsTR = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${monthsTR[mIdx]} ${year}`;
  }

  // If format is Wxx or YYYY-Wxx (e.g., W26, 2026-W18)
  const weekMatch = key.match(/^(?:(\d{4})-)?W(\d+)$/i);
  if (weekMatch) {
    const parsedYear = weekMatch[1] ? parseInt(weekMatch[1], 10) : new Date().getFullYear();
    const weekNum = parseInt(weekMatch[2], 10);
    const simple = new Date(parsedYear, 0, 1 + (weekNum - 1) * 7);
    const dayOfWeek = simple.getDay();
    const ISOweekStart = simple;
    if (dayOfWeek <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    const ISOweekEnd = new Date(ISOweekStart);
    ISOweekEnd.setDate(ISOweekStart.getDate() + 6);

    const monthsShortTR = [
      'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
      'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
    ];
    
    const startDay = ISOweekStart.getDate();
    const startMonth = monthsShortTR[ISOweekStart.getMonth()];
    const endDay = ISOweekEnd.getDate();
    const endMonth = monthsShortTR[ISOweekEnd.getMonth()];

    if (startMonth === endMonth) {
      return `${startDay}-${endDay} ${startMonth}`;
    } else {
      return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
    }
  }

  return key;
}

function formatXAxisTooltip(key: string): string {
  // If format is YYYY-MM-DD (e.g., 2026-07-11)
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const [year, month, day] = key.split('-');
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    const daysTR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const monthsTR = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    return `${parseInt(day, 10)} ${monthsTR[d.getMonth()]} ${year}, ${daysTR[d.getDay()]}`;
  }

  // If format is YYYY-MM (e.g., 2026-07)
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split('-');
    const monthsTR = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    return `${monthsTR[parseInt(month, 10) - 1]} ${year}`;
  }

  // If format is Wxx or YYYY-Wxx (e.g., W26, 2026-W18)
  const weekMatch = key.match(/^(?:(\d{4})-)?W(\d+)$/i);
  if (weekMatch) {
    const parsedYear = weekMatch[1] ? parseInt(weekMatch[1], 10) : new Date().getFullYear();
    const weekNum = parseInt(weekMatch[2], 10);
    const simple = new Date(parsedYear, 0, 1 + (weekNum - 1) * 7);
    const dayOfWeek = simple.getDay();
    const ISOweekStart = simple;
    if (dayOfWeek <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    const ISOweekEnd = new Date(ISOweekStart);
    ISOweekEnd.setDate(ISOweekStart.getDate() + 6);

    const monthsTR = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];

    const startDay = ISOweekStart.getDate();
    const startMonth = ISOweekStart.getMonth();
    const endDay = ISOweekEnd.getDate();
    const endMonth = ISOweekEnd.getMonth();
    const startYear = ISOweekStart.getFullYear();

    if (startMonth === endMonth) {
      if (startDay >= 25) {
        return `${monthsTR[startMonth]} Ayının Son Haftası`;
      }
      const weekOfMonth = Math.ceil((startDay + 1) / 7);
      const suffix = ['Birinci', 'İkinci', 'Üçüncü', 'Dördüncü', 'Beşinci'][weekOfMonth - 1] || `${weekOfMonth}.`;
      return `${monthsTR[startMonth]} Ayının ${suffix} Haftası`;
    } else {
      return `${monthsTR[startMonth]} Sonu / ${monthsTR[endMonth]} Başı`;
    }
  }

  return key;
}

function simplifyDescription(desc: string | null): string {
  if (!desc) return '';
  return desc.replace(/#S-([a-zA-Z0-9]+)-([a-zA-Z0-9]+)-([a-zA-Z0-9]+)/g, '#S-$3')
             .replace(/#S-([a-zA-Z0-9]+)-([a-zA-Z0-9]+)/g, '#S-$2');
}

function simplifyOrderCode(id: string | null): string {
  if (!id) return '';
  const parts = id.split('-');
  if (parts.length > 1) {
    return `${parts[0]}-${parts[parts.length - 1]}`;
  }
  return id;
}

// ── KATEGORİ VE TABLO SABİTLERİ ──
const INCOME_CATS  = ['Dışarıdan Nakit Girişi', 'Tahsilat', 'İade Alım', 'Hizmet Bedeli', 'Kira Geliri', 'Bağış / Destek', 'Diğer'];
const EXPENSE_CATS = ['Kira', 'Elektrik', 'Su', 'Telefon', 'İnternet', 'Maaş', 'SGK / Sigorta', 'Kargo', 'Temizlik', 'Tamir / Bakım', 'Vergi / Harç', 'Reklam', 'Malzeme / Sarf', 'Zayiat / Fire / Bozuk Ürün', 'Diğer'];

const PAYMENT_LABELS: Record<string, string> = { CASH: 'Nakit', CARD: 'Kart', TRANSFER: 'Havale', DEBT: 'Veresiye' };
const SOURCE_INFO: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  POS: { label: 'Satış', icon: Store, color: 'text-emerald-600' },
  MANUAL: { label: 'Manuel', icon: FileText, color: 'text-sky-600' },
  ECOMMERCE: { label: 'E-Ticaret', icon: Globe, color: 'text-violet-600' },
  ONLINE: { label: 'Online', icon: Globe, color: 'text-blue-600' },
  INVOICE: { label: 'Fatura', icon: FileText, color: 'text-orange-500' },
  REFUND: { label: 'İade', icon: RotateCcw, color: 'text-rose-600' },
};

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 bg-white focus:border-slate-500 focus:ring-0 outline-none transition-colors";

/** Backend UTC tarihlerini yerel saat dilimine çevirir */
function parseUTC(dateStr: string): Date {
  if (!dateStr) return new Date();
  // Backend 'Z' son eki olmadan UTC kaydediyor, JS bunu yerel saat olarak algılıyor
  const s = dateStr.trim();
  if (s.endsWith('Z') || s.includes('+') || s.includes('T') && s.match(/[+-]\d{2}:\d{2}$/)) {
    return new Date(s);
  }
  // '2026-07-15 23:21:35.536699' → '2026-07-15T23:21:35.536699Z'
  return new Date(s.replace(' ', 'T') + 'Z');
}

// ── DÖNEM SEÇENEKLERİ ──
const PERIOD_OPTIONS = [
  { key: '1d', label: 'Bugün',          days: 1,   trendPeriod: 'daily',   trendPoints: 1  },
  { key: '1w', label: 'Bu Hafta (7 Gün)', days: 7,   trendPeriod: 'daily',   trendPoints: 7  },
  { key: '1m', label: 'Bu Ay (30 Gün)',   days: 30,  trendPeriod: 'daily',   trendPoints: 30 },
  { key: '3m', label: 'Son 3 Ay',          days: 90,  trendPeriod: 'weekly',  trendPoints: 12 },
  { key: '6m', label: 'Son 6 Ay',          days: 180, trendPeriod: 'weekly',  trendPoints: 24 },
  { key: '1y', label: 'Son 1 Yıl',         days: 365, trendPeriod: 'monthly', trendPoints: 12 },
] as const;

type PeriodKey = typeof PERIOD_OPTIONS[number]['key'];

// ── FORM ELEMANI HALE GETİRİCİ ──
function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{label}</label>
      {children}
    </div>
  );
}

// ── PROJEYE UYGUN MODAL ŞABLONU ──
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest leading-none">{title}</h2>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ── GELİR EKLEME DIALOGU ──
function AddIncomeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Dışarıdan Nakit Girişi');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!amount || isNaN(+amount) || +amount <= 0) return setErr('Geçerli bir tutar girin');
    setLoading(true); setErr('');
    try {
      await transactionsApi.addIncome(+amount, category, desc, 'default-user', 'CASH', 'CASH');
      onSaved();
      onClose();
    } catch {
      setErr('Gelir kaydedilemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Manuel Gelir Ekle" onClose={onClose}>
      <div className="space-y-3">
        <FF label="Tutar (₺)">
          <input type="number" className={inputCls} placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        </FF>
        <FF label="Kategori">
          <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
            {INCOME_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </FF>
        <FF label="Açıklama">
          <input type="text" className={inputCls} placeholder="örn. Hizmet bedeli tahsilatı" value={desc} onChange={e => setDesc(e.target.value)} />
        </FF>
        {err && <p className="text-xs text-rose-500 font-bold leading-none">{err}</p>}
        <button onClick={save} disabled={loading} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-md transition-colors shadow-sm">
          {loading ? 'Kaydediliyor…' : '+ Gelir Ekle'}
        </button>
      </div>
    </Modal>
  );
}

// ── GİDER EKLEME DIALOGU ──
function AddExpenseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Diğer');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!amount || isNaN(+amount) || +amount <= 0) return setErr('Geçerli bir tutar girin');
    setLoading(true); setErr('');
    try {
      await transactionsApi.addExpense(+amount, category, desc, 'default-user', 'CASH', 'CASH');
      onSaved();
      onClose();
    } catch {
      setErr('Gider kaydedilemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Manuel Gider Ekle" onClose={onClose}>
      <div className="space-y-3">
        <FF label="Tutar (₺)">
          <input type="number" className={inputCls} placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        </FF>
        <FF label="Kategori">
          <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
            {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </FF>
        <FF label="Açıklama">
          <input type="text" className={inputCls} placeholder="örn. Dükkan kirası" value={desc} onChange={e => setDesc(e.target.value)} />
        </FF>
        {err && <p className="text-xs text-rose-500 font-bold leading-none">{err}</p>}
        <button onClick={save} disabled={loading} className="w-full py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-md transition-colors shadow-sm">
          {loading ? 'Kaydediliyor…' : '− Gider Ekle'}
        </button>
      </div>
    </Modal>
  );
}

// ── İŞLEM EKLE DROPDOWN BUTONU ──
type ModalType = 'income' | 'expense' | null;

function AddDropdown({ onSelect }: { onSelect: (m: ModalType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const items: { key: ModalType; label: string; icon: string; color: string }[] = [
    { key: 'income',   label: 'Gelir Ekle',  icon: '↑', color: 'text-emerald-600 hover:bg-emerald-55' },
    { key: 'expense',  label: 'Gider Ekle',  icon: '↓', color: 'text-rose-500 hover:bg-rose-55' },
  ];

  return (
    <div ref={ref} className="relative z-10">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-lg hover:bg-slate-700 transition-all shadow-sm uppercase tracking-wide"
      >
        <Plus className="w-3.5 h-3.5" />
        İşlem Ekle
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-40 bg-white rounded-xl border border-slate-205 shadow-xl z-30 py-1 overflow-hidden">
          {items.map(item => (
            <button
              key={item.key}
              onClick={() => { onSelect(item.key); setOpen(false); }}
              className={cn('w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs font-bold transition-colors', item.color)}
            >
              <span className="text-sm leading-none w-3 text-center">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KOMPAKT KPI KART (Resmi, Sade, Rozetler Çerçevesiz Sağ Üstte) ──
function KPICard({ label, value, badge, subtext }: {
  label: string; value: string; badge?: string; subtext?: string;
}) {
  return (
    <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">{label}</span>
        {badge && (
          <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap shrink-0">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-1">
        <span className="text-xl font-bold text-slate-900 tracking-tight">
          {value}
        </span>
      </div>
      {subtext && <p className="text-[11px] text-slate-400 mt-0.5">{subtext}</p>}
    </div>
  );
}

// ── KATEGORİ SATIRI (Monokrom, Minimal) ──
function CategoryRow({ name, amount, pct, rank }: {
  name: string; amount: number; pct: number; rank: number;
}) {
  return (
    <div className="flex items-center gap-3 py-2 group">
      <span className="text-[10px] font-bold text-slate-800 tabular-nums w-4 text-right flex-shrink-0">{rank}</span>
      <span className="text-[11px] font-semibold text-slate-700 truncate w-28 flex-shrink-0">{name}</span>
      <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: '#93c5fd' }} />
      </div>
      <span className="text-[11px] font-bold text-slate-700 tabular-nums w-20 text-right flex-shrink-0">{fmtFull(amount)}</span>
      <span className="text-[10px] font-bold text-emerald-500 tabular-nums w-8 text-right flex-shrink-0">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ── TAHSİLAT / ÖDEME MODALİ ──
function CollectionModal({ tx, txType, onClose, onSaved }: {
  tx: Transaction; txType: 'receivable' | 'payable';
  onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState(tx.amount.toFixed(2));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const isReceivable = txType === 'receivable';
  const fullAmount = tx.amount;

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setErr('Geçerli tutar girin');
    if (amt > fullAmount + 0.001) return setErr(`En fazla ${fmtFull(fullAmount)} girebilirsiniz`);
    setLoading(true); setErr('');
    try {
      const desc = `Tahsilat: ${tx.description || tx.category || ''}`.trim();
      const saleOrderId = tx.id ? (tx.reference_id || undefined) : undefined;
      const customerId = tx.id ? undefined : (tx.reference_id || undefined);
      if (isReceivable) {
        await transactionsApi.addIncome(amt, tx.category || 'Tahsilat', desc, 'default-user', 'CASH', 'CASH', customerId, saleOrderId);
      } else {
        await transactionsApi.addExpense(amt, tx.category || 'Ödeme', desc, 'default-user', 'CASH', 'CASH');
      }
      if (tx.id) {
        const remaining = fullAmount - amt;
        if (remaining > 0.01) {
          const remDesc = tx.description || tx.category || '';
          if (isReceivable) {
            await transactionsApi.addIncome(remaining, tx.category || 'Veresiye', remDesc, 'default-user', 'CASH', 'DEBT', undefined, saleOrderId);
          } else {
            await transactionsApi.addExpense(remaining, tx.category || 'Veresiye', remDesc, 'default-user', 'CASH', 'DEBT');
          }
        }
        await transactionsApi.deleteTransaction(tx.id);
      }
      onSaved(); onClose();
    } catch { setErr('Kaydedilemedi'); }
    finally { setLoading(false); }
  };

  const enteredAmt = parseFloat(amount) || 0;
  const remaining = fullAmount - enteredAmt;

  return (
    <Modal title={isReceivable ? 'Tahsilat Kaydet' : 'Borç Ödemesi'} onClose={onClose}>
      <div className="space-y-3">
        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Kayıt Bilgisi</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{tx.category || 'Genel'}</p>
          {tx.description && <p className="text-xs text-slate-500 mt-0.5">{tx.description}</p>}
          <p className="text-[10px] text-slate-400 mt-1">
            {parseUTC(tx.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <FF label={isReceivable ? 'Tahsil Edilen Tutar (₺)' : 'Ödenen Tutar (₺)'}>
          <input
            type="number" className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 bg-white focus:border-slate-500 focus:ring-0 outline-none transition-colors" value={amount} autoFocus
            onChange={e => { setAmount(e.target.value); setErr(''); }}
            max={fullAmount} step="0.01"
          />
        </FF>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-lg">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Toplam Borç</p>
            <p className="text-sm font-bold text-slate-855 dark:text-slate-200 mt-0.5 tabular-nums">{fmtFull(fullAmount)}</p>
          </div>
          <div className={cn('p-2.5 rounded-lg border', remaining > 0.01 ? 'bg-amber-50/50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30' : 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30')}>
            <p className={cn('text-[9px] font-bold uppercase tracking-widest', remaining > 0.01 ? 'text-amber-500' : 'text-emerald-500')}>Kalan</p>
            <p className={cn('text-sm font-bold mt-0.5 tabular-nums', remaining > 0.01 ? 'text-amber-600' : 'text-emerald-600')}>
              {fmtFull(Math.max(remaining, 0))}
            </p>
          </div>
        </div>
        {remaining > 0.01 && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 px-3 py-2 rounded-lg">
            {fmtFull(remaining)} kalan tutar yeni kayıt olarak saklanacak.
          </p>
        )}
        {err && <p className="text-xs text-rose-500 font-semibold">{err}</p>}
        <button onClick={save} disabled={loading}
          className={cn('w-full py-2.5 text-white text-xs font-bold rounded-md transition-colors disabled:opacity-50 cursor-pointer',
            isReceivable ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-violet-600 hover:bg-violet-700')}>
          {loading ? 'Kaydediliyor…' : isReceivable ? '✓ Tahsil Et' : '✓ Ödeme Yap'}
        </button>
      </div>
    </Modal>
  );
}

// ── VADELİ ÖDEME & ALACAK TAKİBİ KARTI (OdemelerVeAlacaklarCard) ──
function OdemelerVeAlacaklarCard({
  receivableTxs,
  receivable,
  receivableCount,
  payableTxs,
  payable,
  payableCount,
  onCollect,
  customersWithDebts = [],
  onPrint,
  onReport,
}: {
  receivableTxs: Transaction[];
  receivable: number;
  receivableCount: number;
  payableTxs: Transaction[];
  payable: number;
  payableCount: number;
  onCollect: (tx: Transaction, type: 'receivable' | 'payable') => void;
  customersWithDebts?: any[];
  onPrint: (order: any, customerName: string) => void;
  onReport: (tx: Transaction, customerName: string) => void;
}) {
  const [showPayables, setShowPayables] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState<any | null>(null);

  const handleDeleteCustomer = (customer: any) => {
    setDeleteConfirmCustomer(customer);
  };

  const confirmDeleteCustomer = async () => {
    if (!deleteConfirmCustomer) return;
    setDeletingCustomerId(deleteConfirmCustomer.id);
    setDeleteConfirmCustomer(null);
    try {
      await customersApi.delete(deleteConfirmCustomer.id);
      window.location.reload();
    } catch (err) {
      alert('Müşteri silinirken hata oluştu.');
      console.error(err);
    } finally {
      setDeletingCustomerId(null);
    }
  };
  const [expandedOrderNo, setExpandedOrderNo] = useState<string | null>(null);
  const [expandedOrderData, setExpandedOrderData] = useState<any | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [selectedCustomerForReport, setSelectedCustomerForReport] = useState<any | null>(null);

  // States for expandable invoices inside customer report modal
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [expandedInvoiceData, setExpandedInvoiceData] = useState<any | null>(null);
  const [expandedInvoiceLoading, setExpandedInvoiceLoading] = useState(false);

  const handleReportIconClick = (c: any) => {
    const txs = receivableTxs.filter(tx => {
      const desc = tx.description || '';
      const orderMatch = desc.match(/(#?S-[^\s]+)/);
      const order = orderMatch ? orderMatch[1] : null;

      let musteri: string | null = null;
      if (order) {
        const rest = desc.split(order)[1] || '';
        const cleaned = rest.replace(/^[\s\-]+/, '').replace(/\s*-\s*Vade:.*$/i, '').trim();
        if (cleaned && cleaned.length < 60 && !cleaned.match(/^[\da-f-]{20,}/i)) musteri = cleaned;
      } else {
        const fallback = desc.replace(/^Veresiye\s*(Satış)?\s*-?\s*/i, '').trim();
        if (fallback && fallback.length < 60) musteri = fallback;
      }

      const nameMatch = `${c.name} ${c.last_name || ''}`.trim().toLowerCase();
      return musteri && (
        musteri.toLowerCase().includes(nameMatch) ||
        nameMatch.includes(musteri.toLowerCase())
      );
    });

    if (txs.length === 0) {
      alert("Bu müşteriye ait aktif veresiye faturası bulunamadı.");
      return;
    }

    const sorted = [...txs].sort((a, b) => b.created_at.localeCompare(a.created_at));
    onReport(sorted[0], `${c.name} ${c.last_name || ''}`);
  };

  const handleInvoiceRowClick = async (tx: Transaction) => {
    const refId = tx.reference_id;
    if (!refId) return;

    if (expandedInvoiceId === refId) {
      setExpandedInvoiceId(null);
      setExpandedInvoiceData(null);
      return;
    }
    setExpandedInvoiceId(refId);
    setExpandedInvoiceData(null);
    setExpandedInvoiceLoading(true);
    try {
      const data = await salesApi.getSaleById(refId);
      setExpandedInvoiceData(data);
    } catch (e) {
      console.error('Fatura detayları yüklenemedi:', e);
    } finally {
      setExpandedInvoiceLoading(false);
    }
  };

  const handleRowClick = async (tx: Transaction) => {
    const refId = tx.reference_id;
    if (!refId) return;

    if (expandedOrderNo === refId) {
      setExpandedOrderNo(null);
      setExpandedOrderData(null);
      return;
    }
    setExpandedOrderNo(refId);
    setExpandedOrderData(null);
    setExpandedLoading(true);
    try {
      const data = await salesApi.getSaleById(refId);
      setExpandedOrderData(data);
    } catch (e) {
      console.error('Sipariş yüklenemedi:', e);
    } finally {
      setExpandedLoading(false);
    }
  };

  const parseVeresiye = (tx: Transaction) => {
    const desc = tx.description || '';
    const orderMatch = desc.match(/(#?S-[^\s]+)/);
    const order = orderMatch ? orderMatch[1] : null;

    const vadeMatch = desc.match(/Vade:\s*([\d-]+)/i);
    const vade = vadeMatch ? vadeMatch[1] : null;

    let musteri: string | null = null;
    if (order) {
      const rest = desc.split(order)[1] || '';
      const cleaned = rest.replace(/^[\s\-]+/, '').replace(/\s*-\s*Vade:.*$/, '').trim();
      if (cleaned && cleaned.length < 60 && !cleaned.match(/^[\da-f-]{20,}/i)) musteri = cleaned;
    } else {
      const fallback = desc.replace(/^Veresiye\s*(Satış)?\s*-?\s*/i, '').trim();
      if (fallback && fallback.length < 60) musteri = fallback;
    }
    return { order, musteri, vade };
  };

  const daysUntil = (vade: string) => {
    return Math.ceil((new Date(vade).getTime() - Date.now()) / 86_400_000);
  };

  const currentTotal = showPayables ? payable : receivable;
  const currentCount = showPayables ? payableCount : receivableCount;

  const filteredCustomers = customersWithDebts.filter(c =>
    `${c.name} ${c.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPayableTxs = payableTxs.filter(tx => {
    const { musteri, order } = parseVeresiye(tx);
    return `${musteri || ''} ${order || ''} ${tx.description || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const matchingCustomerTxs = useMemo(() => {
    if (!selectedCustomerForReport) return [];
    return receivableTxs.filter(tx => {
      const { musteri } = parseVeresiye(tx);
      const nameMatch = `${selectedCustomerForReport.name} ${selectedCustomerForReport.last_name || ''}`.trim().toLowerCase();
      return musteri && (
        musteri.toLowerCase().includes(nameMatch) ||
        nameMatch.includes(musteri.toLowerCase())
      );
    });
  }, [selectedCustomerForReport, receivableTxs]);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Müşteri Alacak &amp; Vade Takibi
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {currentCount} Aktif Hesap
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Müşterilerden tahsilat bekleyen vadeli hesaplar ve veresiye bakiyeleri
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Toplam Alacak</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              {fmtFull(currentTotal)}
            </span>
          </div>

          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Müşteri ara..."
              className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-400"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[300px] divide-y divide-slate-100 dark:divide-slate-800 custom-scrollbar">
        {(
          filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2.5 px-4 text-center">
              <Coins className="w-8 h-8 text-slate-300 dark:text-slate-750" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {searchTerm ? 'Aranan bakiye bulunamadı' : 'Bekleyen alacak bulunmamaktadır'}
              </p>
            </div>
          ) : (
            filteredCustomers
              .slice()
              .sort((a, b) => { const bdiff = b.balance - a.balance; if (bdiff !== 0) return bdiff; return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(); })
              .map(c => {
                const initials = `${c.name[0] || ''}${c.last_name ? c.last_name[0] : ''}`.toUpperCase();
                const dn = c.next_delivery_date ? Math.ceil((new Date(c.next_delivery_date).getTime() - Date.now()) / 86_400_000) : null;
                const vadeColor = dn === null ? 'text-slate-400'
                  : dn < 0 ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/20'
                  : dn <= 3 ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/20'
                  : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20';
                
                const vadeLbl = dn === null ? null
                  : dn < 0 ? `${Math.abs(dn)} gün gecikti`
                  : dn === 0 ? 'Bugün teslim'
                  : `${dn} gün kaldı`;

                return (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/10 to-indigo-600/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-xs font-black shrink-0 border border-indigo-200/20 shadow-sm uppercase">
                      {initials}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-105 truncate">
                          {c.name} {c.last_name || ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-slate-400 font-bold">
                          {c.phone || 'Telefon Kayıtsız'}
                        </span>
                        {vadeLbl && (
                          <>
                            <span className="text-slate-300 dark:text-slate-750">·</span>
                            <span className={cn('text-[8px] font-black uppercase px-1 py-0.2 rounded leading-none', vadeColor)}>
                              {vadeLbl}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-indigo-650 dark:text-indigo-400 tabular-nums">
                        {fmtFull(c.balance)}
                      </span>
                      
                      <button
                        onClick={() => handleReportIconClick(c)}
                        className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-805 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 transition-all cursor-pointer shadow-sm active:scale-95"
                        title="Fatura Detay Raporu (Yazdır)"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteCustomer(c)}
                        disabled={deletingCustomerId === c.id}
                        className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 text-rose-400 hover:text-rose-600 dark:text-rose-500 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                        title="Müşteriyi Listeden Sil"
                      >
                        {deletingCustomerId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => {
                          onCollect({
                            id: '',
                            amount: c.balance,
                            category: 'Tahsilat',
                            description: `Veresiye Tahsilatı: ${c.name} ${c.last_name || ''}`.trim(),
                            created_at: new Date().toISOString(),
                            reference_id: c.id,
                            payment_method: 'DEBT',
                            payment_source: 'CASH',
                          } as any, 'receivable');
                        }}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-755 text-white rounded-lg text-[9px] font-bold transition-all shadow hover:shadow-md cursor-pointer active:scale-95 flex items-center gap-1 uppercase"
                      >
                        Tahsil Et
                      </button>
                    </div>
                  </div>
                );
              })
          )
        )}
      </div>

      {/* Customer Open Invoices List Modal with Inline Product Expander */}
      {selectedCustomerForReport && (
        <Modal
          onClose={() => setSelectedCustomerForReport(null)}
          title={`${selectedCustomerForReport.name} ${selectedCustomerForReport.last_name || ''} — Vadeli Hesap Detay Raporu`}
        >
          <div className="p-4 space-y-4 max-h-[360px] overflow-y-auto custom-scrollbar">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-bold uppercase">Müşteri</span>
                <span className="text-slate-800 dark:text-slate-100 font-extrabold">{selectedCustomerForReport.name} {selectedCustomerForReport.last_name || ''}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-bold uppercase">Toplam Bakiye</span>
                <span className="text-indigo-650 dark:text-indigo-400 font-black">{fmtFull(selectedCustomerForReport.balance)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Açık Veresiye Faturaları (Tıklayıp Detay Görün)</p>
              <div className="divide-y divide-slate-100 dark:divide-slate-850">
                {matchingCustomerTxs.length === 0 ? (
                  <p className="text-xs text-slate-455 italic py-4 text-center">Bu müşteriye ait aktif fatura kaydı bulunamadı.</p>
                ) : (
                  matchingCustomerTxs.map(tx => {
                    const { order, vade } = parseVeresiye(tx);
                    const isExpanded = expandedInvoiceId === tx.reference_id;
                    const dn = vade ? daysUntil(vade) : null;
                    const vadeColor = dn === null ? 'text-slate-400'
                      : dn < 0 ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.2 rounded font-black'
                      : dn === 0 ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.2 rounded font-black'
                      : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.2 rounded font-black';
                    
                    const vadeLbl = dn === null ? null
                      : dn < 0 ? `${Math.abs(dn)} gün gecikti`
                      : dn === 0 ? 'Vade Bugün'
                      : `${dn} gün kaldı`;

                    return (
                      <div key={tx.id} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-2.5 bg-slate-50/30 dark:bg-slate-900/30">
                        {/* Expandable Invoice Row Header */}
                        <div
                          onClick={() => handleInvoiceRowClick(tx)}
                          className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors select-none"
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-850 dark:text-slate-100">
                                {order || 'Veresiye Fişi'}
                              </span>
                              {vadeLbl && (
                                <span className={cn('text-[8px] font-black uppercase leading-none', vadeColor)}>
                                  {vadeLbl}
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold">
                              {parseUTC(tx.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })} · {parseUTC(tx.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="font-black text-indigo-650 dark:text-indigo-400 tabular-nums">{fmtFull(tx.amount)}</span>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm('Bu veresiye işlemini silmek istediğinizden emin misiniz?')) return;
                                try {
                                  await transactionsApi.deleteTransaction(tx.id);
                                  window.location.reload();
                                } catch (err) {
                                  alert('İşlem silinirken hata oluştu.');
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/30 text-rose-500 transition-colors cursor-pointer"
                              title="İşlemi Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform duration-150', isExpanded && 'rotate-180')} />
                          </div>
                        </div>

                        {/* Inline Invoice Items Expander */}
                        {isExpanded && (
                          <div className="px-3.5 pb-3.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                            {expandedInvoiceLoading ? (
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 py-3">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Detaylar yükleniyor...</span>
                              </div>
                            ) : expandedInvoiceData ? (
                              <div className="space-y-3">
                                <div className="flex justify-between items-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 border-b border-slate-100 dark:border-slate-800 pb-1">
                                  <span>Fatura Ürün Listesi</span>
                                  <button
                                    type="button"
                                    onClick={() => onPrint(expandedInvoiceData, `${selectedCustomerForReport.name} ${selectedCustomerForReport.last_name || ''}`)}
                                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <Printer className="w-3.5 h-3.5" /> Fiş Yazdır
                                  </button>
                                </div>
                                <div className="space-y-1.5">
                                  {expandedInvoiceData.items?.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-300">
                                      <span>
                                        {item.product_name || item.product?.name || 'Ürün'}{' '}
                                        <span className="text-[10px] text-slate-400 font-bold">({item.quantity} adet)</span>
                                      </span>
                                      <span className="font-extrabold text-slate-850 dark:text-slate-205">
                                        ₺{(item.subtotal || ((item.unit_price || item.unit_sell_price || 0) * (item.quantity || 1) - (item.discount || 0))).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="pt-2 border-t border-slate-105 dark:border-slate-800 flex justify-end gap-2">
                                  <button
                                    onClick={() => onReport(tx, `${selectedCustomerForReport.name} ${selectedCustomerForReport.last_name || ''}`)}
                                    className="px-2.5 py-1.5 border border-indigo-200 text-indigo-600 hover:bg-indigo-50/50 dark:border-indigo-900/30 dark:text-indigo-400 rounded-lg text-[9px] font-bold transition-all cursor-pointer flex items-center gap-1 uppercase"
                                  >
                                    <FileText className="w-3.5 h-3.5" /> Detay Raporu
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 py-2">Detaylar yüklenemedi.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedCustomerForReport(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Kapat
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modern Silme Onay Modalı */}
      {deleteConfirmCustomer && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" onClick={() => setDeleteConfirmCustomer(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/30 mx-auto">
              <Trash2 className="w-6 h-6 text-rose-500" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Müşteriyi Sil</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                <span className="font-bold text-slate-700 dark:text-slate-200">{deleteConfirmCustomer.name}</span> adlı müşteri ve tüm alacak kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz.
              </p>
            </div>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setDeleteConfirmCustomer(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={confirmDeleteCustomer}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-black text-white bg-rose-500 hover:bg-rose-600 transition-colors shadow-sm cursor-pointer"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TxRow({
  tx,
  onDelete,
  onRefund,
  deletingId,
  onPrint,
  onReport,
}: {
  tx: Transaction;
  onDelete: (id: string) => void;
  onRefund: (id: string) => void;
  deletingId: string | null;
  onPrint?: (order: any, customerName: string) => void;
  onReport?: (tx: Transaction, customerName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [orderData, setOrderData] = useState<any | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  useEffect(() => {
    const refId = tx.reference_id || tx.related_order_id;
    if (expanded && tx.source === 'POS' && refId && !orderData) {
      setLoadingOrder(true);
      salesApi.getSaleById(refId)
        .then(data => setOrderData(data))
        .catch(err => console.error("Error loading sale items in TxRow:", err))
        .finally(() => setLoadingOrder(false));
    }
  }, [expanded, tx.source, tx.reference_id, tx.related_order_id, orderData]);

  const isIncome = tx.type === 'INCOME';
  const srcInfo = SOURCE_INFO[tx.source || ''] || SOURCE_INFO['MANUAL'];
  
  const isRefundable = tx.source === 'POS' && (tx.related_order_id || tx.reference_id) && isIncome && !tx.is_deleted;
  const isManual = tx.source !== 'POS' && !tx.related_order_id && !tx.reference_id;

  const date = parseUTC(tx.created_at);
  const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = `${date.getDate()} ${['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][date.getMonth()]}`;

  const parseDescription = (desc: string) => {
    const orderMatch = desc.match(/(#?S-[^\s]+)/);
    const order = orderMatch ? orderMatch[1] : null;

    const vadeMatch = desc.match(/Vade:\s*([\d\.]+)/i) || desc.match(/Vade:\s*([\d\-]+)/i);
    const vade = vadeMatch ? vadeMatch[1] : null;

    let customer = '';
    if (order) {
      const parts = desc.split(order);
      const rest = parts[1] || '';
      customer = rest.replace(/^[\s\-]+/, '').replace(/\s*-\s*Vade:.*$/i, '').trim();
    } else {
      customer = desc.replace(/^(Veresiye|Satış)\s*-?\s*/i, '').trim();
    }
    return { order, customer, vade };
  };

  const { order, customer, vade } = parseDescription(tx.description || '');

  const getPaymentMethodBadge = (method: string) => {
    switch (method) {
      case 'CASH':
        return <span className="text-[9px] font-extrabold uppercase text-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-100/20">Nakit</span>;
      case 'CARD':
        return <span className="text-[9px] font-extrabold uppercase text-blue-600 bg-blue-50/60 dark:bg-blue-950/20 px-2 py-0.5 rounded border border-blue-100/20">Kart</span>;
      case 'TRANSFER':
        return <span className="text-[9px] font-extrabold uppercase text-violet-600 bg-violet-50/60 dark:bg-violet-950/20 px-2 py-0.5 rounded border border-violet-100/20">Havale</span>;
      case 'DEBT':
        return <span className="text-[9px] font-extrabold uppercase text-amber-600 bg-amber-50/60 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-100/20">Veresiye</span>;
      default:
        return null;
    }
  };

  return (
    <div className={cn(
      'transition-all duration-300 border overflow-hidden rounded-2xl', 
      expanded 
        ? 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 shadow-sm' 
        : 'bg-white dark:bg-slate-950 border-slate-200/80 dark:border-slate-850 hover:bg-slate-50/30'
    )}>
      <div className="flex items-center justify-between py-3 px-4 cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm transition-transform duration-300 group-hover:scale-105',
            isIncome 
              ? 'bg-emerald-50/40 dark:bg-emerald-950/10 text-emerald-600 border-emerald-100/20' 
              : 'bg-rose-50/40 dark:bg-rose-950/10 text-rose-500 border-rose-100/20'
          )}>
            {isIncome ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-slate-900 dark:text-slate-50">
                {tx.category || 'İşlem'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-slate-800 dark:text-slate-200 font-bold flex-wrap">
              <span className="tabular-nums font-extrabold">{dateStr} · {timeStr}</span>
              {tx.source && (
                <>
                  <span className="text-slate-400 dark:text-slate-600">·</span>
                  <span className="uppercase tracking-wider text-[8px] font-black">{srcInfo?.label || tx.source}</span>
                </>
              )}
              {vade && (
                <>
                  <span className="text-slate-400 dark:text-slate-600">·</span>
                  <span className="text-rose-600 font-extrabold bg-rose-50 dark:bg-rose-950/20 px-1 py-0.2 rounded">Vade: {new Date(vade).toLocaleDateString('tr-TR')}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 ml-2">
          <span className={cn('text-xs font-black tabular-nums tracking-tight min-w-[70px] text-right', isIncome ? 'text-emerald-600' : 'text-rose-500')}>
            {isIncome ? '+' : '-'}{fmtFull(tx.amount)}
          </span>
          <ChevronDown className={cn('w-3.5 h-3.5 text-slate-500 transition-transform duration-200', expanded && 'rotate-180')} />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-3 bg-slate-100/50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-800 space-y-4">

          {loadingOrder ? (
            <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-350 font-bold py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
              <span>Ürün detayları yükleniyor...</span>
            </div>
          ) : orderData?.items ? (
            <div className="space-y-2">
              <span className="text-[9px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block">Satılan Ürünler</span>
              <div className="flex flex-wrap gap-1.5">
                {orderData.items.map((item: any, i: number) => (
                  <span key={i} className="px-2.5 py-1 bg-white dark:bg-slate-800 text-[10px] text-slate-900 dark:text-slate-100 font-bold rounded-lg shadow-sm border border-slate-200/80 dark:border-slate-700">
                    {item.product_name || 'Ürün'} <span className="text-slate-500 dark:text-slate-400 font-extrabold">({item.quantity} Adet)</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="text-[10px] text-slate-900 dark:text-slate-100 font-bold border-t border-slate-200 dark:border-slate-800 pt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            <div>Kategori: <strong className="text-slate-950 dark:text-slate-50">{tx.category || 'Diğer'}</strong></div>
            <div>·</div>
            <div>Kasa: <strong className="text-slate-950 dark:text-slate-50 uppercase">{tx.payment_source || 'Kasa'}</strong></div>
            <div>·</div>
            <div>Kaynak: <strong className="text-slate-950 dark:text-slate-50">{srcInfo?.label || tx.source || 'Manuel'}</strong></div>
            <div>·</div>
            <div>Kullanıcı: <strong className="text-slate-950 dark:text-slate-50">Yönetici</strong></div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200 dark:border-slate-800 pt-3">
            {isRefundable && (
              <button
                onClick={e => { e.stopPropagation(); onRefund(tx.id); }}
                disabled={deletingId === tx.id}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black border border-rose-250 text-rose-600 bg-rose-50/20 hover:bg-rose-50 dark:bg-rose-955/20 dark:border-rose-900/30 dark:text-rose-450 hover:dark:bg-rose-950/30 disabled:opacity-50 transition-all shadow-sm cursor-pointer active:scale-95"
              >
                {deletingId === tx.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Satışı İptal Et / İade Al
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); onDelete(tx.id); }}
              disabled={deletingId === tx.id}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black border border-rose-250 text-rose-600 bg-rose-50/20 hover:bg-rose-50 dark:bg-rose-955/20 dark:border-rose-900/30 dark:text-rose-450 hover:dark:bg-rose-950/30 disabled:opacity-50 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              {deletingId === tx.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              İşlemi Sil
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FinancePage() {
  // Global dönem filtresi — localStorage ile kalıcı
  const [globalPeriod, _setGlobalPeriod] = useState<PeriodKey>(() => {
    const saved = localStorage.getItem('finance-period-key');
    const valid = PERIOD_OPTIONS.find(o => o.key === saved);
    return valid ? saved as PeriodKey : '1m';
  });
  const setGlobalPeriod = (key: PeriodKey) => {
    localStorage.setItem('finance-period-key', key);
    _setGlobalPeriod(key);
  };

  const [breakdownType, setBreakdownType] = useState<'income' | 'expense'>('income');

  // Son işlemler için yerel filtreler ve sayfalama
  const [txTab, setTxTab] = useState<'all' | 'income' | 'expense' | 'pos'>('all');
  const [txSearch, setTxSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Bağımsız veri stateleri
  const [profitability, setProfitability] = useState<NetProfitabilityResponse | null>(null);
  const [cashflowTrend, setCashflowTrend] = useState<CashflowTrendResponse | null>(null);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdownResponse | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStatistics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customersWithDebts, setCustomersWithDebts] = useState<any[]>([]);
  const [debtsLoading, setDebtsLoading] = useState(false);

  const [selectedReportOrder, setSelectedReportOrder] = useState<any | null>(null);
  const [reportCustomerName, setReportCustomerName] = useState<string>('');
  const [reportModalLoading, setReportModalLoading] = useState(false);

  const handleReportClick = async (tx: Transaction, customerName: string) => {
    const desc = tx.description || '';
    const orderMatch = desc.match(/Satış\s+(S-\d+)/i);
    const orderNo = orderMatch ? orderMatch[1] : null;
    const refId = tx.reference_id;
    if (!refId) return;

    setSelectedReportOrder({ order_number: orderNo || '---' });
    setReportCustomerName(customerName);
    setReportModalLoading(true);
    try {
      const data = await salesApi.getSaleById(refId);
      setSelectedReportOrder(data);
    } catch (e) {
      console.error('Sipariş yüklenemedi:', e);
      setSelectedReportOrder(null);
    } finally {
      setReportModalLoading(false);
    }
  };

  const handlePrintInvoice = (order: any, customerName: string) => {
    const printWin = window.open('', '_blank', 'width=850,height=950,toolbar=no,menubar=no');
    if (!printWin) return;

    const rawTotal = order.total_amount || 0;
    const discAmt = order.discount_amount || 0;
    const finalAmount = (order.final_amount !== undefined && order.final_amount !== null && order.final_amount > 0.01) ? order.final_amount : (rawTotal - discAmt);
    const isPaid = order.payment_method !== 'DEBT';
    const paymentLabel = order.payment_method === 'DEBT' ? 'Veresiye (Cari Hesap)' : order.payment_method === 'CASH' ? 'Nakit' : order.payment_method === 'CARD' ? 'Kredi Kartı' : 'Havale/EFT';

    const itemsHtml = (order.items || []).map((item: any, idx: number) => {
      const unit = item.unit_price || item.unit_sell_price || 0;
      const qty = item.quantity || 1;
      const disc = item.discount || 0;
      const line = item.subtotal || ((unit * qty) - disc);
      return `<tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 14px; font-size: 12px; color: #475569;">${idx + 1}</td>
        <td style="padding: 12px 14px; font-size: 12px; color: #1e293b; font-weight: 600;">${item.product_name || 'Ürün'}</td>
        <td style="padding: 12px 14px; font-size: 12px; text-align: center; color: #475569;">${qty} Adet</td>
        <td style="padding: 12px 14px; font-size: 12px; text-align: right; color: #475569;">₺${unit.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td style="padding: 12px 14px; font-size: 12px; text-align: right; color: #ef4444;">${disc > 0 ? `-₺${disc.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}` : '—'}</td>
        <td style="padding: 12px 14px; font-size: 12px; text-align: right; color: #0f172a; font-weight: 700;">₺${line.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
      </tr>`;
    }).join('');

    printWin.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <title>Fatura — ${order.order_number || 'N/A'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; padding: 40px; font-size: 13px; line-height: 1.5; }
    
    .invoice-container { max-width: 800px; margin: 0 auto; }
    
    /* Üst Başlık ve Logo Alanı */
    .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #0f172a; margin-bottom: 30px; }
    .company-title { font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; text-transform: uppercase; }
    .company-subtitle { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    
    .invoice-title-badge { text-align: right; }
    .invoice-title-badge h1 { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; margin-bottom: 4px; }
    .invoice-no { font-family: monospace; font-size: 13px; font-weight: 700; color: #475569; }

    /* Resmi Fatura Meta Grid */
    .meta-section { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 40px; margin-bottom: 32px; }
    .meta-block { display: flex; flex-direction: column; gap: 8px; }
    .meta-block h3 { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    
    .info-row { display: flex; margin-bottom: 6px; font-size: 12.5px; }
    .info-label { width: 120px; color: #64748b; font-weight: 600; }
    .info-value { color: #0f172a; font-weight: 700; }
    
    .status-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .status-paid { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .status-unpaid { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }

    /* Ürün Tablosu */
    .table-title { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead tr { background: #0f172a; }
    thead th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.5px; }
    thead th:not(:nth-child(2)):not(:first-child) { text-align: right; }
    thead th:nth-child(3) { text-align: center; }

    /* Toplam Hesap Alanı */
    .summary-section { display: flex; justify-content: flex-end; margin-bottom: 40px; }
    .summary-box { width: 300px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #475569; }
    .summary-row.total { border-top: 1px dashed #cbd5e1; margin-top: 8px; padding-top: 12px; font-size: 16px; font-weight: 900; color: #0f172a; }
    
    /* Footer */
    .invoice-footer { border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 10.5px; color: #94a3b8; margin-top: 60px; }
    .footer-stamp { margin-bottom: 8px; font-weight: 600; color: #64748b; }
    
    @media print {
      body { padding: 20px; }
      .summary-box { background: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="invoice-header">
      <div>
        <div class="company-title">ATLI MEDİKAL</div>
        <div class="company-subtitle">Tıbbi Cihaz ve Malzemeleri</div>
      </div>
      <div class="invoice-title-badge">
        <h1>RESMİ SATIŞ FATURASI</h1>
        <div class="invoice-no">No: #${order.order_number || 'N/A'}</div>
      </div>
    </div>

    <div class="meta-section">
      <div class="meta-block">
        <h3>Müşteri Bilgileri</h3>
        <div class="info-row">
          <span class="info-label">Müşteri Adı:</span>
          <span class="info-value">${customerName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">İşlem Tarihi:</span>
          <span class="info-value">${parseUTC(order.created_at || new Date().toISOString()).toLocaleDateString('tr-TR', {day:'2-digit',month:'long',year:'numeric'})}</span>
        </div>
      </div>
      
      <div class="meta-block">
        <h3>Fatura ve Ödeme Detayları</h3>
        <div class="info-row">
          <span class="info-label">Ödeme Yöntemi:</span>
          <span class="info-value">${paymentLabel}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Ödeme Durumu:</span>
          <span class="info-value">
            <span class="status-badge ${isPaid ? 'status-paid' : 'status-unpaid'}">
              ${isPaid ? 'ÖDENDİ' : 'AÇIK HESAP / BORÇ'}
            </span>
          </span>
        </div>
      </div>
    </div>

    <div>
      <div class="table-title">Satılan Ürünler Listesi</div>
      <table>
        <thead>
          <tr>
            <th style="width: 8%;">Sıra</th>
            <th style="width: 45%;">Ürün Açıklaması</th>
            <th style="width: 15%; text-align: center;">Miktar</th>
            <th style="width: 16%;">Birim Fiyat</th>
            <th style="width: 16%;">İndirim</th>
            <th style="width: 20%; text-align: right;">Toplam</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    </div>

    <div class="summary-section">
      <div class="summary-box">
        ${discAmt > 0 ? `<div class="summary-row"><span>Ara Toplam</span><span>₺${rawTotal.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>` : ''}
        ${discAmt > 0 ? `<div class="summary-row"><span>Toplam İndirim</span><span style="color:#ef4444;">-₺${discAmt.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>` : ''}
        <div class="summary-row total"><span>GENEL TOPLAM</span><span>₺${finalAmount.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
      </div>
    </div>

    <div class="invoice-footer">
      <div class="footer-stamp">Atlı Medikal Tıbbi Cihaz ve Malzemeleri</div>
      <div>Bu belge Atlı Medikal Satış Sistemi üzerinden otomatik olarak oluşturulmuştur.</div>
      <div style="margin-top: 4px;">Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}</div>
    </div>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
    printWin.document.close();
  };

  // Bağımsız yüklenme stateleri
  const [kpiLoading, setKpiLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [breakdownLoading, setBreakdownLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Quick Refund State (Milestone 1)
  const [refundConfirmTx, setRefundConfirmTx] = useState<Transaction | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Modallar ve Dropdown durumları
  const [modal, setModal] = useState<ModalType>(null);
  const [globalDropdownOpen, setGlobalDropdownOpen] = useState(false);
  const [txTabDropdownOpen, setTxTabDropdownOpen] = useState(false);

  // Dropdown referansı
  const globalDropdownRef = useRef<HTMLDivElement>(null);
  const txTabDropdownRef = useRef<HTMLDivElement>(null);

  const globalOption = useMemo(() => PERIOD_OPTIONS.find(o => o.key === globalPeriod) || PERIOD_OPTIONS[1], [globalPeriod]);

  const [collectionTx, setCollectionTx] = useState<Transaction | null>(null);
  const [collectionType, setCollectionType] = useState<'receivable' | 'payable'>('receivable');

  const debtStats = useMemo(() => {
    const isVeresiye = (t: Transaction) =>
      !t.is_deleted && t.type === 'INCOME' &&
      (t.payment_method === 'DEBT' || t.category === 'Veresiye Satış');
    const receivableTxs = transactions.filter(isVeresiye);
    const payableTxs = transactions.filter(t => t.payment_method === 'DEBT' && t.type === 'EXPENSE' && !t.is_deleted);
    return {
      receivable: customersWithDebts.reduce((sum, c) => sum + (c.balance || 0), 0),
      receivableCount: customersWithDebts.length,
      receivableTxs,
      payable: payableTxs.reduce((s,t) => s + t.amount, 0),
      payableCount: payableTxs.length,
      payableTxs,
    };
  }, [transactions, customersWithDebts]);

  // Tıklama algılayıcıları (Açılır kutuları kapatmak için)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (globalDropdownRef.current && !globalDropdownRef.current.contains(target)) setGlobalDropdownOpen(false);
      if (txTabDropdownRef.current && !txTabDropdownRef.current.contains(target)) setTxTabDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 1. KPI Verilerini Yükle
  const loadKPIs = async () => {
    setKpiLoading(true);
    try {
      const prof = await financeApi.getNetProfitability(globalOption.days);
      setProfitability(prof);
    } catch (e) {
      console.error('[FinancePage - KPIs]', e);
    } finally {
      setKpiLoading(false);
    }
  };

  // 2. Trend Grafik Verilerini Yükle
  const loadTrend = async () => {
    setTrendLoading(true);
    try {
      const trend = await financeApi.getCashflowTrend(globalOption.trendPeriod as any, globalOption.trendPoints);
      setCashflowTrend(trend);
    } catch (e) {
      console.error('[FinancePage - Trend]', e);
    } finally {
      setTrendLoading(false);
    }
  };

  // 3. Kategori Dağılım Verilerini Yükle
  const loadBreakdown = async () => {
    setBreakdownLoading(true);
    try {
      if (breakdownType === 'income') {
        const stats = await transactionsApi.getCategoryStatistics(globalOption.days);
        setCategoryStats(stats);
      } else {
        const exp = await financeApi.getExpenseBreakdown(globalOption.days);
        setExpenseBreakdown(exp);
      }
    } catch (e) {
      console.error('[FinancePage - Breakdown]', e);
    } finally {
      setBreakdownLoading(false);
    }
  };

  // 4. Tüm İşlemleri Yükle
  const loadCustomerDebts = async () => {
    setDebtsLoading(true);
    try {
      const debts = await customersApi.getDebts();
      setCustomersWithDebts(debts);
    } catch (e) {
      console.error('[FinancePage - Customer Debts]', e);
    } finally {
      setDebtsLoading(false);
    }
  };

  const loadTransactions = async () => {
    setRecentLoading(true);
    try {
      const txs = await transactionsApi.getTransactions();
      setTransactions(txs);
    } catch (e) {
      console.error('[FinancePage - Transactions]', e);
    } finally {
      setRecentLoading(false);
    }
  };

  // Tetikleyiciler
  useEffect(() => {
    loadKPIs();
    loadTrend();
    loadBreakdown();
  }, [globalPeriod, breakdownType]);

  useEffect(() => {
    loadTransactions();
    loadCustomerDebts();
  }, []);

  // Herhangi bir işlem kaydedildiğinde tüm panelleri yenileyen toplu load
  const loadAll = () => {
    loadKPIs();
    loadTrend();
    loadBreakdown();
    loadTransactions();
    loadCustomerDebts();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await transactionsApi.deleteTransaction(id);
      loadAll();
    } catch (e) {
      console.error('[FinancePage - Delete]', e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleRefund = async (id: string) => {
    setRefundingId(id);
    try {
      const res = await transactionsApi.refundSaleTransaction(id);
      showToast(
        `Satış başarıyla iade edildi. (${res?.restocked_items || 0} kalem ürün stoğa geri alındı)`,
        'success'
      );
      setRefundConfirmTx(null);
      await loadAll();
    } catch (e: any) {
      console.error('[FinancePage - Refund Error]', e);
      const errorMsg = e.response?.data?.detail || e.message || 'Satış iade işlemi sırasında bir hata oluştu.';
      showToast(errorMsg, 'error');
    } finally {
      setRefundingId(null);
    }
  };

  const kpiData = useMemo(() => {
    if (!profitability) return null;
    return {
      // Toplam Gelir = tüm gelir kalemleri
      revenue:     profitability.revenue,
      expense:     profitability.operational_expenses,
      // Net Kar / Zarar = tüm maliyetler düşüldükten sonraki net kar
      netProfit:   profitability.net_profit,
      grossProfit: profitability.gross_profit,
      posProfit:   profitability.pos_profit,
      margin:      profitability.net_margin_percent,
    };
  }, [profitability]);

  const trendData = useMemo(() => {
    if (!cashflowTrend?.points) return [];
    return cashflowTrend.points.map(p => ({
      name:   formatXAxisLabel(p.key),
      rawKey: p.key,
      gelir:  p.revenue,
      gider:  p.expenses,
      kar:    p.profit,
    }));
  }, [cashflowTrend]);

  // Gelir Kategorileri Dağılımı
  const incomeCategories = useMemo(() => {
    if (!categoryStats?.incomes) return [];
    const total = categoryStats.incomes.reduce((sum, c) => sum + c.amount, 0);
    return categoryStats.incomes
      .sort((a, b) => b.amount - a.amount)
      .map((c) => ({
        name: c.category || 'Diğer',
        amount: c.amount,
        pct: total > 0 ? (c.amount / total) * 100 : 0,
      }));
  }, [categoryStats]);

  const totalIncomeBreakdown = useMemo(() =>
    incomeCategories.reduce((s, c) => s + c.amount, 0),
  [incomeCategories]);

  // Gider Kategorileri Dağılımı (Opex)
  const expenseCategories = useMemo(() => {
    if (!expenseBreakdown?.categories) return [];
    return expenseBreakdown.categories
      .sort((a, b) => b.amount - a.amount)
      .map((c) => ({
        name:   c.category,
        amount: c.amount,
        pct:    c.percentage_of_total_expenses,
      }));
  }, [expenseBreakdown]);

  const totalExpenseBreakdown = useMemo(() =>
    expenseCategories.reduce((s, c) => s + c.amount, 0),
  [expenseCategories]);

  // Filtrelenmiş İşlem Defteri (globalPeriod ve arama/sekme kriterlerine göre)
  const filteredTransactions = useMemo(() => {
    const limitDays = globalOption.days;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - limitDays);
    
    let list = transactions.filter(t => parseUTC(t.created_at) >= cutoff && !t.is_deleted);
    
    // Filtrele: Gelir / Gider / POS
    if (txTab === 'income') {
      list = list.filter(t => t.type === 'INCOME');
    } else if (txTab === 'expense') {
      list = list.filter(t => t.type === 'EXPENSE');
    } else if (txTab === 'pos') {
      list = list.filter(t => t.source === 'POS');
    }
    
    // Arama filtreleme
    if (txSearch.trim()) {
      const q = txSearch.toLowerCase();
      list = list.filter(t => 
        (t.category || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        t.amount.toString().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [transactions, globalOption.days, txTab, txSearch]);

  const ledgerStats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    filteredTransactions.forEach(t => {
      if (t.is_deleted) return;
      if (t.type === 'INCOME') inflow += t.amount;
      else outflow += t.amount;
    });
    return { inflow, outflow, net: inflow - outflow };
  }, [filteredTransactions]);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));

  const handleExportExcel = () => {
    const data = filteredTransactions.map(t => {
      const d = parseUTC(t.created_at);
      return {
        'Tarih': d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        'Tür': t.type === 'INCOME' ? 'Gelir' : 'Gider',
        'Kaynak': t.source || 'MANUAL',
        'Kategori': t.category || '-',
        'Açıklama': t.description || '-',
        'Ödeme Yöntemi': t.payment_source || 'CASH',
        'Tutar (TL)': t.amount,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kasa Hareketleri');
    XLSX.writeFile(wb, `kasa_finans_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-5 space-y-4">
      {/* 1. ÜST EYLEM VE ZAMAN FİLTRESİ ŞERİDİ */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AddDropdown onSelect={setModal} />
        </div>

        <div className="flex items-center gap-2">
          {/* Global Dönem Dropdown Filtresi */}
          <div ref={globalDropdownOpen ? globalDropdownRef : null} className="relative z-20">
            <button
              onClick={() => setGlobalDropdownOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 transition shadow-xs"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{globalOption.label}</span>
              <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', globalDropdownOpen && 'rotate-180')} />
            </button>
            {globalDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl border border-slate-200 shadow-xl z-30 py-1 overflow-hidden">
                {PERIOD_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    onClick={() => { setGlobalPeriod(o.key); setGlobalDropdownOpen(false); setCurrentPage(1); }}
                    className={cn('w-full px-4 py-2 text-left text-xs font-medium transition-colors hover:bg-slate-50',
                      globalPeriod === o.key ? 'text-slate-900 bg-slate-100 font-semibold' : 'text-slate-600')}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Dışa Aktar</span>
          </button>
        </div>
      </div>

      {/* 2. KOMPAKT KPI KARTLARI (Faturalar & Tedarikçiler Standardı) */}
      <div className="relative">
        {kpiLoading && (
          <div className="absolute inset-0 bg-slate-50/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        )}
        <div className="grid grid-cols-4 gap-4">
          <KPICard
            label="Toplam Ciro (Hasılat)"
            value={kpiData ? fmtFull(kpiData.revenue) : '₺0,00'}
            badge={`${transactions.filter(t => t.type === 'INCOME').length} tahsilat`}
            subtext="dönemsel toplam tahsilat ve ciro"
          />
          <KPICard
            label="Operasyonel Gider"
            value={kpiData ? fmtFull(kpiData.expense) : '₺0,00'}
            badge={`${transactions.filter(t => t.type === 'EXPENSE').length} harcama`}
            subtext="işletme ve mal tedarik harcaması"
          />
          <KPICard
            label="Net Kâr / Zarar"
            value={kpiData ? ((kpiData.netProfit ?? 0) >= 0 ? '+' : '-') + fmtFull(Math.abs(kpiData.netProfit ?? 0)) : '₺0,00'}
            badge={`%${kpiData?.margin?.toFixed(1) || '0.0'} net marj`}
            subtext="tüm maliyetler sonrası net kâr"
          />
          <KPICard
            label="Nakit & Likidite"
            value={fmtFull(ledgerStats.net)}
            badge={`${debtStats.receivableCount} alacak`}
            subtext="eldeki net kasa pozisyonu"
          />
        </div>
      </div>

      {/* 3. CİRO & NET KÂR TRENDİ GRAFİĞİ */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 relative">
        {trendLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        )}
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Ciro & Net Kâr Trendi</h3>
            <p className="text-[11px] text-slate-400">Dönemsel hasılat ve net kâr dağılım analizi</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Toplam Ciro</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span>Net Kâr</span>
            </div>
          </div>
        </div>

        {trendData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-slate-400 text-xs">Bu dönemde veri bulunamadı.</div>
        ) : (
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={trendData} margin={{ left: 0, right: 10, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="fGelir" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fKar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis
                width={72}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `₺${Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
              />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11 }}
                labelFormatter={(label) => {
                  const point = cashflowTrend?.points.find(p => formatXAxisLabel(p.key) === label);
                  return <span style={{fontWeight:700,color:'#0f172a'}}>{point ? formatXAxisTooltip(point.key) : label}</span>;
                }}
                formatter={(v: any, name: any) => {
                  const labels: Record<string,string> = { gelir: 'Toplam Ciro', kar: 'Net Kâr' };
                  const colors: Record<string,string> = { gelir: '#10b981', kar: '#6366f1' };
                  return [
                    <span style={{color: colors[name] || '#000', fontWeight:700}}>₺{Number(v).toLocaleString('tr-TR')}</span>,
                    labels[name] || name
                  ];
                }}
              />
              <Area type="monotone" dataKey="gelir" stroke="#10b981" strokeWidth={2} fill="url(#fGelir)" dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
              <Area type="monotone" dataKey="kar" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 2" fill="url(#fKar)" dot={false} activeDot={{ r: 4, fill: '#6366f1' }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 4. ANA İŞLEM DEFTERİ (Excel Tarzı Çizgili Izgara Grid - Faturalar & Tedarikçiler Standardı) */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          {/* Sol Sekmeler */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200/60">
            {[
              { id: 'all', label: 'Tümü', count: transactions.length },
              { id: 'income', label: 'Gelirler', count: transactions.filter(t => t.type === 'INCOME').length },
              { id: 'expense', label: 'Giderler', count: transactions.filter(t => t.type === 'EXPENSE').length },
              { id: 'pos', label: 'POS Satış', count: transactions.filter(t => t.source === 'POS').length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setTxTab(tab.id as any); setCurrentPage(1); }}
                className={`px-3 py-1 text-xs rounded-md transition flex items-center gap-1.5 ${
                  txTab === tab.id
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[11px] text-slate-400">{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Sağ Araçlar */}
          <div className="flex items-center gap-2">
            <div className="relative w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="İşlem veya kategori ara..."
                value={txSearch}
                onChange={e => { setTxSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-400"
              />
              {txSearch && (
                <button onClick={() => setTxSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* VERİ TABLOSU (Excel Tarzı Çizgili Izgara Grid) */}
        <div className="overflow-x-auto min-h-[260px]">
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100/85 text-[10px] font-bold text-slate-600 uppercase tracking-wider divide-x divide-slate-200 border-b border-slate-300">
                <th className="py-2 px-3 font-bold text-center w-36">TARİH &amp; SAAT</th>
                <th className="py-2 px-3 font-bold text-center w-28">TÜR</th>
                <th className="py-2 px-3 font-bold text-left">KATEGORİ &amp; AÇIKLAMA</th>
                <th className="py-2 px-3 font-bold text-center w-32">KASA / HESAP</th>
                <th className="py-2 px-3 font-bold text-right w-36">TUTAR</th>
                <th className="py-2 px-3 font-bold text-center w-28">BELGE / NO</th>
                <th className="py-2 px-3 font-bold text-center w-24">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {recentLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">İşlemler yükleniyor...</td>
                </tr>
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">Kayıtlı işlem bulunamadı.</td>
                </tr>
              ) : (
                paginatedTransactions.map((tx, idx) => {
                  const isIncome = tx.type === 'INCOME';
                  const date = parseUTC(tx.created_at);
                  const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                  const dateStr = date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
                  const orderMatch = (tx.description || '').match(/(#?S-[^\s]+)/);
                  const orderNo = orderMatch ? orderMatch[1] : null;

                  return (
                    <tr
                      key={tx.id}
                      className={`divide-x divide-slate-200 hover:bg-sky-50/60 transition-colors group ${
                        idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                      }`}
                    >
                      <td className="py-2 px-3 text-center text-slate-600 font-medium whitespace-nowrap">
                        <div>{dateStr}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{timeStr}</div>
                      </td>

                      <td className="py-2 px-3 text-center">
                        {isIncome ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Gelir</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span>Gider</span>
                          </span>
                        )}
                      </td>

                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900 text-xs">
                          {tx.category || (isIncome ? 'Genel Gelir' : 'Genel Gider')}
                        </div>
                        {tx.description && (
                          <div className="text-[11px] text-slate-500 truncate max-w-md">
                            {tx.description}
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {tx.payment_source === 'CASH' ? 'Nakit Kasa' : tx.payment_source === 'CARD' ? 'Banka / POS' : tx.payment_source === 'TRANSFER' ? 'Havale/EFT' : 'Cari'}
                        </span>
                      </td>

                      <td className="py-2 px-3 text-right">
                        <span className={`font-bold text-xs ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {isIncome ? '+' : '-'}{fmtFull(tx.amount)}
                        </span>
                      </td>

                      <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-600">
                        {orderNo || (tx.source === 'POS' ? 'POS Satış' : 'Manuel Fiş')}
                      </td>

                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {tx.source === 'POS' && (tx.related_order_id || tx.reference_id) && (
                            <button
                              onClick={() => handleReportClick(tx, 'Müşteri')}
                              title="Fatura / Sipariş İncele"
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isIncome && (tx.source === 'POS' || tx.category === 'SALE_INCOME' || tx.category === 'Gelir' || tx.category?.includes('Satış')) && (
                            <button
                              onClick={() => setRefundConfirmTx(tx)}
                              disabled={refundingId === tx.id || deletingId === tx.id}
                              title="Satışı İade Et (Stoğu geri yükle, kasa kaydını ve borcu iptal et)"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors group/refund"
                            >
                              {refundingId === tx.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5 group-hover/refund:rotate-[-45deg] transition-transform" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(tx.id)}
                            disabled={deletingId === tx.id || refundingId === tx.id}
                            title="Sil"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Alt Sayfalama */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            {filteredTransactions.length > 0 ? `${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, filteredTransactions.length)}` : '0'} / {filteredTransactions.length} işlem
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-2.5 py-1 text-slate-400 hover:text-slate-600 rounded disabled:opacity-50"
            >
              Önceki
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                  currentPage === page
                    ? 'bg-slate-100 font-semibold text-slate-900'
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              disabled={currentPage === totalPages || filteredTransactions.length === 0}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-2.5 py-1 hover:text-slate-900 rounded disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>

      {/* 5. BEKLEYEN ÖDEME & ALACAKLAR (Paraşüt Vade Takibi) */}
      <OdemelerVeAlacaklarCard
        receivableTxs={debtStats.receivableTxs}
        receivable={debtStats.receivable}
        receivableCount={debtStats.receivableCount}
        payableTxs={debtStats.payableTxs}
        payable={debtStats.payable}
        payableCount={debtStats.payableCount}
        onCollect={(tx, type) => { setCollectionTx(tx); setCollectionType(type); }}
        customersWithDebts={customersWithDebts}
        onPrint={handlePrintInvoice}
        onReport={handleReportClick}
      />

      {/* Modallar */}
      {modal === 'income'   && <AddIncomeModal   onClose={() => setModal(null)} onSaved={loadAll} />}
      {modal === 'expense'  && <AddExpenseModal  onClose={() => setModal(null)} onSaved={loadAll} />}
      {collectionTx && (
        <CollectionModal
          tx={collectionTx}
          txType={collectionType}
          onClose={() => setCollectionTx(null)}
          onSaved={loadAll}
        />
      )}

      {selectedReportOrder && (
        <Modal
          onClose={() => setSelectedReportOrder(null)}
          title="Fatura / Borç Detay Raporu"
        >
          <div className="p-4 space-y-4">
            {reportModalLoading ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                <span className="text-[10px] text-slate-400 font-bold">Rapor yükleniyor...</span>
              </div>
            ) : (
              <>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 font-bold uppercase">Müşteri/Tedarikçi</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">{reportCustomerName}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 font-bold uppercase">İşlem Numarası</span>
                    <span className="text-slate-800 dark:text-slate-200 font-mono font-bold">#{selectedReportOrder.order_number}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 font-bold uppercase">Tarih</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">
                      {new Date(selectedReportOrder.created_at || Date.now()).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alınan Ürünler</p>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-805 bg-white dark:bg-slate-900">
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/80 px-2.5 py-1.5">
                      <span className="w-5/12">Ürün</span>
                      <span className="w-1/12 text-center">Adet</span>
                      <span className="w-3/12 text-right text-red-400 font-bold">İndirim</span>
                      <span className="w-3/12 text-right">Tutar</span>
                    </div>
                    {selectedReportOrder.items?.map((item: any, idx: number) => {
                      const unitPrice = item.unit_price || item.unit_sell_price || 0;
                      const qty = item.quantity || 1;
                      const itemDiscount = item.discount || 0;
                      const lineTotal = item.subtotal || ((qty * unitPrice) - itemDiscount);
                      return (
                        <div key={idx} className="flex justify-between text-xs px-2.5 py-2">
                          <span className="w-5/12 text-slate-700 dark:text-slate-350 font-bold truncate">{item.product_name || item.product?.name || 'Ürün'}</span>
                          <span className="w-1/12 text-center text-slate-500 font-semibold">{qty}</span>
                          <span className="w-3/12 text-right font-semibold" style={{color: itemDiscount > 0 ? '#ef4444' : '#94a3b8'}}>
                            {itemDiscount > 0 ? `-₺${itemDiscount.toFixed(2)}` : '—'}
                          </span>
                          <span className="w-3/12 text-right text-slate-800 dark:text-slate-200 font-bold">₺{lineTotal.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-1">
                  {(() => {
                    const rawTotal = selectedReportOrder.total_amount || 0;
                    const discAmt = selectedReportOrder.discount_amount || 0;
                    const finalAmt = (selectedReportOrder.final_amount !== undefined && selectedReportOrder.final_amount !== null && selectedReportOrder.final_amount > 0.01) ? selectedReportOrder.final_amount : (rawTotal - discAmt);
                    return (
                      <>
                        {discAmt > 0 && (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Ara Toplam</span>
                              <span className="text-slate-600 text-xs font-semibold">₺{rawTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-red-400 text-[10px] uppercase tracking-wider">İndirim</span>
                              <span className="text-red-500 text-xs font-semibold">-₺{discAmt.toFixed(2)}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between items-center font-bold border-t border-slate-100 dark:border-slate-800 pt-1">
                          <span className="text-slate-455 text-[10px] uppercase tracking-wider">Genel Toplam</span>
                          <span className="text-emerald-605 font-black">₺{finalAmt.toFixed(2)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setSelectedReportOrder(null)}
                    className="flex-1 py-2 bg-slate-105 dark:bg-slate-800 text-slate-650 dark:text-slate-350 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Kapat
                  </button>
                  <button
                    onClick={() => handlePrintInvoice(selectedReportOrder, reportCustomerName)}
                    className="flex-[2] py-2 bg-indigo-600 hover:bg-indigo-755 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Faturayı Yazdır
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2.5 border transition-all animate-in fade-in slide-in-from-top-2 duration-200',
          toast.type === 'success'
            ? 'bg-white border-emerald-200 text-emerald-700 shadow-emerald-500/10'
            : 'bg-white border-rose-200 text-rose-700 shadow-rose-500/10'
        )}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            : <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {refundConfirmTx && (
        <Modal
          onClose={() => !refundingId && setRefundConfirmTx(null)}
          title="Satış İadesi Onayı"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <span className="font-bold">Önemli Uyarı:</span> Bu işlem satışı iade edecek, satılan ürünleri stoğa geri yükleyecek, kasa gelir kaydını iptal edecek ve varsa müşteri borcunu silecektir. Onaylıyor musunuz?
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">İşlem / Belge:</span>
                <span className="font-mono font-bold text-slate-800">
                  {(refundConfirmTx.description || '').match(/(#?S-[^\s]+)/)?.[1] || refundConfirmTx.description || 'POS Satış'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">İade Tutarı:</span>
                <span className="font-bold text-rose-600 font-mono text-sm">
                  {fmtFull(refundConfirmTx.amount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Ödeme Kaynağı:</span>
                <span className="text-slate-700 font-medium">
                  {refundConfirmTx.payment_source === 'CASH' ? 'Nakit Kasa' : refundConfirmTx.payment_source === 'CARD' ? 'Banka / POS' : refundConfirmTx.payment_source === 'TRANSFER' ? 'Havale/EFT' : 'Cari'}
                </span>
              </div>
              {refundConfirmTx.created_at && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Satış Tarihi:</span>
                  <span className="text-slate-700">
                    {parseUTC(refundConfirmTx.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={refundingId !== null}
                onClick={() => setRefundConfirmTx(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={refundingId !== null}
                onClick={() => handleRefund(refundConfirmTx.id)}
                className="flex-[2] py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/20 disabled:opacity-50"
              >
                {refundingId === refundConfirmTx.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>İade Ediliyor...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>İadeyi Onayla</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
