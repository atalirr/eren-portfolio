/**
 * E-Commerce Settings Component
 * Pazaryeri entegrasyon ayarları
 */

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, Zap } from 'lucide-react';
import { ecommerceApi } from '../services/ecommerceApi';
import { MarketplaceConfig, MarketplacePlatform } from '../types/ecommerce.types';

export function EcommerceSettings() {
  const [configs, setConfigs] = useState<MarketplaceConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MarketplaceConfig | null>(null);
  const [formData, setFormData] = useState({
    platform: MarketplacePlatform.TRENDYOL,
    api_key: '',
    api_secret: '',
    merchant_id: '',
    is_active: false,
    is_simulation_mode: true,
    webhook_url: '',
    notes: '',
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const data = await ecommerceApi.getMarketplaceConfigs();
      setConfigs(data);
    } catch (error) {
      console.error('Ayarlar yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (editingConfig) {
        await ecommerceApi.updateMarketplaceConfig(editingConfig.id, formData);
      } else {
        await ecommerceApi.createMarketplaceConfig(formData as any);
      }
      setShowModal(false);
      setEditingConfig(null);
      setFormData({
        platform: MarketplacePlatform.TRENDYOL,
        api_key: '',
        api_secret: '',
        merchant_id: '',
        is_active: false,
        is_simulation_mode: true,
        webhook_url: '',
        notes: '',
      });
      loadConfigs();
    } catch (error) {
      console.error('Ayar kaydetme hatası:', error);
      alert('Ayar kaydedilemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    try {
      await ecommerceApi.simulateOrder(1, MarketplacePlatform.TRENDYOL);
      alert('Simülasyon siparişi oluşturuldu!');
    } catch (error) {
      console.error('Simülasyon hatası:', error);
      alert('Simülasyon siparişi oluşturulamadı');
    }
  };

  if (loading && configs.length === 0) {
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
          <h2 className="text-lg font-semibold text-slate-900">Pazaryeri Entegrasyonları</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulate}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Test Siparişi Oluştur
            </button>
            <button
              onClick={() => {
                setEditingConfig(null);
                setFormData({
                  platform: MarketplacePlatform.TRENDYOL,
                  api_key: '',
                  api_secret: '',
                  merchant_id: '',
                  is_active: false,
                  is_simulation_mode: true,
                  webhook_url: '',
                  notes: '',
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Yeni Entegrasyon
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {configs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              Henüz entegrasyon yok
            </div>
          ) : (
            configs.map((config) => (
              <div
                key={config.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div>
                  <p className="font-medium text-slate-900">{config.platform}</p>
                  <p className="text-sm text-slate-500">
                    {config.is_active ? (
                      <span className="text-green-600">Aktif</span>
                    ) : (
                      <span className="text-gray-600">Pasif</span>
                    )}
                    {config.is_simulation_mode && (
                      <span className="ml-2 text-yellow-600">• Simülasyon Modu</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingConfig(config);
                    setFormData({
                      platform: config.platform as any,
                      api_key: config.api_key || '',
                      api_secret: config.api_secret || '',
                      merchant_id: config.merchant_id || '',
                      is_active: config.is_active,
                      is_simulation_mode: config.is_simulation_mode,
                      webhook_url: config.webhook_url || '',
                      notes: config.notes || '',
                    });
                    setShowModal(true);
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Düzenle
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingConfig ? 'Entegrasyon Düzenle' : 'Yeni Entegrasyon'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Platform</label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value as MarketplacePlatform })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  disabled={!!editingConfig}
                >
                  {Object.values(MarketplacePlatform).map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">API Anahtarı</label>
                <input
                  type="text"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="API anahtarınızı girin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">API Secret</label>
                <input
                  type="password"
                  value={formData.api_secret}
                  onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="API secret'ınızı girin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Satıcı ID</label>
                <input
                  type="text"
                  value={formData.merchant_id}
                  onChange={(e) => setFormData({ ...formData, merchant_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Satıcı ID'nizi girin"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-slate-700">Aktif</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_simulation_mode}
                    onChange={(e) => setFormData({ ...formData, is_simulation_mode: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-slate-700">Simülasyon Modu</span>
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





















