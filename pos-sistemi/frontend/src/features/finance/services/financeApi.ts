/**
 * Finance API Service
 * Finans dashboard ek metrikleri (gerçek veri)
 */

import { apiClient } from '@/shared/utils/api.client';

export type Money = number;

export interface FinanceDashboardStatsResponse {
  cash_bank_distribution: Array<{ name: string; value: number; color: string }>;
  payment_methods_distribution: Array<{ name: string; value: number; color: string }>;
}

export interface FinancialHealthMetricsResponse {
  financial_balance: {
    assets: Money;
    liabilities: Money;
    ratio: number;
    status: string;
    details: {
      cash_balance: Money;
      bank_balance: Money;
      receivables: Money;
      marketplace_balance: Money;
      customer_debts: Money;
      planned_expenses: Money;
    };
  };
  cash_runway: {
    monthly_fixed_expenses: Money;
    daily_burn_rate: Money;
    current_cash: Money;
    runway_days: number;
    status: string;
  };
}

export interface NetProfitabilityResponse {
  period: { start: string; end: string };
  revenue: Money;
  pos_revenue?: Money;
  cost_of_goods_sold: Money;
  gross_profit: Money;
  gross_margin_percent: number;
  operational_expenses: Money;
  net_profit: Money;
  net_margin_percent: number;
  warning?: string | null;
  pos_profit?: Money;
}

export interface ExpenseBreakdownResponse {
  period: { start: string; end: string };
  total_revenue: Money;
  total_expenses: Money;
  expense_to_revenue_ratio: number;
  categories: Array<{
    category: string;
    amount: Money;
    percentage_of_revenue: number;
    percentage_of_total_expenses: number;
    is_anomaly: boolean;
    anomaly_reason?: string | null;
  }>;
}

export interface AdvancedProjectionResponse {
  target_period: { month: number; year: number };
  pace_analysis: {
    current_time: string;
    current_cumulative_revenue: Money;
    last_month_same_day_cumulative: Money;
    last_week_same_day_cumulative: Money;
    pace_vs_last_month_percent: number;
    pace_vs_last_week_percent: number;
    status: 'ahead' | 'behind' | 'on_track' | string;
  };
  month_end_projection: {
    current_revenue: Money;
    days_completed: number;
    days_remaining: number;
    last_7_days_avg: Money;
    weighted_avg: Money;
    projected_revenue: Money;
    confidence: 'high' | 'medium' | 'low' | string;
  };
  seasonality: {
    weekend_multiplier: number;
    weekday_avg: Money;
    weekend_avg: Money;
  };
}

export interface CashflowTrendPoint {
  key: string;
  revenue: Money;
  cogs: Money;
  expenses: Money;
  profit: Money;
}

export interface CashflowTrendResponse {
  period: 'daily' | 'weekly' | 'monthly' | string;
  start: string;
  end: string;
  points: CashflowTrendPoint[];
}

export interface InventoryTurnoverDataPoint {
  period: string;
  turnover: number;
  avg_inventory_value: Money;
  cogs: Money;
}

export interface InventoryTurnoverResponse {
  weekly: InventoryTurnoverDataPoint[];
  monthly: InventoryTurnoverDataPoint[];
  six_monthly: InventoryTurnoverDataPoint[];
}

export interface ROITrendDataPoint {
  month: string;
  roi_percent: number;
  net_profit: Money;
  inventory_cost: Money;
}

export interface ROITrendResponse {
  data: ROITrendDataPoint[];
  period: { start: string; end: string };
}

export interface ResetFinanceResponse {
  deleted: Record<string, number>;
  customers_zeroed: number;
}

// Backend yeni endpoint'leri bazen çalışırken yüklenmemiş olabiliyor (server restart gerekebilir).
// 404 spam'ini önlemek için kısa süreli "cooldown" uyguluyoruz.
const cashflowTrendEndpointState: { lastNotFoundAt: number } = { lastNotFoundAt: 0 };

export const financeApi = {
  getDashboardStats: async (): Promise<FinanceDashboardStatsResponse> => {
    const res = await apiClient.get<FinanceDashboardStatsResponse>('/finance/dashboard-stats');
    return res.data;
  },

  getHealthMetrics: async (): Promise<FinancialHealthMetricsResponse> => {
    const res = await apiClient.get<FinancialHealthMetricsResponse>('/finance/health-metrics');
    return res.data;
  },

  getNetProfitability: async (
    days: number = 30,
    startDate?: string,
    endDate?: string
  ): Promise<NetProfitabilityResponse> => {
    const res = await apiClient.get<NetProfitabilityResponse>('/finance/net-profitability', {
      params: {
        days,
        start_date: startDate ?? undefined,
        end_date: endDate ?? undefined,
      },
    });
    return res.data;
  },

  getCashflowTrend: async (
    period: 'daily' | 'weekly' | 'monthly',
    points: number = 0,
    startDate?: string,
    endDate?: string
  ): Promise<CashflowTrendResponse> => {
    // Son 15sn içinde 404 aldıysak tekrar deneme (spam engeli)
    if (cashflowTrendEndpointState.lastNotFoundAt && Date.now() - cashflowTrendEndpointState.lastNotFoundAt < 15000) {
      return { period, start: '', end: '', points: [] };
    }

    try {
      const res = await apiClient.get<CashflowTrendResponse>('/finance/cashflow-trend', {
        params: {
          period,
          points: points || 0,
          start_date: startDate ?? undefined,
          end_date: endDate ?? undefined,
        },
      });
      return res.data;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        cashflowTrendEndpointState.lastNotFoundAt = Date.now();
        return { period, start: '', end: '', points: [] };
      }
      throw err;
    }
  },

  getExpenseBreakdown: async (days: number = 30): Promise<ExpenseBreakdownResponse> => {
    const res = await apiClient.get<ExpenseBreakdownResponse>('/finance/expense-breakdown', {
      params: { days },
    });
    return res.data;
  },

  getAdvancedProjection: async (targetMonth?: number, targetYear?: number): Promise<AdvancedProjectionResponse> => {
    const res = await apiClient.get<AdvancedProjectionResponse>('/finance/advanced-projection', {
      params: {
        target_month: targetMonth ?? undefined,
        target_year: targetYear ?? undefined,
      },
    });
    return res.data;
  },

  getInventoryTurnover: async (days: number = 180): Promise<InventoryTurnoverResponse> => {
    try {
      const res = await apiClient.get<InventoryTurnoverResponse>('/finance/inventory-turnover', {
        params: { days },
      });
      return res.data;
    } catch (err: any) {
      // Backend endpoint yoksa fallback data döner
      return { weekly: [], monthly: [], six_monthly: [] };
    }
  },

  getROITrend: async (months: number = 12): Promise<ROITrendResponse> => {
    try {
      const res = await apiClient.get<ROITrendResponse>('/finance/roi-trend', {
        params: { months },
      });
      return res.data;
    } catch (err: any) {
      // Backend endpoint yoksa fallback data döner
      return { data: [], period: { start: '', end: '' } };
    }
  },

  resetFinanceData: async (): Promise<ResetFinanceResponse> => {
    const res = await apiClient.post<ResetFinanceResponse>('/finance/reset-data');
    return res.data;
  },
};

/**
 * Not: Projede bazı sayfalar tedarikçi borçlarını bu modülden bekliyor.
 * Backend tarafında tedarikçi endpoint'i yoksa güvenli şekilde boş liste döner.
 */
export const suppliersApi = {
  getAll: async (): Promise<any[]> => {
    return [];
  },
};


