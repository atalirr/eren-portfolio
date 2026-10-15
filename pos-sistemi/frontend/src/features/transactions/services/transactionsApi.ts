/**
 * Transactions API Service
 * Kasa ve Giderler API çağrıları
 */

import { apiClient } from "@/shared/utils/api.client";

export interface Transaction {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: string | null;
  amount: number;
  description: string | null;
  user_id: string;
  related_order_id: string | null;
  created_at: string;
  updated_at: string;
  is_synced: boolean;
  is_deleted: boolean;
  source?:
    | "POS"
    | "ONLINE"
    | "INVOICE"
    | "ECOMMERCE"
    | "MANUAL"
    | string
    | null;
  payment_source?: "CASH" | "BANK" | string | null;
  payment_method?: "CASH" | "CARD" | "TRANSFER" | string | null;
  reference_id?: string | null;
  platform?: string | null;
}

export interface DailySummary {
  date: string;
  income: number;
  expense: number;
  net: number;
  income_count: number;
  expense_count: number;
  total_count: number;
}

export interface CategoryStatistic {
  category: string;
  amount: number;
}

export interface CategoryStatistics {
  expenses: CategoryStatistic[];
  incomes: CategoryStatistic[];
}

export interface TrendData {
  week?: string;
  month?: string;
  date?: string;
  income: number;
  expense: number;
}

export interface BalanceResponse {
  balance: number;
}

