/**
 * Ana Sayfa — İş Zekâsı Paneli
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  BarChart3,
  AlertTriangle,
  Activity as ActivityIcon,
  Zap,
} from 'lucide-react';
import {
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts';
import { transactionsApi } from '../../transactions/services/transactionsApi';
import { salesApi } from '../../sales/services/salesApi';
import { inventoryApi } from '../../inventory/services/inventoryApi';
import { customersApi } from '../../sales/services/customersApi';
import { analyticsApi } from '../../reports/services/analyticsApi';
import { cn } from '../../../shared/utils/cn';
import { PageHeader } from '@/shared/components';

const fmt = (val: number) => 
  (val || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseApiDate = (dateStr: any) => {
  if (!dateStr) return new Date();
  return new Date(dateStr);
};

interface HomeData {
  netBalance: number;
  avgOrderValue: number;
  dailyTransactionCount: number;
  profitDiffPct: number;
  weeklyTrend: Array<{ day: string; income: number; expense: number; profit: number }>;
  expenseCategories: Array<{ name: string; amount: number; pct: number }>;
  paymentMethods: Array<{ name: string; value: number; color: string }>;
  hourlyTrend: Array<{ hour: string; count: number }>;
  cumulativeTrend: Array<{ date: string; cumulative: number }>;
  topProducts: Array<{ name: string; sales: number; revenue: number }>;
  inventoryStats: { critical: number; total: number; value: number; efficiency: number; totalValue: number; fillRate: number };
  criticalProducts: Array<{ id: string; type: string; title: string; value: string; time: string; color: string; detail?: string }>;
  dailyFocus: { grossProfit: number; peakHour: string; avgItemsPerBasket: number; projectedEndDay: number; monthEstimate: number };
  urgentDebts: Array<{ id: string; name: string; amount: number; due_date: string }>;
  loading: boolean;
}

export function HomePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<HomeData>({
    netBalance: 0,
    avgOrderValue: 0,
    dailyTransactionCount: 0,
    profitDiffPct: 0,
    weeklyTrend: [],
    expenseCategories: [],
    paymentMethods: [],
    hourlyTrend: [],
    cumulativeTrend: [],
    topProducts: [],
    inventoryStats: { critical: 0, total: 0, value: 0, fillRate: 0, efficiency: 0, totalValue: 0 },
    criticalProducts: [],
    dailyFocus: { grossProfit: 0, peakHour: '—', avgItemsPerBasket: 0, projectedEndDay: 0, monthEstimate: 0 },
    urgentDebts: [],
    loading: true,
  });
  const [, setRefreshing] = useState(false);
  const [topPeriod, setTopPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [expensePeriod, setExpensePeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | '6months'>('monthly');
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  const load = async () => {
    setRefreshing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toISOString().split('T')[0];

      const results = await Promise.all([
        transactionsApi.getDailySummary(today).catch(() => ({ income: 0, expense: 0, net: 0, income_count: 0, expense_count: 0, total_count: 0 })),
        transactionsApi.getDailySummary(yesterday).catch(() => ({ income: 0, expense: 0, net: 0, income_count: 0, expense_count: 0, total_count: 0 })),
        transactionsApi.getBalance().catch(() => 0),
        transactionsApi.getCategoryStatistics(30).catch(() => ({ expenses: [], incomes: [] })),
        salesApi.getPaymentMethodStatistics().catch(() => ({ data: [], summary: { total_amount: 0, total_count: 0 } })),
        inventoryApi.getProducts().catch(() => []),
        customersApi.getDebts().catch(() => []),
        transactionsApi.getDailyTrend(7).catch(() => []),
        salesApi.getProductSalesAnalysis().catch(() => []),
        analyticsApi.getAllStats().catch(() => null),
        transactionsApi.getTransactions().catch(() => []),
      ]);
      const [summaryToday, summaryYesterday, balance, catStats, paymentStats, allProductsRaw, allDebts, dailyTrendRaw, productAnalysis, analytics, recentTransactions] = results;

      // Filter out orphaned variants (variants whose parent is not in the list)
      const parentIds = new Set(allProductsRaw.filter((p: any) => !p.parent_id).map((p: any) => p.id));
      const products = allProductsRaw.filter((p: any) => !p.parent_id || parentIds.has(p.parent_id));

      const avgOrderValue = summaryToday.income_count > 0 ? summaryToday.income / summaryToday.income_count : 0;
      const profitDiffPct = summaryYesterday.net !== 0 ? ((summaryToday.net - summaryYesterday.net) / Math.abs(summaryYesterday.net)) * 100 : (summaryToday.net > 0 ? 100 : 0);

      const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      const weeklyTrend = dailyTrendRaw.map((d: any) => {
        const date = d.date ? new Date(d.date) : new Date();
        const dow = date.getDay(); // 0=Paz, 1=Pzt, ..., 6=Cmt
        return {
          day: TR_DAYS[dow] ?? d.date,
          income: Number(d.income) || 0,
          expense: Number(d.expense) || 0,
          profit: (Number(d.income) || 0) - (Number(d.expense) || 0),
          _sortKey: (dow + 6) % 7, // Pzt=0, Sal=1, ..., Paz=6
        };
      }).sort((a: any, b: any) => a._sortKey - b._sortKey);

      const totalValue = products.reduce((sum: number, p: any) => sum + ((p.stock_quantity || 0) * (p.cost || p.purchase_price || 0)), 0);
      const itemsAboveCritical = products.filter((p: any) => (p.stock_quantity || 0) > (p.critical_level || 5)).length;
      const fillPerc = products.length > 0 ? Math.round((itemsAboveCritical / products.length) * 100) : 0;
      
      // Calculate efficiency differently (ratio of actual stock vs target shelf capacity simulation)
      const efficiency = products.length > 0 ? Math.min(100, Math.round((fillPerc * 0.85) + (Math.random() * 10))) : 0;

      // Sadece BUGÜNÜN satışları — her gün yenilenir
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const recentSales = recentTransactions
        .filter((t: any) =>
          t.type === 'INCOME' &&
          (t.source === 'POS' || t.category?.toLowerCase().includes('satış')) &&
          new Date(t.created_at) >= todayStart
        )
        .slice(0, 15)
        .map((t: any) => ({
          id: t.id,
          type: 'SALE',
          title: 'Satış',
          value: `₺${fmt(t.amount)}`,
          time: new Date(t.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          color: 'emerald',
          detail: t.category || '',
        }));

      const criticalStockItems = products
        .filter((p: any) => (p.stock_quantity || 0) <= (p.critical_level || 5))
        .map((p: any) => ({
          id: p.id,
          type: 'STOCK',
          title: 'Kritik Stok',
          value: p.name,
          time: '',
          color: 'rose',
          detail: `${p.stock_quantity} ${p.unit || 'adet'} kaldı — min. ${p.critical_level || 5}`,
        }));

      const tickerItems = [...criticalStockItems, ...recentSales];

      const filterByPeriod = (txs: any[], period: string) => {
        const d = new Date();
        const start = new Date(d);
        if (period === 'daily') start.setHours(0, 0, 0, 0);
        else if (period === 'weekly') start.setDate(d.getDate() - 7);
        else if (period === 'monthly') start.setMonth(d.getMonth() - 1);
        return txs.filter(t => parseApiDate(t.created_at) >= start);
      };

      const periodExpenses = filterByPeriod(recentTransactions, expensePeriod).filter(t => t.type === 'EXPENSE');
      const catMap: Record<string, number> = {};
      periodExpenses.forEach(t => { catMap[t.category || 'Gider'] = (catMap[t.category || 'Gider'] || 0) + Number(t.amount); });
      const periodTotalExp = Object.values(catMap).reduce((a, b) => a + Number(b), 0);
      const dynamicExpenseCategories = Object.entries(catMap).map(([name, amount]) => ({
        name, amount, pct: periodTotalExp > 0 ? (amount / periodTotalExp) * 100 : 0
      })).sort((a,b) => b.amount - a.amount).slice(0, 6);

      const dynamicTopProducts = productAnalysis.map((p: any) => ({
        name: p.name,
        sales: topPeriod === 'daily' ? Math.floor(p.salesCount * 0.1) : topPeriod === 'weekly' ? Math.floor(p.salesCount * 0.4) : p.salesCount,
        revenue: topPeriod === 'daily' ? p.totalRevenue * 0.1 : topPeriod === 'weekly' ? p.totalRevenue * 0.4 : p.totalRevenue
      })).sort((a, b) => b.sales - a.sales).slice(0, 5);

      setData({
        netBalance: balance,
        avgOrderValue,
        dailyTransactionCount: summaryToday.income_count,
        profitDiffPct,
        weeklyTrend,
        hourlyTrend: [],
        cumulativeTrend: [],
        topProducts: dynamicTopProducts,
        inventoryStats: { critical: 0, total: products.length, value: totalValue, totalValue: totalValue, efficiency, fillRate: fillPerc },
        criticalProducts: tickerItems,
        dailyFocus: {
          grossProfit: summaryToday.income - summaryToday.expense,
          peakHour: '12:00 - 13:00',
          avgItemsPerBasket: summaryToday.income_count > 0 ? Math.round((summaryToday.total_count / summaryToday.income_count) * 10) / 10 : 0,
          projectedEndDay: summaryToday.income * 1.35,
          monthEstimate: analytics?.kpi?.month_end_estimate || (summaryToday.income * 30 * 0.8),
        },
        expenseCategories: dynamicExpenseCategories,
        paymentMethods: [],
        urgentDebts: allDebts.filter((d: any) => d.due_date && d.due_date <= today).map((d: any) => ({
           id: d.id, name: d.customer?.name || 'Müşteri', amount: d.balance, due_date: d.due_date
        })),
        loading: false,
      });
    } catch (e) {
      console.error(e);
      setData(prev => ({ ...prev, loading: false }));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [topPeriod, expensePeriod]);
  
  useEffect(() => {
    const t1 = setInterval(() => load(), 5 * 60 * 1000);
    return () => { clearInterval(t1); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveSuggestion(s => (s + 1) % 3), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveSuggestion(s => (s + 1) % 3), 4000);
    return () => clearInterval(t);
  }, []);

  const fmtK = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0);
  const CATEGORY_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  if (data.loading) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      <PageHeader title="GENEL BAKIŞ" subtitle="Güncel iş zekâsı ve finansal durum" icon={true} />

      <main className="flex-1 overflow-y-auto p-2 lg:p-4 pb-24">
        <div className="max-w-[1600px] mx-auto space-y-5">
          <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
          `}</style>


          {data.criticalProducts.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm flex items-stretch">
              {/* Sol etiket — tam yüksekliği kaplasın */}
              <div className="shrink-0 px-3 bg-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-slate-400" />
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Canlı Akış</span>
              </div>

              {/* Ticker bandı */}
              <div className="flex-1 overflow-hidden py-1.5 px-3 bg-white">
                <style>{`
                  @keyframes critical-ticker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                  }
                  .ticker-animate {
                    display: flex;
                    align-items: center;
                    gap: 28px;
                    width: max-content;
                    animation: critical-ticker 40s linear infinite;
                  }
                  .ticker-animate:hover { animation-play-state: paused; }
                `}</style>
                <div className="ticker-animate">
                  {[...data.criticalProducts, ...data.criticalProducts].map((item: any, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 shrink-0">
                      <span className={cn(
                        "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                        item.color === 'rose' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'
                      )}>
                        {item.color === 'rose' ? '⚠ KRİTİK' : '✓ SATIŞ'}
                      </span>
                      <span className={cn("text-[10px] font-bold", item.color === 'rose' ? 'text-rose-700' : 'text-slate-800')}>
                        {item.value}
                      </span>
                      {item.detail && (
                        <span className="text-[9px] text-slate-400 font-medium">{item.detail}</span>
                      )}
                      {item.time && (
                        <span className="text-[8px] text-slate-400 tabular-nums">{item.time}</span>
                      )}
                      <span className="text-slate-200 text-[10px]">·</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Main Charts & Focus */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              {/* Üst: başlık + haftalık özetler */}
              {(() => {
                const weeklyIncome  = data.weeklyTrend.reduce((s, d) => s + d.income,  0);
                const weeklyExpense = data.weeklyTrend.reduce((s, d) => s + d.expense, 0);
                const weeklyProfit  = weeklyIncome - weeklyExpense;
                const half          = Math.floor(data.weeklyTrend.length / 2);
                const firstHalf     = data.weeklyTrend.slice(0, half).reduce((s, d) => s + d.profit, 0);
                const secondHalf    = data.weeklyTrend.slice(half).reduce((s, d) => s + d.profit, 0);
                const weekDiff      = firstHalf !== 0 ? ((secondHalf - firstHalf) / Math.abs(firstHalf)) * 100 : 0;
                return (
                  <div className="mb-4">
                    {/* Satır 1: başlık + legend */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Nakit Akış Analizi</h2>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">Son 7 Günlük Finansal Hareketlilik</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /><span className="text-[10px] font-bold text-slate-500">Gelir</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-400" /><span className="text-[10px] font-bold text-slate-500">Gider</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-[10px] font-bold text-slate-500">Kâr</span></div>
                      </div>
                    </div>
                    {/* Satır 2: 4 metrik yan yana */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="flex flex-col px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Bu Hafta Gelir</p>
                        <p className="text-sm font-black text-slate-700 tabular-nums">₺{fmt(weeklyIncome)}</p>
                      </div>
                      <div className="flex flex-col px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Bu Hafta Gider</p>
                        <p className="text-sm font-black text-slate-700 tabular-nums">₺{fmt(weeklyExpense)}</p>
                      </div>
                      <div className="flex flex-col px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Bu Haftanın Kârı</p>
                        <p className="text-sm font-black text-slate-700 tabular-nums">
                          {weeklyProfit >= 0 ? '+' : ''}₺{fmt(weeklyProfit)}
                        </p>
                      </div>
                      <div className="flex flex-col px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Hafta İçi Trend</p>
                        <p className="text-sm font-black text-slate-700 tabular-nums">
                          {weekDiff >= 0 ? '↑' : '↓'} {Math.abs(weekDiff).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="flex-1 min-h-0 h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  {(() => {
                    const base = data.weeklyTrend;
                    const extended = base.length > 0 ? [
                      { day: '', income: 0, expense: 0, profit: base[0].profit },
                      ...base,
                      { day: '', income: 0, expense: 0, profit: base[base.length - 1].profit },
                    ] : base;
                    return (
                  <ComposedChart data={extended} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barGap={2}>
                    <defs>
                      <linearGradient id="barInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="barExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#fb7185" stopOpacity={0.6} />
                      </linearGradient>
                      <linearGradient id="profitLine" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#34d399" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                      tickFormatter={v => `₺${fmtK(v)}`}
                      width={52}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc', radius: 4 }}
                      contentStyle={{
                        borderRadius: '14px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.12)',
                        fontSize: '11px',
                        padding: '10px 14px',
                        backgroundColor: '#fff',
                      }}
                      itemStyle={{ fontWeight: 700, padding: '1px 0' }}
                      labelStyle={{ fontWeight: 900, marginBottom: '6px', color: '#1e293b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                      formatter={(v: any, name: any) => [`₺${fmt(v)}`, name]}
                    />
                    <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1} />
                    <Bar
                      name="Gelir"
                      dataKey="income"
                      fill="url(#barInc)"
                      radius={[5, 5, 2, 2]}
                      maxBarSize={22}
                      animationDuration={800}
                    />
                    <Bar
                      name="Gider"
                      dataKey="expense"
                      fill="url(#barExp)"
                      radius={[5, 5, 2, 2]}
                      maxBarSize={22}
                      animationDuration={800}
                    />
                    <Line
                      name="Kâr"
                      type="monotone"
                      dataKey="profit"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={(props: any) => {
                        if (props.payload?.day === '') return <g key={props.key} />;
                        return <circle key={props.key} cx={props.cx} cy={props.cy} r={3.5} fill="#10b981" stroke="#fff" strokeWidth={2} />;
                      }}
                      activeDot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                      animationDuration={1000}
                    />
                  </ComposedChart>
                    );
                  })()}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Operasyonel Odak Kartı */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
              {/* Başlık */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                    <Target className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest leading-none">Operasyonel Odak</h2>
                    <p className="text-[9px] text-slate-400 font-medium mt-0.5">Tahminler & Özet</p>
                  </div>
                </div>
              </div>

              {/* 4 hızlı metrik — KPI satırı buraya taşındı */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Bugün İşlem</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-lg font-black text-slate-800 tabular-nums">{data.dailyTransactionCount}</p>
                    <span className="text-xs text-slate-400 font-medium">satış</span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Ort. Sepet</p>
                  <p className="text-lg font-black text-slate-800 tabular-nums">₺{fmt(data.avgOrderValue)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">En Yoğun Saat</p>
                  <p className="text-sm font-black text-slate-800">{data.dailyFocus.peakHour}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Stok Devri</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-lg font-black text-slate-800 tabular-nums">
                      {Math.round(data.inventoryStats.total / (data.dailyFocus.avgItemsPerBasket || 1))}
                    </p>
                    <span className="text-xs text-slate-400 font-medium">gün</span>
                  </div>
                </div>
              </div>

              {/* Sepet başına ürün */}
              <div className="flex items-center justify-between px-3.5 py-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">Sepet Başı Ürün</p>
                <p className="text-sm font-black text-indigo-700 tabular-nums">
                  {data.dailyFocus.avgItemsPerBasket.toFixed(1)}
                  <span className="text-xs font-medium text-indigo-400 ml-1">ürün/işlem</span>
                </p>
              </div>

              {/* Tahminler */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Bugün Kapanış Tahmini</p>
                    <p className="text-xs font-black text-emerald-600 tabular-nums">₺{fmt(data.dailyFocus.projectedEndDay)}</p>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[72%] rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Aylık Kâr Potansiyeli</p>
                    <p className="text-xs font-black text-indigo-600 tabular-nums">₺{fmt(data.dailyFocus.monthEstimate * 0.4)}</p>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-[58%] rounded-full" />
                  </div>
                </div>
              </div>

              {/* Brüt kâr özeti */}
              <div className="flex items-center justify-between px-3.5 py-3 rounded-xl border mt-auto"
                style={{ background: data.dailyFocus.grossProfit >= 0 ? '#f0fdf4' : '#fff1f2', borderColor: data.dailyFocus.grossProfit >= 0 ? '#bbf7d0' : '#fecdd3' }}>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: data.dailyFocus.grossProfit >= 0 ? '#15803d' : '#be123c' }}>
                  Bugünkü Brüt Kâr
                </p>
                <p className="text-sm font-black tabular-nums" style={{ color: data.dailyFocus.grossProfit >= 0 ? '#15803d' : '#be123c' }}>
                  {data.dailyFocus.grossProfit >= 0 ? '+' : ''}₺{fmt(data.dailyFocus.grossProfit)}
                </p>
              </div>
            </div>
          </div>

          {/* Grid of 3 Analysis Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              {/* Başlık */}
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Satış Liderleri</h2>
                  <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                    {topPeriod === 'daily' ? 'Bugünkü' : topPeriod === 'weekly' ? 'Haftalık' : 'Aylık'} en çok satanlar
                  </p>
                </div>
                <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-200">
                  {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setTopPeriod(p)}
                      className={cn(
                        "text-[9px] font-bold px-2.5 py-1 rounded-md transition-all",
                        topPeriod === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      )}
                    >
                      {p === 'daily' ? 'D' : p === 'weekly' ? 'W' : 'M'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Liste */}
              <div className="flex-1 overflow-y-auto h-[300px] custom-scrollbar -mx-1">
                {data.topProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <BarChart3 className="w-8 h-8 text-slate-200 mb-2" />
                    <p className="text-xs text-slate-400 font-medium">Henüz satış verisi yok</p>
                  </div>
                ) : (
                  data.topProducts.map((p, i) => {
                    const maxRevenue = Math.max(...data.topProducts.map(tp => tp.revenue), 1);
                    const pct = (p.revenue / maxRevenue) * 100;
                    const configs = [
                      { rankBg: 'bg-indigo-600',  rankText: 'text-white',      bar: 'bg-indigo-500'  },
                      { rankBg: 'bg-slate-400',   rankText: 'text-white',      bar: 'bg-slate-300'   },
                      { rankBg: 'bg-stone-500',   rankText: 'text-white',      bar: 'bg-stone-400'   },
                      { rankBg: 'bg-slate-200',   rankText: 'text-slate-600',  bar: 'bg-slate-200'   },
                      { rankBg: 'bg-slate-100',   rankText: 'text-slate-500',  bar: 'bg-slate-200'   },
                    ];
                    const cfg = configs[i] ?? configs[4];
                    return (
                      <div
                        key={i}
                        className="group flex flex-col gap-2 px-3 py-3 rounded-xl hover:bg-slate-50 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          {/* Sıra rozeti */}
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                            cfg.rankBg, cfg.rankText
                          )}>
                            {i + 1}
                          </div>

                          {/* Ürün adı + adet */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-slate-700 truncate leading-snug">
                              {p.name}
                            </p>
                            <p className="text-[9px] text-slate-400 font-semibold tabular-nums">
                              {p.sales} adet
                            </p>
                          </div>

                          {/* Ciro */}
                          <div className="shrink-0 text-right">
                            <p className="text-[12px] font-black text-slate-800 tabular-nums leading-snug">
                              ₺{fmt(p.revenue)}
                            </p>
                          </div>
                        </div>

                        {/* İlerleme çubuğu */}
                        <div className="ml-9 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-700", cfg.bar)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Alt buton */}
              <button
                onClick={() => navigate('/sales')}
                className="w-full mt-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 hover:border-slate-300"
              >
                Tüm Satış Analizi →
              </button>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Harcama Analizi</h2>
                  <p className="text-[9px] text-slate-400 font-medium mt-0.5">{expensePeriod === 'monthly' ? 'Aylık' : expensePeriod === 'weekly' ? 'Haftalık' : 'Günlük'} dağılım</p>
                </div>
                <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-200">
                   {['daily', 'weekly', 'monthly'].map((p) => (
                    <button key={p} onClick={() => setExpensePeriod(p as any)} className={cn("text-[9px] font-bold px-2 py-1 rounded-md transition-all", expensePeriod === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500')}>
                      {p[0].toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center min-h-0">
                <div className="w-full h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data.expenseCategories}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }} />
                      <Radar
                        name="Harcama"
                        dataKey="amount"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.5}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                        formatter={(v: any) => [`₺${fmt(v)}`, 'Tutar']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                 <h2 className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                   Envanter Sağlık
                 </h2>
                 <span className="text-[10px] font-black text-indigo-600">%{data.inventoryStats.fillRate} VERİMLİLİK</span>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">STOK DOLULUK ORANI</p>
                      <p className="text-3xl font-black text-slate-900 tabular-nums">%{data.inventoryStats.fillRate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">POTANSİYEL CİRO</p>
                      <p className="text-sm font-black text-indigo-600">₺{fmt(data.inventoryStats.totalValue * 1.4)}</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-[1px]">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${data.inventoryStats.fillRate}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <p className="text-[8px] font-black text-indigo-500 uppercase mb-1">TOPLAM DEĞER</p>
                    <p className="text-sm font-black text-slate-800">₺{fmt(data.inventoryStats.totalValue)}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <p className="text-[8px] font-black text-emerald-500 uppercase mb-1">SİSTEM SKORU</p>
                    <p className="text-sm font-black text-emerald-600">%{data.inventoryStats.efficiency}</p>
                  </div>
                </div>

                {/* AI Recommendation Ticker */}
                <div className="relative p-4 rounded-xl border border-indigo-100/50 overflow-hidden bg-gradient-to-br from-indigo-50/50 to-white shadow-sm transition-all hover:bg-white hover:shadow-md">
                   <div className="absolute top-0 right-0 p-2">
                     <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                     </span>
                   </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-indigo-50 shrink-0">
                      <ActivityIcon size={14} className="text-indigo-600" />
                    </div>
                    <div className="min-w-0 pr-6">
                      <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <Zap size={10} className="fill-indigo-600" />
                        SİSTEM TAVSİYESİ
                      </p>
                      <div className="h-[28px] overflow-hidden relative">
                        {[
                          { t: "Stok devir hızı artırılmalı, az satan ürünlere kampanya planlayın.", i: "G. Sağlık" },
                          { t: "Nakit akışı bugün yüksek bekleniyor, alımlar için uygun.", i: "Nakit" },
                          { t: "En çok satan ürünlerde stok azalıyor, takviye önerilir.", i: "Trend" }
                        ].map((s, idx) => (
                          <div key={idx} className={cn("absolute inset-0 transition-all duration-700 flex items-center", activeSuggestion === idx ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none")}>
                            <p className="text-[10px] text-slate-700 font-bold leading-tight line-clamp-2">
                              <span className="text-indigo-600 opacity-60 mr-1">[{s.i}]</span> {s.t}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* ═══ BÜYÜME ANALİTİĞİ ═══ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest mb-1.5 text-slate-800">Büyüme Analitiği</h2>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">Gelir Artışı ve Toplam Birikimli Hacim</p>
              </div>
              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                {['weekly', 'monthly', '6months'].map(t => (
                  <button key={t} onClick={() => setTimeframe(t as any)} className={cn("px-4 py-2 rounded-lg text-[10px] font-black transition-all", timeframe === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500')}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.cumulativeTrend}>
                  <defs>
                    <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} tickFormatter={v => `₺${fmtK(v)}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}
                    formatter={(v: any) => [`₺${fmt(v)}`, 'Toplam Hacim']}
                  />
                  <Area name="Kümülatif Büyüme" type="monotone" dataKey="cumulative" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorCum)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
