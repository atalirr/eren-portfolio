/**
 * API Client
 * Axios instance with base configuration
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { getApiBaseUrl } from '../config/api.config';

/**
 * Axios instance oluşturur
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor: Her istekte baseURL'i dinamik olarak kontrol et
  client.interceptors.request.use(
    (config) => {
      // ELECTRON ENVIRONMENT: Electron IPC'den gelen portu kullan
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        config.baseURL = `${getApiBaseUrl()}/api`;
      }
      // VITE DEV: Herhangi bir localhost portunda çalışıyorsa Vite proxy'yi kullan
      // (5173, 5174, 5175, 5176+ her port dahil — sabit port listesi gerekmiyor)
      else if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
        config.baseURL = '/api';
      }
      // FALLBACK (production veya file:// protokolü)
      else {
        config.baseURL = `${getApiBaseUrl()}/api`;
      }

      return config;
    },
    (error) => {
      console.error('❌ API Request Error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor
  client.interceptors.response.use(
    (response) => {
      return response;
    },
    (error: AxiosError) => {
      if (error.response) {
        console.error('❌ API Response Error:', error.response.status, error.config?.url, error.response.data);
      } else if (error.request) {
        console.error('❌ API Request Error: No response received', error.config?.url);
      } else {
        console.error('❌ API Error:', error.message);
      }

      return Promise.reject(error);
    }
  );

  return client;
}

// Export singleton instance
export const apiClient = createApiClient();
export default apiClient;
