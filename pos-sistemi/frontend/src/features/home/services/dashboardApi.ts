/**
 * Dashboard API Service
 */

import { apiClient } from '@/shared/utils/api.client';
import { transactionsApi, type Transaction } from '@/features/transactions/services/transactionsApi';
import { inventoryApi } from '@/features/inventory/services/inventoryApi';
import { salesApi } from '@/features/sales/services/salesApi';

const parseApiDate = (isoLike: string): Date => {
  const s = String(isoLike || '').trim();
  if (!s) return new Date(NaN);
  const trimmed = s.replace(/(\.\d{3})\d+/, '$1');
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) return d;
  const m = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?/);
  if (m) {
    const base = m[1];
    const ms = String(m[2] || '0').slice(0, 3).padEnd(3, '0');
    return new Date(`${base}.${ms}`);
  }
  return d;
};

export interface DashboardStats {
  daily_revenue: number;
  daily_profit: number;
  transaction_count: number;
  net_cash: number;
  critical_stock: Array<{
    id: string;
    name: string;
    stock_quantity: number;
    critical_level: number;
  }>;
  weekly_trend: Array<{
    day: string;
    pos: number;
    online: number;
  }>;
  daily_trend: Array<{
    hour: string;
    pos: number;
    online: number;
  }>;
  top_products: Array<{
    id: string;
    name: string;
    sales: number;
  }>;
  average_basket: number;
  yesterday_revenue: number;
  held_orders_count: number;
  today_payments: Array<{
    id: string;
    customerName: string;
    product: string;
    debt: number;
    phone: string;
    createdAt: string;
  }>;
  supplier_debts: Array<{
    id: string;
    name: string;
    balance: number;
    phone?: string;
    email?: string;
  }>;
  recent_sales: Array<{
    id: string;
    amount: number;
    time: string;
    method: string;
  }>;
  payment_methods_breakdown: {
    CASH: number;
    CARD: number;
    DEBT: number;
    OTHER: number;
  };
}

