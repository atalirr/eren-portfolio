/**
 * E-Commerce Types
 * E-Ticaret Yönetim Modülü
 */

export enum MarketplacePlatform {
  LOCAL = 'LOCAL',
  TRENDYOL = 'TRENDYOL',
  HEPSIBURADA = 'HEPSIBURADA',
  SHOPIFY = 'SHOPIFY',
  N11 = 'N11',
  GITTIGIDIYOR = 'GITTIGIDIYOR',
}

export enum MarketplaceStatus {
  NEW = 'NEW',
  PREPARING = 'PREPARING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum OrderSource {
  POS = 'POS',
  ONLINE = 'ONLINE',
}

export interface MarketplaceConfig {
  id: string;
  platform: string;
  api_key?: string;
  api_secret?: string;
  merchant_id?: string;
  is_active: boolean;
  is_simulation_mode: boolean;
  webhook_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductMapping {
  id: string;
  product_id: string;
  marketplace_config_id: string;
  marketplace_product_id: string;
  marketplace_sku?: string;
  marketplace_barcode?: string;
  is_active: boolean;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OnlineOrder {
  id: string;
  order_number: string;
  platform?: MarketplacePlatform;
  marketplace_status?: MarketplaceStatus;
  final_amount: number;
  created_at: string;
}

export interface RevenueAnalytics {
  online_revenue: number;
  pos_revenue: number;
  total_revenue: number;
  online_percentage: number;
}

export interface PlatformDistribution {
  platform: string;
  revenue: number;
  count: number;
}

export interface SalesTrend {
  date: string;
  revenue: number;
  count: number;
}





















