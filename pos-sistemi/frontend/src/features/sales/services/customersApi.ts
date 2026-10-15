/**
 * Customers API Service
 * Müşteri Yönetimi API İşlemleri
 */

import { apiClient } from '@/shared/utils/api.client';

export interface Customer {
  id: string;
  name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  balance: number;
  address?: string;
  notes?: string;
  due_date?: string;
  // Düzenli Teslimat
  needed_material?: string;
  product_id?: string;
  quantity?: number;
  unit_price?: number;
  period_days?: number;
  last_delivery_date?: string;
  next_delivery_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreate {
  name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  needed_material?: string;
  product_id?: string;
  quantity?: number;
  unit_price?: number;
  period_days?: number;
  last_delivery_date?: string;
  next_delivery_date?: string;
}

export interface CustomerBalance {
  customer_id: string;
  customer_name: string;
  balance: number;
  total_debt: number;
  total_paid: number;
}

export interface DeliveryRequest {
  manual_price?: number;
  payment_method?: 'CASH' | 'CARD';
}

export const customersApi = {
  /** Tüm müşterileri getir */
  async getAll(search?: string): Promise<Customer[]> {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    const response = await apiClient.get('/customers', { params });
    return response.data;
  },

  /** ID'ye göre müşteri getir */
  async getById(customerId: string): Promise<Customer> {
    const response = await apiClient.get(`/customers/${customerId}`);
    return response.data;
  },

  /** Müşteri bakiyesi getir */
  async getBalance(customerId: string): Promise<CustomerBalance> {
    const response = await apiClient.get(`/customers/${customerId}/balance`);
    return response.data;
  },

  /** Yeni müşteri oluştur */
  async create(data: CustomerCreate): Promise<Customer> {
    const response = await apiClient.post('/customers', data);
    return response.data;
  },

  /** Müşteriyi güncelle */
  async update(customerId: string, data: Partial<CustomerCreate>): Promise<Customer> {
    const response = await apiClient.put(`/customers/${customerId}`, data);
    return response.data;
  },

  /** Müşteriyi sil */
  async delete(customerId: string): Promise<void> {
    await apiClient.delete(`/customers/${customerId}`);
  },

  /** Borcu olan müşterileri getir (balance > 0) */
  async getDebts(): Promise<Customer[]> {
    const response = await apiClient.get('/customers/debts');
    return response.data;
  },

  /** Teslimat yapıldı — stok düş, kasaya kaydet, tarihleri güncelle */
  async deliver(customerId: string, body: DeliveryRequest = {}): Promise<Customer> {
    const response = await apiClient.post(`/customers/${customerId}/deliver`, body);
    return response.data;
  },
};























