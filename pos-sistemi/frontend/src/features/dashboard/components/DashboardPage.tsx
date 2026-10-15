/**
 * Dashboard Page Component
 * Güncellenmiş Bento Grid Layout - Modern Dashboard Tasarımı
 */

import { useState, useEffect, useCallback } from 'react';
import { useSaleCompletedListener } from '@/shared/hooks/useSaleCompletedListener';
import { PageHeader } from '@/shared/components';
import {
  RadialBarChart,
  RadialBar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Save, Trash2, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Pause, ArrowDownCircle, ArrowUpCircle, Plus, X, Info } from 'lucide-react';
import { ecommerceApi } from '../../ecommerce/services/ecommerceApi';
import { RevenueAnalytics } from '../../ecommerce/types/ecommerce.types';
import { salesApi } from '../../sales/services/salesApi';
import { transactionsApi, Transaction } from '../../transactions/services/transactionsApi';
import { inventoryApi } from '../../inventory/services/inventoryApi';
import { apiClient } from '@/shared/utils/api.client';
import { cn } from '@/shared/utils/cn';

// ========== CONSTANTS ==========

// Günlük Hedef
const DAILY_TARGET = 3000;
const profitMargin = 0.30; // %30 kar marjı

// Veresiye Girişi Interface
interface DebtEntry {
  id: string;
  customerName: string;
  product: string;
  debt: number;
  phone: string;
  createdAt: string;
  dueDate?: string;
  isApproved?: boolean;
}

// Tedarikçi Borcu Interface
interface SupplierDebt {
  id: string;
  name: string;
  balance: number;
  phone?: string;
  email?: string;
}

