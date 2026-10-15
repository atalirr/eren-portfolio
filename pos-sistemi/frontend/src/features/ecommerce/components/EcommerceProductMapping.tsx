/**
 * E-Commerce Product Mapping Component
 * Ürün eşleştirme ekranı
 */

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Upload } from 'lucide-react';
import { ecommerceApi } from '../services/ecommerceApi';
import { ProductMapping, MarketplaceConfig } from '../types/ecommerce.types';

export function EcommerceProductMapping() {
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [configs, setConfigs] = useState<MarketplaceConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mappingsData, configsData] = await Promise.all([
        ecommerceApi.getProductMappings(),
        ecommerceApi.getMarketplaceConfigs(),
      ]);
      setMappings(mappingsData);
      setConfigs(configsData);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Ürün Eşleştirmeleri</h2>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Yeni Eşleştirme
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Ürün ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Yerel Ürün</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pazaryeri ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Durum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Henüz eşleştirme yok
                  </td>
                </tr>
              ) : (
                mappings.map((mapping) => (
                  <tr key={mapping.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">{mapping.product_id}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {configs.find((c) => c.id === mapping.marketplace_config_id)?.platform || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{mapping.marketplace_product_id}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{mapping.marketplace_sku || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          mapping.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {mapping.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                          <Upload className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}





















