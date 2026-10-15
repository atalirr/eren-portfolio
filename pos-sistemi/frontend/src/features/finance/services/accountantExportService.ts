/**
 * Accountant Package Export Service (SMMM Paketi Dışa Aktarma)
 * 5-Sheet Excel Package Generator using SheetJS (xlsx)
 */

import * as XLSX from 'xlsx';
import apiClient from '@/shared/utils/api.client';

export interface SalesInvoiceItem {
  invoice_number: string;
  date: string;
  customer_name: string;
  tax_number: string;
  subtotal: number;
  vat_01: number;
  vat_10: number;
  vat_20: number;
  withholding_tax: number;
  total_amount: number;
  invoice_type: string;
}

export interface PurchaseInvoiceItem {
  invoice_number: string;
  date: string;
  supplier_name: string;
  category: string;
  source_type: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
}

export interface CashBankLedgerItem {
  date: string;
  document_no: string;
  payment_source: string;
  type: string;
  category: string;
  description: string;
  inflow: number;
  outflow: number;
  running_balance: number;
}

export interface VatRateDetail {
  matrah: number;
  vat: number;
}

export interface VatSummaryData {
  sales_vat_391: {
    rate_01: VatRateDetail;
    rate_10: VatRateDetail;
    rate_20: VatRateDetail;
    total_matrah: number;
    total_vat: number;
  };
  purchase_vat_191: {
    rate_01: VatRateDetail;
    rate_10: VatRateDetail;
    rate_20: VatRateDetail;
    total_matrah: number;
    total_vat: number;
  };
  net_vat: number;
  payable_vat: number;
  carryover_vat: number;
  status: string;
  status_description: string;
}

export interface CheckPortfolioItem {
  check_type: string;
  check_number: string;
  bank_branch: string;
  issuer: string;
  contact_name: string;
  issue_date: string;
  due_date: string;
  amount: number;
  status: string;
  notes: string;
}

export interface AccountantPackageResponse {
  period: {
    year: number;
    month: number;
    month_name: string;
    label: string;
    start_date: string;
    end_date: string;
  };
  sales_invoices: SalesInvoiceItem[];
  pos_sales_summary: {
    order_count: number;
    total_revenue: number;
    matrah: number;
    vat_01: number;
    vat_10: number;
    vat_20: number;
    total_vat: number;
  };
  purchase_invoices: PurchaseInvoiceItem[];
  cash_bank_ledger: CashBankLedgerItem[];
  vat_summary: VatSummaryData;
  checks_portfolio: CheckPortfolioItem[];
  summary_counts: {
    sales_count: number;
    purchase_count: number;
    ledger_count: number;
    checks_count: number;
  };
}

