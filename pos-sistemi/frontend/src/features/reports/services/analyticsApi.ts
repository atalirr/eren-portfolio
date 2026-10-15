/**
 * Analytics API Service
 */

import { apiClient } from '@/shared/utils/api.client';

export interface AnalyticsStats {
  kpi: {
    total_revenue: number;
    net_profit: number;
    leakage: number;
    month_end_estimate: number;
    daily_average: number;
  };
  shop: {
    hourly_density: Record<string, number>;
    product_pareto: Array<{ name: string; revenue: number }>;
    basket_sizes: number[];
    payment_methods: Array<{ method: string; count: number; total: number }>;
    category_performance: Array<{ name: string; revenue: number }>;
  };
  ecommerce: {
    platform_daily: Array<{ day: number; platform: string; revenue: number }>;
    platform_profitability: Array<{
      platform: string;
      gross_sales: number;
      discounts: number;
      commissions: number;
      net_profit: number;
    }>;
    return_rates: Array<{
      platform: string;
      total_orders: number;
      cancelled_orders: number;
      return_rate: number;
    }>;
  };
  staff: {
    staff_leaders: Array<{
      id: string;
      name: string;
      transaction_count: number;
      total_sales: number;
      avg_basket: number;
    }>;
  };
}

export const analyticsApi = {
  getAllStats: async (): Promise<AnalyticsStats> => {
    const response = await apiClient.get('/analytics/stats');
    return response.data;
  },
};

