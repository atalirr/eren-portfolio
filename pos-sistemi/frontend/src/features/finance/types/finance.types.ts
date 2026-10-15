/**
 * Finance Types
 */

export type TransactionType = 'INCOME' | 'EXPENSE';
export type PaymentSource = 'CASH' | 'BANK';
export type ExpenseCategory = 'BILLS' | 'RENT' | 'PURCHASE' | 'STAFF' | 'KITCHEN' | 'OTHER';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  description?: string;
  payment_source: PaymentSource;
  user_id: string;
  user_name?: string;
  related_order_id?: string;
  receipt_url?: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionCreate {
  type: TransactionType;
  category: string;
  amount: number;
  description?: string;
  payment_source: PaymentSource;
  receipt_file?: File;
  related_supplier_id?: string;
  related_staff_id?: string;
}

export interface CashFlowData {
  date: string;
  income: number;
  expense: number;
  cumulative: number;
}

export interface ExpenseCategoryData {
  category: string;
  amount: number;
  percentage: number;
}

export interface CustomerReceivable {
  id: string;
  name: string;
  balance: number;
  phone?: string;
  email?: string;
}

export interface SupplierPayable {
  id: string;
  name: string;
  balance: number;
  phone?: string;
  email?: string;
}

export interface FinanceKPIs {
  netCash: number;
  monthlyIncome: number;
  monthlyExpense: number;
  estimatedMonthEnd: number;
  cashChange: number;
  bankBalance: number;
}
