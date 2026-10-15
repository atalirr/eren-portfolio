/**
 * Settings API
 */

import axios from 'axios';
import { getApiBaseUrl } from '@/shared/config/api.config';

const API_URL = `${getApiBaseUrl()}/api/settings`;

export interface Setting {
  id: string;
  key: string;
  value: string;
  description?: string;
}

export const settingsApi = {
  /**
   * Tüm ayarları getir
   */
  getSettings: async (): Promise<Setting[]> => {
    const response = await axios.get(API_URL);
    return response.data;
  },

  /**
   * Ayar güncelle veya oluştur
   */
  updateSetting: async (key: string, value: string): Promise<Setting> => {
    const response = await axios.put(`${API_URL}/${key}`, { value });
    return response.data;
  }
};
