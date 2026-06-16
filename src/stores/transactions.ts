import { create } from 'zustand';
import { Transaction } from '../types';
import { supabase } from '../lib/supabase';

interface TransactionsState {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  fetchTransactions: (userId: string, limit?: number) => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'created_at' | 'hash'>) => Promise<Transaction | null>;
  updateCategory: (txId: string, categoryId: string) => Promise<void>;
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  loading: false,
  error: null,

  fetchTransactions: async (userId, limit = 100) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    set({ transactions: data as Transaction[], loading: false });
  },

  addTransaction: async (tx) => {
    const hash = await computeHash(tx.date, tx.amount, tx.description);

    // Check for duplicate
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('hash', hash)
      .maybeSingle();

    if (existing) return null; // duplicate — skip

    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...tx, hash })
      .select()
      .single();

    if (error || !data) return null;

    set((state) => ({ transactions: [data as Transaction, ...state.transactions] }));
    return data as Transaction;
  },

  updateCategory: async (txId, categoryId) => {
    await supabase
      .from('transactions')
      .update({ category_id: categoryId })
      .eq('id', txId);

    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === txId ? { ...t, category_id: categoryId } : t
      ),
    }));
  },
}));

async function computeHash(date: string, amount: number, description: string): Promise<string> {
  const normalized = `${date.substring(0, 10)}|${Math.abs(amount)}|${description.toLowerCase().trim().replace(/\s+/g, ' ')}`;
  // Simple hash using TextEncoder + SubtleCrypto (available in React Native Hermes)
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback simple hash for environments without SubtleCrypto
    let h = 0;
    for (let i = 0; i < normalized.length; i++) {
      h = Math.imul(31, h) + normalized.charCodeAt(i);
    }
    return (h >>> 0).toString(16);
  }
}
