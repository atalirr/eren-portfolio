/**
 * Sales Hook
 */

import { useState, useEffect } from 'react';
import { salesApi } from '../services/salesApi';
import { Product, Category, CartItem, OrderCreate } from '../types/sales.types';

export function useSales() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED' | null>(null);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'DEBT'>('CASH');

  // Sepeti sessionStorage'dan yükle
  useEffect(() => {
    const savedCart = sessionStorage.getItem('sales-cart');
    const savedDiscountType = sessionStorage.getItem('sales-discount-type');
    const savedDiscountValue = sessionStorage.getItem('sales-discount-value');
    
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
      } catch (error) {
        console.error('Sepet yüklenemedi:', error);
      }
    }
    
    if (savedDiscountType) {
      setDiscountType(savedDiscountType as 'PERCENT' | 'FIXED' | null);
    }
    
    if (savedDiscountValue) {
      setDiscountValue(parseFloat(savedDiscountValue));
    }
  }, []);

  // Sepeti sessionStorage'a kaydet
  useEffect(() => {
    if (cart.length > 0) {
      sessionStorage.setItem('sales-cart', JSON.stringify(cart));
    } else {
      sessionStorage.removeItem('sales-cart');
    }
  }, [cart]);

  // İndirim bilgilerini localStorage'a kaydet
  useEffect(() => {
    if (discountType) {
      sessionStorage.setItem('sales-discount-type', discountType);
    } else {
      sessionStorage.removeItem('sales-discount-type');
    }
  }, [discountType]);

  useEffect(() => {
    if (discountValue > 0) {
      sessionStorage.setItem('sales-discount-value', discountValue.toString());
    } else {
      sessionStorage.removeItem('sales-discount-value');
    }
  }, [discountValue]);

  // Kategorileri yükle
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await salesApi.getCategories();
        setCategories(data);
      } catch (error) {
        console.error('Kategoriler yüklenemedi:', error);
      }
    };
    loadCategories();
  }, []);

  // Ürünleri yükle - Stok sayfasındaki mock verilerle
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        // Önce API'den dene
        try {
          const data = await salesApi.getProducts(selectedCategory || undefined);
          if (data && data.length > 0) {
            setProducts(data);
            return;
          }
        } catch (error) {
          // API'den veri alınamazsa mock veriler kullanılacak
        }
        
        // Eğer API'den veri gelmezse, stok sayfasındaki mock verileri kullan
        const mockProducts: Product[] = [
          {
            id: '1',
            name: 'Nike Air Max 90',
            brand: 'Nike',
            size: '42',
            sell_price: 299.99,
            buy_price: 150,
            stock_quantity: 25,
            critical_level: 10,
            unit: 'adet',
            category_id: 'cat-1',
            barcode: '1234567890123',
            tax_rate: 20,
            category: { id: 'cat-1', name: 'Ayakkabı' },
          },
          {
            id: '2',
            name: 'Adidas Ultraboost',
            brand: 'Adidas',
            size: '41',
            sell_price: 349.99,
            buy_price: 180,
            stock_quantity: 12,
            critical_level: 10,
            unit: 'adet',
            category_id: 'cat-1',
            barcode: '2345678901234',
            tax_rate: 20,
            category: { id: 'cat-1', name: 'Ayakkabı' },
          },
          {
            id: '3',
            name: 'Puma RS-X',
            brand: 'Puma',
            size: '42',
            sell_price: 249.99,
            buy_price: 120,
            stock_quantity: 8,
            critical_level: 10,
            unit: 'adet',
            category_id: 'cat-1',
            barcode: '3456789012345',
            category: { id: 'cat-1', name: 'Ayakkabı' },
          },
          {
            id: '4',
            name: 'Converse Chuck Taylor',
            sell_price: 199.99,
            buy_price: 90,
            stock_quantity: 3,
            critical_level: 10,
            unit: 'adet',
            category_id: 'cat-1',
            barcode: '4567890123456',
            category: { id: 'cat-1', name: 'Ayakkabı' },
          },
          {
            id: '5',
            name: 'Vans Old Skool',
            sell_price: 179.99,
            buy_price: 85,
            stock_quantity: 0,
            critical_level: 10,
            unit: 'adet',
            category_id: 'cat-1',
            barcode: '5678901234567',
            category: { id: 'cat-1', name: 'Ayakkabı' },
          },
          {
            id: '6',
            name: 'New Balance 550',
            sell_price: 269.99,
            buy_price: 130,
            stock_quantity: 18,
            critical_level: 10,
            unit: 'adet',
            category_id: 'cat-1',
            barcode: '6789012345678',
            category: { id: 'cat-1', name: 'Ayakkabı' },
          },
          {
            id: '7',
            name: 'Nike T-Shirt',
            brand: 'Nike',
            size: 'L',
            sell_price: 79.99,
            buy_price: 35,
            stock_quantity: 45,
            critical_level: 20,
            unit: 'adet',
            category_id: 'cat-2',
            barcode: '7890123456789',
            category: { id: 'cat-2', name: 'Giyim' },
          },
          {
            id: '8',
            name: 'Adidas Sweatshirt',
            brand: 'Adidas',
            size: 'M',
            sell_price: 129.99,
            buy_price: 60,
            stock_quantity: 22,
            critical_level: 15,
            unit: 'adet',
            category_id: 'cat-2',
            barcode: '8901234567890',
            category: { id: 'cat-2', name: 'Giyim' },
          },
          {
            id: '9',
            name: 'Puma Shorts',
            sell_price: 89.99,
            buy_price: 40,
            stock_quantity: 5,
            critical_level: 10,
            unit: 'adet',
            category_id: 'cat-2',
            barcode: '9012345678901',
            category: { id: 'cat-2', name: 'Giyim' },
          },
          {
            id: '10',
            name: 'Nike Backpack',
            sell_price: 149.99,
            buy_price: 70,
            stock_quantity: 15,
            critical_level: 5,
            unit: 'adet',
            category_id: 'cat-3',
            barcode: '0123456789012',
            category: { id: 'cat-3', name: 'Aksesuar' },
          },
          {
            id: '11',
            name: 'Adidas Cap',
            sell_price: 49.99,
            buy_price: 20,
            stock_quantity: 30,
            critical_level: 10,
            unit: 'adet',
            category_id: 'cat-3',
            barcode: '1234509876543',
            category: { id: 'cat-3', name: 'Aksesuar' },
          },
          {
            id: '12',
            name: 'Puma Socks Pack',
            sell_price: 29.99,
            buy_price: 12,
            stock_quantity: 7,
            critical_level: 15,
            unit: 'adet',
            category_id: 'cat-3',
            barcode: '2345610987654',
            category: { id: 'cat-3', name: 'Aksesuar' },
          },
        ];
        
        // Kategori filtresine göre filtrele
        const filtered = selectedCategory
          ? mockProducts.filter(p => p.category_id === selectedCategory)
          : mockProducts;
        
        setProducts(filtered);
      } catch (error) {
        console.error('Ürünler yüklenemedi:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, [selectedCategory]);

  const refreshProducts = async () => {
    try {
      const data = await salesApi.getProducts(selectedCategory || undefined);
      if (data && data.length > 0) {
        setProducts(data);
      }
    } catch (error) {
      console.error('Ürünler güncellenemedi:', error);
    }
  };

  // Ürün indirimini ve ara toplamı yeniden hesaplama yardımcı fonksiyonu
  const recalculateItemDiscountAndSubtotal = (
    item: CartItem,
    newQuantity: number
  ) => {
    let discount = 0;
    const originalLineTotal = newQuantity * item.unitPrice;

    if (item.discountType === 'PERCENT' && item.discountValue !== undefined) {
      discount = originalLineTotal * (item.discountValue / 100);
    } else if (item.discountType === 'FIXED' && item.discountValue !== undefined) {
      discount = Math.min(item.discountValue, originalLineTotal);
    } else {
      discount = Math.min(item.discount || 0, originalLineTotal);
    }

    return {
      discount,
      subtotal: Math.max(0, originalLineTotal - discount)
    };
  };

  // Sepete ürün ekle
  const addToCart = (product: Product, quantity: number = 1) => {
    if (product.stock_quantity < quantity) {
      alert(`Yetersiz stok! Mevcut stok: ${product.stock_quantity}`);
      return;
    }

    const existingItem = cart.find((item) => item.productId === product.id);

    if (existingItem) {
      // Mevcut ürünü güncelle
      const newQuantity = existingItem.quantity + quantity;
      if (product.stock_quantity < newQuantity) {
        alert(`Yetersiz stok! Mevcut stok: ${product.stock_quantity}`);
        return;
      }
      const { discount, subtotal } = recalculateItemDiscountAndSubtotal(existingItem, newQuantity);
      setCart(
        cart.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: newQuantity,
                discount,
                subtotal,
              }
            : item
        )
      );
    } else {
      // Yeni ürün ekle - Veritabanındaki sell_price zaten KDV dahil fiyattır, tekrar KDV eklenmez.
      const taxRate = product.tax_rate ?? 20;
      const inclusivePrice = product.sell_price;
      const subtotal = quantity * inclusivePrice;
      
      setCart([
        ...cart,
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          unit: product.unit,
          quantity,
          unitPrice: inclusivePrice,
          buyPrice: product.buy_price,
          discount: 0,
          subtotal,
          tax_rate: taxRate,
          size: product.size,
          color: product.color,
        },
      ]);
    }
  };

  // Sepetten ürün çıkar
  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  // Sepeti güncelle
  const updateCartItem = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find((p) => p.id === productId);
    if (product && product.stock_quantity < quantity) {
      alert(`Yetersiz stok! Mevcut stok: ${product.stock_quantity}`);
      return;
    }

    setCart(
      cart.map((item) => {
        if (item.productId === productId) {
          const { discount, subtotal } = recalculateItemDiscountAndSubtotal(item, quantity);
          return {
            ...item,
            quantity,
            discount,
            subtotal,
          };
        }
        return item;
      })
    );
  };

  // Ürün bazlı indirim uygula
  const applyItemDiscount = (productId: string, discountType: 'PERCENT' | 'FIXED', discountValue: number): boolean => {
    const item = cart.find((i) => i.productId === productId);
    if (item) {
      const lineTotal = item.unitPrice * item.quantity;
      let actualDiscountAmount = 0;
      if (discountType === 'PERCENT') {
        actualDiscountAmount = lineTotal * (discountValue / 100);
      } else {
        actualDiscountAmount = discountValue;
      }
      if (actualDiscountAmount > lineTotal) {
        alert(`İndirim tutarı (₺${actualDiscountAmount.toFixed(2)}) ürünün toplam fiyatından (₺${lineTotal.toFixed(2)}) fazla olamaz!`);
        return false;
      }
    }

    setCart(
      cart.map((item) => {
        if (item.productId === productId) {
          const tempItem = {
            ...item,
            discountType,
            discountValue,
          };
          const { discount, subtotal } = recalculateItemDiscountAndSubtotal(tempItem, item.quantity);
          return {
            ...item,
            discountType,
            discountValue,
            discount,
            subtotal,
          };
        }
        return item;
      })
    );
    return true;
  };

  // Ürün bazlı indirimi geri al
  const removeItemDiscount = (productId: string) => {
    setCart(
      cart.map((item) => {
        if (item.productId === productId) {
          const subtotal = item.quantity * item.unitPrice;
          return {
            ...item,
            discount: 0,
            discountType: undefined,
            discountValue: undefined,
            subtotal,
          };
        }
        return item;
      })
    );
  };

  // Sepeti temizle
  const clearCart = () => {
    setCart([]);
    setDiscountType(null);
    setDiscountValue(0);
    sessionStorage.removeItem('sales-cart');
    sessionStorage.removeItem('sales-discount-type');
    sessionStorage.removeItem('sales-discount-value');
  };

  // Sepeti geri yükle (bekleyen satışlar için - indirim bilgileriyle birlikte)
  const restoreCart = (items: CartItem[]) => {
    setCart(items);
  };

  // Toplam hesapla
  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  // İndirim sonrası toplam
  const calculateFinalTotal = () => {
    const total = calculateTotal();
    if (!discountType || discountValue === 0) return total;

    if (discountType === 'PERCENT') {
      return total * (1 - discountValue / 100);
    } else {
      return Math.max(0, total - discountValue);
    }
  };

  // Satışı tamamla
  const completeSale = async (userId: string = 'default-user-id'): Promise<any> => {
    if (cart.length === 0) {
      throw new Error('Sepet boş!');
    }

    const totalAmount = calculateTotal();
    const finalAmount = calculateFinalTotal();

    const orderData: OrderCreate = {
      total_amount: totalAmount,
      discount_type: discountType,
      discount_value: discountValue,
      final_amount: finalAmount,
      payment_method: paymentMethod,
      status: 'completed',
      items: cart.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_sell_price: item.unitPrice,
        unit_buy_price: item.buyPrice,
        discount: item.discount,
        subtotal: item.subtotal,
      })),
    };

    const result = await salesApi.createSale(orderData as any, userId);
    clearCart();
    return result;
  };

  return {
    products,
    categories,
    selectedCategory,
    setSelectedCategory,
    cart,
    addToCart,
    removeFromCart,
    updateCartItem,
    applyItemDiscount,
    removeItemDiscount,
    clearCart,
    restoreCart,
    calculateTotal,
    calculateFinalTotal,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    paymentMethod,
    setPaymentMethod,
    completeSale,
    refreshProducts,
    loading,
  };
}