function DashKPICard({
  title, value, sub1, sub2, icon: Icon, iconBg, trend, trendUp,
}: {
  title: string; value: string; sub1?: string; sub2?: string;
  icon: any; iconBg: string; trend?: string; trendUp?: boolean;
}) {
  return (
    <div className="bg-slate-50/85 rounded-xl border border-slate-400 shadow-sm p-5 hover:shadow-md hover:border-slate-500 transition-all hover:bg-slate-100/60">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{title}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none tracking-tight">{value}</p>
      {sub1 && <p className="text-xs text-emerald-600 font-semibold mt-2">{sub1}</p>}
      {sub2 && <p className="text-xs text-slate-400 mt-0.5">{sub2}</p>}
      {trend !== undefined && (
        <div className="mt-3 pt-2.5 border-t border-slate-200/65">
          <p className={`text-[10px] font-bold uppercase tracking-tight leading-none ${trendUp ? 'text-emerald-600' : 'text-rose-500'}`}>
            {trend}
          </p>
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const [noteContent, setNoteContent] = useState('');
  const [densityView, setDensityView] = useState<'daily' | 'weekly'>('daily');
  const [revenueAnalytics, setRevenueAnalytics] = useState<RevenueAnalytics | null>(null);

  // Uzaktan Duyurular ve Sayfa Güncellemeleri
  interface Announcement {
    id: string;
    title: string;
    content: string;
    type: 'info' | 'warning' | 'success' | 'danger';
    date?: string;
  }
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    apiClient.get('/system/remote-content')
      .then(res => {
        if (res.data && Array.isArray(res.data.announcements)) {
          setAnnouncements(res.data.announcements);
        }
      })
      .catch(err => console.log('Uzak duyuru verileri alinamadi:', err));
  }, []);
  const [todayPayments, setTodayPayments] = useState<DebtEntry[]>([]);
  const [heldOrdersCount, setHeldOrdersCount] = useState(0);
  const [paymentViewMode, setPaymentViewMode] = useState<'receivables' | 'payables'>('receivables');
  const [supplierDebts, setSupplierDebts] = useState<SupplierDebt[]>([]);
  const [paymentMethodStats, setPaymentMethodStats] = useState<{
    data: Array<{
      method: string;
      label: string;
      count: number;
      total: number;
      percentage: number;
    }>;
    summary: {
      total_count: number;
      total_amount: number;
    };
  } | null>(null);
  const [expenseIncomeView, setExpenseIncomeView] = useState<'expenses' | 'incomes'>('expenses');
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [incomes, setIncomes] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  
  // KPI Verileri
  const [kpiData, setKpiData] = useState({
    dailyRevenue: { value: 0, change: 0, isPositive: true },
    transactionCount: { value: 0, change: 0, isPositive: true },
    averageBasket: { value: 0, change: 0, isPositive: true },
    netCash: { value: 0, change: 0, isPositive: true },
  });
  
  // Kritik Stok Ürünleri
  const [lowStockItems, setLowStockItems] = useState<Array<{ name: string; stock: number }>>([]);
  
  // Haftalık Satış Trendi
  const [weeklySalesData, setWeeklySalesData] = useState<Array<{ day: string; pos: number; online: number }>>([]);
  
  // En Çok Satanlar
  const [topProductsData, setTopProductsData] = useState<Array<{ name: string; sales: number }>>([]);
  const [maxSales, setMaxSales] = useState(0);
  
  // Günlük ve Haftalık Yoğunluk
  const [hourlyData, setHourlyData] = useState<Array<{ hour: string; sales: number }>>([]);
  const [weeklyDensityData, setWeeklyDensityData] = useState<Array<{ day: string; density: number }>>([]);
  
  // Günlük hedef ve kar hesaplamaları
  const [targetPercentage, setTargetPercentage] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [profitPercentage, setProfitPercentage] = useState(0);
  const [todayProfitAmount, setTodayProfitAmount] = useState(0);

  // Not defteri içeriğini localStorage'dan yükle
  useEffect(() => {
    const savedNote = localStorage.getItem('dashboard-note');
    if (savedNote) {
      setNoteContent(savedNote);
    }
  }, []);

  // Online satış verilerini yükle
  useEffect(() => {
    const loadEcommerceData = async () => {
      try {
        const revenueData = await ecommerceApi.getRevenueAnalytics();
        setRevenueAnalytics(revenueData);
      } catch (error) {
        console.error('E-Ticaret verileri yüklenemedi:', error);
      }
    };
    loadEcommerceData();
  }, []);

  // Günü gelen ödemeleri yükle (Veresiye Defteri)
  useEffect(() => {
    const loadTodayPayments = () => {
      try {
        const savedDebts = localStorage.getItem('debt-entries');
        if (savedDebts) {
          const debts: DebtEntry[] = JSON.parse(savedDebts);
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD formatı
          
          // Bugün vadesi gelen ödemeleri filtrele
          const todayDebts = debts.filter(debt => {
            if (!debt.dueDate) return false;
            const dueDate = new Date(debt.dueDate).toISOString().split('T')[0];
            return dueDate === today && !debt.isApproved; // Onaylanmamış olanlar
          });
          
          setTodayPayments(todayDebts);
        }
      } catch (error) {
        console.error('Günü gelen ödemeler yüklenemedi:', error);
      }
    };
    
    loadTodayPayments();
    // Her 30 saniyede bir güncelle
    const interval = setInterval(loadTodayPayments, 30000);
    return () => clearInterval(interval);
  }, []);

  // Bekleyen siparişleri yükle
  useEffect(() => {
    const loadHeldOrders = () => {
      try {
        const saved = localStorage.getItem('heldOrders');
        if (saved) {
          const orders = JSON.parse(saved);
          setHeldOrdersCount(Array.isArray(orders) ? orders.length : 0);
        } else {
          setHeldOrdersCount(0);
        }
      } catch (error) {
        console.error('Bekleyen siparişler yüklenemedi:', error);
        setHeldOrdersCount(0);
      }
    };
    
    loadHeldOrders();
    // Her 10 saniyede bir güncelle
    const interval = setInterval(loadHeldOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  // Tedarikçi borçlarını yükle
  useEffect(() => {
    const loadSupplierDebts = async () => {
      try {
        // Finance API'den tedarikçileri çek
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - modül opsiyonel olabilir (deploy/feature flag)
        const financeModule = await import('../../finance/services/financeApi').catch(() => null);
        if (!financeModule || !financeModule.suppliersApi) {
          setSupplierDebts([]);
          return;
        }
        
        const suppliers = await financeModule.suppliersApi.getAll().catch(() => []);
        
        // Sadece borcu olan tedarikçileri filtrele (current_balance > 0)
        const debts = suppliers
          .filter((s: any) => s.current_balance > 0)
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            balance: s.current_balance,
            phone: s.phone || '',
            email: s.email || '',
          }));
        
        setSupplierDebts(debts);
      } catch (error) {
        console.error('Tedarikçi borçları yüklenemedi:', error);
        // Hata durumunda boş array
        setSupplierDebts([]);
      }
    };
    
    loadSupplierDebts();
    // Her 30 saniyede bir güncelle
    const interval = setInterval(loadSupplierDebts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Ödeme yöntemleri istatistiklerini yükle
  const loadPaymentMethodStats = useCallback(async () => {
    try {
      const stats = await salesApi.getPaymentMethodStatistics();
      setPaymentMethodStats(stats);
    } catch (error) {
      console.error('Ödeme yöntemleri istatistikleri yüklenemedi:', error);
      setPaymentMethodStats(null);
    }
  }, []);

  useEffect(() => {
    loadPaymentMethodStats();
  }, [loadPaymentMethodStats]);

  // Satış tamamlandığında ödeme yöntemi istatistiklerini yenile
  useSaleCompletedListener({
    onSaleCompleted: loadPaymentMethodStats,
    refreshInterval: 10000, // Her 10 saniyede bir güncelle
  });

  // Gelir ve gider verilerini yükle
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        const allTransactions = await transactionsApi.getTransactions();
        const incomeList = allTransactions.filter(t => t.type === 'INCOME').slice(0, 10);
        const expenseList = allTransactions.filter(t => t.type === 'EXPENSE').slice(0, 10);
        setIncomes(incomeList);
        setExpenses(expenseList);
      } catch (error) {
        console.error('İşlemler yüklenemedi:', error);
      }
    };
    
    loadTransactions();
    // Her 30 saniyede bir güncelle
    const interval = setInterval(loadTransactions, 30000);
    return () => clearInterval(interval);
  }, []);

  // KPI verilerini yükle (Gerçek satış verilerinden)
  useEffect(() => {
    const loadKpiData = async () => {
      try {
        const getLocalDateStr = (d: Date | string) => {
          let date: Date;
          if (typeof d === 'string') {
            date = d.endsWith('Z') || d.includes('+') ? new Date(d) : new Date(d + 'Z');
          } else {
            date = d;
          }
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        const now = new Date();
        const todayStr = getLocalDateStr(now);
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getLocalDateStr(yesterday);
        
        // Orders API'sinden bugünkü ve dünkü siparişleri çek
        const [allOrders, yesterdaySummary, balance] = await Promise.all([
          apiClient.get('/orders', { params: { include_deleted: false } }).catch(() => ({ data: [] })),
          transactionsApi.getDailySummary(yesterdayStr).catch(() => ({ income: 0, expense: 0, net: 0, total_count: 0, income_count: 0, expense_count: 0 })),
          transactionsApi.getBalance().catch(() => 0),
        ]);

        const orders = allOrders.data || [];
        
        // Bugünkü siparişleri filtrele (TÜM KAYNAKLAR: POS, ONLINE, ve fatura sayfasından)
        const todayOrders = orders.filter((order: any) => {
          return getLocalDateStr(order.created_at) === todayStr;
        });
        
        // Dünkü siparişleri filtrele (TÜM KAYNAKLAR)
        const yesterdayOrders = orders.filter((order: any) => {
          return getLocalDateStr(order.created_at) === yesterdayStr;
        });

        // Bugünkü toplam ciro (TÜM KAYNAKLARDAN gerçek satışlardan)
        const dailyRevenue = todayOrders.reduce((sum: number, order: any) => sum + (order.final_amount || 0), 0);
        const yesterdayRevenue = yesterdayOrders.reduce((sum: number, order: any) => sum + (order.final_amount || 0), 0);
        const revenueChange = yesterdayRevenue > 0 ? ((dailyRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

        // İşlem sayısı (sipariş sayısı)
        const transactionCount = todayOrders.length;
        const yesterdayCount = yesterdayOrders.length;
        const countChange = yesterdayCount > 0 ? ((transactionCount - yesterdayCount) / yesterdayCount) * 100 : 0;

        // Ortalama sepet
        const avgBasket = transactionCount > 0 ? dailyRevenue / transactionCount : 0;
        const yesterdayAvgBasket = yesterdayCount > 0 ? yesterdayRevenue / yesterdayCount : 0;
        const avgBasketChange = yesterdayAvgBasket > 0 ? ((avgBasket - yesterdayAvgBasket) / yesterdayAvgBasket) * 100 : 0;

        // Net kasa
        const netCash = balance;
        const yesterdayNet = yesterdaySummary.net || 0;
        const netChange = yesterdayNet !== 0 ? ((netCash - yesterdayNet) / Math.abs(yesterdayNet)) * 100 : 0;

        setKpiData({
          dailyRevenue: {
            value: dailyRevenue,
            change: revenueChange,
            isPositive: revenueChange >= 0,
          },
          transactionCount: {
            value: transactionCount,
            change: countChange,
            isPositive: countChange >= 0,
          },
          averageBasket: {
            value: avgBasket,
            change: avgBasketChange,
            isPositive: avgBasketChange >= 0,
          },
          netCash: {
            value: netCash,
            change: netChange,
            isPositive: netChange >= 0,
          },
        });

        // Günlük hedef hesaplamaları (gerçek satışlardan)
        const targetPct = Math.min((dailyRevenue / DAILY_TARGET) * 100, 100);
        setTargetPercentage(targetPct);
        setRemaining(Math.max(DAILY_TARGET - dailyRevenue, 0));
        
        // Kar hesaplama (siparişlerden toplam kar marjı)
        const todayProfit = todayOrders.reduce((sum: number, order: any) => {
          const totalCost = (order.items || []).reduce((itemSum: number, item: any) => {
            return itemSum + ((item.unit_buy_price || 0) * (item.quantity || 0));
          }, 0);
          return sum + ((order.final_amount || 0) - totalCost);
        }, 0);
        const profitTgt = DAILY_TARGET * profitMargin;
        setProfitPercentage(Math.min((todayProfit / profitTgt) * 100, 100));
        setTodayProfitAmount(todayProfit);
      } catch (error) {
        console.error('KPI verileri yüklenemedi:', error);
      }
    };
    
    loadKpiData();
    const interval = setInterval(loadKpiData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Kritik stok ürünlerini yükle
  useEffect(() => {
    const loadLowStockItems = async () => {
      try {
        const products = await inventoryApi.getProducts({ stock_status: 'low' });
        const lowStock = products
          .filter(p => p.stock_quantity <= p.critical_level)
          .map(p => ({ name: p.name, stock: p.stock_quantity }))
          .slice(0, 10);
        setLowStockItems(lowStock);
      } catch (error) {
        console.error('Kritik stok ürünleri yüklenemedi:', error);
        setLowStockItems([]);
      }
    };
    
    loadLowStockItems();
    const interval = setInterval(loadLowStockItems, 60000);
    return () => clearInterval(interval);
  }, []);

  // En çok satanları yükle (TÜM KAYNAKLARDAN: Satış sayfası, E-ticaret, Fatura sayfası - ANLIK)
  useEffect(() => {
    const loadTopProducts = async () => {
      try {
        // Orders API'sinden tüm siparişleri çek (TÜM KAYNAKLAR: POS, ONLINE, ve diğerleri)
        const response = await apiClient.get('/orders', { params: { include_deleted: false } }).catch(() => ({ data: [] }));
        const orders = response.data || [];
        
        // Tüm ürünleri önce çek (isimleri için)
        const allProducts = await inventoryApi.getProducts().catch(() => []);
        const productMap = new Map(allProducts.map((p: any) => [p.id, p.name]));
        
        // Ürün bazında satış sayısını hesapla (TÜM KAYNAKLARDAN)
        const productSales: Record<string, { name: string; sales: number }> = {};
        
        orders.forEach((order: any) => {
          // Tüm siparişlerden ürünleri topla (kaynak fark etmeksizin: POS, ONLINE, Fatura)
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item: any) => {
              const productId = item.product_id;
              // Product ismini önce item'dan, yoksa productMap'ten al
              const productName = item.product?.name || productMap.get(productId) || 'Bilinmeyen Ürün';
              
              if (!productSales[productId]) {
                productSales[productId] = { name: productName, sales: 0 };
              }
              productSales[productId].sales += item.quantity || 0;
            });
          }
        });
        
        // En çok satanları sırala ve ilk 5'i al (sadece gerçek satışları göster)
        const topProducts = Object.values(productSales)
          .filter(p => p.sales > 0) // Sadece satışı olan ürünleri göster
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5);
        
        setTopProductsData(topProducts);
        if (topProducts.length > 0) {
          setMaxSales(Math.max(...topProducts.map(p => p.sales)));
        } else {
          setMaxSales(0);
        }
      } catch (error) {
        console.error('En çok satanlar yüklenemedi:', error);
        setTopProductsData([]);
        setMaxSales(0);
      }
    };
    
    loadTopProducts();
    const interval = setInterval(loadTopProducts, 10000); // Her 10 saniyede bir güncelle (anlık)
    return () => clearInterval(interval);
  }, []);

  // Haftalık satış trendini yükle (Gerçek sipariş verilerinden, haftalık sıfırlama ile)
  useEffect(() => {
    const loadWeeklySales = async () => {
      try {
        // Haftanın başlangıcını bul (Pazartesi)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        monday.setHours(0, 0, 0, 0);
        
        // Orders API'sinden tüm siparişleri çek
        const response = await apiClient.get('/orders', { params: { include_deleted: false } }).catch(() => ({ data: [] }));
        const orders = response.data || [];
        
        const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
        const weeklyData = [];
        
        // Son 7 günü işle (bu hafta)
        for (let i = 0; i < 7; i++) {
          const date = new Date(monday);
          date.setDate(monday.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          const dayName = dayNames[date.getDay()];
          
          // Bu güne ait POS siparişlerini filtrele (Satış sayfası ve Fatura sayfası)
          const dayOrders = orders.filter((order: any) => {
            const orderDate = new Date(order.created_at);
            orderDate.setHours(0, 0, 0, 0);
            return orderDate.toISOString().split('T')[0] === dateStr && (order.source === 'POS' || !order.source);
          });
          
          // Bu güne ait online siparişleri filtrele (E-ticaret sayfası)
          const dayOnlineOrders = orders.filter((order: any) => {
            const orderDate = new Date(order.created_at);
            orderDate.setHours(0, 0, 0, 0);
            return orderDate.toISOString().split('T')[0] === dateStr && order.source === 'ONLINE';
          });
          
          // POS ciro
          const posRevenue = dayOrders.reduce((sum: number, order: any) => sum + (order.final_amount || 0), 0);
          
          // Online ciro
          const onlineRevenue = dayOnlineOrders.reduce((sum: number, order: any) => sum + (order.final_amount || 0), 0);
          
          weeklyData.push({
            day: dayName,
            pos: posRevenue,
            online: onlineRevenue,
          });
        }
        
        setWeeklySalesData(weeklyData);
      } catch (error) {
        console.error('Haftalık satış trendi yüklenemedi:', error);
        setWeeklySalesData([]);
      }
    };
    
    loadWeeklySales();
    const interval = setInterval(loadWeeklySales, 30000); // Her 30 saniyede bir güncelle
    return () => clearInterval(interval);
  }, []);

  // Günlük ve haftalık yoğunluk verilerini yükle (Gerçek verilerden)
  useEffect(() => {
    const loadDensityData = async () => {
      try {
        // Günlük yoğunluk (saatlik) - Bugünkü siparişlerden hesapla
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        
        // Orders API'sinden bugünkü siparişleri çek
        const response = await apiClient.get('/orders', { params: { include_deleted: false } }).catch(() => ({ data: [] }));
        const orders = response.data || [];
        
        // Bugünkü siparişleri filtrele (TÜM KAYNAKLAR)
        const todayOrders = orders.filter((order: any) => {
          const orderDate = new Date(order.created_at);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate.toISOString().split('T')[0] === todayStr;
        });
        
        // Saatlere göre grupla (TÜM KAYNAKLARDAN)
        const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
        const hourly = hours.map(hour => {
          const hourNum = parseInt(hour.split(':')[0]);
          const sales = todayOrders.filter((order: any) => {
            const orderHour = new Date(order.created_at).getHours();
            return orderHour === hourNum;
          }).length;
          return { hour, sales };
        });
        
        setHourlyData(hourly);
        
        // Haftalık yoğunluk - Haftalık satış verilerinden hesapla
        if (weeklySalesData.length > 0) {
          const maxDaily = Math.max(...weeklySalesData.map(d => d.pos + d.online));
          const weeklyDensity = weeklySalesData.map(d => ({
            day: d.day,
            density: maxDaily > 0 ? Math.round(((d.pos + d.online) / maxDaily) * 100) : 0,
          }));
          setWeeklyDensityData(weeklyDensity);
        }
      } catch (error) {
        console.error('Yoğunluk verileri yüklenemedi:', error);
        setHourlyData([]);
      }
    };
    
    loadDensityData();
    const interval = setInterval(loadDensityData, 60000); // Her 1 dakikada bir güncelle
    return () => clearInterval(interval);
  }, [weeklySalesData]);

  // Not defteri içeriğini kaydet
  const handleSaveNote = () => {
    localStorage.setItem('dashboard-note', noteContent);
    alert('Not kaydedildi!');
  };

  // Not defteri içeriğini temizle
  const handleClearNote = () => {
    setNoteContent('');
    localStorage.removeItem('dashboard-note');
  };


  // Haftalık satış verileri zaten gerçek verilerden geldiği için direkt kullan
  const weeklySalesWithOnline = weeklySalesData;

  // Ticker metnini oluştur (tekrarlanmış - kesintisiz animasyon için)
  const tickerText = lowStockItems
    .map((item) => `⚠️ ${item.name} (${item.stock} Adet)`)
    .join('  |  ');
  // Animasyonun kesintisiz çalışması için içeriği 2 kez tekrarla
  const repeatedTickerText = `${tickerText}  |  ${tickerText}  |  `;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <PageHeader
        title="GENEL BAKIŞ"
        subtitle="Günlük Performans ve İş Özeti"
        icon={true}
      />

      <div className="flex-1 p-6 space-y-5 max-w-[1600px] mx-auto w-full">

        {/* Uzaktan Duyurular Paneli */}
        {announcements.length > 0 && (
          <div className="space-y-3">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className={cn(
                  "p-4 border rounded-lg flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm",
                  ann.type === 'warning' ? "bg-amber-50/50 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-300" :
                  ann.type === 'success' ? "bg-emerald-50/50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-300" :
                  ann.type === 'danger' ? "bg-rose-50/50 border-rose-200 text-rose-900 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-300" :
                  "bg-blue-50/50 border-blue-200 text-blue-900 dark:bg-blue-950/20 dark:border-blue-900/50 dark:text-blue-300"
                )}
              >
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider leading-none mb-1.5">{ann.title}</h4>
                  <p className="text-xs font-semibold leading-relaxed opacity-90">{ann.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── KPI KARTLARI ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashKPICard
            title="GÜNLÜK CİRO"
            value={`${kpiData.dailyRevenue.value.toFixed(2)} ₺`}
            sub1={`Kar: ${todayProfitAmount.toFixed(2)} ₺`}
            sub2={revenueAnalytics && revenueAnalytics.online_revenue > 0
              ? `Online: ${revenueAnalytics.online_revenue.toFixed(2)} ₺`
              : `Dün'e göre ${kpiData.dailyRevenue.isPositive ? '+' : ''}${kpiData.dailyRevenue.change.toFixed(1)}%`}
            icon={DollarSign}
            iconBg={kpiData.dailyRevenue.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}
            trend={`${kpiData.dailyRevenue.isPositive ? '+' : ''}${kpiData.dailyRevenue.change.toFixed(1)}% Değişim`}
            trendUp={kpiData.dailyRevenue.isPositive}
          />
          <DashKPICard
            title="İŞLEM SAYISI"
            value={`${kpiData.transactionCount.value}`}
            sub2={`Dün'e göre ${kpiData.transactionCount.isPositive ? '+' : ''}${kpiData.transactionCount.change.toFixed(1)}%`}
            icon={TrendingUp}
            iconBg={kpiData.transactionCount.isPositive ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}
            trend={`${kpiData.transactionCount.isPositive ? '+' : ''}${kpiData.transactionCount.change.toFixed(1)}% Değişim`}
            trendUp={kpiData.transactionCount.isPositive}
          />
          <DashKPICard
            title="BEKLEYEN SİPARİŞLER"
            value={`${heldOrdersCount}`}
            sub2="Kargoya verilmeyi bekleyen siparişler"
            icon={Pause}
            iconBg="bg-amber-50 text-amber-600"
          />
          <DashKPICard
            title="NET KASA"
            value={`${kpiData.netCash.value.toFixed(2)} ₺`}
            sub2={`Dün'e göre ${kpiData.netCash.isPositive ? '+' : ''}${kpiData.netCash.change.toFixed(1)}%`}
            icon={ArrowUpCircle}
            iconBg={kpiData.netCash.isPositive ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}
            trend={`${kpiData.netCash.isPositive ? '+' : ''}${kpiData.netCash.change.toFixed(1)}% Değişim`}
            trendUp={kpiData.netCash.isPositive}
          />
        </div>

        {/* ── KRİTİK STOK TICKER ── */}
        {lowStockItems.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl h-11 overflow-hidden shadow-sm flex">
            <div className="flex-shrink-0 flex items-center bg-rose-50 border-r border-rose-100 px-4 gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-widest whitespace-nowrap">
                Kritik Stok
              </span>
            </div>
            <div className="flex-1 overflow-hidden flex items-center pl-4">
              <div className="marquee text-sm text-slate-600 font-medium">
                {repeatedTickerText}
              </div>
            </div>
          </div>
        )}

        {/* ── GRAFİK VE HEDEF ── */}
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-5">
              Haftalık Satış Trendi
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              {weeklySalesWithOnline.length > 0 ? (
                <AreaChart data={weeklySalesWithOnline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPOS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area type="monotone" dataKey="pos" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPOS)" name="Mağaza (POS)" />
                  <Area type="monotone" dataKey="online" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorOnline)" name="E-Ticaret" />
                </AreaChart>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-slate-400">Bu hafta henüz satış verisi yok</p>
                </div>
              )}
            </ResponsiveContainer>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-5">
              Ciro &amp; Kar Hedefi
            </h3>
            <div className="relative" style={{ height: '280px' }}>
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="50%" outerRadius="95%"
                    data={[{ name: 'Ciro', value: targetPercentage }]}
                    startAngle={90} endAngle={90 - (targetPercentage / 100) * 360} barSize={20}>
                    <RadialBar dataKey="value" cornerRadius={10} fill="#3b82f6" />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div style={{ width: '60%', height: '60%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="50%" outerRadius="95%"
                      data={[{ name: 'Kar', value: profitPercentage }]}
                      startAngle={90} endAngle={90 - (profitPercentage / 100) * 360} barSize={15}>
                      <RadialBar dataKey="value" cornerRadius={8} fill="#10b981" />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-3xl font-bold text-slate-900 tabular-nums">{targetPercentage.toFixed(0)}%</p>
                <p className="text-xs text-slate-400 mt-1">Kalan: {remaining.toFixed(0)} ₺</p>
                <p className="text-xs text-emerald-600 font-bold mt-1">Kar: {profitPercentage.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── DETAY ANALİZLERİ ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* En Çok Satanlar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-5">En Çok Satanlar</h3>
            <div className="space-y-3">
              {topProductsData.length > 0 ? (
                topProductsData.slice(0, 5).map((product, index) => {
                  const percentage = maxSales > 0 ? (product.sales / maxSales) * 100 : 0;
                  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                  return (
                    <div key={index} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 truncate pr-2">{product.name}</span>
                        <span className="text-xs font-bold text-slate-500 whitespace-nowrap tabular-nums">{product.sales} adet</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%`, backgroundColor: colors[index] }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-400 text-center py-6">Henüz satış verisi yok</p>
              )}
            </div>
          </div>

          {/* Giderler / Gelirler */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {expenseIncomeView === 'expenses' ? 'En Çok Harcananlar' : 'Gelirler'}
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={expenseIncomeView === 'incomes'}
                  onChange={(e) => setExpenseIncomeView(e.target.checked ? 'incomes' : 'expenses')}
                  className="sr-only peer" />
                <div className="w-11 h-6 rounded-full transition-all duration-300 bg-slate-200 peer-checked:bg-emerald-500 relative">
                  <div className={`absolute top-0.5 left-0.5 bg-white rounded-full h-5 w-5 transition-all duration-300 shadow-sm ${expenseIncomeView === 'incomes' ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="ml-2 text-xs font-medium text-slate-500">
                  {expenseIncomeView === 'expenses' ? 'Gider' : 'Gelir'}
                </span>
              </label>
            </div>
            {expenseIncomeView === 'expenses' ? (
              <div className="space-y-0">
                {expenses.length > 0 ? expenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-sm font-medium text-slate-700 truncate">{expense.category || 'Kategori Yok'}</p>
                      {expense.description && <p className="text-xs text-slate-400 truncate">{expense.description}</p>}
                    </div>
                    <span className="text-sm font-bold text-rose-600 whitespace-nowrap">{expense.amount.toFixed(2)} ₺</span>
                  </div>
                )) : (
                  <p className="text-sm text-slate-400 text-center py-6">Henüz gider kaydı yok</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={() => setShowIncomeModal(true)}
                  className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-xs font-bold">
                  <Plus className="w-4 h-4" /> Gelir Ekle
                </button>
                {incomes.length > 0 ? (
                  <div className="space-y-0 max-h-[260px] overflow-y-auto">
                    {incomes.map((income) => (
                      <div key={income.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-sm font-medium text-slate-700 truncate">{income.category || 'Kategori Yok'}</p>
                          {income.description && <p className="text-xs text-slate-400 truncate">{income.description}</p>}
                          <p className="text-xs text-slate-300 mt-0.5">{new Date(income.created_at).toLocaleDateString('tr-TR')}</p>
                        </div>
                        <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">{income.amount.toFixed(2)} ₺</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-6">Henüz gelir kaydı yok</p>
                )}
              </div>
            )}
          </div>

          {/* Satış Yoğunluğu */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Satış Yoğunluğu</h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={densityView === 'weekly'}
                  onChange={(e) => setDensityView(e.target.checked ? 'weekly' : 'daily')}
                  className="sr-only peer" />
                <div className="w-11 h-6 rounded-full transition-all duration-300 bg-slate-200 peer-checked:bg-blue-500 relative">
                  <div className={`absolute top-0.5 left-0.5 bg-white rounded-full h-5 w-5 transition-all duration-300 shadow-sm ${densityView === 'weekly' ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="ml-2 text-xs font-medium text-slate-500">
                  {densityView === 'daily' ? 'Günlük' : 'Haftalık'}
                </span>
              </label>
            </div>
            {densityView === 'daily' ? (
              <div className="grid grid-cols-4 gap-2">
                {hourlyData.length > 0 ? hourlyData.map((item, index) => {
                  const maxValue = Math.max(...hourlyData.map(d => d.sales), 1);
                  const intensity = item.sales / maxValue;
                  const opacity = 0.12 + intensity * 0.78;
                  return (
                    <div key={index} className="flex flex-col items-center gap-1">
                      <div className="w-full aspect-square rounded-lg flex items-center justify-center border border-slate-100 transition-all"
                        style={{ backgroundColor: `rgba(59,130,246,${opacity})` }}
                        title={`${item.hour} — ${item.sales} satış`}>
                        <span className="text-xs font-bold text-white drop-shadow">{item.sales}</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-500">{item.hour}</span>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-slate-400 text-center py-4 col-span-4">Bugün henüz satış yok</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {weeklyDensityData.length > 0 ? weeklyDensityData.map((item, index) => {
                  const maxValue = Math.max(...weeklyDensityData.map(d => d.density), 1);
                  const opacity = 0.12 + (item.density / maxValue) * 0.78;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-500 w-8 text-right">{item.day}</span>
                      <div className="flex-1 h-7 rounded-md border border-slate-100 transition-all"
                        style={{ backgroundColor: `rgba(59,130,246,${opacity})` }}
                        title={`Yoğunluk: ${item.density}`} />
                      <span className="text-xs font-bold text-slate-600 w-6 text-right tabular-nums">{item.density}</span>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-slate-400 text-center py-4">Bu hafta henüz satış yok</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── ALT SATIR ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Ödeme Yöntemleri */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-5">Ödeme Yöntemleri</h3>
            {paymentMethodStats && paymentMethodStats.data.length > 0 ? (
              <div className="space-y-4">
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentMethodStats.data} cx="50%" cy="50%" labelLine={false}
                        label={(entry: any) => `${entry.label}: ${entry.percentage.toFixed(1)}%`}
                        outerRadius={70} dataKey="total">
                        {paymentMethodStats.data.map((entry, index) => {
                          const c: Record<string, string> = { CASH: '#10b981', CARD: '#3b82f6', TRANSFER: '#8b5cf6', CREDIT: '#f59e0b' };
                          return <Cell key={`cell-${index}`} fill={c[entry.method] || '#94a3b8'} />;
                        })}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px' }}
                        formatter={(value: any) => [`${value.toFixed(2)} ₺`, 'Toplam']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-0">
                  {paymentMethodStats.data.map((entry) => {
                    const c: Record<string, string> = { CASH: '#10b981', CARD: '#3b82f6', TRANSFER: '#8b5cf6', CREDIT: '#f59e0b' };
                    return (
                      <div key={entry.method} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c[entry.method] || '#94a3b8' }} />
                          <span className="text-sm font-medium text-slate-700">{entry.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-slate-900">{entry.total.toFixed(2)} ₺</span>
                          <span className="text-xs text-slate-400 ml-2">{entry.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-500">Toplam: <span className="font-bold text-slate-800">{paymentMethodStats.summary.total_amount.toFixed(2)} ₺</span></span>
                  <span className="text-xs text-slate-400">{paymentMethodStats.summary.total_count} işlem</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-slate-300">
                <div className="text-center">
                  <DollarSign className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">Henüz veri yok</p>
                </div>
              </div>
            )}
          </div>

          {/* Hızlı Notlar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hızlı Notlar</h3>
              <div className="flex gap-1">
                <button onClick={handleSaveNote} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Kaydet">
                  <Save className="w-4 h-4 text-slate-400" />
                </button>
                <button onClick={handleClearNote} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Temizle">
                  <Trash2 className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Buraya notlarınızı yazabilirsiniz..."
              className="w-full h-[230px] bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none resize-none text-sm text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>

          {/* Ödenecekler / Alınacaklar */}
          <div className={`bg-white rounded-xl border-2 shadow-sm p-6 transition-all duration-300 ${
            paymentViewMode === 'payables' ? 'border-rose-200' : 'border-emerald-200'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {paymentViewMode === 'payables'
                    ? <ArrowDownCircle className="w-4 h-4 text-rose-500" />
                    : <ArrowUpCircle className="w-4 h-4 text-emerald-500" />}
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {paymentViewMode === 'payables' ? 'Ödenecekler' : 'Alınacaklar'}
                  </h3>
                </div>
                <p className={`text-xs font-semibold ${paymentViewMode === 'payables' ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {paymentViewMode === 'payables' ? 'Tedarikçi Borçları' : 'Müşteri Alacakları'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={paymentViewMode === 'receivables'}
                  onChange={(e) => setPaymentViewMode(e.target.checked ? 'receivables' : 'payables')}
                  className="sr-only peer" />
                <div className={`w-12 h-6 rounded-full transition-all duration-300 relative ${paymentViewMode === 'receivables' ? 'bg-emerald-500' : 'bg-rose-400'}`}>
                  <div className={`absolute top-0.5 left-0.5 bg-white rounded-full h-5 w-5 transition-all duration-300 shadow-md ${paymentViewMode === 'receivables' ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
              </label>
            </div>

            {(paymentViewMode === 'receivables' ? todayPayments.length : supplierDebts.length) > 0 && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-4 ${
                paymentViewMode === 'payables' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
              }`}>
                <span>{paymentViewMode === 'receivables' ? todayPayments.length : supplierDebts.length}</span>
                <span>{paymentViewMode === 'payables' ? 'Tedarikçi' : 'Müşteri'}</span>
              </div>
            )}

            {paymentViewMode === 'receivables' ? (
              todayPayments.length > 0 ? (
                <div className="space-y-0 max-h-[230px] overflow-y-auto">
                  {todayPayments.map((debt) => (
                    <div key={debt.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{debt.customerName}</p>
                        <p className="text-xs text-slate-400">{debt.phone}{debt.product ? ` · ${debt.product}` : ''}</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">{debt.debt.toFixed(2)} ₺</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <ArrowUpCircle className="w-10 h-10 text-emerald-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Bugün vadesi gelen alacak yok</p>
                </div>
              )
            ) : (
              supplierDebts.length > 0 ? (
                <div className="space-y-0 max-h-[230px] overflow-y-auto">
                  {supplierDebts.map((supplier) => (
                    <div key={supplier.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{supplier.name}</p>
                        {supplier.phone && <p className="text-xs text-slate-400">{supplier.phone}</p>}
                      </div>
                      <span className="text-sm font-bold text-rose-600 whitespace-nowrap">{supplier.balance.toFixed(2)} ₺</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <ArrowDownCircle className="w-10 h-10 text-rose-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Ödenecek borç yok</p>
                </div>
              )
            )}
          </div>
        </div>

      </div>

      {/* Gelir Ekle Modal */}
      {showIncomeModal && (
        <DashboardIncomeModal
          onClose={() => setShowIncomeModal(false)}
          onSuccess={() => {
            setShowIncomeModal(false);
            transactionsApi.getTransactions().then((allTransactions) => {
              const incomeList = allTransactions.filter(t => t.type === 'INCOME').slice(0, 10);
              setIncomes(incomeList);
            }).catch(console.error);
          }}
        />
      )}
    </div>
  );
}

// Dashboard Gelir Ekle Modal (Basitleştirilmiş)
function DashboardIncomeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentSource, setPaymentSource] = useState<'CASH' | 'BANK'>('CASH');
  const [savedCategories, setSavedCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('income-categories');
    return saved ? JSON.parse(saved) : ['Kira Geliri', 'Satış Geliri', 'Diğer Gelir'];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddCategory = () => {
    if (customCategory.trim() && !savedCategories.includes(customCategory.trim())) {
      const updated = [...savedCategories, customCategory.trim()];
      setSavedCategories(updated);
      localStorage.setItem('income-categories', JSON.stringify(updated));
      setCategory(customCategory.trim());
      setCustomCategory('');
      setShowAddCategory(false);
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      alert('Lütfen açıklama girin');
      return;
    }
    if (!category) {
      alert('Lütfen kategori seçin');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      alert('Lütfen geçerli bir miktar girin');
      return;
    }

    try {
      setIsSubmitting(true);
      await transactionsApi.addIncome(
        parseFloat(amount),
        category,
        description,
        'default-user',
        paymentSource
      );
      onSuccess();
    } catch (error: any) {
      alert(`Gelir eklenirken hata oluştu: ${error.message || 'Bilinmeyen hata'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800">Gelir Ekle</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Açıklama <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Gelir açıklamasını girin (örn: Kira geliri)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kategori <span className="text-red-500">*</span>
            </label>
            {!showAddCategory ? (
              <>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent mb-2"
                >
                  <option value="">Kategori seçin...</option>
                  {savedCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Yeni Kategori Ekle
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Yeni kategori adı"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCategory();
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowAddCategory(false);
                      setCustomCategory('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleAddCategory}
                    disabled={!customCategory.trim()}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Ekle
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Miktar (₺) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ödeme Kaynağı
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentSource('CASH')}
                className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                  paymentSource === 'CASH'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                Nakit
              </button>
              <button
                onClick={() => setPaymentSource('BANK')}
                className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                  paymentSource === 'BANK'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                Banka
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={!description.trim() || !category || !amount || parseFloat(amount) <= 0 || isSubmitting}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
