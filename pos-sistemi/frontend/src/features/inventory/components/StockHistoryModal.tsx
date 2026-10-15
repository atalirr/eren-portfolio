/**
 * Stock History Modal Component
 * Ürün stok hareket geçmişi modalı
 */

import { useState, useEffect } from 'react';
import { X, Loader2, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { Product, inventoryApi } from '../services/inventoryApi';

interface StockHistoryEntry {
  id: string;
  date: string;
  type: 'SALE' | 'RETURN' | 'RESTOCK' | 'CORRECTION';
  quantity: number;
  user_name?: string;
  notes?: string;
}

interface StockHistoryModalProps {
  product: Product;
  onClose: () => void;
}

export function StockHistoryModal({ product, onClose }: StockHistoryModalProps) {
  const [history, setHistory] = useState<StockHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [product.id]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      // API'den stok geçmişini çek
      const data = await inventoryApi.getStockHistory(product.id);
      setHistory(data);
    } catch (error) {
      console.error('Stok geçmişi yüklenemedi:', error);
      alert('Stok geçmişi yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'SALE':
        return 'Satış';
      case 'RETURN':
        return 'İade';
      case 'RESTOCK':
        return 'Stok Girişi';
      case 'CORRECTION':
        return 'Düzeltme';
      default:
        return type;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'SALE':
      case 'RETURN':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'RESTOCK':
      case 'CORRECTION':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      default:
        return <Package className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {product.name} Hareketleri
            </h2>
            <p className="text-sm text-slate-500 mt-1">Stok hareket geçmişi</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-slate-500">Yükleniyor...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-500">Henüz hareket kaydı yok</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Tarih
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      İşlem
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Miktar
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Yapan Kişi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Notlar
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(entry.type)}
                          <span className="text-sm text-slate-700">
                            {getTypeLabel(entry.type)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-semibold ${
                            entry.quantity > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {entry.quantity > 0 ? '+' : ''}
                          {entry.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {entry.user_name || 'Sistem'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {entry.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex items-center justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition font-medium"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

