/**
 * E-Commerce API Service
 */

import {
  MarketplaceConfig,
  ProductMapping,
  OnlineOrder,
  RevenueAnalytics,
  PlatformDistribution,
  SalesTrend,
  MarketplacePlatform,
} from '../types/ecommerce.types';
import { apiClient } from '@/shared/utils/api.client';

export const ecommerceApi = {
  // Marketplace Configs
  getMarketplaceConfigs: async (): Promise<MarketplaceConfig[]> => {
    const response = await apiClient.get('/ecommerce/marketplace-configs');
    return response.data;
  },

  createMarketplaceConfig: async (config: Omit<MarketplaceConfig, 'id' | 'created_at' | 'updated_at'>): Promise<MarketplaceConfig> => {
    const response = await apiClient.post('/ecommerce/marketplace-configs', config);
    return response.data;
  },

  updateMarketplaceConfig: async (id: string, config: Partial<MarketplaceConfig>): Promise<MarketplaceConfig> => {
    const response = await apiClient.put(`/ecommerce/marketplace-configs/${id}`, config);
    return response.data;
  },

  // Product Mappings
  getProductMappings: async (productId?: string, marketplaceConfigId?: string): Promise<ProductMapping[]> => {
    const params: any = {};
    if (productId) params.product_id = productId;
    if (marketplaceConfigId) params.marketplace_config_id = marketplaceConfigId;
    const response = await apiClient.get('/ecommerce/product-mappings', { params });
    return response.data;
  },

  createProductMapping: async (mapping: Omit<ProductMapping, 'id' | 'created_at' | 'updated_at' | 'last_sync_at'>): Promise<ProductMapping> => {
    const response = await apiClient.post('/ecommerce/product-mappings', mapping);
    return response.data;
  },

  // Simulation
  simulateOrder: async (count: number = 1, platform: MarketplacePlatform = MarketplacePlatform.TRENDYOL): Promise<void> => {
    await apiClient.post('/ecommerce/simulate/order', { count, platform });
  },

  // Analytics
  getRevenueAnalytics: async (): Promise<RevenueAnalytics> => {
    const response = await apiClient.get('/ecommerce/analytics/revenue');
    return response.data;
  },

  getPlatformDistribution: async (): Promise<PlatformDistribution[]> => {
    const response = await apiClient.get('/ecommerce/analytics/platform-distribution');
    return response.data;
  },

  getSalesTrend: async (days: number = 30): Promise<SalesTrend[]> => {
    const response = await apiClient.get('/ecommerce/analytics/sales-trend', { params: { days } });
    return response.data;
  },

  getPendingOrders: async (): Promise<OnlineOrder[]> => {
    const response = await apiClient.get('/ecommerce/orders/pending');
    return response.data;
  },
};

