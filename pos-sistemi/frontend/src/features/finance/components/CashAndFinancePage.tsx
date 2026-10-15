/**
 * Kasa, Finans & Raporlar - Combined Page
 * Combines Kasa (Transactions), Gelirler (Incomes), Giderler (Finance), and Raporlar (Reports)
 * with a unified header and tab navigation
 * 
 * Features:
 * - Tab switching between Finance, Reports, KDV Report, Cash Flow, Checks
 * - "Mali Müşavir Paketi İndir" (CPA 5-Sheet Excel Package Export)
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FileText,
  Building2,
  Scale,
  Receipt,
  CheckSquare
} from 'lucide-react';

import { FinancePage } from './FinancePage';
import { ReportsPage } from '../../reports/components/ReportsPage';
import { KdvReportView } from '../../reports/components/KdvReportView';
import { CashFlowReportView } from '../../reports/components/CashFlowReportView';
import { ChecksView } from '../../checks/components/ChecksView';
import { accountantExportService } from '../services/accountantExportService';

type PageTab = 'gelir-gider' | 'raporlar' | 'kdv-raporu' | 'nakit-akisi' | 'cekler';

const MONTH_NAMES = [
  { value: 1, label: 'Ocak' },
  { value: 2, label: 'Şubat' },
  { value: 3, label: 'Mart' },
  { value: 4, label: 'Nisan' },
  { value: 5, label: 'Mayıs' },
  { value: 6, label: 'Haziran' },
  { value: 7, label: 'Temmuz' },
  { value: 8, label: 'Ağustos' },
  { value: 9, label: 'Eylül' },
  { value: 10, label: 'Ekim' },
  { value: 11, label: 'Kasım' },
  { value: 12, label: 'Aralık' },
];

const AVAILABLE_YEARS = [2024, 2025, 2026, 2027];

interface AccountantExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function AccountantExportModal({ isOpen, onClose }: AccountantExportModalProps) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear() || 2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1 || 9);
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const data = await accountantExportService.fetchPackageData(selectedYear, selectedMonth);
      accountantExportService.generateAndDownloadExcel(data);
      setFeedback({
        type: 'success',
        message: `Mali Müşavir Paketi başarıyla oluşturuldu ve indirildi! (${data.period.label} - ${data.sales_invoices.length} satış, ${data.purchase_invoices.length} alış/gider, ${data.cash_bank_ledger.length} kasa/banka, ${data.checks_portfolio.length} çek)`,
      });
      setTimeout(() => {
        // Otomatik kapatma isteğe bağlı
      }, 3000);
    } catch (err: any) {
      console.error('[Accountant Package Export Error]', err);
      const errDetail = err?.response?.data?.detail || err?.message || 'Veri seti alınamadı';
      setFeedback({
        type: 'error',
        message: `Hata oluştu: ${errDetail}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedMonthObj = MONTH_NAMES.find((m) => m.value === selectedMonth);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-150">
        {/* Modal Başlığı */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Mali Müşavir / Muhasebeci Paketi</h3>
              <p className="text-[11px] text-emerald-100 font-medium">
                Mevzuata Uygun 5 Sekmeli Excel İhracı
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal İçeriği */}
        <div className="p-6 space-y-5">
          {/* Dönem Seçimi */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Dönem Seçimi</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Dönem Yılı</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {AVAILABLE_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Dönem Ayı</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {MONTH_NAMES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} ({String(m.value).padStart(2, '0')})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Seçilen Dönem: <strong className="text-slate-800">{selectedMonthObj?.label} {selectedYear}</strong> — Dosya adı: <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">Mali_Musavir_Paketi_{selectedYear}_{String(selectedMonth).padStart(2, '0')}.xlsx</code>
            </p>
          </div>

          {/* 5 Sekmeli Paket Detayı */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Paket İçeriği (5 Ayrı Sekme)</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                SMMM Standartı
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200/70 hover:border-emerald-300 transition">
                <FileText className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">1. Satış Faturaları &amp; POS İcmali</div>
                  <div className="text-[11px] text-slate-500">
                    Resmî e-faturalar, perakende Z-Raporu toplamı, %1, %10, %20 KDV matrahı ve tevkifat.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200/70 hover:border-emerald-300 transition">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">2. Alış Faturaları &amp; İşletme Giderleri</div>
                  <div className="text-[11px] text-slate-500">
                    Tedarikçi alımları, kategori bazlı gider fişleri ve yüklenilen girdi KDV dökümü.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200/70 hover:border-emerald-300 transition">
                <Receipt className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">3. Kasa ve Banka Muavin Defteri</div>
                  <div className="text-[11px] text-slate-500">
                    Nakit kasa ve banka hesaplarının tahsilat/tediye hareketleri ile yürüyen bakiye.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200/70 hover:border-emerald-300 transition">
                <Scale className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">4. Ay Sonu KDV Özeti (391 vs 191 Dengesi)</div>
                  <div className="text-[11px] text-slate-500">
                    Hesaplanan KDV vs İndirilecek KDV dengesi, ödenecek (360) veya devreden (190) KDV hesabı.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200/70 hover:border-emerald-300 transition">
                <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">5. Çek &amp; Senet Portföy Durumu</div>
                  <div className="text-[11px] text-slate-500">
                    Alınan ve verilen çeklerin banka, keşideci, vade tarihi ve portföy durumları.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bildirim / Feedback Banner */}
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="leading-snug">{feedback.message}</div>
            </div>
          )}
        </div>

        {/* Modal Alt Butonları */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
          >
            Kapat
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Paket Hazırlanıyor...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-white" />
                <span>Excel Paketi Oluştur &amp; İndir</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CashAndFinancePage() {
  const location = useLocation();

  const getInitialTab = (): PageTab => {
    if (location.pathname.includes('reports')) {
      return 'raporlar';
    }
    return 'gelir-gider';
  };

  const [activeTab, setActiveTab] = useState<PageTab>(getInitialTab());
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (location.pathname.includes('reports')) {
      setActiveTab('raporlar');
    } else if (location.pathname.includes('transactions')) {
      setActiveTab('gelir-gider');
    }
  }, [location]);

  const tabs = [
    { id: 'gelir-gider', label: 'Kasa & Finans' },
    { id: 'raporlar', label: 'Performans Raporu' },
    { id: 'kdv-raporu', label: 'KDV Raporu' },
    { id: 'nakit-akisi', label: 'Nakit Akışı' },
    { id: 'cekler', label: 'Çekler' },
  ] as const;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f8f9ff] text-slate-800 font-sans antialiased">
      {/* ────────────────────── ÜST BAR (HEADER) ────────────────────── */}
      <header className="h-16 px-8 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-bold text-slate-900 leading-none">Finans &amp; Raporlar</h2>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
            {tabs.find((t) => t.id === activeTab)?.label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Mali Müşavir Paketi İndir Butonu */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer shrink-0"
            title="Mevzuata Uygun 5 Sekmeli Excel İhracı"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            <span>Mali Müşavir Paketi İndir</span>
          </button>

          {/* Tab Geçiş Şeridi */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200/60">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs rounded-md transition flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ────────────────────── SAYFA İÇERİĞİ ────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'gelir-gider' && <FinancePage />}
        {activeTab === 'raporlar' && <ReportsPage />}
        {activeTab === 'kdv-raporu' && <KdvReportView />}
        {activeTab === 'nakit-akisi' && <CashFlowReportView />}
        {activeTab === 'cekler' && <ChecksView />}
      </div>

      {/* ────────────────────── MALİ MÜŞAVİR PAKETİ MODAL ────────────────────── */}
      <AccountantExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
