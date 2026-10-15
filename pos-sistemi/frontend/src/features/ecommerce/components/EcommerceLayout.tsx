/**
 * E-Commerce Layout Component
 * E-Ticaret modülü için ana layout
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  BarChart3,
  Package,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import { EcommerceDashboard } from './EcommerceDashboard';
import { EcommerceOrders } from './EcommerceOrders';
import { EcommerceProductMapping } from './EcommerceProductMapping';
import { EcommerceSettings } from './EcommerceSettings';

type TabType = 'dashboard' | 'orders' | 'mapping' | 'settings';

export function EcommerceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // URL'den aktif tab'ı belirle
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/ecommerce/orders')) setActiveTab('orders');
    else if (path.includes('/ecommerce/mapping')) setActiveTab('mapping');
    else if (path.includes('/ecommerce/settings')) setActiveTab('settings');
    else setActiveTab('dashboard');
  }, [location.pathname]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // URL güncellemesi yapmıyoruz, sadece state'i güncelliyoruz
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-[1600px] mx-auto p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-3xl font-bold text-slate-900">E-Ticaret Yönetimi</h1>
          </div>
          <p className="text-sm text-slate-500">Online satışlar, pazaryeri entegrasyonları ve sipariş yönetimi</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-6">
          <div className="flex gap-1 p-2 border-b border-slate-200">
            <button
              onClick={() => handleTabChange('dashboard')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'dashboard'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => handleTabChange('orders')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'orders'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Siparişler
            </button>
            <button
              onClick={() => handleTabChange('mapping')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'mapping'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Package className="w-4 h-4" />
              Ürün Eşleştirme
            </button>
            <button
              onClick={() => handleTabChange('settings')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'settings'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              Ayarlar
            </button>
          </div>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'dashboard' && <EcommerceDashboard />}
          {activeTab === 'orders' && <EcommerceOrders />}
          {activeTab === 'mapping' && <EcommerceProductMapping />}
          {activeTab === 'settings' && <EcommerceSettings />}
        </div>
      </div>
    </div>
  );
}

