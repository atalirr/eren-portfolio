import { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp, ShoppingBag, RefreshCw, BarChart3, ChevronDown, Calendar,
  Download, Search, ChevronLeft, ChevronRight, Package, ArrowUpRight,
  Sparkles, AlertTriangle, AlertOctagon, CheckCircle2, Zap, Award,
  Lightbulb, Target
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { analyticsApi } from '../services/analyticsApi';
import { salesApi, StockAdvisoryResponse, StockAdvisoryItem } from '../../sales/services/salesApi';
import { transactionsApi, TrendData } from '../../transactions/services/transactionsApi';
import { financeApi } from '../../finance/services/financeApi';
import { inventoryApi } from '../../inventory/services/inventoryApi';
import { cn } from '@/shared/utils/cn';

// ── Formatters ──────────────────────────────────────────────────────────────
const fmt  = (n: number) => `₺${(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
const fmtK = (n: number) => n >= 1_000_000 ? `₺${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `₺${(n / 1000).toFixed(1)}B` : fmt(n);

// ── Period config ────────────────────────────────────────────────────────────
const PERIODS = [
  { key: 'weekly',   label: 'Haftalık' },
  { key: '1month',   label: '1 Aylık' },
  { key: '3months',  label: '3 Aylık' },
  { key: '6months',  label: '6 Aylık' },
  { key: '1year',    label: '1 Yıllık' },
  { key: '3years',   label: '3 Yıllık' },
] as const;
type Period = typeof PERIODS[number]['key'];

const TR_DAYS_FULL = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const TR_MONTHS_FULL = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function dayLabel(dateStr: string, period: Period): string {
  const d = new Date(dateStr);
  if (period === '1month') {
    return `${d.getDate()} ${TR_MONTHS_FULL[d.getMonth()]}`;
  }
  return TR_DAYS_FULL[d.getDay()];
}

function monthLabel(monthStr: string, period?: Period): string {
  const [year, mon] = monthStr.split('-');
  const monthName = TR_MONTHS_FULL[parseInt(mon) - 1];
  if (period === '3months' || period === '6months') {
    return monthName;
  }
  return `${monthName} '${year.slice(2)}`;
}

function formatWeekLabel(weekStr: string): string {
  if (!weekStr) return '';
  if (weekStr.includes('-W')) {
    const [year, week] = weekStr.split('-W');
    return `${week}. Hft '${year.slice(2)}`;
  }
  if (weekStr.includes('W')) {
    const parts = weekStr.split('W');
    return `${parts[1] || parts[0]}. Hft`;
  }
  return weekStr;
}

// ── 2D Saatlik Isı Haritası ───────────────────────────────────────────────────
const DAYS_EN   = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_TR   = ['Pzt','Sal','Çar','Per','Cum','Cmt'];
const HEAT_HOURS = [9,10,11,12,13,14,15,16,17,18,19];

function HeatmapCard({ density, basketAvg, txCount, borderless }: {
  density: Record<string, number>;
  basketAvg: number;
  txCount: number;
  borderless?: boolean;
}) {
  const grid: Record<string, Record<number, number>> = {};
  DAYS_EN.forEach(d => { grid[d] = {}; });

  Object.entries(density).forEach(([key, count]) => {
    const idx = key.lastIndexOf('_');
    if (idx === -1) return;
    const day  = key.substring(0, idx);
    const hour = parseInt(key.substring(idx + 1), 10);
    if (grid[day] !== undefined && HEAT_HOURS.includes(hour)) {
      grid[day][hour] = (grid[day][hour] || 0) + count;
    }
  });

  const allCounts = DAYS_EN.flatMap(d => HEAT_HOURS.map(h => grid[d][h] || 0));
  const maxCount  = Math.max(1, ...allCounts);

  let peakDayTR = '', peakHour = 0, peakCount = 0;
  DAYS_EN.forEach((day, di) => {
    HEAT_HOURS.forEach(h => {
      const c = grid[day][h] || 0;
      if (c > peakCount) { peakCount = c; peakHour = h; peakDayTR = DAYS_TR[di]; }
    });
  });

  const fmt2 = (h: number) => h < 10 ? `0${h}` : `${h}`;

  const getCellBg = (intensity: number, count: number) => {
    if (count === 0) return '#f8fafc';
    if (intensity < 0.25) return '#e0e7ff';
    if (intensity < 0.5) return '#a5b4fc';
    if (intensity < 0.75) return '#6366f1';
    if (intensity < 0.9) return '#4f46e5';
    return '#4338ca';
  };

  const getTextColor = (intensity: number, count: number) => {
    if (count === 0) return 'transparent';
    return intensity > 0.4 ? '#ffffff' : '#4f46e5';
  };

  return (
    <div className={cn(
      "flex flex-col",
      borderless
        ? "bg-transparent"
        : "bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden h-fit"
    )}>
      <div className={cn(
        "px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-white",
        borderless && "bg-transparent px-0 pt-0 pb-3"
      )}>
        <div>
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Saatlik Isı Haritası</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">Müşteri yoğunluk saatleri (Pzt–Cmt, 09:00–19:00)</p>
        </div>
      </div>

      <div className={cn(
        "flex-1 flex flex-col justify-between",
        borderless ? "p-0 pt-3" : "p-4"
      )}>
        <div className="flex flex-col items-center justify-center w-full">
          <div className="flex items-center mb-2 gap-0.5 w-full max-w-[270px]">
            <div className="w-8 shrink-0" />
            {HEAT_HOURS.map(h => (
              <div key={h} className="w-[18px] text-center text-[8px] font-bold text-slate-400 leading-none shrink-0">
                {fmt2(h)}
              </div>
            ))}
          </div>

          <div className="space-y-1 w-full max-w-[270px]">
            {DAYS_EN.map((day, di) => (
              <div key={day} className="flex items-center gap-0.5">
                <div className="w-8 shrink-0 text-[9px] font-bold text-slate-500 text-right pr-1.5">
                  {DAYS_TR[di]}
                </div>
                {HEAT_HOURS.map(h => {
                  const count     = grid[day][h] || 0;
                  const intensity = count / maxCount;
                  return (
                    <div
                      key={h}
                      title={`${DAYS_TR[di]} ${fmt2(h)}:00 — ${count} işlem`}
                      className="w-[18px] h-[18px] rounded flex items-center justify-center text-[7px] font-black cursor-pointer transition-all hover:scale-110 select-none border shrink-0"
                      style={{
                        backgroundColor: getCellBg(intensity, count),
                        color: getTextColor(intensity, count),
                        borderColor: count > 0 ? 'rgba(99,102,241,0.1)' : 'rgba(226,232,240,0.4)'
                      }}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 border-t border-slate-100 pt-3">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Düşük</span>
          <div className="flex gap-1.5">
            {['#e0e7ff', '#a5b4fc', '#6366f1', '#4f46e5', '#4338ca'].map((color, i) => (
              <div key={i} className="w-4 h-4 rounded shadow-xs border border-black/5" style={{ backgroundColor: color }} />
            ))}
          </div>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Yoğun</span>
        </div>

        {peakCount > 0 && (
          <div className="mt-4 bg-slate-900 rounded-xl p-3 shadow-xs">
            <p className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider mb-0.5">En Yoğun Zaman Dilimi</p>
            <p className="text-sm font-black text-white leading-tight">
              {peakDayTR} günü saat {fmt2(peakHour)}:00
            </p>
            <p className="text-[10px] text-indigo-200 mt-0.5 font-medium">Toplam {peakCount} işlem gerçekleşti</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Official Minimal KPI Card ────────────────────────────────────────────────
function KPICard({
  label,
  value,
  subtext,
  badgeText,
  valueColor = "text-slate-900"
}: {
  label: string;
  value: string;
  subtext?: string;
  badgeText?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
          {label}
        </span>
        {badgeText && (
          <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap shrink-0">
            {badgeText}
          </span>
        )}
      </div>
      <div className="mt-1">
        <div className={`text-xl font-bold tracking-tight ${valueColor}`}>
          {value}
        </div>
        {subtext && (
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Period Tab ───────────────────────────────────────────────────────────────
function PeriodTabs({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const activeOption = PERIODS.find(o => o.key === value) || PERIODS[0];

  return (
    <div ref={dropdownRef} className="relative z-20 font-sans">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-700 transition shadow-xs cursor-pointer"
      >
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        {activeOption.label}
        <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-40 bg-white rounded-xl border border-slate-200 shadow-lg z-30 py-1 overflow-hidden">
          {PERIODS.map(o => (
            <button
              key={o.key}
              onClick={() => { onChange(o.key); setIsOpen(false); }}
              className={cn(
                'w-full px-3.5 py-1.5 text-left text-xs font-medium transition-colors hover:bg-slate-50 cursor-pointer',
                value === o.key ? 'text-indigo-600 bg-indigo-50/50 font-semibold' : 'text-slate-600'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Chart Tooltip ────────────────────────────────────────────────────────────
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const income = payload[0]?.value ?? 0;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl px-3.5 py-2.5 text-white min-w-[140px] backdrop-blur-md bg-opacity-95">
      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 border-b border-slate-800 pb-1">{label}</p>
      <div className="flex justify-between gap-6">
        <span className="text-[10px] text-slate-400 font-bold">Toplam Ciro</span>
        <span className="text-[10px] font-black text-emerald-400 tabular-nums">{fmt(income)}</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function ReportsPage() {
  const [period, setPeriod] = useState<Period>(() => {
    const saved = localStorage.getItem('reports-period-key');
    return (saved as Period) || '1month';
  });

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    localStorage.setItem('reports-period-key', newPeriod);
  };
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<Array<{ label: string; income: number; expense: number; profit: number }>>([]);
  const [productAnalysis, setProductAnalysis] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [healthMetrics, setHealthMetrics] = useState<any>(null);
  const [inventoryKPIs, setInventoryKPIs] = useState<any>(null);
  const [kpi, setKpi] = useState({ revenue: 0, expense: 0, profit: 0, basketAvg: 0, txCount: 0 });

  // AI Danışmanı State (Milestone 2 - R2)
  const [aiAdvisory, setAiAdvisory] = useState<StockAdvisoryResponse | null>(null);
  const [isAiActive, setIsAiActive] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiFilter, setAiFilter] = useState<'ALL' | 'CRITICAL_ORDER' | 'STAR' | 'DEAD_STOCK'>('ALL');
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

  // Tablo arama & sayfalama
  const [prodSearch, setProdSearch] = useState('');
  const [prodPage, setProdPage] = useState(1);
  const prodPageSize = 10;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [rawTrend, products, stats, health, invKPIs] = await Promise.all([
          period === '3years'
            ? transactionsApi.getMonthlyTrend(36).catch(() => [] as TrendData[])
            : period === '1year'
            ? transactionsApi.getMonthlyTrend(12).catch(() => [] as TrendData[])
            : period === '6months'
            ? transactionsApi.getMonthlyTrend(6).catch(() => [] as TrendData[])
            : period === '3months'
            ? transactionsApi.getMonthlyTrend(3).catch(() => [] as TrendData[])
            : period === '1month'
            ? transactionsApi.getDailyTrend(30).catch(() => [] as TrendData[])
            : transactionsApi.getDailyTrend(7).catch(() => [] as TrendData[]),
          salesApi.getProductSalesAnalysis().catch(() => []),
          analyticsApi.getAllStats().catch(() => null),
          financeApi.getHealthMetrics().catch(() => null),
          inventoryApi.getKPIs().catch(() => null),
        ]);
        if (cancelled) return;

        // Build chart data
        const chart = rawTrend.map((d: any) => {
          const label = d.month
            ? monthLabel(d.month, period)
            : d.date
            ? dayLabel(d.date, period)
            : d.week ? formatWeekLabel(d.week) : '';
          const income  = Number(d.income)  || 0;
          const expense = Number(d.expense) || 0;
          const profit  = d.gross_profit !== undefined ? Number(d.gross_profit) : (income - expense);
          return { label, income, expense, profit };
        });

        const totalRevenue = chart.reduce((s, d) => s + d.income, 0);
        const totalExpense = chart.reduce((s, d) => s + d.expense, 0);
        const productProfit = (products as any[]).reduce((s: number, p: any) => s + (Number(p.profit) || 0), 0);
        const totalProfit  = productProfit > 0 ? productProfit : (totalRevenue - totalExpense);
        const totalSales   = (products as any[]).reduce((s: number, p: any) => s + (p.salesCount || 0), 0);
        const basketAvg    = totalSales > 0 ? totalRevenue / totalSales : 0;

        setChartData(chart);
        setProductAnalysis(products || []);
        setAnalytics(stats);
        setHealthMetrics(health);
        setInventoryKPIs(invKPIs);

        const txCount = (products as any[]).length > 0 ? (products as any[]).length : (stats?.today?.order_count ?? 0);
        setKpi({
          revenue: totalRevenue,
          expense: totalExpense,
          profit: totalProfit,
          basketAvg: basketAvg,
          txCount: txCount,
        });

      } catch (err) {
        console.error('Veri yükleme hatası:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [period]);

  // AI Analizini Başlat / Kapat
  const handleToggleAiAnalysis = async () => {
    if (isAiActive) {
      setIsAiActive(false);
      return;
    }

    setIsAiActive(true);
    if (!aiAdvisory) {
      await handleRefreshAiAnalysis();
    }
  };

  // AI Analizini Yeniden Çalıştır (Canlı Gemini Sorgusu)
  const handleRefreshAiAnalysis = async () => {
    setAiLoading(true);
    try {
      const adv = await salesApi.getStockAdvisory();
      setAiAdvisory(adv);
      if (adv && adv.items && adv.items.length > 0) {
        setProductAnalysis(adv.items);
      }
    } catch (err) {
      console.error('AI Stok & Tedarik Danışmanı analizi alınamadı:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Gelir grafiği ölçeklendirme
  const yTicks = useMemo(() => {
    if (!chartData.length) return [0, 5000];
    const maxVal = Math.max(...chartData.map(d => d.income), 1000);
    const ticks = [];
    for (let val = 1000; val <= maxVal; val += 2000) {
      ticks.push(val);
    }
    return ticks;
  }, [chartData]);

  // Isı Haritası Yoğunluk Verisi
  const hourlyDensity: Record<string, number> = analytics?.shop?.hourly_density ?? {};

  // Ürün Filtreleme (AI Kategori Filtresi & Arama) & Sayfalama
  const filteredProducts = useMemo(() => {
    let list = productAnalysis;

    // AI Hızlı Filtreleri
    if (isAiActive && aiFilter !== 'ALL') {
      list = list.filter((p: any) => {
        if (aiFilter === 'CRITICAL_ORDER') {
          return p.classification === 'CRITICAL_ORDER' || p.is_critical || (p.reorder_point && p.stock <= p.reorder_point);
        }
        if (aiFilter === 'STAR') {
          return p.classification === 'STAR' || p.is_star;
        }
        if (aiFilter === 'DEAD_STOCK') {
          return p.classification === 'DEAD_STOCK' || p.is_dead_stock || (p.sold_90d === 0 && p.stock > 0);
        }
        return true;
      });
    }

    // Metin Arama
    if (!prodSearch.trim()) return list;
    const q = prodSearch.toLowerCase();
    return list.filter((p: any) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }, [productAnalysis, prodSearch, isAiActive, aiFilter]);

  const totalProdPages = Math.max(1, Math.ceil(filteredProducts.length / prodPageSize));
  const paginatedProducts = useMemo(() => {
    const start = (prodPage - 1) * prodPageSize;
    return filteredProducts.slice(start, start + prodPageSize);
  }, [filteredProducts, prodPage, prodPageSize]);

  const handleExportExcel = () => {
    if (!filteredProducts.length) return;
    const rows = filteredProducts.map((p: any) => {
      const margin = p.totalRevenue > 0 ? ((p.profit / p.totalRevenue) * 100).toFixed(1) + '%' : '0%';
      return {
        'Ürün Adı': p.name || '-',
        'Marka': p.brand || '-',
        'Kategori': p.category || '-',
        'Satış Adedi': p.salesCount || 0,
        'Toplam Satış (₺)': p.totalRevenue || 0,
        'Toplam Maliyet (₺)': p.totalCost || 0,
        'Net Kâr (₺)': p.profit || 0,
        'Kâr Marjı': margin,
        'Stok Miktarı': p.stock || 0,
        ...(p.reorder_point !== undefined ? {
          'Güvenlik Eşiği (ROP)': p.reorder_point,
          'Güvenlik Stoğu (SS)': p.safety_stock,
          'Önerilen Sipariş (ROQ)': p.recommended_order_qty,
          'Günlük Talep (D)': p.daily_demand ?? '-',
          'AI Sınıfı': p.badge?.label || p.classification || '-',
          'AI Eylem Tavsiyesi': p.advice || '-',
        } : {}),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ürün Satış ve Kârlılık');
    XLSX.writeFile(wb, `Urun_Satis_ve_Karlilik_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* ── Üst Araç Çubuğu (Dönem Seçimi & Excel İndirme) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-slate-700">Dönem Analizi:</div>
          <PeriodTabs value={period} onChange={handlePeriodChange} />
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              <span>Güncelleniyor...</span>
            </div>
          )}
        </div>

        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          title="Ürün Raporunu Excel Olarak İndir"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span>Excel İndir</span>
        </button>
      </div>

      {/* ── 4 KPI KARTI ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Toplam Ciro (Satış)"
          value={fmt(kpi.revenue)}
          badgeText={`${kpi.txCount} İşlem`}
          subtext="Seçilen dönemdeki brüt hasılat"
          valueColor="text-slate-900"
        />
        <KPICard
          label="Tahmini Brüt Kâr"
          value={fmt(kpi.profit)}
          badgeText={kpi.revenue > 0 ? `%${((kpi.profit / kpi.revenue) * 100).toFixed(1)} Marj` : '%0 Marj'}
          subtext="Ciro ve maliyet arasındaki brüt fark"
          valueColor="text-emerald-600"
        />
        <KPICard
          label="Ortalama Sepet"
          value={fmt(kpi.basketAvg)}
          badgeText="İşlem Başı"
          subtext="Fiş başına düşen ortalama tutar"
          valueColor="text-slate-900"
        />
        <KPICard
          label="Kritik Stok Uyarısı"
          value={`${inventoryKPIs?.criticalStockCount ?? 0} Ürün`}
          badgeText="Acil Sipariş"
          subtext="Kritik eşiğin altına inenler"
          valueColor={(inventoryKPIs?.criticalStockCount ?? 0) > 0 ? "text-rose-600" : "text-slate-900"}
        />
      </div>

      {/* ── GELİR GRAFİĞİ + SAATLİK YOĞUNLUK ISI HARİTASI ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Satış ve Hasılat Trendi */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Satış & Hasılat Trendi</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Zaman içindeki brüt satış hacmi performansı</p>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-bold">
              <TrendingUp className="w-3 h-3" />
              <span>Ciro Artışı</span>
            </div>
          </div>

          <div className="h-56 mt-4">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-300 text-xs font-medium">
                Bu dönem için veri bulunamadı
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCiro" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: '#f1f5f9' }}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                  />
                  <YAxis
                    ticks={yTicks}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={fmtK}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area
                    type="linear"
                    dataKey="income"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorCiro)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Saatlik Yoğunluk Isı Haritası */}
        <HeatmapCard density={hourlyDensity} basketAvg={kpi.basketAvg} txCount={kpi.txCount} />
      </div>

      {/* ── ÜRÜN SATIŞ VE KÂRLILIK ANALİZİ & AI STOK VE TEDARİK DANIŞMANI ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        {/* Üst Başlık & Eylem Çubuğu */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Ürün Satış ve Kârlılık Analizi
              </h3>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                {filteredProducts.length} Ürün
              </span>
            </div>

            {/* AI ile Analiz Et Butonu */}
            <button
              onClick={handleToggleAiAnalysis}
              disabled={aiLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isAiActive
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-800 hover:bg-slate-900 text-white shadow-xs'
              }`}
              title="Yapay Zeka (AI) Stok ve Tedarik Danışmanını Çalıştır"
            >
              {aiLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className={`w-3.5 h-3.5 ${isAiActive ? 'text-indigo-500' : 'text-slate-300'}`} />
              )}
              <span>{aiLoading ? 'Analiz Ediliyor...' : isAiActive ? 'AI Açık' : 'AI ile Analiz Et'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={prodSearch}
                onChange={e => { setProdSearch(e.target.value); setProdPage(1); }}
                placeholder="Ürün adı veya kategori..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:bg-white w-56 transition"
              />
            </div>
          </div>
        </div>

        {/* AI Danışmanı — Sade Tasarım */}
        {isAiActive && aiAdvisory && (
          <div className="border-b border-slate-200">
            {/* Üst Bilgi Çubuğu */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  AI Stok & Tedarik Danışmanı
                </h4>
                {aiAdvisory.gemini_analysis?.gemini_powered && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Gemini 2.5 Flash
                  </span>
                )}
              </div>
              <button
                onClick={handleRefreshAiAnalysis}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${aiLoading ? 'animate-spin text-indigo-500' : 'text-slate-400'}`} />
                <span>{aiLoading ? 'Yenileniyor...' : 'Yenile'}</span>
              </button>
            </div>

            {/* 4 KPI Kartı — Sade */}
            <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Analiz Edilen</span>
                  <Package className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
                  {aiAdvisory.summary.total_products} <span className="text-xs font-normal text-slate-400">ürün</span>
                </div>
              </div>
              <div className="bg-white px-3.5 py-2.5 rounded-xl border border-indigo-100 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wider">Yıldız</span>
                  <Award className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="mt-1 text-xl font-bold text-indigo-700 tabular-nums">
                  {aiAdvisory.summary.star_count} <span className="text-xs font-normal text-indigo-400">ürün</span>
                </div>
              </div>
              <div className="bg-white px-3.5 py-2.5 rounded-xl border border-rose-100 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-rose-500 uppercase tracking-wider">Acil Sipariş</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div className="mt-1 text-xl font-bold text-rose-600 tabular-nums">
                  {aiAdvisory.summary.critical_count} <span className="text-xs font-normal text-rose-400">ürün</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{aiAdvisory.summary.total_reorder_qty} adet ikmal</div>
              </div>
              <div className="bg-white px-3.5 py-2.5 rounded-xl border border-amber-100 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Ölü Stok</span>
                  <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="mt-1 text-xl font-bold text-amber-700 tabular-nums">
                  {aiAdvisory.summary.dead_stock_count} <span className="text-xs font-normal text-amber-400">ürün</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">₺{(aiAdvisory.summary.total_dead_stock_value || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} atıl sermaye</div>
              </div>
            </div>

            {/* Gemini AI Detaylı Rapor Alanı */}
            {aiAdvisory.gemini_analysis && (
              <div className="px-4 pb-4 space-y-4">

                {/* Genel Durum & Sağlık Notu */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Genel Değerlendirme</h5>
                  </div>
                  <p className="text-[12px] text-slate-700 leading-relaxed">
                    {aiAdvisory.gemini_analysis.executive_summary}
                  </p>
                  {aiAdvisory.gemini_analysis.health_note && (
                    <div className="mt-2 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{aiAdvisory.gemini_analysis.health_note}</span>
                    </div>
                  )}
                </div>

                {/* En Çok Satan Ürünler Tablosu */}
                {aiAdvisory.gemini_analysis.top_sellers && aiAdvisory.gemini_analysis.top_sellers.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">En Çok Satan Ürünler & Stok Önerileri</h5>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                            <th className="text-left px-3 py-2 font-semibold">Ürün Adı</th>
                            <th className="text-right px-3 py-2 font-semibold">30g Satış</th>
                            <th className="text-right px-3 py-2 font-semibold">90g Satış</th>
                            <th className="text-right px-3 py-2 font-semibold">Mevcut Stok</th>
                            <th className="text-right px-3 py-2 font-semibold">Önerilen</th>
                            <th className="text-left px-3 py-2 font-semibold">Tavsiye</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {aiAdvisory.gemini_analysis.top_sellers.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 transition">
                              <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.sold_30d}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.sold_90d}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.current_stock}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-indigo-600">{item.recommended_stock}</td>
                              <td className="px-3 py-2 text-slate-500 max-w-[200px]">{item.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Acil Sipariş Gereken Ürünler Tablosu */}
                {aiAdvisory.gemini_analysis.critical_orders && aiAdvisory.gemini_analysis.critical_orders.length > 0 && (
                  <div className="bg-white rounded-xl border border-rose-100 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-rose-100 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Acil Sipariş Gereken Ürünler</h5>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-rose-50/50 text-slate-500 uppercase tracking-wider">
                            <th className="text-left px-3 py-2 font-semibold">Ürün Adı</th>
                            <th className="text-right px-3 py-2 font-semibold">Mevcut Stok</th>
                            <th className="text-right px-3 py-2 font-semibold">Sipariş Adedi</th>
                            <th className="text-center px-3 py-2 font-semibold">Aciliyet</th>
                            <th className="text-left px-3 py-2 font-semibold">Not</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {aiAdvisory.gemini_analysis.critical_orders.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-rose-50/30 transition">
                              <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-rose-600 font-semibold">{item.current_stock}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">{item.order_qty}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                  item.urgency === 'Acil' ? 'bg-rose-100 text-rose-700' :
                                  item.urgency === 'Orta' ? 'bg-amber-100 text-amber-700' :
                                  'bg-slate-100 text-slate-600'
                                }`}>{item.urgency}</span>
                              </td>
                              <td className="px-3 py-2 text-slate-500 max-w-[200px]">{item.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3 Aylık Tedarik Planı & Stratejik Öneriler — Yan Yana */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* 3 Aylık Tahmin */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">3 Aylık Tedarik Planı</h5>
                    </div>
                    <p className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-line">
                      {aiAdvisory.gemini_analysis.quarterly_forecast}
                    </p>
                  </div>

                  {/* Stratejik Öneriler */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-3.5 h-3.5 text-indigo-500" />
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Stratejik Öneriler</h5>
                    </div>
                    <ul className="space-y-2">
                      {aiAdvisory.gemini_analysis.strategic_recommendations?.map((rec: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-[12px] text-slate-700 leading-relaxed">
                          <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-indigo-100">
                            {idx + 1}
                          </span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Ölü Stok Tablosu & Strateji */}
                {aiAdvisory.gemini_analysis.top_dead_stock && aiAdvisory.gemini_analysis.top_dead_stock.length > 0 && (
                  <div className="bg-white rounded-xl border border-amber-100 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-amber-100 flex items-center gap-2">
                      <AlertOctagon className="w-3.5 h-3.5 text-amber-500" />
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ölü Stok Ürünleri & Tasfiye Önerisi</h5>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-amber-50/50 text-slate-500 uppercase tracking-wider">
                            <th className="text-left px-3 py-2 font-semibold">Ürün Adı</th>
                            <th className="text-right px-3 py-2 font-semibold">Stok</th>
                            <th className="text-right px-3 py-2 font-semibold">Bağlı Sermaye</th>
                            <th className="text-left px-3 py-2 font-semibold">Tasfiye Önerisi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {aiAdvisory.gemini_analysis.top_dead_stock.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-amber-50/30 transition">
                              <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.stock}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-700">
                                ₺{(item.capital_tied || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="px-3 py-2 text-slate-500 max-w-[250px]">{item.suggestion}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {aiAdvisory.gemini_analysis.dead_stock_strategy && (
                      <div className="px-4 py-3 bg-amber-50/50 border-t border-amber-100">
                        <p className="text-[11px] text-slate-700 leading-relaxed">
                          <span className="font-bold text-amber-700">Genel Tasfiye Stratejisi: </span>
                          {aiAdvisory.gemini_analysis.dead_stock_strategy}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Hızlı Filtre Butonları */}
        {isAiActive && (
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Filtre:</span>
            <button
              onClick={() => { setAiFilter('ALL'); setProdPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                aiFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Tümü ({productAnalysis.length})
            </button>
            <button
              onClick={() => { setAiFilter('CRITICAL_ORDER'); setProdPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                aiFilter === 'CRITICAL_ORDER'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Acil Sipariş ({aiAdvisory?.summary?.critical_count ?? productAnalysis.filter((p: any) => p.is_critical || p.classification === 'CRITICAL_ORDER').length})
            </button>
            <button
              onClick={() => { setAiFilter('STAR'); setProdPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                aiFilter === 'STAR'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-500" />
              Yıldız Ürünler ({aiAdvisory?.summary?.star_count ?? productAnalysis.filter((p: any) => p.is_star || p.classification === 'STAR').length})
            </button>
            <button
              onClick={() => { setAiFilter('DEAD_STOCK'); setProdPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                aiFilter === 'DEAD_STOCK'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <AlertOctagon className="w-3 h-3 text-amber-500" />
              Ölü Stok Riski ({aiAdvisory?.summary?.dead_stock_count ?? productAnalysis.filter((p: any) => p.is_dead_stock || p.classification === 'DEAD_STOCK').length})
            </button>
          </div>
        )}

        {/* Tablo */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100/85 text-[10px] font-bold text-slate-600 uppercase tracking-wider divide-x divide-slate-200 border-b border-slate-300">
                <th className="py-2.5 px-3">Ürün Adı</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-3 text-right">Satış Adedi</th>
                <th className="py-2.5 px-3 text-right">Toplam Hasılat</th>
                <th className="py-2.5 px-3 text-right">Toplam Maliyet</th>
                <th className="py-2.5 px-3 text-right">Brüt Kâr</th>
                <th className="py-2.5 px-3 text-center">Kâr Marjı</th>
                <th className="py-2.5 px-3 text-center">Kalan Stok</th>
                {isAiActive && (
                  <>
                    <th className="py-2.5 px-3 text-center bg-purple-50/60 text-purple-900">ROP (Güvenlik)</th>
                    <th className="py-2.5 px-3 text-center bg-purple-50/60 text-purple-900">Önerilen Sipariş (ROQ)</th>
                    <th className="py-2.5 px-3 text-center bg-purple-50/60 text-purple-900">AI Danışman Tavsiyesi</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={isAiActive ? 11 : 8} className="py-8 text-center text-slate-400">
                    Kayıtlı ürün satış verisi bulunamadı.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((prod: any, idx: number) => {
                  const margin = prod.totalRevenue > 0
                    ? ((prod.profit / prod.totalRevenue) * 100).toFixed(1)
                    : '0';
                  return (
                    <tr
                      key={prod.id || idx}
                      className={`divide-x divide-slate-200 hover:bg-sky-50/60 transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                      }`}
                    >
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        <div className="truncate max-w-[280px]" title={prod.name}>
                          {prod.name}
                        </div>
                        {prod.brand && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            {prod.brand}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-500 font-medium whitespace-nowrap">
                        {prod.category || 'Genel'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap">
                        {prod.salesCount || 0}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {fmt(prod.totalRevenue || 0)}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-500 tabular-nums whitespace-nowrap">
                        {fmt(prod.totalCost || 0)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600 tabular-nums whitespace-nowrap">
                        {fmt(prod.profit || 0)}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className="text-[11px] font-bold text-emerald-700">
                          %{margin}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className={`text-[11px] font-semibold ${
                          (prod.stock || 0) <= 5 ? 'text-rose-600 font-bold' : 'text-slate-600'
                        }`}>
                          {prod.stock || 0}
                        </span>
                      </td>

                      {/* AI Kolonları */}
                      {isAiActive && (
                        <>
                          {/* ROP & SS */}
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-bold text-slate-800 text-xs tabular-nums">
                                ROP: {prod.reorder_point ?? '-'}
                              </span>
                              <span className="text-[10px] text-slate-400 tabular-nums">
                                SS: {prod.safety_stock ?? '-'}
                              </span>
                            </div>
                          </td>

                          {/* Önerilen Sipariş (ROQ) */}
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {(prod.recommended_order_qty || 0) > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-xs bg-rose-50 text-rose-700 border border-rose-200 tabular-nums">
                                {prod.recommended_order_qty} adet
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">0 adet</span>
                            )}
                          </td>

                          {/* AI Tavsiye Rozeti & Popover */}
                          <td className="py-2 px-3 text-center whitespace-nowrap relative">
                            <div
                              className="inline-block"
                              onMouseEnter={() => setActivePopoverId(prod.id)}
                              onMouseLeave={() => setActivePopoverId(null)}
                            >
                              <button
                                onClick={() => setActivePopoverId(activePopoverId === prod.id ? null : prod.id)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer shadow-2xs ${
                                  prod.badge?.color === 'red' || prod.classification === 'CRITICAL_ORDER'
                                    ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200 ring-2 ring-rose-400/20'
                                    : prod.badge?.color === 'purple' || prod.classification === 'STAR'
                                    ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                                    : prod.badge?.color === 'amber' || prod.classification === 'DEAD_STOCK'
                                    ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                    : prod.badge?.color === 'blue' || prod.classification === 'VOLUME'
                                    ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                }`}
                              >
                                {prod.badge?.color === 'red' || prod.classification === 'CRITICAL_ORDER' ? (
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                ) : prod.badge?.color === 'purple' || prod.classification === 'STAR' ? (
                                  <Sparkles className="w-3 h-3 text-purple-600" />
                                ) : prod.badge?.color === 'amber' || prod.classification === 'DEAD_STOCK' ? (
                                  <AlertOctagon className="w-3 h-3 text-amber-600" />
                                ) : prod.badge?.color === 'blue' || prod.classification === 'VOLUME' ? (
                                  <Zap className="w-3 h-3 text-blue-600" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                )}
                                <span>
                                  {prod.badge?.label || (
                                    prod.classification === 'CRITICAL_ORDER'
                                      ? 'Acil Sipariş'
                                      : prod.classification === 'STAR'
                                      ? 'Yıldız Ürün'
                                      : prod.classification === 'DEAD_STOCK'
                                      ? 'Ölü Stok Riski'
                                      : prod.classification === 'VOLUME'
                                      ? 'Sürüm Ürünü'
                                      : 'Dengeli Stok'
                                  )}
                                </span>
                              </button>

                              {/* Popover / Tooltip */}
                              {activePopoverId === prod.id && (
                                <div className="absolute right-0 bottom-full mb-2 w-80 sm:w-96 p-4 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 z-50 text-left text-xs animate-in fade-in zoom-in-95 duration-150">
                                  <div className="flex items-start justify-between gap-2 border-b border-slate-700 pb-2 mb-2.5">
                                    <div>
                                      <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" /> AI Tedarik Değerlendirmesi
                                      </div>
                                      <div className="font-bold text-sm text-white mt-0.5 truncate max-w-[220px]">
                                        {prod.name}
                                      </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      prod.badge?.color === 'red' || prod.classification === 'CRITICAL_ORDER'
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                        : prod.badge?.color === 'purple' || prod.classification === 'STAR'
                                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                        : prod.badge?.color === 'amber' || prod.classification === 'DEAD_STOCK'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    }`}>
                                      {prod.badge?.label || prod.classification}
                                    </span>
                                  </div>

                                  {/* Hız & Parametreler Grid */}
                                  <div className="grid grid-cols-2 gap-2 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60 mb-2.5 text-[11px]">
                                    <div>
                                      <span className="text-slate-400">Günlük Talep (D):</span>
                                      <span className="font-bold text-slate-200 ml-1 tabular-nums">{prod.daily_demand ?? '-'} /gün</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Kalan Stok Ömrü:</span>
                                      <span className="font-bold text-slate-200 ml-1 tabular-nums">
                                        {prod.days_remaining !== null && prod.days_remaining !== undefined ? `${prod.days_remaining} gün` : 'Durgun'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Güvenlik Stoğu (SS):</span>
                                      <span className="font-bold text-slate-200 ml-1 tabular-nums">{prod.safety_stock ?? '-'} adet</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Sipariş Eşiği (ROP):</span>
                                      <span className="font-bold text-amber-300 ml-1 tabular-nums">{prod.reorder_point ?? '-'} adet</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">30g Hız (V30):</span>
                                      <span className="font-bold text-slate-200 ml-1 tabular-nums">{prod.v_30 ?? '-'} /gün</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Önerilen Sipariş:</span>
                                      <span className={`font-bold ml-1 tabular-nums ${prod.recommended_order_qty > 0 ? 'text-rose-400 font-black' : 'text-emerald-400'}`}>
                                        {prod.recommended_order_qty ?? 0} adet
                                      </span>
                                    </div>
                                  </div>

                                  {/* AI Tavsiye Mesajı */}
                                  <div className="mb-2">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                      Eylem Tavsiyesi:
                                    </div>
                                    <p className="text-slate-200 leading-relaxed font-medium bg-slate-800/50 p-2 rounded-md border-l-2 border-indigo-500">
                                      {prod.advice || 'Özel bir eylem gerekmemektedir.'}
                                    </p>
                                  </div>

                                  {/* Gerekçe */}
                                  {prod.rationale && (
                                    <div className="text-[10px] text-slate-400 italic">
                                      <span className="font-semibold text-slate-300">Gerekçe: </span>
                                      {prod.rationale}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Sayfalama Çubuğu */}
        <div className="p-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 bg-white">
          <div>
            Toplam <span className="font-semibold text-slate-800">{filteredProducts.length}</span> üründen{' '}
            <span className="font-semibold text-slate-800">
              {filteredProducts.length > 0 ? (prodPage - 1) * prodPageSize + 1 : 0}
            </span>
            -
            <span className="font-semibold text-slate-800">
              {Math.min(prodPage * prodPageSize, filteredProducts.length)}
            </span>{' '}
            arası gösteriliyor
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setProdPage(p => Math.max(1, p - 1))}
              disabled={prodPage === 1}
              className="p-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Önceki Sayfa"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-slate-700 px-1">
              Sayfa {prodPage} / {totalProdPages}
            </span>
            <button
              onClick={() => setProdPage(p => Math.min(totalProdPages, p + 1))}
              disabled={prodPage >= totalProdPages}
              className="p-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Sonraki Sayfa"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
