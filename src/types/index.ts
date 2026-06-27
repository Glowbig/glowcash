export type Bank = 'bancolombia' | 'nequi' | 'nu' | 'davivienda' | 'cash' | 'other';
export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'wallet';
export type TransactionSource = 'email' | 'sms' | 'manual' | 'api' | 'pdf' | 'notification';
export type CategoryType = 'need' | 'want' | 'saving';
export type BudgetModel = '50_30_20' | '3_bolsillos' | 'custom';
export type PayCycle = 'monthly' | 'biweekly' | 'bimonthly' | 'daily_labor';
export type AlertType = 'budget_exceeded' | 'unusual_spending' | 'nu_payment_due' | 'saving_reminder' | 'tip';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  bank: Bank;
  type: AccountType;
  balance: number;
  currency: string;
  last_four?: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  budget_pct: number;
  is_default: boolean;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id?: string;
  amount: number;
  description: string;
  merchant?: string;
  category_id?: string;
  category?: Category;
  date: string;
  source: TransactionSource;
  raw_text?: string;
  hash: string;
  is_pending: boolean;
  created_at: string;
}

export interface CategorizationRule {
  id: string;
  user_id: string;
  pattern: string;
  category_id: string;
  confidence: number;
  uses_count: number;
  created_from: 'user' | 'ai';
}

export interface BudgetConfig {
  id: string;
  user_id: string;
  income: number;
  model: BudgetModel;
  period: 'monthly' | 'biweekly';
  pay_cycle: PayCycle;
  needs_pct: number;
  wants_pct: number;
  savings_pct: number;
}

export interface Alert {
  id: string;
  user_id: string;
  type: AlertType;
  message: string;
  read: boolean;
  created_at: string;
}

// Derived types for UI
export interface BudgetSummary {
  needs: { limit: number; spent: number; pct: number };
  wants: { limit: number; spent: number; pct: number };
  savings: { limit: number; transferred: number; pct: number };
}

export interface NuRecommendation {
  cycleSpend: number;
  availableForPayment: number;
  canPayFull: boolean;
  paymentAmount: number;
  savingsTransfer: number;
  emergencyFundProgress: number;
  emergencyFundTarget: number;
  status: 'green' | 'yellow' | 'red';
  message: string;
}