export const accountantExportService = {
  /**
   * Fetch CPA package data for selected year and month
   */
  fetchPackageData: async (year: number, month: number): Promise<AccountantPackageResponse> => {
    const res = await apiClient.get<AccountantPackageResponse>('/finance/accountant-package/data', {
      params: { year, month },
    });
    return res.data;
  },

  /**
   * Generate and trigger download of 5-sheet XLSX workbook
   */
  generateAndDownloadExcel: (data: AccountantPackageResponse) => {
    const wb = XLSX.utils.book_new();

    // ── SHEET 1: Satış Faturaları & POS İcmali ──
    const salesRows: any[] = [];
    let totSalesSubtotal = 0;
    let totSalesVat01 = 0;
    let totSalesVat10 = 0;
    let totSalesVat20 = 0;
    let totSalesTotal = 0;

    data.sales_invoices.forEach((inv) => {
      totSalesSubtotal += inv.subtotal;
      totSalesVat01 += inv.vat_01;
      totSalesVat10 += inv.vat_10;
      totSalesVat20 += inv.vat_20;
      totSalesTotal += inv.total_amount;

      salesRows.push({
        'Fatura / Belge No': inv.invoice_number,
        'Tarih': inv.date,
        'Müşteri Adı / Unvanı': inv.customer_name,
        'Vergi No / TCKN': inv.tax_number,
        'Matrah (KDV Hariç) ₺': Number(inv.subtotal.toFixed(2)),
        'KDV %1 ₺': Number(inv.vat_01.toFixed(2)),
        'KDV %10 ₺': Number(inv.vat_10.toFixed(2)),
        'KDV %20 ₺': Number(inv.vat_20.toFixed(2)),
        'Tevkifat Tutarı ₺': Number(inv.withholding_tax.toFixed(2)),
        'Genel Toplam (KDV Dahil) ₺': Number(inv.total_amount.toFixed(2)),
        'Belge Türü': inv.invoice_type,
      });
    });

    // Subtotal summary row
    salesRows.push({
      'Fatura / Belge No': 'TOPLAM',
      'Tarih': `${data.period.label}`,
      'Müşteri Adı / Unvanı': `${data.sales_invoices.length} Adet Kayıt`,
      'Vergi No / TCKN': '-',
      'Matrah (KDV Hariç) ₺': Number(totSalesSubtotal.toFixed(2)),
      'KDV %1 ₺': Number(totSalesVat01.toFixed(2)),
      'KDV %10 ₺': Number(totSalesVat10.toFixed(2)),
      'KDV %20 ₺': Number(totSalesVat20.toFixed(2)),
      'Tevkifat Tutarı ₺': 0.00,
      'Genel Toplam (KDV Dahil) ₺': Number(totSalesTotal.toFixed(2)),
      'Belge Türü': 'GENEL TOPLAM',
    });

    const wsSales = XLSX.utils.json_to_sheet(salesRows);
    wsSales['!cols'] = [
      { wch: 22 }, // Fatura / Belge No
      { wch: 12 }, // Tarih
      { wch: 36 }, // Müşteri
      { wch: 18 }, // VKN / TCKN
      { wch: 20 }, // Matrah
      { wch: 14 }, // KDV %1
      { wch: 14 }, // KDV %10
      { wch: 14 }, // KDV %20
      { wch: 16 }, // Tevkifat
      { wch: 24 }, // Genel Toplam
      { wch: 24 }, // Belge Türü
    ];
    XLSX.utils.book_append_sheet(wb, wsSales, 'Satış Faturaları');

    // ── SHEET 2: Alış Faturaları & Giderler ──
    const purchRows: any[] = [];
    let totPurchSubtotal = 0;
    let totPurchVat = 0;
    let totPurchTotal = 0;

    data.purchase_invoices.forEach((p) => {
      totPurchSubtotal += p.subtotal;
      totPurchVat += p.vat_amount;
      totPurchTotal += p.total_amount;

      purchRows.push({
        'Belge / Fatura No': p.invoice_number,
        'Tarih': p.date,
        'Tedarikçi / Muhatap': p.supplier_name,
        'Belge Türü': p.source_type,
        'Gider Kategorisi': p.category,
        'Matrah (KDV Hariç) ₺': Number(p.subtotal.toFixed(2)),
        'KDV Tutarı ₺': Number(p.vat_amount.toFixed(2)),
        'Genel Toplam ₺': Number(p.total_amount.toFixed(2)),
      });
    });

    purchRows.push({
      'Belge / Fatura No': 'TOPLAM',
      'Tarih': `${data.period.label}`,
      'Tedarikçi / Muhatap': `${data.purchase_invoices.length} Adet Kayıt`,
      'Belge Türü': '-',
      'Gider Kategorisi': 'GENEL TOPLAM',
      'Matrah (KDV Hariç) ₺': Number(totPurchSubtotal.toFixed(2)),
      'KDV Tutarı ₺': Number(totPurchVat.toFixed(2)),
      'Genel Toplam ₺': Number(totPurchTotal.toFixed(2)),
    });

    const wsPurch = XLSX.utils.json_to_sheet(purchRows);
    wsPurch['!cols'] = [
      { wch: 22 }, // Belge / Fatura No
      { wch: 12 }, // Tarih
      { wch: 34 }, // Tedarikçi
      { wch: 20 }, // Belge Türü
      { wch: 22 }, // Kategori
      { wch: 20 }, // Matrah
      { wch: 16 }, // KDV
      { wch: 20 }, // Genel Toplam
    ];
    XLSX.utils.book_append_sheet(wb, wsPurch, 'Alış Faturaları & Giderler');

    // ── SHEET 3: Kasa ve Banka Muavini ──
    const ledgerRows: any[] = [];
    let totInflow = 0;
    let totOutflow = 0;

    data.cash_bank_ledger.forEach((l) => {
      if (l.document_no !== 'DEVİR') {
        totInflow += l.inflow;
        totOutflow += l.outflow;
      }

      ledgerRows.push({
        'İşlem Tarihi': l.date,
        'Belge / Ref No': l.document_no,
        'Hesap / Kasa': l.payment_source,
        'İşlem Türü': l.type,
        'Kategori': l.category,
        'Açıklama': l.description,
        'Giriş / Borç (₺)': Number(l.inflow.toFixed(2)),
        'Çıkış / Alacak (₺)': Number(l.outflow.toFixed(2)),
        'Yürüyen Bakiye (₺)': Number(l.running_balance.toFixed(2)),
      });
    });

    const lastRunningBalance = data.cash_bank_ledger.length > 0 
      ? data.cash_bank_ledger[data.cash_bank_ledger.length - 1].running_balance 
      : 0;

    ledgerRows.push({
      'İşlem Tarihi': 'TOPLAM HAREKET',
      'Belge / Ref No': '-',
      'Hesap / Kasa': 'Kasa & Banka',
      'İşlem Türü': '-',
      'Kategori': '-',
      'Açıklama': 'Dönem Toplamı ve Ay Sonu Kapanış Bakiyesi',
      'Giriş / Borç (₺)': Number(totInflow.toFixed(2)),
      'Çıkış / Alacak (₺)': Number(totOutflow.toFixed(2)),
      'Yürüyen Bakiye (₺)': Number(lastRunningBalance.toFixed(2)),
    });

    const wsLedger = XLSX.utils.json_to_sheet(ledgerRows);
    wsLedger['!cols'] = [
      { wch: 18 }, // Tarih
      { wch: 20 }, // Belge / Ref No
      { wch: 18 }, // Hesap
      { wch: 18 }, // İşlem Türü
      { wch: 18 }, // Kategori
      { wch: 38 }, // Açıklama
      { wch: 18 }, // Giriş
      { wch: 18 }, // Çıkış
      { wch: 20 }, // Bakiye
    ];
    XLSX.utils.book_append_sheet(wb, wsLedger, 'Kasa ve Banka Muavini');

    // ── SHEET 4: Ay Sonu KDV Özeti ──
    const vat = data.vat_summary;
    const vatRows: any[] = [
      {
        'Hesap / Başlık': '1. HESAPLANAN KDV (391 HESAP - SATIŞLAR VE PERAKENDE GELİRLERİ)',
        'Oran': '',
        'Matrah (₺)': '',
        'KDV Tutarı (₺)': '',
        'Muhasebe Kodu': '391',
        'Açıklama': `Dönem: ${data.period.label}`,
      },
      {
        'Hesap / Başlık': 'KDV %1 Satış Matrah ve Vergisi',
        'Oran': '%1',
        'Matrah (₺)': Number(vat.sales_vat_391.rate_01.matrah.toFixed(2)),
        'KDV Tutarı (₺)': Number(vat.sales_vat_391.rate_01.vat.toFixed(2)),
        'Muhasebe Kodu': '391.01',
        'Açıklama': 'Temel Gıda / Tıbbi İlaç',
      },
      {
        'Hesap / Başlık': 'KDV %10 Satış Matrah ve Vergisi',
        'Oran': '%10',
        'Matrah (₺)': Number(vat.sales_vat_391.rate_10.matrah.toFixed(2)),
        'KDV Tutarı (₺)': Number(vat.sales_vat_391.rate_10.vat.toFixed(2)),
        'Muhasebe Kodu': '391.10',
        'Açıklama': 'Tıbbi Cihaz ve Medikal Sarf',
      },
      {
        'Hesap / Başlık': 'KDV %20 Satış Matrah ve Vergisi',
        'Oran': '%20',
        'Matrah (₺)': Number(vat.sales_vat_391.rate_20.matrah.toFixed(2)),
        'KDV Tutarı (₺)': Number(vat.sales_vat_391.rate_20.vat.toFixed(2)),
        'Muhasebe Kodu': '391.20',
        'Açıklama': 'Genel Oranlı Ürünler & Hizmet',
      },
      {
        'Hesap / Başlık': 'TOPLAM HESAPLANAN KDV',
        'Oran': '-',
        'Matrah (₺)': Number(vat.sales_vat_391.total_matrah.toFixed(2)),
        'KDV Tutarı (₺)': Number(vat.sales_vat_391.total_vat.toFixed(2)),
        'Muhasebe Kodu': '391 TOPLAM',
        'Açıklama': 'Müşterilerden Tahsil Edilen Toplam KDV',
      },
      {
        'Hesap / Başlık': '',
        'Oran': '',
        'Matrah (₺)': '',
        'KDV Tutarı (₺)': '',
        'Muhasebe Kodu': '',
        'Açıklama': '',
      },
      {
        'Hesap / Başlık': '2. İNDİRİLECEK KDV (191 HESAP - ALIŞLAR VE İŞLETME GİDERLERİ)',
        'Oran': '',
        'Matrah (₺)': '',
        'KDV Tutarı (₺)': '',
        'Muhasebe Kodu': '191',
        'Açıklama': `Dönem: ${data.period.label}`,
      },
      {
        'Hesap / Başlık': 'KDV %1 Alış Matrah ve Vergisi',
        'Oran': '%1',
        'Matrah (₺)': Number(vat.purchase_vat_191.rate_01.matrah.toFixed(2)),
        'KDV Tutarı (₺)': Number(vat.purchase_vat_191.rate_01.vat.toFixed(2)),
        'Muhasebe Kodu': '191.01',
        'Açıklama': 'Tedarik Alışları (%1)',
      },
      {
        'Hesap / Başlık': 'KDV %10 Alış Matrah ve Vergisi',
        'Oran': '%10',
        'Matrah (₺)': Number(vat.purchase_vat_191.rate_10.matrah.toFixed(2)),
        'KDV Tutarı (₺)': Number(vat.purchase_vat_191.rate_10.vat.toFixed(2)),
        'Muhasebe Kodu': '191.10',
        'Açıklama': 'Tıbbi Malzeme / İlaç Alışları',
      },
      {
        'Hesap / Başlık': 'KDV %20 Alış Matrah ve Vergisi',
        'Oran': '%20',
        'Matrah (₺)': Number(vat.purchase_vat_191.rate_20.matrah.toFixed(2)),
        'KDV Tutarı (₺)': Number(vat.purchase_vat_191.rate_20.vat.toFixed(2)),
        'Muhasebe Kodu': '191.20',
        'Açıklama': 'Genel Malzeme Alışı ve İşletme Giderleri',
      },
      {
        'Hesap / Başlık': 'TOPLAM İNDİRİLECEK KDV',
        'Oran': '-',
        'Matrah (₺)': Number(vat.purchase_vat_191.total_matrah.toFixed(2)),
        'KDV Tutarı (₺)': Number(vat.purchase_vat_191.total_vat.toFixed(2)),
        'Muhasebe Kodu': '191 TOPLAM',
        'Açıklama': 'Tedarikçilere Ödenen Toplam Girdi KDV',
      },
      {
        'Hesap / Başlık': '',
        'Oran': '',
        'Matrah (₺)': '',
        'KDV Tutarı (₺)': '',
        'Muhasebe Kodu': '',
        'Açıklama': '',
      },
      {
        'Hesap / Başlık': '3. AY SONU KDV DENGESİ & VERGİ BEYANI',
        'Oran': '',
        'Matrah (₺)': '',
        'KDV Tutarı (₺)': '',
        'Muhasebe Kodu': 'BEYAN',
        'Açıklama': '',
      },
      {
        'Hesap / Başlık': 'Hesaplanan KDV (391) - İndirilecek KDV (191) Farkı',
        'Oran': '-',
        'Matrah (₺)': Number((vat.sales_vat_391.total_matrah - vat.purchase_vat_191.total_matrah).toFixed(2)),
        'KDV Tutarı (₺)': Number(vat.net_vat.toFixed(2)),
        'Muhasebe Kodu': 'NET FARK',
        'Açıklama': vat.status,
      },
      {
        'Hesap / Başlık': 'ÖDENECEK KDV (Vergi Dairesine Tahakkuk Eden)',
        'Oran': '-',
        'Matrah (₺)': '-',
        'KDV Tutarı (₺)': Number(vat.payable_vat.toFixed(2)),
        'Muhasebe Kodu': '360',
        'Açıklama': vat.payable_vat > 0 ? 'Bu tutar vergi dairesine ödenecektir.' : 'Ödenecek vergi çıkmamıştır.',
      },
      {
        'Hesap / Başlık': 'SONRAKİ DÖNEME DEVREDEN KDV (Gelecek Aya Kalan Alacak)',
        'Oran': '-',
        'Matrah (₺)': '-',
        'KDV Tutarı (₺)': Number(vat.carryover_vat.toFixed(2)),
        'Muhasebe Kodu': '190',
        'Açıklama': vat.carryover_vat > 0 ? 'Sonraki ay KDV beyannamesinde 190 kodunda indirilecektir.' : 'Devreden KDV yoktur.',
      },
    ];

    const wsVat = XLSX.utils.json_to_sheet(vatRows);
    wsVat['!cols'] = [
      { wch: 54 }, // Hesap / Başlık
      { wch: 10 }, // Oran
      { wch: 20 }, // Matrah
      { wch: 20 }, // KDV Tutarı
      { wch: 18 }, // Muhasebe Kodu
      { wch: 45 }, // Açıklama
    ];
    XLSX.utils.book_append_sheet(wb, wsVat, 'Ay Sonu KDV Özeti');

    // ── SHEET 5: Çek / Senet Portföyü ──
    const checkRows: any[] = [];
    let totCheckAmount = 0;

    data.checks_portfolio.forEach((c) => {
      totCheckAmount += c.amount;
      checkRows.push({
        'Portföy Türü': c.check_type,
        'Çek Seri No': c.check_number,
        'Banka / Şube': c.bank_branch,
        'Keşideci (Borçlu)': c.issuer,
        'İlgili Müşteri / Tedarikçi': c.contact_name,
        'Keşide Tarihi': c.issue_date,
        'Vade Tarihi': c.due_date,
        'Tutar (₺)': Number(c.amount.toFixed(2)),
        'Portföy Durumu': c.status,
        'Açıklama / Not': c.notes,
      });
    });

    checkRows.push({
      'Portföy Türü': 'TOPLAM',
      'Çek Seri No': `${data.checks_portfolio.length} Adet Çek`,
      'Banka / Şube': '-',
      'Keşideci (Borçlu)': '-',
      'İlgili Müşteri / Tedarikçi': '-',
      'Keşide Tarihi': '-',
      'Vade Tarihi': '-',
      'Tutar (₺)': Number(totCheckAmount.toFixed(2)),
      'Portföy Durumu': 'GENEL PORTFÖY TOPLAMI',
      'Açıklama / Not': '',
    });

    const wsChecks = XLSX.utils.json_to_sheet(checkRows);
    wsChecks['!cols'] = [
      { wch: 22 }, // Tür
      { wch: 18 }, // Seri No
      { wch: 26 }, // Banka / Şube
      { wch: 26 }, // Keşideci
      { wch: 26 }, // İlgili Cari
      { wch: 14 }, // Keşide Tarihi
      { wch: 14 }, // Vade Tarihi
      { wch: 18 }, // Tutar
      { wch: 22 }, // Durum
      { wch: 24 }, // Açıklama
    ];
    XLSX.utils.book_append_sheet(wb, wsChecks, 'Çek Portföyü');

    // ── Export Workbook to File ──
    const padMonth = String(data.period.month).padStart(2, '0');
    const filename = `Mali_Musavir_Paketi_${data.period.year}_${padMonth}.xlsx`;
    XLSX.writeFile(wb, filename);
  },
};
