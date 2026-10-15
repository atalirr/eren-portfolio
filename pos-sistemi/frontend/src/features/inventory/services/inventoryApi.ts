/**
 * Inventory API Service
 */

import { apiClient } from '@/shared/utils/api.client';

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  sku?: string;
  brand?: string;
  category_id: string;
  price: number; // sell_price
  cost?: number; // buy_price
  stock_quantity: number;
  critical_level: number;
  unit: string;
  description?: string;
  image_url?: string;
  // Variant fields
  parent_id?: string | null;
  color?: string | null;
  size?: string | null;
  material?: string | null;
  // UI'da kullanılan opsiyonel alanlar (backend'den gelmeyebilir)
  discount?: number | null;
  marketplaceStatus?: 'active' | 'inactive' | string | null;
  tax_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  category_id: string;
  name: string;
  barcode?: string;
  sku?: string;
  brand?: string;
  price: number; // sell_price
  cost?: number; // buy_price
  stock_quantity: number;
  critical_level: number;
  unit: string;
  description?: string;
  image_url?: string;
  image?: File;
  parent_id?: string;
  color?: string;
  size?: string;
  material?: string;
  tax_rate?: number;
  is_active?: boolean;
}

export interface ProductUpdate {
  category_id?: string;
  name?: string;
  barcode?: string;
  sku?: string;
  brand?: string;
  price?: number; // sell_price
  cost?: number; // buy_price
  stock_quantity?: number;
  critical_level?: number;
  unit?: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
  color?: string;
  size?: string;
  material?: string;
  tax_rate?: number;
  is_active?: boolean;
}

export const inventoryApi = {
  // Kategorileri getir
  getCategories: async (): Promise<Category[]> => {
    const response = await apiClient.get('/inventory/categories');
    return response.data;
  },

  // Kategori oluştur
  createCategory: async (category: { name: string; description?: string; color?: string }): Promise<Category> => {
    const response = await apiClient.post('/inventory/categories', category);
    return response.data;
  },

  // Kategori sil
  deleteCategory: async (categoryId: string): Promise<void> => {
    await apiClient.delete(`/inventory/categories/${categoryId}`);
  },

  // Ürünleri getir
  getProducts: async (params?: {
    category_id?: string;
    brand?: string;
    stock_status?: 'low' | 'in_stock' | 'out_of_stock';
    include_deleted?: boolean;
  }): Promise<Product[]> => {
    const response = await apiClient.get('/inventory/products', { params });
    return response.data;
  },

  // Ürün getir (ID ile)
  getProduct: async (productId: string): Promise<Product> => {
    const response = await apiClient.get(`/inventory/products/${productId}`);
    return response.data;
  },

  // Toplu sil
  batchDelete: async (ids: string[]): Promise<void> => {
    await apiClient.post('/inventory/products/batch/delete', ids);
  },

  // Toplu kategori değiştir
  batchUpdateCategory: async (ids: string[], categoryId: string): Promise<void> => {
    await apiClient.post('/inventory/products/batch/update-category', { ids, category_id: categoryId });
  },

  // Ürün geçmişi getir
  getProductHistory: async (productId: string): Promise<any[]> => {
    const response = await apiClient.get(`/inventory/products/${productId}/history`);
    return response.data;
  },

  // KPI'ları getir
  getKPIs: async (): Promise<any> => {
    const response = await apiClient.get('/inventory/statistics/kpis');
    return response.data;
  },

  // Barkod ile ürün getir
  getProductByBarcode: async (barcode: string): Promise<Product> => {
    const response = await apiClient.get(`/inventory/products/barcode/${barcode}`);
    return response.data;
  },

  // Ürün oluştur
  createProduct: async (product: ProductCreate): Promise<Product> => {
    // Eğer dosya yüklemesi varsa multipart/form-data kullan
    if (product.image) {
      const formData = new FormData();

      formData.append('category_id', product.category_id);
      formData.append('name', product.name);
      if (product.barcode) formData.append('barcode', product.barcode);
      if (product.sku) formData.append('sku', product.sku);
      if (product.brand) formData.append('brand', product.brand);
      formData.append('price', String(product.price));
      if (product.cost != null) formData.append('cost', String(product.cost));
      formData.append('stock_quantity', String(product.stock_quantity));
      formData.append('critical_level', String(product.critical_level));
      if (product.unit) formData.append('unit', product.unit);
      if (product.description) formData.append('description', product.description);
      if (product.tax_rate != null) formData.append('tax_rate', String(product.tax_rate));
      if (product.is_active != null) formData.append('is_active', String(product.is_active));
      if (product.parent_id) formData.append('parent_id', product.parent_id);
      if (product.color) formData.append('color', product.color);
      if (product.size) formData.append('size', product.size);
      if (product.material) formData.append('material', product.material);
      formData.append('image', product.image);

      const response = await apiClient.post('/inventory/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    }

    // Görsel yoksa klasik JSON isteği gönder
    const { image, ...rest } = product;
    const response = await apiClient.post('/inventory/products', rest);
    return response.data;
  },

  // Ürün güncelle
  updateProduct: async (productId: string, product: ProductUpdate): Promise<Product> => {
    const response = await apiClient.put(`/inventory/products/${productId}`, product);
    return response.data;
  },

  // Ürün sil
  deleteProduct: async (productId: string): Promise<void> => {
    await apiClient.delete(`/inventory/products/${productId}`);
  },

  // Stok güncelle
  updateStock: async (
    productId: string,
    data: { amount: number; reason: string; notes?: string },
    userId?: string
  ): Promise<Product> => {
    const response = await apiClient.patch(`/inventory/products/${productId}/stock`, data, {
      params: { user_id: userId || 'default-user-id' },
    });
    return response.data;
  },

  // Stok geçmişi
  getStockHistory: async (productId: string): Promise<any[]> => {
    const response = await apiClient.get(`/inventory/products/${productId}/history`);
    return response.data;
  },

  // Kritik stok ürünleri
  getCriticalProducts: async (): Promise<Product[]> => {
    const response = await apiClient.get('/inventory/products/critical/list');
    return response.data;
  },

  // Ürün resmini güncelle
  updateProductImage: async (productId: string, imageFile: File): Promise<Product> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    const response = await apiClient.put(`/inventory/products/${productId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};


