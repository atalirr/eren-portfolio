import React, { useState, useEffect } from 'react';
import { Printer, RefreshCw, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import apiClient from '@/shared/utils/api.client';

interface KdvData {
  period_days: number;
  collected_vat: Record<string, number>;
  paid_vat: Record<string, number>;
  total_collected: number;
  total_paid: number;
  net_vat_payable: number;
  summary: string;
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

export const KdvReportView: React.FC = () => {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<KdvData | null>(null);

  const fetchKdv = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/finance/kdv-report', { params: { days } });
      setData(res.data);
    } catch (e) {
      console.error('KDV raporu alınamadı', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKdv();
  }, [days]);

  const handlePrint = () => {
    window.print();
  };

  const rates = ['1', '10', '20'];

  const handleExportExcel = () => {
    if (!data) return;
    const rows = rates.map(rate => {
      const collected = data.collected_vat?.[rate] || 0;
      const paid = data.paid_vat?.[rate] || 0;
      const diff = collected - paid;
      return {
        'KDV Oranı': `%${rate}`,
        'Satışlardan Toplanan (₺)': collected,
        'Alışlarda Ödenen (₺)': paid,
        'Fark / Net KDV (₺)': diff,
      };
    });

    rows.push({
      'KDV Oranı': 'GENEL TOPLAM',
      'Satışlardan Toplanan (₺)': data.total_collected || 0,
      'Alışlarda Ödenen (₺)': data.total_paid || 0,
      'Fark / Net KDV (₺)': data.net_vat_payable || 0,
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'KDV Raporu');
    XLSX.writeFile(wb, `KDV_Raporu_${days}_Gun_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const isPayable = (data?.net_vat_payable || 0) > 0;

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* ── Üst Araç Çubuğu (Dönem Seçimi & Butonlar) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-slate-700">Dönem:</div>
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {[
              { label: '30 Gün', val: 30 },
              { label: '3 Ay', val: 90 },
              { label: '6 Ay', val: 180 },
              { label: '1 Yıl', val: 365 },
            ].map(item => (
              <button
                key={item.val}
                onClick={() => setDays(item.val)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                  days === item.val
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
              <span>Güncelleniyor...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchKdv}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Yazdır</span>
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

      {/* ── 3 KPI KARTI ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          label="Toplanan KDV (Hesaplanan)"
          value={fmt(data?.total_collected || 0)}
          badgeText="Satış &amp; POS"
          subtext="Müşterilerden tahsil edilen satış vergisi"
          valueColor="text-slate-900"
        />

        <KPICard
          label="Ödenen KDV (İndirilecek)"
          value={fmt(data?.total_paid || 0)}
          badgeText="Alış Faturaları"
          subtext="Tedarikçi alışları ile ödenen girdi vergisi"
          valueColor="text-slate-900"
        />

        <KPICard
          label="Net KDV Durumu"
          value={fmt(Math.abs(data?.net_vat_payable || 0))}
          badgeText={isPayable ? 'Ödenecek KDV' : 'Devreden KDV'}
          subtext={isPayable ? 'Devlete ödenecek net vergi tutarı' : 'Gelecek döneme devreden KDV alacağı'}
          valueColor={isPayable ? 'text-amber-600' : 'text-emerald-600'}
        />
      </div>

      {/* ── KDV DAĞILIMI (EXCEL GRID TABLO) ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Oran Bazında KDV Dağılımı</h3>
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
            %{rates.join(' - %')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100/85 text-[10px] font-bold text-slate-600 uppercase tracking-wider divide-x divide-slate-200 border-b border-slate-300">
                <th className="py-2.5 px-4">KDV Oranı</th>
                <th className="py-2.5 px-4 text-right">Satışlardan Toplanan</th>
                <th className="py-2.5 px-4 text-right">Alışlarda Ödenen</th>
                <th className="py-2.5 px-4 text-right">Net Durum (Fark)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {rates.map((rate, idx) => {
                const collected = data?.collected_vat?.[rate] || 0;
                const paid = data?.paid_vat?.[rate] || 0;
                const diff = collected - paid;
                return (
                  <tr
                    key={rate}
                    className={`divide-x divide-slate-200 hover:bg-sky-50/60 transition-colors ${
                      idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                    }`}
                  >
                    <td className="py-2 px-4 font-bold text-slate-900 whitespace-nowrap">
                      %{rate} KDV
                    </td>
                    <td className="py-2 px-4 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {fmt(collected)}
                    </td>
                    <td className="py-2 px-4 text-right font-medium text-slate-600 tabular-nums whitespace-nowrap">
                      {fmt(paid)}
                    </td>
                    <td className={`py-2 px-4 text-right font-bold tabular-nums whitespace-nowrap ${
                      diff >= 0 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {fmt(diff)}
                    </td>
                  </tr>
                );
              })}
              <tr className="divide-x divide-slate-200 bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                <td className="py-2.5 px-4">GENEL TOPLAM</td>
                <td className="py-2.5 px-4 text-right tabular-nums text-slate-900">
                  {fmt(data?.total_collected || 0)}
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums text-slate-700">
                  {fmt(data?.total_paid || 0)}
                </td>
                <td className={`py-2.5 px-4 text-right tabular-nums ${
                  isPayable ? 'text-amber-700' : 'text-emerald-700'
                }`}>
                  {fmt(data?.net_vat_payable || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

