import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth';
import { supabase } from '../../src/lib/supabase';
import { Category, Transaction, BudgetConfig } from '../../src/types';

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

const DEFAULT_INCOME = 2_825_095;

export default function AnalyticsScreen() {
  const { user } = useAuthStore();
  const [month, setMonth] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [config, setConfig] = useState<BudgetConfig | null>(null);
  const [carryover, setCarryover] = useState(0);
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<{ month: string; total: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${user.id},is_default.eq.true`)
      .then(({ data }) => setCategories((data as Category[]) ?? []));

    supabase
      .from('budget_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setConfig(data as BudgetConfig | null));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const from = startOfMonth(month).toISOString();
    const to = endOfMonth(month).toISOString();
    supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .eq('user_id', user.id)
      .gte('date', from)
      .lte('date', to)
      .then(({ data }) => setTransactions((data as Transaction[]) ?? []));
  }, [user, month]);

  // Saldo acumulado de todos los meses anteriores al seleccionado
  useEffect(() => {
    if (!user) return;
    const firstOfMonth = startOfMonth(month).toISOString();
    supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .lt('date', firstOfMonth)
      .then(({ data }) => {
        const sum = (data ?? []).reduce((s, t) => s + t.amount, 0);
        setCarryover(sum);
      });
  }, [user, month]);

  // Last 6 months evolution
  useEffect(() => {
    if (!user) return;
    (async () => {
      const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
      const from = startOfMonth(months[0]).toISOString();
      const { data } = await supabase
        .from('transactions')
        .select('amount, date')
        .eq('user_id', user.id)
        .lt('amount', 0)
        .gte('date', from);

      const totals = months.map((m) => {
        const key = format(m, 'yyyy-MM');
        const total = (data ?? [])
          .filter((t) => t.date.startsWith(key))
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        return { month: format(m, 'MMM', { locale: es }), total };
      });
      setHistory(totals);
    })();
  }, [user]);

  const income = config?.income ?? DEFAULT_INCOME;
  const needsLimit = income * ((config?.needs_pct ?? 58) / 100);
  const wantsLimit = income * ((config?.wants_pct ?? 30) / 100);
  const savingsLimit = income * ((config?.savings_pct ?? 12) / 100);

  const totalIncome = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const periodBalance = carryover + totalIncome - totalExpenses;

  const byType = useMemo(() => {
    const groups = { need: 0, want: 0, saving: 0 };
    for (const t of transactions) {
      if (t.amount >= 0 || !t.category) continue;
      groups[t.category.type] += Math.abs(t.amount);
    }
    return groups;
  }, [transactions]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { category: Category; total: number }>();
    for (const t of transactions) {
      if (t.amount >= 0 || !t.category) continue;
      const existing = map.get(t.category.id);
      map.set(t.category.id, { category: t.category, total: (existing?.total ?? 0) + Math.abs(t.amount) });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [transactions]);

  const maxHistory = Math.max(...history.map((h) => h.total), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>Analytics</Text>

      {/* Month selector */}
      <View style={styles.monthRow}>
        <TouchableOpacity style={styles.monthArrow} onPress={() => setMonth((m) => subMonths(m, 1))}>
          <Text style={styles.monthArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthText}>{format(month, "MMMM yyyy", { locale: es })}</Text>
        <TouchableOpacity style={styles.monthArrow} onPress={() => setMonth((m) => addMonths(m, 1))}>
          <Text style={styles.monthArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Saldo inicial (carryover de meses anteriores) */}
      {carryover !== 0 && (
        <View style={[styles.carryoverCard, { borderColor: carryover > 0 ? '#166534' : '#7F1D1D' }]}>
          <Text style={styles.carryoverLabel}>Saldo inicial (meses anteriores)</Text>
          <Text style={[styles.carryoverValue, { color: carryover > 0 ? '#4ADE80' : '#F87171' }]}>
            {carryover >= 0 ? '+' : ''}{formatCOP(carryover)}
          </Text>
          {totalIncome === 0 && carryover > 0 && (
            <Text style={styles.carryoverNote}>
              Sin ingresos registrados este mes. Tu saldo incluye la nómina del mes anterior.
            </Text>
          )}
        </View>
      )}

      {/* Summary */}
      <View style={styles.summaryRow}>
        <SummaryCard label="Ingresos" value={formatCOP(totalIncome)} color="#4ADE80" />
        <SummaryCard label="Gastos" value={formatCOP(totalExpenses)} color="#F87171" />
      </View>

      {/* Balance del periodo = carryover + ingresos - gastos */}
      <View style={[styles.periodCard, { borderColor: periodBalance >= 0 ? '#166534' : '#7F1D1D' }]}>
        <Text style={styles.periodLabel}>Balance del periodo</Text>
        <Text style={[styles.periodValue, { color: periodBalance >= 0 ? '#4ADE80' : '#F87171' }]}>
          {periodBalance >= 0 ? '+' : ''}{formatCOP(periodBalance)}
        </Text>
        {carryover !== 0 && (
          <Text style={styles.periodBreakdown}>
            {formatCOP(carryover)} inicial{totalIncome > 0 ? ` + ${formatCOP(totalIncome)} ingresos` : ''}{totalExpenses > 0 ? ` − ${formatCOP(totalExpenses)} gastos` : ''}
          </Text>
        )}
      </View>

      {totalIncome > 0 && (
        <View style={styles.savingsCard}>
          <Text style={styles.savingsLabel}>Tasa de ahorro del mes</Text>
          <Text style={[styles.savingsValue, { color: savingsRate >= 12 ? '#4ADE80' : '#FBBF24' }]}>
            {savingsRate.toFixed(1)}%
          </Text>
        </View>
      )}

      {/* 3 Bolsillos comparison */}
      <Text style={styles.sectionTitle}>Necesidades / Gustos / Ahorro</Text>
      <BudgetBar label="Necesidades" spent={byType.need} limit={needsLimit} color="#22D3EE" />
      <BudgetBar label="Gustos" spent={byType.want} limit={wantsLimit} color="#A78BFA" />
      <BudgetBar label="Ahorro" spent={byType.saving} limit={savingsLimit} color="#4ADE80" />

      {/* Category breakdown */}
      <Text style={styles.sectionTitle}>Gasto por categoría</Text>
      {byCategory.length === 0 ? (
        <Text style={styles.emptyText}>Sin gastos registrados este mes.</Text>
      ) : (
        byCategory.map(({ category, total }) => (
          <View key={category.id} style={styles.categoryRow}>
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryAmount}>{formatCOP(total)}</Text>
              </View>
              <View style={styles.categoryTrack}>
                <View
                  style={[
                    styles.categoryFill,
                    { width: `${Math.min((total / (totalExpenses || 1)) * 100, 100)}%` as any, backgroundColor: category.color },
                  ]}
                />
              </View>
            </View>
          </View>
        ))
      )}

      {/* Monthly evolution */}
      <Text style={styles.sectionTitle}>Últimos 6 meses</Text>
      <View style={styles.historyChart}>
        {history.map((h) => (
          <View key={h.month} style={styles.historyBarContainer}>
            <View style={styles.historyBarTrack}>
              <View style={[styles.historyBar, { height: `${(h.total / maxHistory) * 100}%` as any }]} />
            </View>
            <Text style={styles.historyLabel}>{h.month}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function BudgetBar({ label, spent, limit, color }: { label: string; spent: number; limit: number; color: string }) {
  const pct = Math.min((spent / (limit || 1)) * 100, 100);
  const isOver = spent > limit;
  return (
    <View style={styles.budgetBarContainer}>
      <View style={styles.budgetBarHeader}>
        <Text style={styles.budgetBarLabel}>{label}</Text>
        <Text style={[styles.budgetBarAmount, isOver && { color: '#F87171' }]}>
          {formatCOP(spent)} / {formatCOP(limit)}
        </Text>
      </View>
      <View style={styles.budgetBarTrack}>
        <View style={[styles.budgetBarFill, { width: `${pct}%` as any, backgroundColor: isOver ? '#F87171' : color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#F8FAFC', marginBottom: 16 },
  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 8, marginBottom: 20,
    borderWidth: 1, borderColor: '#334155',
  },
  monthArrow: { paddingHorizontal: 18, paddingVertical: 12 },
  monthArrowText: { fontSize: 20, color: '#22D3EE', fontWeight: '700' },
  monthText: { fontSize: 15, fontWeight: '700', color: '#F8FAFC', textTransform: 'capitalize' },
  // Carryover card
  carryoverCard: {
    backgroundColor: '#1E293B', borderRadius: 14, padding: 16, borderWidth: 1,
    marginBottom: 12, alignItems: 'center', gap: 4,
  },
  carryoverLabel: { fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  carryoverValue: { fontSize: 22, fontWeight: '800' },
  carryoverNote: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 2 },
  // Summary
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: '#1E293B', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#334155' },
  summaryLabel: { fontSize: 12, color: '#64748B', marginBottom: 6 },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  // Period balance card
  periodCard: {
    backgroundColor: '#1E293B', borderRadius: 14, padding: 16, borderWidth: 1,
    marginBottom: 12, alignItems: 'center', gap: 4,
  },
  periodLabel: { fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  periodValue: { fontSize: 26, fontWeight: '800' },
  periodBreakdown: { fontSize: 11, color: '#475569', textAlign: 'center' },
  // Savings rate (only when income > 0)
  savingsCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 24, alignItems: 'center' },
  savingsLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  savingsValue: { fontSize: 26, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginTop: 8, marginBottom: 12 },
  budgetBarContainer: { marginBottom: 14 },
  budgetBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  budgetBarLabel: { fontSize: 13, color: '#94A3B8' },
  budgetBarAmount: { fontSize: 13, color: '#CBD5E1', fontWeight: '600' },
  budgetBarTrack: { height: 8, backgroundColor: '#1E293B', borderRadius: 4, overflow: 'hidden' },
  budgetBarFill: { height: 8, borderRadius: 4 },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', paddingVertical: 16 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  categoryIcon: { fontSize: 20 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  categoryName: { fontSize: 13, color: '#CBD5E1', fontWeight: '600' },
  categoryAmount: { fontSize: 13, color: '#F8FAFC', fontWeight: '700' },
  categoryTrack: { height: 6, backgroundColor: '#1E293B', borderRadius: 3, overflow: 'hidden' },
  categoryFill: { height: 6, borderRadius: 3 },
  historyChart: { flexDirection: 'row', justifyContent: 'space-between', height: 140, marginTop: 8, paddingHorizontal: 4 },
  historyBarContainer: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  historyBarTrack: { width: 22, height: 100, justifyContent: 'flex-end' },
  historyBar: { width: 22, backgroundColor: '#22D3EE', borderRadius: 6, minHeight: 4 },
  historyLabel: { fontSize: 11, color: '#64748B', textTransform: 'capitalize' },
});