export const transactionsApi = {
  /**
   * Tüm kasa hareketlerini getir
   */
  getTransactions: async (
    includeDeleted: boolean = false,
  ): Promise<Transaction[]> => {
    const response = await apiClient.get("/transactions", {
      params: { include_deleted: includeDeleted },
    });
    return response.data;
  },

  /**
   * Kasa bakiyesini getir
   */
  getBalance: async (opts?: {
    includeTransfers?: boolean;
    paymentSource?: "CASH" | "BANK";
  }): Promise<number> => {
    const response = await apiClient.get<BalanceResponse>(
      "/transactions/balance",
      {
        params: {
          include_transfers: opts?.includeTransfers ?? false,
          payment_source: opts?.paymentSource ?? undefined,
        },
      },
    );
    return response.data.balance;
  },

  /**
   * Günlük kasa özeti
   */
  getDailySummary: async (
    date?: string,
    opts?: { includeTransfers?: boolean; paymentSource?: "CASH" | "BANK" },
  ): Promise<DailySummary> => {
    const response = await apiClient.get<DailySummary>(
      "/transactions/summary/daily",
      {
        params: {
          ...(date ? { date } : {}),
          include_transfers: opts?.includeTransfers ?? false,
          payment_source: opts?.paymentSource ?? undefined,
        },
      },
    );
    return response.data;
  },

  /**
   * Kategori bazlı istatistikler
   */
  getCategoryStatistics: async (
    days: number = 30,
    opts?: { includeTransfers?: boolean; paymentSource?: "CASH" | "BANK" },
  ): Promise<CategoryStatistics> => {
    const response = await apiClient.get<CategoryStatistics>(
      "/transactions/statistics/categories",
      {
        params: {
          days,
          include_transfers: opts?.includeTransfers ?? false,
          payment_source: opts?.paymentSource ?? undefined,
        },
      },
    );
    return response.data;
  },

  /**
   * Günlük trend verisi (son n gün)
   */
  getDailyTrend: async (
    days: number = 7,
    opts?: { includeTransfers?: boolean; paymentSource?: "CASH" | "BANK" },
  ): Promise<TrendData[]> => {
    const response = await apiClient.get<TrendData[]>(
      "/transactions/trend/daily",
      {
        params: {
          days,
          include_transfers: opts?.includeTransfers ?? false,
          payment_source: opts?.paymentSource ?? undefined,
        },
      },
    );
    return response.data;
  },

  /**
   * Haftalık trend verisi
   */
  getWeeklyTrend: async (
    weeks: number = 4,
    opts?: { includeTransfers?: boolean; paymentSource?: "CASH" | "BANK" },
  ): Promise<TrendData[]> => {
    const response = await apiClient.get<TrendData[]>(
      "/transactions/trend/weekly",
      {
        params: {
          weeks,
          include_transfers: opts?.includeTransfers ?? false,
          payment_source: opts?.paymentSource ?? undefined,
        },
      },
    );
    return response.data;
  },

  /**
   * Aylık trend verisi
   */
  getMonthlyTrend: async (
    months: number = 6,
    opts?: { includeTransfers?: boolean; paymentSource?: "CASH" | "BANK" },
  ): Promise<TrendData[]> => {
    const response = await apiClient.get<TrendData[]>(
      "/transactions/trend/monthly",
      {
        params: {
          months,
          include_transfers: opts?.includeTransfers ?? false,
          payment_source: opts?.paymentSource ?? undefined,
        },
      },
    );
    return response.data;
  },

  /**
   * Gider ekle
   */
  addExpense: async (
    amount: number,
    category: string,
    description: string,
    userId: string = "default-user",
    paymentSource: "CASH" | "BANK" = "CASH",
    paymentMethod?: "CASH" | "CARD" | "TRANSFER" | "DEBT",
  ): Promise<Transaction> => {
    const data = {
      amount,
      category,
      description,
      user_id: userId,
    };
    const params: any = {
      payment_source: paymentSource,
    };
    if (paymentMethod) params.payment_method = paymentMethod;
    
    const response = await apiClient.post<Transaction>(
      "/transactions/expense",
      data,
      {
        params,
      },
    );
    return response.data;
  },

  /**
   * Gelir ekle (Tahsilat vb.)
   */
  addIncome: async (
    amount: number,
    category: string,
    description: string,
    userId: string = "default-user",
    paymentSource: "CASH" | "BANK" = "CASH",
    paymentMethod?: "CASH" | "CARD" | "TRANSFER" | "DEBT",
    customerId?: string,
    saleOrderId?: string,
  ): Promise<Transaction> => {
    const data = {
      amount,
      category,
      description,
      user_id: userId,
    };
    const params: any = {
      payment_source: paymentSource,
    };
    if (paymentMethod) {
      params.payment_method = paymentMethod;
    }
    if (customerId) {
      params.customer_id = customerId;
    }
    if (saleOrderId) {
      params.sale_order_id = saleOrderId;
    }
    const response = await apiClient.post<Transaction>(
      "/transactions/income",
      data,
      {
        params,
      },
    );
    return response.data;
  },

  /**
   * ID'ye göre işlem getir
   */
  getTransaction: async (transactionId: string): Promise<Transaction> => {
    const response = await apiClient.get<Transaction>(
      `/transactions/${transactionId}`,
    );
    return response.data;
  },

  /**
   * Transaction'ı sil
   */
  deleteTransaction: async (transactionId: string): Promise<void> => {
    await apiClient.delete(`/transactions/${transactionId}`);
  },

  /**
   * Satış iadesi (transaction üzerinden)
   * - Stokları geri ekler
   * - Sipariş + ilgili transactionları soft-delete eder
   */
  refundSaleTransaction: async (
    transactionId: string,
    userId: string = "default-user",
  ): Promise<{
    refunded: boolean;
    transaction_id: string;
    order_id: string;
    restocked_items: number;
  }> => {
    const response = await apiClient.post(
      `/transactions/${transactionId}/refund`,
      null,
      { params: { user_id: userId } },
    );
    return response.data;
  },

  /**
   * Virman işlemi (Banka ve Kasa arası transfer)
   */
  transfer: async (
    amount: number,
    fromSource: "CASH" | "BANK",
    toSource: "CASH" | "BANK",
    description: string = "",
    userId: string = "default-user",
  ): Promise<{
    expense_transaction: Transaction;
    income_transaction: Transaction;
    message: string;
  }> => {
    const response = await apiClient.post<{
      expense_transaction: Transaction;
      income_transaction: Transaction;
      message: string;
    }>("/transactions/transfer", {
      amount,
      from_source: fromSource,
      to_source: toSource,
      description: description || "",
      user_id: userId,
    });
    return response.data;
  },
};
