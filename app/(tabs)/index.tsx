import { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth';
import { useTransactionsStore } from '../../src/stores/transactions';
import { useBudgetStore } from '../../src/stores/budget';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

function BudgetBar({ label, spent, limit, color }: { label: string; spent: number; limit: number; color: string }) {
  const pct = Math.min((spent / limit) * 100, 100);
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

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { transactions, fetchTransactions, loading } = useTransactionsStore();
  const { summary, config } = useBudgetStore();

  useEffect(() => {
    if (user) fetchTransactions(user.id, 20);
  }, [user]);

  const totalBalance = transactions.reduce((s, t) => s + t.amount, 0);
  const thisMonth = new Date().toISOString().substring(0, 7);
  const monthlyTx = transactions.filter((t) => t.date.startsWith(thisMonth));
  const monthlyExpenses = monthlyTx.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const monthlyIncome = monthlyTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => user && fetchTransactions(user.id, 20)} tintColor="#22D3EE" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola 👋</Text>
          <Text style={styles.date}>{format(new Date(), "EEEE d 'de' MMMM", { locale: es })}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/import')} style={styles.importBtn}>
          <Text style={styles.importBtnText}>+ Importar</Text>
        </TouchableOpacity>
      </View>

      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Balance del mes</Text>
        <Text style={[styles.balanceAmount, { color: monthlyExpenses + monthlyIncome >= 0 ? '#4ADE80' : '#F87171' }]}>
          {formatCOP(monthlyIncome + monthlyExpenses)}
        </Text>
        <View style={styles.balanceRow}>
          <View>
            <Text style={styles.balanceSub}>Ingresos</Text>
            <Text style={[styles.balanceSubAmount, { color: '#4ADE80' }]}>{formatCOP(monthlyIncome)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.balanceSub}>Gastos</Text>
            <Text style={[styles.balanceSubAmount, { color: '#F87171' }]}>{formatCOP(monthlyExpenses)}</Text>
          </View>
        </View>
      </View>

      {/* Budget progress */}
      {summary && config && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Presupuesto del mes</Text>
          <BudgetBar label="Necesidades (58%)" spent={Math.abs(summary.needs.spent)} limit={summary.needs.limit} color="#22D3EE" />
          <BudgetBar label="Gustos (30%)" spent={Math.abs(summary.wants.spent)} limit={summary.wants.limit} color="#A78BFA" />
          <BudgetBar label="Ahorro (12%)" spent={summary.savings.transferred} limit={summary.savings.limit} color="#4ADE80" />
        </View>
      )}

      {/* Recent transactions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimas transacciones</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
            <Text style={styles.seeAll}>Ver todas</Text>
          </TouchableOpacity>
        </View>
        {transactions.slice(0, 5).map((tx) => (
          <TouchableOpacity key={tx.id} style={styles.txRow}>
            <View style={styles.txIcon}>
              <Text style={{ fontSize: 20 }}>{tx.amount < 0 ? '⬇️' : '⬆️'}</Text>
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txDesc} numberOfLines={1}>{tx.merchant ?? tx.description}</Text>
              <Text style={styles.txDate}>{format(new Date(tx.date), 'd MMM', { locale: es })}</Text>
            </View>
            <Text style={[styles.txAmount, { color: tx.amount < 0 ? '#F87171' : '#4ADE80' }]}>
              {tx.amount < 0 ? '' : '+'}{formatCOP(tx.amount)}
            </Text>
          </TouchableOpacity>
        ))}
        {transactions.length === 0 && !loading && (
          <TouchableOpacity style={styles.emptyState} onPress={() => router.push('/import')}>
            <Text style={styles.emptyIcon}>📥</Text>
            <Text style={styles.emptyText}>Importa tus transacciones</Text>
            <Text style={styles.emptySubtext}>Conecta Gmail para importar automáticamente</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#F8FAFC' },
  date: { fontSize: 13, color: '#64748B', marginTop: 2, textTransform: 'capitalize' },
  importBtn: { backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#334155' },
  importBtnText: { color: '#22D3EE', fontSize: 14, fontWeight: '600' },
  balanceCard: { backgroundColor: '#1E293B', borderRadius: 20, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: '#334155' },
  balanceLabel: { fontSize: 13, color: '#94A3B8', marginBottom: 4 },
  balanceAmount: { fontSize: 36, fontWeight: '800', letterSpacing: -1, marginBottom: 16 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceSub: { fontSize: 12, color: '#64748B' },
  balanceSubAmount: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 12 },
  seeAll: { fontSize: 13, color: '#22D3EE', fontWeight: '600' },
  budgetBarContainer: { marginBottom: 14 },
  budgetBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  budgetBarLabel: { fontSize: 13, color: '#94A3B8' },
  budgetBarAmount: { fontSize: 13, color: '#CBD5E1', fontWeight: '600' },
  budgetBarTrack: { height: 8, backgroundColor: '#1E293B', borderRadius: 4, overflow: 'hidden' },
  budgetBarFill: { height: 8, borderRadius: 4 },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 8 },
  txIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: '600', color: '#F8FAFC' },
  txDate: { fontSize: 12, color: '#64748B', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  emptyState: { alignItems: 'center', padding: 32, backgroundColor: '#1E293B', borderRadius: 16, borderWidth: 1, borderColor: '#334155', borderStyle: 'dashed' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#64748B', textAlign: 'center' },
});
