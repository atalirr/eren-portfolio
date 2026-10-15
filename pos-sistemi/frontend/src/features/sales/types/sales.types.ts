/**
 * Sales Types
 */

export interface CartItem {
  productId: string;
  productName: string;
  brand?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  buyPrice: number;
  discount: number;
  subtotal: number;
  tax_rate: number;
  discountType?: 'PERCENT' | 'FIXED' | null;
  discountValue?: number;
  size?: string;
  color?: string;
}

export interface OrderItemCreate {
  product_id: string;
  quantity: number;
  unit_sell_price: number;
  unit_buy_price: number;
  discount: number;
  subtotal: number;
}

export interface OrderCreate {
  total_amount: number;
  discount_type?: 'PERCENT' | 'FIXED' | null;
  discount_value: number;
  final_amount: number;
  payment_method: 'CASH' | 'CARD' | 'TRANSFER' | 'DEBT';
  status: string;
  customer_id?: string;
  notes?: string;
  items: OrderItemCreate[];
  source?: 'POS' | 'ONLINE';
  platform?: 'LOCAL' | 'TRENDYOL' | 'HEPSIBURADA' | 'SHOPIFY';
}

export interface HeldOrder {
  id: string;
  timestamp: string;
  customer: HeldOrderCustomer | null;
  cart: CartItem[];
  discountType?: 'PERCENT' | 'FIXED' | null;
  discountValue: number;
  totalAmount: number;
  finalAmount: number;
}

export interface HeldOrderCustomer {
  id: string;
  name: string;
  phone?: string;
  balance?: number;
}

export interface Product {
  id: string;
  name: string;
  brand?: string;
  sku?: string;
  sell_price: number;
  buy_price: number;
  stock_quantity: number;
  critical_level: number;
  unit: string;
  category_id: string;
  barcode?: string;
  size?: string; // Beden
  color?: string;
  material?: string;
  parent_id?: string | null; // Variant için parent ürün ID
  category?: {
    id: string;
    name: string;
    color?: string;
  };
  image_url?: string;
  tax_rate?: number;
}

export interface Category {
  id: string;
  name: string;
  color?: string;
}

/**
 * Backend'den gelen Order Item Response Tipi
 */
export interface OrderItemResponse {
  id: string;
  product_id: string;
  quantity: number;
  unit_sell_price: number;
  unit_buy_price: number;
  discount: number;
  subtotal: number;
  product?: {
    id: string;
    name: string;
  };
}

/**
 * Backend'den gelen Order Response Tipi
 */
export interface OrderResponse {
  id: string;
  order_number: string;
  user_id: string;
  customer_id?: string | null;
  total_amount: number;
  discount_type?: 'PERCENT' | 'FIXED' | null;
  discount_value: number;
  final_amount: number;
  payment_method: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
  status: string;
  source?: 'POS' | 'ONLINE' | null;
  platform?: string | null;
  marketplace_status?: string | null;
  marketplace_order_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItemResponse[];
  customer?: {
    id: string;
    name: string;
    phone?: string;
  };
}


