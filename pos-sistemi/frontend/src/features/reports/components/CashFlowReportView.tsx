import React, { useState, useEffect } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import apiClient from '@/shared/utils/api.client';

interface ProjectionItem {
  month: string;
  month_label: string;
  projected_income: number;
  projected_expense: number;
  projected_balance: number;
}

interface CashFlowData {
  current_cash: number;
  monthly_income_avg: number;
  monthly_expense_avg: number;
  net_monthly: number;
  receivables: number;
  payables: number;
  projection: ProjectionItem[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n || 0);

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

export const CashFlowReportView: React.FC = () => {
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CashFlowData | null>(null);

  const fetchCashFlow = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/finance/cash-flow-projection', { params: { months } });
      setData(res.data);
    } catch (e) {
      console.error('Nakit akışı verisi alınamadı', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCashFlow();
  }, [months]);

  const handleExportExcel = () => {
    if (!data?.projection?.length) return;
    const rows = data.projection.map(p => ({
      'Dönem': p.month_label || p.month,
      'Tahmini Gelir (₺)': p.projected_income || 0,
      'Tahmini Gider (₺)': p.projected_expense || 0,
      'Dönem Sonu Tahmini Bakiye (₺)': p.projected_balance || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nakit Akışı Projeksiyonu');
    XLSX.writeFile(wb, `Nakit_Akisi_${months}_Ay_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* ── Üst Araç Çubuğu (Projeksiyon Süresi & İşlemler) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-slate-700">Projeksiyon Dönemi:</div>
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {[
              { label: '3 Ay', val: 3 },
              { label: '6 Ay', val: 6 },
              { label: '12 Ay', val: 12 },
            ].map(item => (
              <button
                key={item.val}
                onClick={() => setMonths(item.val)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                  months === item.val
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              <span>Hesaplanıyor...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCashFlow}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel İndir</span>
          </button>
        </div>
      </div>

      {/* ── 4 KPI KARTI ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Mevcut Likit Nakit"
          value={fmt(data?.current_cash || 0)}
          badgeText="Kasa &amp; Banka"
          subtext="Anlık kullanılabilir net bakiye"
          valueColor="text-slate-900"
        />

        <KPICard
          label="Müşteri Alacakları"
          value={fmt(data?.receivables || 0)}
          badgeText="Veresiye / Çek"
          subtext="Beklenen müşteri tahsilatları"
          valueColor="text-blue-600"
        />

        <KPICard
          label="Tedarikçi Borçları"
          value={fmt(data?.payables || 0)}
          badgeText="Vadeli Borçlar"
          subtext="Tedarikçilere ödenecek faturalar"
          valueColor="text-rose-600"
        />

        <KPICard
          label="Aylık Net Nakit Akışı"
          value={fmt(data?.net_monthly || 0)}
          badgeText="Projeksiyon"
          subtext="Ortalama aylık net değişim hızı"
          valueColor={(data?.net_monthly || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}
        />
      </div>

      {/* ── PROJEKSİYON GRAFİĞİ ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col p-4">
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Gelecek {months} Aylık Kasa Dengesi Projeksiyonu
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Mevcut gelir ve gider hızına göre kümülatif bakiye tahmini</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tahmini Bakiye</span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.projection || []} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} dy={6} />
              <YAxis
                stroke="#94A3B8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}B` : `${v}`}
              />
              <Tooltip
                formatter={(val: any) => [fmt(val), 'Tahmini Bakiye']}
                labelFormatter={(label) => `Dönem: ${label}`}
              />
              <Area type="monotone" dataKey="projected_balance" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBalance)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── PROJEKSİYON TABLOSU (EXCEL GRID TABLO) ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Aylık Projeksiyon Detayları</h3>
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
            {data?.projection?.length || 0} Dönem
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100/85 text-[10px] font-bold text-slate-600 uppercase tracking-wider divide-x divide-slate-200 border-b border-slate-300">
                <th className="py-2.5 px-4">Dönem</th>
                <th className="py-2.5 px-4 text-right">Tahmini Gelir</th>
                <th className="py-2.5 px-4 text-right">Tahmini Gider</th>
                <th className="py-2.5 px-4 text-right">Dönem Sonu Tahmini Bakiye</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {(data?.projection || []).map((p, idx) => (
                <tr
                  key={idx}
                  className={`divide-x divide-slate-200 hover:bg-sky-50/60 transition-colors ${
                    idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                  }`}
                >
                  <td className="py-2 px-4 font-bold text-slate-800">{p.month}</td>
                  <td className="py-2 px-4 text-right font-medium text-emerald-600 tabular-nums">
                    {fmt(p.projected_income)}
                  </td>
                  <td className="py-2 px-4 text-right font-medium text-rose-600 tabular-nums">
                    {fmt(p.projected_expense)}
                  </td>
                  <td className="py-2 px-4 text-right font-bold text-blue-700 tabular-nums">
                    {fmt(p.projected_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