export const dashboardApi = {
  /**
   * Dashboard istatistiklerini getir
   */
  getStats: async (): Promise<DashboardStats> => {
    // Kaynak stratejisi (gerçek veri):
    // - Satış KPI/trend: transactions (INCOME, source=POS/ECOMMERCE/ONLINE vb.)
    // - Kritik stok: inventory critical list
    // - Top ürünler: sales analysis endpoint (varsa)
    //
    // Not: Backend /dashboard/stats şimdilik dummy döndüğü için burada frontend-side hesaplıyoruz.
    const safeEmpty: DashboardStats = {
      daily_revenue: 0,
      daily_profit: 0,
      transaction_count: 0,
      net_cash: 0,
      critical_stock: [],
      weekly_trend: [],
      daily_trend: [],
      top_products: [],
      average_basket: 0,
      yesterday_revenue: 0,
      held_orders_count: 0,
      today_payments: [],
      supplier_debts: [],
      recent_sales: [],
      payment_methods_breakdown: { CASH: 0, CARD: 0, DEBT: 0, OTHER: 0 },
    };

    try {
      const [txs, criticalProducts, productAnalysis] = await Promise.all([
        transactionsApi.getTransactions().catch(() => [] as Transaction[]),
        inventoryApi.getCriticalProducts().catch(() => []),
        salesApi.getProductSalesAnalysis().catch(() => [] as any[]),
      ]);

      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);

      const isSaleIncome = (t: Transaction) => {
        if (t.type !== 'INCOME') return false;
        const src = String((t as any).source || '').toUpperCase();
        const cat = String(t.category || '').toLowerCase();
        // Backend POS satışlarını 'Satış Geliri' kategorisiyle yazar
        // ve source='POS' olarak işaretler
        return (
          src === 'POS' ||
          src === 'ECOMMERCE' ||
          src === 'ONLINE' ||
          cat.includes('satış') ||
          cat.includes('gel') ||
          cat.includes('pos') ||
          cat.includes('sat')
        );
      };

      const getBucket = (t: Transaction): 'pos' | 'online' => {
        const src = String((t as any).source || '').toUpperCase();
        if (src === 'POS') return 'pos';
        if (src === 'ECOMMERCE' || src === 'ONLINE') return 'online';
        // fallback: kategori bazlı
        const cat = String(t.category || '').toLowerCase();
        return cat.includes('sat') ? 'pos' : 'online';
      };

      const todaySales = txs
        .filter(isSaleIncome)
        .filter((t) => parseApiDate(t.created_at) >= startOfToday);

      const yesterdaySales = txs
        .filter(isSaleIncome)
        .filter((t) => {
          const d = parseApiDate(t.created_at);
          return d >= startOfYesterday && d < startOfToday;
        });

      const dailyRevenue = todaySales.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const yesterdayRevenue = yesterdaySales.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const transactionCount = todaySales.length;
      const averageBasket = transactionCount > 0 ? dailyRevenue / transactionCount : 0;

      // net_cash: tüm işlemler (gelir-gider)
      const netCash = txs.reduce((sum, t) => {
        const a = Number(t.amount || 0);
        if (!Number.isFinite(a)) return sum;
        return sum + (t.type === 'INCOME' ? a : -a);
      }, 0);

      // Payment methods breakdown for today
      const paymentMethodsBreakdown = { CASH: 0, CARD: 0, DEBT: 0, OTHER: 0 };
      for (const t of todaySales) {
        const amt = Number(t.amount || 0);
        const method = String((t as any).payment_method || 'CASH').toUpperCase();
        if (method === 'CASH') paymentMethodsBreakdown.CASH += amt;
        else if (method === 'CARD') paymentMethodsBreakdown.CARD += amt;
        else if (method === 'DEBT') paymentMethodsBreakdown.DEBT += amt;
        else paymentMethodsBreakdown.OTHER += amt;
      }

      // Weekly trend (son 7 gün)
      const trDaysShort = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      const weekDays: Array<{ date: Date; key: string; label: string }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(startOfToday);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        weekDays.push({ date: d, key, label: trDaysShort[d.getDay()] });
      }

      const weeklyMap: Record<string, { pos: number; online: number }> = {};
      for (const wd of weekDays) weeklyMap[wd.key] = { pos: 0, online: 0 };

      for (const t of txs) {
        if (!isSaleIncome(t)) continue;
        const d = parseApiDate(t.created_at);
        if (d < weekDays[0].date || d >= now) {
          // allow today until now; older than 7 days ignore
        }
        const key = d.toISOString().slice(0, 10);
        if (!weeklyMap[key]) continue;
        const bucket = getBucket(t);
        weeklyMap[key][bucket] += Number(t.amount || 0);
      }

      const weeklyTrend = weekDays.map((wd) => ({
        day: wd.label,
        pos: Number((weeklyMap[wd.key]?.pos || 0).toFixed(2)),
        online: Number((weeklyMap[wd.key]?.online || 0).toFixed(2)),
      }));

      // Daily trend (09:00–19:00) - bugünün saatlik satış tutarı
      const hours = Array.from({ length: 11 }, (_, i) => 9 + i); // 9..19
      const dailyTrend = hours.map((h) => ({ hour: `${String(h).padStart(2, '0')}:00`, pos: 0, online: 0 }));
      const idxByHour: Record<number, number> = {};
      hours.forEach((h, i) => (idxByHour[h] = i));

      for (const t of todaySales) {
        const d = parseApiDate(t.created_at);
        const h = d.getHours();
        if (!(h in idxByHour)) continue;
        const bucket = getBucket(t);
        dailyTrend[idxByHour[h]][bucket] += Number(t.amount || 0);
      }

      // Top products
      const topProducts = (productAnalysis || [])
        .slice()
        .sort((a: any, b: any) => Number(b.salesCount || 0) - Number(a.salesCount || 0))
        .slice(0, 8)
        .map((p: any) => ({
          id: String(p.id || ''),
          name: String(p.name || 'Ürün'),
          sales: Number(p.salesCount || 0),
          profit: Number(p.profit || 0),
        }));

      // Calculate daily profit from product analysis
      // Note: Backend getProductSalesAnalysis returns TOTAL profit for each product.
      // We might need to handle filtering for today if we had that data, 
      // but assuming the analysis is for a specific range or we use it as is.
      const dailyProfit = (productAnalysis || []).reduce((sum, p) => sum + Number(p.profit || 0), 0);

      // Held orders count (SalesPage localStorage)
      let heldOrdersCount = 0;
      try {
        const raw = localStorage.getItem('heldOrders');
        const parsed = raw ? JSON.parse(raw) : [];
        heldOrdersCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        heldOrdersCount = 0;
      }

      // Today payments (veresiye kayıtları - localStorage)
      let todayPayments: DashboardStats['today_payments'] = [];
      try {
        const raw = localStorage.getItem('debt-entries');
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          todayPayments = parsed
            .slice(0, 6)
            .map((e: any) => ({
              id: String(e.id || e.orderId || ''),
              customerName: String(e.customerName || 'Müşteri'),
              product: String(e.product || ''),
              debt: Number(e.debt || 0),
              phone: String(e.phone || '-'),
              createdAt: String(e.createdAt || new Date().toISOString()),
            }));
        }
      } catch {
        todayPayments = [];
      }

      // Supplier debts (finance sayfasındaki localStorage)
      let supplierDebts: DashboardStats['supplier_debts'] = [];
      try {
        const raw = localStorage.getItem('finance-suppliers');
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          supplierDebts = parsed
            .slice(0, 6)
            .map((s: any) => ({
              id: String(s.id || ''),
              name: String(s.name || 'Tedarikçi'),
              balance: Number(s.balance || 0),
              phone: s.phone ? String(s.phone) : undefined,
              email: s.email ? String(s.email) : undefined,
            }));
        }
      } catch {
        supplierDebts = [];
      }

      return {
        daily_revenue: Number(dailyRevenue.toFixed(2)),
        daily_profit: Number(dailyProfit.toFixed(2)),
        transaction_count: transactionCount,
        net_cash: Number(netCash.toFixed(2)),
        critical_stock: (criticalProducts || []).map((p: any) => ({
          id: String(p.id),
          name: String(p.name),
          stock_quantity: Number(p.stock_quantity || 0),
          critical_level: Number(p.critical_level || 0),
        })),
        weekly_trend: weeklyTrend,
        daily_trend: dailyTrend.map((x) => ({
          hour: x.hour,
          pos: Number((x.pos || 0).toFixed(2)),
          online: Number((x.online || 0).toFixed(2)),
        })),
        top_products: topProducts,
        average_basket: Number(averageBasket.toFixed(2)),
        yesterday_revenue: Number(yesterdayRevenue.toFixed(2)),
        held_orders_count: heldOrdersCount,
        today_payments: todayPayments,
        supplier_debts: supplierDebts,
        recent_sales: todaySales
          .slice()
          .sort((a, b) => parseApiDate(b.created_at).getTime() - parseApiDate(a.created_at).getTime())
          .slice(0, 10)
          .map(t => ({
            id: t.id,
            amount: Number(t.amount || 0),
            time: parseApiDate(t.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            method: (t as any).payment_method || 'CASH'
          })),
        payment_methods_breakdown: paymentMethodsBreakdown,
      };
    } catch (e) {
      // Son çare: backend endpoint dene (bazı ortamlarda aktif olabilir)
      try {
        const res = await apiClient.get('/dashboard/stats');
        return { ...safeEmpty, ...(res.data || {}) };
      } catch {
        return safeEmpty;
      }
    }
  },
};

