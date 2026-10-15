/**
 * E-Commerce Orders Component
 * Online sipariş yönetimi (Kanban Board)
 */

import React, { useState, useEffect } from 'react';
import { Package, Truck, CheckCircle, X } from 'lucide-react';
import { MarketplaceStatus } from '../types/ecommerce.types';

interface Order {
  id: string;
  order_number: string;
  platform?: string;
  marketplace_status?: MarketplaceStatus;
  final_amount: number;
  created_at: string;
}

const STATUS_COLUMNS = [
  { status: MarketplaceStatus.NEW, label: 'Yeni', icon: Package, color: 'bg-blue-50 border-blue-200' },
  { status: MarketplaceStatus.PREPARING, label: 'Hazırlanıyor', icon: Package, color: 'bg-yellow-50 border-yellow-200' },
  { status: MarketplaceStatus.SHIPPED, label: 'Kargolandı', icon: Truck, color: 'bg-purple-50 border-purple-200' },
  { status: MarketplaceStatus.DELIVERED, label: 'Teslim Edildi', icon: CheckCircle, color: 'bg-green-50 border-green-200' },
];

export function EcommerceOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      // TODO: API'den siparişleri getir
      // const data = await ecommerceApi.getOnlineOrders();
      // setOrders(data);
    } catch (error) {
      console.error('Siparişler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: MarketplaceStatus) => {
    // TODO: API'ye sipariş durumu güncelleme isteği gönder
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, marketplace_status: newStatus } : order
      )
    );
  };

  const getOrdersByStatus = (status: MarketplaceStatus) => {
    return orders.filter((order) => order.marketplace_status === status);
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
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-900">Sipariş Yönetimi</h2>
        <p className="text-sm text-slate-500">Siparişleri sürükleyip durumlarını güncelleyin</p>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUS_COLUMNS.map((column) => {
          const columnOrders = getOrdersByStatus(column.status);
          const Icon = column.icon;

          return (
            <div key={column.status} className={`rounded-lg border-2 p-4 ${column.color}`}>
              <div className="flex items-center gap-2 mb-4">
                <Icon className="w-5 h-5" />
                <h3 className="font-semibold text-slate-900">{column.label}</h3>
                <span className="ml-auto px-2 py-1 bg-white rounded text-xs font-medium">
                  {columnOrders.length}
                </span>
              </div>
              <div className="space-y-2">
                {columnOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm cursor-move hover:shadow-md transition-shadow"
                    draggable
                    onDragEnd={(e) => {
                      // TODO: Drag & drop implementasyonu
                    }}
                  >
                    <p className="font-medium text-slate-900 text-sm">{order.order_number}</p>
                    <p className="text-xs text-slate-500 mt-1">{order.platform}</p>
                    <p className="text-sm font-semibold text-slate-900 mt-2">
                      {order.final_amount.toFixed(2)} ₺
                    </p>
                  </div>
                ))}
                {columnOrders.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Sipariş yok
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}





















