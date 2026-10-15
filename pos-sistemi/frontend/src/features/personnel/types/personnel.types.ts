/**
 * Personnel Types
 * Personel Yönetimi için TypeScript tipleri
 */

/**
 * Personel Rolleri
 */
export type EmployeeRole = 'ADMIN' | 'CASHIER' | 'MANAGER';

/**
 * Personel Modeli
 * Backend'deki User modeline ek olarak maaş, prim gibi alanlar içerir
 */
export interface Employee {
  id: string;
  username: string;
  full_name: string;
  role: EmployeeRole;
  salary: number; // Maaş (TL)
  bonus_rate: number; // Prim oranı (%)
  pin: string; // Giriş şifresi (PIN) - 4 haneli
  start_date: string; // İşe başlama tarihi (ISO format)
  is_active: boolean; // Aktif mi?
  created_at: string;
  updated_at: string;
}

/**
 * Personel Oluşturma DTO
 */
export interface EmployeeCreate {
  user_id: string; // User ID (User zaten oluşturulmuş olmalı)
  salary: number;
  bonus_rate: number;
  pin?: string;
  start_date: string;
}

/**
 * Personel Güncelleme DTO
 */
export interface EmployeeUpdate {
  full_name?: string;
  role?: EmployeeRole;
  salary?: number;
  bonus_rate?: number;
  pin?: string;
  is_active?: boolean;
}

/**
 * Personel Finans Bilgileri
 */
export interface EmployeeFinance {
  employee_id: string;
  salary: number;
  bonus_rate: number;
  total_sales?: number; // Toplam satış (hesaplanacak)
  estimated_earnings?: number; // Tahmini hakediş
  advances?: Advance[]; // Avanslar
}

/**
 * Avans Modeli
 */
export interface Advance {
  id: string;
  employee_id: string;
  amount: number;
  advance_date: string; // Backend'den advance_date olarak geliyor
  description?: string;
  created_at: string;
}

/**
 * Personel İstatistikleri
 */
export interface EmployeeStats {
  employee_id: string;
  total_sales: number;
  total_transactions: number;
  average_basket: number;
  sales_by_month?: Array<{
    month: string;
    sales: number;
  }>;
}

