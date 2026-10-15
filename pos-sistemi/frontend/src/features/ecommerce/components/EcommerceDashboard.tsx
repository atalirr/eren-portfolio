/**
 * E-Commerce Dashboard Component
 * Online satışların özel analiz ekranı
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Package,
  AlertCircle,
  Truck,
  Zap,
} from 'lucide-react';
import { ecommerceApi } from '../services/ecommerceApi';
import {
  RevenueAnalytics,
  PlatformDistribution,
  SalesTrend,
  OnlineOrder,
} from '../types/ecommerce.types';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function EcommerceDashboard() {
  const [loading, setLoading] = useState(false);
  const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
  const [platformDistribution, setPlatformDistribution] = useState<PlatformDistribution[]>([]);
  const [salesTrend, setSalesTrend] = useState<SalesTrend[]>([]);
  const [pendingOrders, setPendingOrders] = useState<OnlineOrder[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [revenueData, platformData, trendData, pendingData] = await Promise.all([
        ecommerceApi.getRevenueAnalytics().catch(() => ({ online_revenue: 0, pos_revenue: 0, total_revenue: 0, online_percentage: 0 })),
        ecommerceApi.getPlatformDistribution().catch(() => []),
        ecommerceApi.getSalesTrend(30).catch(() => []),
        ecommerceApi.getPendingOrders().catch(() => []),
      ]);
      setRevenue(revenueData);
      setPlatformDistribution(platformData);
      setSalesTrend(trendData);
      setPendingOrders(pendingData);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      // Hata durumunda boş verilerle devam et
      setRevenue({ online_revenue: 0, pos_revenue: 0, total_revenue: 0, online_percentage: 0 });
      setPlatformDistribution([]);
      setSalesTrend([]);
      setPendingOrders([]);
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
      {/* KPI Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Online Ciro</p>
              <p className="text-2xl font-bold text-slate-900">
                {revenue?.online_revenue.toFixed(2) || '0.00'} ₺
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Toplamın %{revenue?.online_percentage.toFixed(1) || '0'}'si
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Bekleyen Sipariş</p>
              <p className="text-2xl font-bold text-slate-900">{pendingOrders.length}</p>
              <p className="text-xs text-slate-400 mt-1">Kargolanmayı bekliyor</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">İade Oranı</p>
              <p className="text-2xl font-bold text-slate-900">2.5%</p>
              <p className="text-xs text-slate-400 mt-1">Son 30 gün</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Kargo Maliyeti</p>
              <p className="text-2xl font-bold text-slate-900">1,250 ₺</p>
              <p className="text-xs text-slate-400 mt-1">Bu ay</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Truck className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Bazlı Satış Dağılımı */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Platform Bazlı Satış Dağılımı</h3>
          {platformDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={platformDistribution as any}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {platformDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              Henüz veri yok
            </div>
          )}
        </div>

        {/* Online Satış Trendi */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Online Satış Trendi (Son 30 Gün)</h3>
          {salesTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#3B82F6" name="Ciro (₺)" />
                <Line type="monotone" dataKey="count" stroke="#10B981" name="Sipariş Sayısı" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              Henüz veri yok
            </div>
          )}
        </div>
      </div>

      {/* Kargolanmayı Bekleyenler */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Kargolanmayı Bekleyenler</h3>
          <button
            onClick={loadData}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Yenile
          </button>
        </div>
        {pendingOrders.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            Bekleyen sipariş yok
          </div>
        ) : (
          <div className="space-y-2">
            {pendingOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div>
                  <p className="font-medium text-slate-900">{order.order_number}</p>
                  <p className="text-sm text-slate-500">
                    {order.platform} • {order.final_amount.toFixed(2)} ₺
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium">
                    {order.marketplace_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

