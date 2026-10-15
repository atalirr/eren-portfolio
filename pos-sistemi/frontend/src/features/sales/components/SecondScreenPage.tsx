/**
 * Second Screen Page Component
 * Müşteriye gösterilecek sepet özeti ekranı
 */

import { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Product } from '../types/sales.types';
import { Customer } from '../services/customersApi';

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  buyPrice: number;
  discount: number;
  tax_rate: number;
}

interface CartData {
  cart: CartItem[];
  total: number;
  customer: Customer | null;
}

export function SecondScreenPage() {
  const [cartData, setCartData] = useState<CartData>({
    cart: [],
    total: 0,
    customer: null,
  });

  useEffect(() => {
    // Window message listener
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'CART_UPDATE') {
        setCartData({
          cart: event.data.cart || [],
          total: event.data.total || 0,
          customer: event.data.customer || null,
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Electron IPC listener (eğer Electron ortamındaysa)
    const electronAPI = (window as any).electronAPI;
    let cartUpdateHandler: ((data: CartData) => void) | null = null;
    
    if (electronAPI && electronAPI.onCartUpdate) {
      cartUpdateHandler = (data: CartData) => {
        setCartData(data);
      };
      electronAPI.onCartUpdate(cartUpdateHandler);
    }

    // Alternatif: Electron IPC (eğer doğrudan erişilebiliyorsa)
    const electron = (window as any).electron;
    let ipcHandler: ((event: any, data: CartData) => void) | null = null;
    
    if (electron && electron.ipcRenderer && typeof electron.ipcRenderer.on === 'function') {
      ipcHandler = (event: any, data: CartData) => {
        setCartData(data);
      };
      electron.ipcRenderer.on('cart-update', ipcHandler);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (electron && electron.ipcRenderer && ipcHandler && typeof electron.ipcRenderer.removeListener === 'function') {
        electron.ipcRenderer.removeListener('cart-update', ipcHandler);
      }
    };
  }, []);

  // Hesaplamalar
  const totalAmount = cartData.cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const itemDiscountsTotal = cartData.cart.reduce((sum, item) => sum + (item.discount || 0), 0);
  const finalAmount = cartData.total || (totalAmount - itemDiscountsTotal);
  const discountAmount = totalAmount - finalAmount;
  const vatAmount = cartData.cart.reduce((sum, item) => {
    const rate = item.tax_rate || 20;
    // KDV dahil birim fiyattan KDV miktarını ayır
    const itemTotal = item.unitPrice * item.quantity;
    const itemVat = itemTotal - (itemTotal / (1 + rate / 100));
    return sum + itemVat;
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Sepet Özeti</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {cartData.customer ? cartData.customer.name : 'Misafir Müşteri'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Ürünler Listesi */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Ürünler</h2>
          {cartData.cart.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Sepet boş</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cartData.cart.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 mb-1">{item.productName}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{item.unitPrice.toFixed(2)} ₺ × {item.quantity}</span>
                      {item.discount > 0 && (
                        <span className="text-red-600 font-medium">
                          İndirim: -{item.discount.toFixed(2)} ₺
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">{(item.unitPrice * item.quantity - item.discount).toFixed(2)} ₺</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Özet */}
        {cartData.cart.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Özet</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-600">Ara Toplam:</span>
                <span className="font-semibold text-blue-600">{totalAmount.toFixed(2)} ₺</span>
              </div>

              <div className="flex justify-between items-center text-lg">
                <span className={discountAmount > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                  İndirim:
                </span>
                <span className={discountAmount > 0 ? 'font-semibold text-red-600' : 'text-gray-400'}>
                  -{discountAmount.toFixed(2)} ₺
                </span>
              </div>

              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-600">KDV Dahil (Toplam):</span>
                <span className="font-semibold text-gray-900">{vatAmount.toFixed(2)} ₺</span>
              </div>

              <div className="border-t-2 border-gray-300 pt-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-gray-900">Toplam:</span>
                  <span className="text-4xl font-bold text-green-600">{finalAmount.toFixed(2)} ₺</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

