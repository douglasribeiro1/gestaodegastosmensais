export type PaymentMethod = 'DEBIT' | 'CREDIT';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  method: PaymentMethod;
  date: string; // ISO string YYYY-MM-DD
  time: string; // HH:MM
  createdAt: number;
}

export interface MonthlyBudget {
  month: string; // YYYY-MM
  limit: number;
}

export interface BackupData {
  version: number;
  timestamp: number;
  transactions: Transaction[];
  budgets: MonthlyBudget[];
}