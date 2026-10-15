/**
 * Personnel API Service
 * Personel yönetimi için API çağrıları
 */

import { apiClient } from '@/shared/utils/api.client';
import { Employee, EmployeeCreate, EmployeeUpdate, Advance, EmployeeStats, EmployeeFinance } from '../types/personnel.types';

export const personnelApi = {
  /**
   * Tüm personelleri getir
   */
  getAll: async (includeInactive: boolean = false): Promise<Employee[]> => {
    const response = await apiClient.get<Employee[]>('/personnel/employees', {
      params: { include_inactive: includeInactive },
    });
    return response.data;
  },

  /**
   * ID'ye göre personel getir
   */
  getById: async (id: string): Promise<Employee> => {
    const response = await apiClient.get<Employee>(`/personnel/employees/${id}`);
    return response.data;
  },

  /**
   * Yeni personel ekle
   */
  create: async (data: EmployeeCreate): Promise<Employee> => {
    const response = await apiClient.post<Employee>('/personnel/employees', data);
    return response.data;
  },

  /**
   * Personel güncelle
   */
  update: async (id: string, data: EmployeeUpdate): Promise<Employee> => {
    const response = await apiClient.put<Employee>(`/personnel/employees/${id}`, data);
    return response.data;
  },

  /**
   * Personel sil (soft delete - pasife alma)
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/personnel/employees/${id}`);
  },

  /**
   * Personel avans ekle
   */
  addAdvance: async (employeeId: string, amount: number, date: string, description?: string): Promise<Advance> => {
    const response = await apiClient.post<Advance>(`/personnel/employees/${employeeId}/advances`, null, {
      params: {
        amount,
        advance_date: date,
        description,
      },
    });
    return response.data;
  },

  /**
   * Personel avanslarını getir
   */
  getAdvances: async (employeeId: string): Promise<Advance[]> => {
    const response = await apiClient.get<Advance[]>(`/personnel/employees/${employeeId}/advances`);
    return response.data;
  },

  /**
   * Personel finans bilgilerini getir
   */
  getFinance: async (employeeId: string): Promise<EmployeeFinance> => {
    const response = await apiClient.get<EmployeeFinance>(`/personnel/employees/${employeeId}/finance`);
    return response.data;
  },

  /**
   * Personel istatistiklerini getir
   */
  getStats: async (employeeId: string): Promise<EmployeeStats> => {
    const response = await apiClient.get<EmployeeStats>(`/personnel/employees/${employeeId}/stats`);
    return response.data;
  },
};

