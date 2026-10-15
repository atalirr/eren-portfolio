/**
 * Transactions Page — Kasa
 * Kompakt KPI + dropdown işlem ekle + gelişmiş grafik tooltip + günlük/geçmiş sekmeleri
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ComposedChart, Line, ReferenceLine,
  LineChart,
  AreaChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowDownRight, ArrowUpRight, Wallet, TrendingUp, TrendingDown,
  Plus, AlertCircle, Receipt, Target, Coins, X,
} from 'lucide-react';
import { transactionsApi, type Transaction } from '../services/transactionsApi';
import { salesApi } from '../../sales/services/salesApi';
import { cn } from '@/shared/utils/cn';

// ── SABİTLER ──
const CASH_THRESHOLD = 4_000; // Kritik eşik (₺)

// ── FORMAT ──
const fmt = (n: number) => n >= 1_000_000 ? `₺${(n/1e6).toFixed(1)}M` : n >= 1000 ? `₺${(n/1000).toFixed(1)}B` : `₺${n.toFixed(0)}`;
const fmtFull = (n: number) => `₺${Math.abs(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;



// ── KOMPAKT KPI KART ──
function KPICard({ label, value, sub, icon: Icon, iconBg, iconColor, positive }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<any>; iconBg: string; iconColor: string; positive?: boolean;
}) {
  return (
    <div className="bg-slate-50/85 rounded-xl border border-slate-400 shadow-sm px-4 py-3 flex items-center gap-3 hover:shadow-md hover:border-slate-500 transition-all hover:bg-slate-100/60">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
        <Icon className={cn('w-4 h-4', iconColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="text-base font-bold text-slate-900 tabular-nums leading-none">{value}</p>
        {sub && <p className={cn('text-[10px] font-semibold mt-0.5 leading-none',
          positive === true ? 'text-emerald-600' : positive === false ? 'text-rose-500' : 'text-slate-400'
        )}>{sub}</p>}
      </div>
    </div>
  );
}

// ── DÖNEM BAR ──
const PERIODS = [
  { key: 'today', label: 'Bugün' }, { key: 'week', label: 'Hafta' },
  { key: 'month', label: 'Ay' }, { key: '3months', label: '3 Ay' }, { key: '6months', label: '6 Ay' },
] as const;

function PeriodBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-lg p-1 border border-slate-400">
      {PERIODS.map(p => (
        <button key={p.key} onClick={() => onChange(p.key)}
          className={cn('px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all',
            value === p.key ? 'bg-white shadow-sm text-slate-900 border border-slate-350' : 'text-slate-500 hover:text-slate-700'
          )}>{p.label}</button>
      ))}
    </div>
  );
}

// ── NAKİT AKIŞ TOOLTIP ──
function CashflowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const gelir      = payload.find((p: any) => p.name === 'gelir')?.value ?? 0;
  const gider      = payload.find((p: any) => p.name === 'gider')?.value ?? 0;
  const kar        = payload.find((p: any) => p.name === 'kar')?.value ?? 0;
  const ciro       = payload.find((p: any) => p.name === 'ciro')?.value ?? 0;
  const haricGelir = gelir - ciro;
  const tl = (n: number) => `₺${Math.abs(Number(n)).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}`;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3.5 min-w-[200px]">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-100">{label}</p>
      <div className="space-y-1.5">
        {/* Gelir bölümü */}
        <div className="flex justify-between items-center gap-8">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-600 flex-shrink-0" />
            <span className="text-[11px] font-bold text-slate-700">Toplam Gelir</span>
          </div>
          <span className="text-[11px] font-bold text-slate-800 tabular-nums">{tl(gelir)}</span>
        </div>
        {ciro > 0 && (
          <div className="flex justify-between items-center gap-8 pl-3.5">
            <span className="text-[9px] text-slate-400 font-medium">└ POS Satış</span>
            <span className="text-[9px] text-slate-500 tabular-nums">{tl(ciro)}</span>
          </div>
        )}
        {haricGelir > 0 && (
          <div className="flex justify-between items-center gap-8 pl-3.5">
            <span className="text-[9px] text-slate-400 font-medium">└ Harici Gelir</span>
            <span className="text-[9px] text-slate-500 tabular-nums">{tl(haricGelir)}</span>
          </div>
        )}
        {/* Gider */}
        <div className="flex justify-between items-center gap-8">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
            <span className="text-[11px] font-bold text-slate-700">Toplam Gider</span>
          </div>
          <span className="text-[11px] font-bold text-rose-500 tabular-nums">{tl(gider)}</span>
        </div>
        {/* Net */}
        <div className="pt-2 mt-1 border-t border-slate-100 flex justify-between items-center gap-8">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-[11px] font-black text-slate-800">Net Kâr</span>
          </div>
          <span className={cn('text-[12px] font-black tabular-nums', kar >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
            {kar >= 0 ? '+' : '-'}{tl(Math.abs(kar))}
          </span>
        </div>
      </div>
    </div>
  );
}



