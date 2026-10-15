/**
 * Invoice Types
 */

export type InvoiceType = 'PURCHASE' | 'SALE';
export type PaymentStatus = 'OPEN' | 'PAID';
export type PaymentMethod = 'CASH' | 'BANK';

export interface InvoiceItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number; // KDV %
  line_total: number;
}

export interface Invoice {
  id: string;
  type: InvoiceType;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  supplier_id?: string;
  supplier_name?: string;
  customer_id?: string;
  customer_name?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax_total: number;
  total: number;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  document_url?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceCreate {
  type: InvoiceType;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  supplier_id?: string;
  customer_id?: string;
  items: InvoiceItem[];
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  document_file?: File;
}
