// ── MODAL ALTYAPI ──
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-widest">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm text-slate-900 bg-white focus:border-slate-500 focus:ring-0 outline-none transition-colors";
function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

// (AddIncomeModal, AddExpenseModal, TransferModal, AddDropdown moved to FinancePage.tsx)

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
      if (isReceivable) {
        await transactionsApi.addIncome(amt, tx.category || 'Tahsilat', desc, 'default-user', 'CASH', 'CASH');
      } else {
        await transactionsApi.addExpense(amt, tx.category || 'Ödeme', desc, 'default-user', 'CASH', 'CASH');
      }
      const remaining = fullAmount - amt;
      if (remaining > 0.01) {
        const remDesc = tx.description || tx.category || '';
        if (isReceivable) {
          await transactionsApi.addIncome(remaining, tx.category || 'Veresiye', remDesc, 'default-user', 'CASH', 'DEBT');
        } else {
          await transactionsApi.addExpense(remaining, tx.category || 'Veresiye', remDesc, 'default-user', 'CASH', 'DEBT');
        }
      }
      await transactionsApi.deleteTransaction(tx.id);
      onSaved(); onClose();
    } catch { setErr('Kaydedilemedi'); }
    finally { setLoading(false); }
  };

  const enteredAmt = parseFloat(amount) || 0;
  const remaining = fullAmount - enteredAmt;

  return (
    <Modal title={isReceivable ? 'Tahsilat Kaydet' : 'Borç Ödemesi'} onClose={onClose}>
      <div className="space-y-3">
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Kayıt Bilgisi</p>
          <p className="text-sm font-semibold text-slate-800">{tx.category || 'Genel'}</p>
          {tx.description && <p className="text-xs text-slate-500 mt-0.5">{tx.description}</p>}
          <p className="text-[10px] text-slate-400 mt-1">
            {new Date(tx.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <FF label={isReceivable ? 'Tahsil Edilen Tutar (₺)' : 'Ödenen Tutar (₺)'}>
          <input
            type="number" className={inputCls} value={amount} autoFocus
            onChange={e => { setAmount(e.target.value); setErr(''); }}
            max={fullAmount} step="0.01"
          />
        </FF>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 bg-slate-50 rounded-lg">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Toplam Borç</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5 tabular-nums">{fmtFull(fullAmount)}</p>
          </div>
          <div className={cn('p-2.5 rounded-lg', remaining > 0.01 ? 'bg-amber-50' : 'bg-emerald-50')}>
            <p className={cn('text-[9px] font-bold uppercase tracking-widest', remaining > 0.01 ? 'text-amber-500' : 'text-emerald-500')}>Kalan</p>
            <p className={cn('text-sm font-bold mt-0.5 tabular-nums', remaining > 0.01 ? 'text-amber-600' : 'text-emerald-600')}>
              {fmtFull(Math.max(remaining, 0))}
            </p>
          </div>
        </div>
        {remaining > 0.01 && (
          <p className="text-[10px] text-amber-600 font-medium bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
            {fmtFull(remaining)} kalan veresiye yeni kayıt olarak saklanacak.
          </p>
        )}
        {err && <p className="text-xs text-rose-500 font-semibold">{err}</p>}
        <button onClick={save} disabled={loading}
          className={cn('w-full py-2.5 text-white text-sm font-bold rounded-md transition-colors disabled:opacity-50',
            isReceivable ? 'bg-violet-600 hover:bg-violet-700' : 'bg-orange-500 hover:bg-orange-600')}>
          {loading ? 'Kaydediliyor…' : isReceivable ? '✓ Tahsilat Yap' : '✓ Ödeme Yap'}
        </button>
      </div>
    </Modal>
  );
}



// ── ALACAK & BORÇ KARTI ──
// Veresiye Alacaklar kartı — INCOME + (payment_method=DEBT veya category="Veresiye Satış")
function DebtCard({ receivableTxs, receivable, receivableCount, payableTxs, payable, payableCount, onCollect }: {
  receivableTxs: Transaction[];
  receivable: number;
  receivableCount: number;
  payableTxs: Transaction[];
  payable: number;
  payableCount: number;
  onCollect: (tx: Transaction, type: 'receivable' | 'payable') => void;
}) {
  const [showPayables, setShowPayables] = useState(false);
  // description formatı: "Veresiye Satış #S-... - MüşteriAdı - Vade: 2026-05-20"
  const parseVeresiye = (tx: Transaction) => {
    const desc = tx.description || '';
    const orderMatch = desc.match(/#S-[\d-]+/);
    const order = orderMatch ? orderMatch[0] : null;
    const vadeMatch = desc.match(/Vade:\s*(\d{4}-\d{2}-\d{2})/);
    const vade = vadeMatch ? vadeMatch[1] : null;
    // Müşteri adı: sipariş ile vade arasındaki parçayı yakala
    let musteri: string | null = null;
    if (order) {
      const rest = desc.split(order)[1] || '';
      const cleaned = rest.replace(/^[\s\-]+/, '').replace(/\s*-\s*Vade:.*$/, '').trim();
      if (cleaned && cleaned.length < 60 && !cleaned.match(/^[\da-f-]{20,}/i)) musteri = cleaned;
    } else {
      // Eski/manuel formatta: tüm description müşteri adı olabilir
      const fallback = desc.replace(/^Veresiye\s*(Satış)?\s*-?\s*/i, '').trim();
      if (fallback && fallback.length < 60) musteri = fallback;
    }
    return { order, musteri, vade };
  };

  const daysUntil = (vade: string) => {
    const diff = Math.ceil((new Date(vade).getTime() - Date.now()) / 86_400_000);
    return diff;
  };

  const currentTxs   = showPayables ? payableTxs : receivableTxs;
  const currentTotal = showPayables ? payable : receivable;
  const currentCount = showPayables ? payableCount : receivableCount;
  const accentColor  = showPayables ? 'rose' : 'amber';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
      {/* Başlık + Switch */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', showPayables ? 'bg-rose-50' : 'bg-amber-50')}>
            <Coins className={cn('w-3.5 h-3.5', showPayables ? 'text-rose-500' : 'text-amber-600')} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-800 uppercase tracking-widest leading-none">
              {showPayables ? 'Veresiye Borçlar' : 'Veresiye Alacaklar'}
            </p>
            <p className="text-[9px] text-slate-500 mt-0.5">
              {showPayables ? 'Ödenmesi bekleyen' : 'Tahsil bekleyen'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-[9px] px-2 py-1 rounded-md font-bold border',
            showPayables
              ? 'text-rose-600 bg-rose-50 border-rose-100'
              : 'text-amber-700 bg-amber-50 border-amber-100'
          )}>
            {currentCount} kayıt
          </span>
          {/* Switch — Alacak / Borç */}
          <button
            onClick={() => setShowPayables(v => !v)}
            title={showPayables ? 'Alacakları göster' : 'Borçları göster'}
            className={cn(
              'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
              showPayables ? 'bg-rose-400' : 'bg-slate-200'
            )}
          >
            <span className={cn(
              'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform duration-200',
              showPayables ? 'translate-x-4' : 'translate-x-0'
            )} />
          </button>
        </div>
      </div>

      {/* Özet tutar */}
      <div className={cn('px-4 py-1.5 border-b border-slate-100 flex items-center justify-between',
        showPayables ? 'bg-rose-50/40' : 'bg-amber-50/30'
      )}>
        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Toplam</p>
        <p className="text-sm font-black text-slate-900 tabular-nums">{fmtFull(currentTotal)}</p>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto max-h-[165px] divide-y divide-slate-100 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb:hover]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full">
        {currentTxs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 px-4 text-center">
            <Coins className="w-7 h-7 text-slate-200" />
            <p className="text-xs font-semibold text-slate-500">
              {showPayables ? 'Bekleyen borç yok' : 'Henüz veresiye satış yok'}
            </p>
            <p className="text-[10px] text-slate-400">
              {showPayables ? 'Veresiye gider yapıldığında burada görünür' : 'Satış sayfasından veresiye yapıldığında burada görünür'}
            </p>
          </div>
        ) : (
          currentTxs
            .slice()
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map(tx => {
              const { order, musteri, vade } = parseVeresiye(tx);
              const dn = vade ? daysUntil(vade) : null;
              const vadeColor = dn === null ? 'text-slate-500'
                : dn < 0 ? 'text-rose-600'
                : dn <= 3 ? 'text-amber-600'
                : 'text-emerald-600';
              const vadeLbl = dn === null ? null
                : dn < 0 ? `${Math.abs(dn)} gün geçti`
                : dn === 0 ? 'Bugün vade'
                : `${dn} gün kaldı`;
              const barColor = accentColor === 'rose' ? 'bg-rose-400' : 'bg-amber-400';
              const btnClass = accentColor === 'rose'
                ? 'bg-rose-500 hover:bg-rose-600'
                : 'bg-amber-500 hover:bg-amber-600';
              return (
                <div key={tx.id} className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors',
                  showPayables ? 'hover:bg-rose-50/30' : 'hover:bg-amber-50/30'
                )}>
                  <div className={cn('w-0.5 h-9 rounded-full flex-shrink-0', barColor)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-900 truncate">
                        {musteri || (showPayables ? 'Alacaklı belirtilmemiş' : 'Müşteri belirtilmemiş')}
                      </span>
                      {order && (
                        <span className="text-[8px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                          {order}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] text-slate-600 font-medium">
                        {new Date(tx.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      {vadeLbl && (
                        <>
                          <span className="text-[8px] text-slate-300">·</span>
                          <span className={cn('text-[9px] font-bold tabular-nums', vadeColor)}>
                            {vadeLbl}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-black text-slate-900 tabular-nums">{fmtFull(tx.amount)}</span>
                    <button
                      onClick={() => onCollect(tx, showPayables ? 'payable' : 'receivable')}
                      className={cn('px-2.5 py-1.5 rounded-md text-[10px] font-bold text-white transition-colors shadow-sm', btnClass)}
                    >
                      {showPayables ? 'Öde' : 'Tahsil'}
                    </button>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

// ── SATIŞ İÇGÖRÜSÜ KARTI ──
// POS satışlarının tutar profilini analiz eder + doğal dilde özet üretir
function SalesInsightCard({ txs, periodLabel, embedded }: {
  txs: Transaction[];
  periodLabel: string;
  embedded?: boolean;
}) {
  const stats = useMemo(() => {
    const pos = txs.filter(t => t.type === 'INCOME' && t.source === 'POS' && !t.is_deleted);
    const amounts = pos.map(t => t.amount).sort((a,b) => a-b);
    const count = amounts.length;

    const bucketDefs = [
      { min: 0,    max: 100,      label: 'küçük1',   short: '0-100' },
      { min: 100,  max: 300,      label: 'küçük2',   short: '100-300' },
      { min: 300,  max: 1000,     label: 'orta',     short: '300-1.000' },
      { min: 1000, max: 3000,     label: 'büyük',    short: '1.000-3.000' },
      { min: 3000, max: Infinity, label: 'çokbüyük', short: '3.000+' },
    ];

    if (count === 0) {
      return { count: 0, avg: 0, median: 0, max: 0, total: 0,
               buckets: bucketDefs.map(b => ({ ...b, count: 0, total: 0, countPct: 0, totalPct: 0 })),
               insight: '', topBucket: null as null };
    }

    const total = amounts.reduce((s,a) => s+a, 0);
    const avg = total / count;
    const median = amounts[Math.floor(count/2)];
    const max = amounts[count-1];

    const buckets = bucketDefs.map(b => {
      const inB = amounts.filter(a => a >= b.min && a < b.max);
      const bTotal = inB.reduce((s,a) => s+a, 0);
      return {
        ...b,
        count: inB.length,
        total: bTotal,
        countPct: (inB.length / count) * 100,
        totalPct: (bTotal / total) * 100,
      };
    });

    const topBucket = buckets.reduce((a, b) => b.count > a.count ? b : a, buckets[0]);
    const smallCountPct = buckets[0].countPct + buckets[1].countPct;
    const bigTotalPct   = buckets[3].totalPct + buckets[4].totalPct;
    const bigCount      = buckets[3].count + buckets[4].count;

    // Doğal dilde içgörü cümlesi
    let insight = '';
    if (count < 5) {
      insight = `Sadece ${count} satış var, içgörü için yetersiz veri.`;
    } else if (smallCountPct > 50 && bigTotalPct > 50) {
      insight = `Satışların %${smallCountPct.toFixed(0)}'ı ₺300 altında, ama cironun %${bigTotalPct.toFixed(0)}'ı ${bigCount} büyük siparişten geliyor. Küçük satışlar tablo şişiriyor, parayı az sayıda büyük müşteri bırakıyor.`;
    } else if (avg / Math.max(median, 1) > 1.5) {
      insight = `Ortalama sepet ₺${avg.toFixed(0)} gözükse de medyan ₺${median.toFixed(0)}. Birkaç büyük sipariş ortalamayı yukarı çekiyor — tipik satış aslında daha küçük.`;
    } else if (smallCountPct > 60) {
      insight = `Satışlarının %${smallCountPct.toFixed(0)}'ı ₺300 altı. Küçük tutarlı, sık satış profilin var — sepet ortalamasını yükseltecek üst-satış fırsatları olabilir.`;
    } else if (topBucket && topBucket.countPct > 40) {
      insight = `Satışların büyük çoğunluğu ${topBucket.short} aralığında (${topBucket.count} işlem, %${topBucket.countPct.toFixed(0)}). Bu fiyat noktası iyi tutuyor.`;
    } else {
      insight = `${count} satış, ortalama sepet ₺${avg.toFixed(0)}. Tutar dağılımı dengeli — belirgin bir baskın segment yok.`;
    }

    return { count, avg, median, max, total, buckets, insight, topBucket };
  }, [txs]);

  if (stats.count === 0) {
    return (
      <div className={cn(embedded ? 'p-4 flex flex-col h-full' : 'bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col')}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Receipt className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Satış İçgörüsü</p>
          </div>
          <span className="text-[9px] text-slate-400">{periodLabel}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-12 gap-1.5">
          <Receipt className="w-7 h-7 text-slate-200" />
          <p className="text-xs font-semibold text-slate-400">Bu dönemde POS satışı yok</p>
          <p className="text-[10px] text-slate-300">Satış yapıldıkça analizler burada belirir</p>
        </div>
      </div>
    );
  }

  const maxBucketCount = Math.max(...stats.buckets.map(b => b.count), 1);

  return (
    <div className={cn(embedded ? 'p-4 flex flex-col gap-3 h-full' : 'bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3')}>
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Receipt className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest leading-none">Satış İçgörüsü</p>
            <p className="text-[9px] text-slate-400 mt-0.5">{stats.count} POS işlemi</p>
          </div>
        </div>
        <span className="text-[9px] text-slate-400">{periodLabel}</span>
      </div>

      {/* İçgörü cümlesi */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2.5">
        <p className="text-[11px] text-slate-700 leading-relaxed">{stats.insight}</p>
      </div>

      {/* Histogram */}
      <div>
        <div className="flex items-end gap-1 h-14">
          {stats.buckets.map(b => {
            const heightPct = (b.count / maxBucketCount) * 100;
            const isTop = stats.topBucket && b.label === stats.topBucket.label && b.count > 0;
            return (
              <div key={b.label} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                <span className={cn('text-[9px] font-bold tabular-nums leading-none', isTop ? 'text-indigo-700' : 'text-slate-500')}>{b.count}</span>
                <div
                  className={cn('w-full rounded-t transition-all', isTop ? 'bg-indigo-500' : 'bg-indigo-200')}
                  style={{ height: `${Math.max(heightPct, 6)}%` }}
                  title={`${b.count} işlem · ${fmtFull(b.total)} (%${b.countPct.toFixed(0)} adet · %${b.totalPct.toFixed(0)} ciro)`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-1">
          {stats.buckets.map(b => (
            <span key={b.label} className="flex-1 text-center text-[8px] font-bold text-slate-400">₺{b.short}</span>
          ))}
        </div>
      </div>

      {/* Metrikler */}
      <div className="border-t border-slate-100 pt-2.5 grid grid-cols-3 gap-2">
        {[
          { label: 'Ortalama Sepet', val: fmt(stats.avg), color: 'text-slate-800' },
          { label: 'Medyan',         val: fmt(stats.median), color: 'text-slate-800' },
          { label: 'En Yüksek',      val: fmt(stats.max), color: 'text-emerald-600' },
        ].map(m => (
          <div key={m.label}>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{m.label}</p>
            <p className={cn('text-xs font-black tabular-nums', m.color)}>{m.val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ANA SAYFA ──
export function TransactionsPage() {
  const [loading, setLoading]       = useState(true);
  const [balance, setBalance]       = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [period, setPeriod]         = useState<string>('week');
  const [collectionTx, setCollectionTx] = useState<Transaction | null>(null);
  const [collectionType, setCollectionType] = useState<'receivable' | 'payable'>('receivable');
  const [insightTab, setInsightTab] = useState<'trend' | 'expense'>('trend');
  const [trendTabPeriod, setTrendTabPeriod] = useState<'weekly' | 'monthly' | '6months'>('monthly');

  const parseUTC = useCallback((dateStr: string) => {
    if (!dateStr) return new Date();
    if (dateStr.endsWith('Z') || dateStr.includes('+')) return new Date(dateStr);
    return new Date(dateStr + 'Z');
  }, []);

  const toLocalDateStr = useCallback((d: Date | string) => {
    const date = typeof d === 'string' ? parseUTC(d) : d;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [parseUTC]);

  const load = useCallback(async () => {
    try {
      const [bal, txs] = await Promise.all([
        transactionsApi.getBalance(),
        transactionsApi.getTransactions(),
      ]);
      setBalance(bal);
      setTransactions(txs);
    } catch (err) {
      console.error('İşlemler yüklenirken hata oluştu:', err);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    // Her 30 saniyede bir otomatik yenile
    const interval = setInterval(load, 30_000);
    // Sekme/pencere odağa gelince de yenile
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [load]);

  const todayStr = useMemo(() => toLocalDateStr(new Date()), [toLocalDateStr]);

  const today = useMemo(() => {
    const t = transactions.filter(x => toLocalDateStr(x.created_at) === todayStr);
    const inc = t.filter(x => x.type === 'INCOME').reduce((s, x) => s + x.amount, 0);
    const exp = t.filter(x => x.type === 'EXPENSE').reduce((s, x) => s + x.amount, 0);
    return { inc, exp, net: inc - exp, count: t.length };
  }, [transactions, todayStr, toLocalDateStr]);

  // Günlük net nakit akışı (DEBT hariç, bugün)
  const netCashFlow = useMemo(() => {
    const t = transactions.filter(x =>
      toLocalDateStr(x.created_at) === todayStr &&
      x.payment_method !== 'DEBT' &&
      !x.is_deleted
    );
    const inc = t.filter(x => x.type === 'INCOME').reduce((s,x) => s+x.amount, 0);
    const exp = t.filter(x => x.type === 'EXPENSE').reduce((s,x) => s+x.amount, 0);
    return inc - exp;
  }, [transactions, todayStr, toLocalDateStr]);

  const filtered = useMemo(() => {
    const now = new Date(), start = new Date();
    if (period === 'today') start.setHours(0,0,0,0);
    else if (period === 'week') start.setDate(now.getDate() - 7);
    else if (period === 'month') start.setMonth(now.getMonth() - 1);
    else if (period === '3months') start.setMonth(now.getMonth() - 3);
    else start.setMonth(now.getMonth() - 6);
    return transactions.filter(t => parseUTC(t.created_at) >= start);
  }, [transactions, period, parseUTC]);

  // Sepet ortalaması (POS satışları, seçili dönem)
  const basketStats = useMemo(() => {
    const pos = filtered.filter(t => t.type === 'INCOME' && t.source === 'POS' && !t.is_deleted);
    const total = pos.reduce((s,t) => s+t.amount, 0);
    return { avg: pos.length > 0 ? total / pos.length : 0, count: pos.length };
  }, [filtered]);

  const trendData = useMemo(() => {
    const map: Record<string, { dateLabel: string; gelir: number; gider: number; kar: number; ciro: number; hariçGelir: number }> = {};
    filtered.forEach(tx => {
      const d = tx.created_at.split('T')[0];
      if (!map[d]) map[d] = { dateLabel: new Date(d).toLocaleDateString('tr-TR', { day:'2-digit', month:'short' }), gelir: 0, gider: 0, kar: 0, ciro: 0, hariçGelir: 0 };
      if (tx.type === 'INCOME') {
        map[d].gelir += tx.amount;
        if (tx.source === 'POS') map[d].ciro += tx.amount;
        else map[d].hariçGelir += tx.amount;
      } else {
        map[d].gider += tx.amount;
      }
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => ({ ...v, kar: v.gelir - v.gider }));
  }, [filtered]);


  // Alacaklar & borçlar (tüm zamanlar — veresiye işlemler)
  // Yeni format: payment_method='DEBT'  | Eski format: category='Veresiye Satış'
  const debtStats = useMemo(() => {
    const isVeresiye = (t: Transaction) =>
      !t.is_deleted && t.type === 'INCOME' &&
      (t.payment_method === 'DEBT' || t.category === 'Veresiye Satış');
    const receivableTxs = transactions.filter(isVeresiye);
    const payableTxs = transactions.filter(t => t.payment_method === 'DEBT' && t.type === 'EXPENSE' && !t.is_deleted);
    return {
      receivable: receivableTxs.reduce((s,t) => s + t.amount, 0),
      receivableCount: receivableTxs.length,
      receivableTxs,
      payable: payableTxs.reduce((s,t) => s + t.amount, 0),
      payableCount: payableTxs.length,
      payableTxs,
    };
  }, [transactions]);

  // Büyüme trendi — seçili dönem vs önceki dönem
  const growthData = useMemo(() => {
    const days = trendTabPeriod === 'weekly' ? 7 : trendTabPeriod === 'monthly' ? 30 : 180;
    const now = new Date();
    const startCurrent = new Date(now); startCurrent.setDate(startCurrent.getDate() - days); startCurrent.setHours(0,0,0,0);
    const startPrev = new Date(startCurrent); startPrev.setDate(startPrev.getDate() - days);

    const income = (t: Transaction) => t.type === 'INCOME' && t.payment_method !== 'DEBT' && !t.is_deleted;
    const current = transactions.filter(t => income(t) && new Date(t.created_at) >= startCurrent);
    const prev    = transactions.filter(t => income(t) && new Date(t.created_at) >= startPrev && new Date(t.created_at) < startCurrent);

    const currentTotal = current.reduce((s,t) => s+t.amount, 0);
    const prevTotal    = prev.reduce((s,t) => s+t.amount, 0);
    const growthPct    = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : currentTotal > 0 ? 100 : 0;

    // Daily/monthly buckets for current period
    const TR_MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
    const TR_DAYS   = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
    const bucket = (t: Transaction) => trendTabPeriod === '6months' ? t.created_at.substring(0,7) : t.created_at.split('T')[0];
    const label = (key: string) => {
      if (trendTabPeriod === '6months') { const [y,m] = key.split('-'); return `${TR_MONTHS[+m-1]} '${y.slice(2)}`; }
      const d = new Date(key);
      return trendTabPeriod === 'weekly' ? `${TR_DAYS[d.getDay()]} ${d.getDate()}` : `${d.getDate()} ${TR_MONTHS[d.getMonth()]}`;
    };

    const curMap: Record<string,number> = {};
    current.forEach(t => { const k = bucket(t); curMap[k] = (curMap[k]||0)+t.amount; });
    // shift prev by `days` for overlay alignment
    const prevMap: Record<string,number> = {};
    prev.forEach(t => {
      let d = new Date(t.created_at); d.setDate(d.getDate()+days);
      const k = trendTabPeriod === '6months' ? d.toISOString().substring(0,7) : d.toISOString().split('T')[0];
      prevMap[k] = (prevMap[k]||0)+t.amount;
    });

    const allKeys = Array.from(new Set([...Object.keys(curMap),...Object.keys(prevMap)])).sort();
    const chartData = allKeys.map(k => ({ label: label(k), ciro: curMap[k]||0, prev: prevMap[k]||0 }));

    return { chartData, currentTotal, prevTotal, growthPct };
  }, [transactions, trendTabPeriod]);

  // Harcama analizi (dönem filtresiyle)
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(t => t.type === 'EXPENSE' && !t.is_deleted && t.payment_method !== 'DEBT').forEach(t => {
      const cat = t.category || 'Diğer';
      map[cat] = (map[cat] || 0) + t.amount;
    });
    const total = Object.values(map).reduce((s,v) => s+v, 0);
    return { total, items: Object.entries(map).sort(([,a],[,b]) => b-a).slice(0,6).map(([name, amount]) => ({ name, amount, pct: total > 0 ? amount/total*100 : 0 })) };
  }, [filtered]);



  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-5">

      {/* ── KPI KARTLARI (4 kart) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Net Nakit Akışı */}
        <KPICard
          label="Net Nakit Akışı"
          value={fmt(Math.abs(netCashFlow))}
          sub={netCashFlow >= 0 ? '▲ Kasaya girdi' : '▼ Kasadan çıktı'}
          icon={netCashFlow >= 0 ? TrendingUp : TrendingDown}
          iconBg={netCashFlow >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}
          iconColor={netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-500'}
          positive={netCashFlow >= 0}
        />

        {/* 2. Bekleyen Ödemeler */}
        <KPICard
          label="Bekleyen Ödemeler"
          value={debtStats.payable > 0 ? fmt(debtStats.payable) : '₺0'}
          sub={debtStats.payableCount > 0 ? `${debtStats.payableCount} ödeme bekliyor` : 'Bekleyen borç yok'}
          icon={AlertCircle}
          iconBg={debtStats.payable > 0 ? 'bg-amber-100' : 'bg-slate-100'}
          iconColor={debtStats.payable > 0 ? 'text-amber-600' : 'text-slate-400'}
          positive={debtStats.payable === 0}
        />

        {/* 3. Kritik Eşik */}
        {(() => {
          const diff = balance - CASH_THRESHOLD;
          const safe = diff >= 0;
          const close = safe && diff < CASH_THRESHOLD * 0.5;
          const barPct = Math.min((balance / (CASH_THRESHOLD * 2)) * 100, 100);
          const threshColorBg   = !safe ? 'bg-rose-100'   : close ? 'bg-amber-100'   : 'bg-emerald-100';
          const threshColorIcon = !safe ? 'text-rose-500' : close ? 'text-amber-600' : 'text-emerald-600';
          const threshColorTxt  = !safe ? 'text-rose-500' : close ? 'text-amber-600' : 'text-emerald-600';
          const threshBarColor  = !safe ? '#ef4444'       : close ? '#f59e0b'        : '#10b981';
          const threshLabel     = !safe ? '⚠ Limit altında' : close ? '⚡ Yaklaşıyor' : '✓ Güvende';
          return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 hover:shadow-md transition-all flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', threshColorBg)}>
                  <Target className={cn('w-4 h-4', threshColorIcon)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Kritik Eşik</p>
                  <p className={cn('text-base font-bold tabular-nums leading-none', threshColorTxt)}>
                    {safe ? `+${fmt(diff)}` : `-${fmt(Math.abs(diff))}`}
                  </p>
                  <p className={cn('text-[10px] font-semibold mt-0.5 leading-none', threshColorTxt)}>{threshLabel}</p>
                </div>
              </div>
              <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="absolute top-0 left-1/2 w-px h-full bg-slate-400 z-10" />
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${barPct}%`, backgroundColor: threshBarColor }} />
              </div>
              <div className="flex justify-between text-[7px] text-slate-400 font-medium">
                <span>₺0</span>
                <span className="text-slate-500 font-bold">Min ₺{CASH_THRESHOLD.toLocaleString('tr-TR')}</span>
                <span>₺{(CASH_THRESHOLD * 2).toLocaleString('tr-TR')}</span>
              </div>
            </div>
          );
        })()}

        {/* 4. Sepet Ortalaması */}
        <KPICard
          label="Sepet Ortalaması"
          value={basketStats.avg > 0 ? fmt(basketStats.avg) : '—'}
          sub={basketStats.count > 0 ? `${basketStats.count} POS satışından` : 'Dönemde POS satışı yok'}
          icon={Receipt}
          iconBg="bg-indigo-100"
          iconColor="text-indigo-600"
        />
      </div>

      {/* ── DÖNEM ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <PeriodBar value={period} onChange={setPeriod} />
      </div>

      {/* ── KASA GÖRSEL ÖZET (Alacaklar) ── */}
      <div className="grid grid-cols-1 gap-4">
        <DebtCard
            receivableTxs={debtStats.receivableTxs}
            receivable={debtStats.receivable}
            receivableCount={debtStats.receivableCount}
            payableTxs={debtStats.payableTxs}
            payable={debtStats.payable}
            payableCount={debtStats.payableCount}
            onCollect={(tx, type) => { setCollectionTx(tx); setCollectionType(type); }}
          />
      </div>



      {/* Modallar */}
      {collectionTx && (
        <CollectionModal
          tx={collectionTx}
          txType={collectionType}
          onClose={() => setCollectionTx(null)}
          onSaved={load}
        />
      )}

    </div>
  );
}
