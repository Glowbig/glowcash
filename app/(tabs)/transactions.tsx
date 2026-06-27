import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth';
import { useTransactionsStore } from '../../src/stores/transactions';
import { learnFromCorrection } from '../../src/lib/categorizer';
import { supabase } from '../../src/lib/supabase';
import { Transaction, BudgetConfig } from '../../src/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

const SOURCE_LABELS: Record<string, string> = {
  email: '📧', sms: '💬', manual: '✏️', api: '🔗', pdf: '📄',
};

export default function TransactionsScreen() {
  const { user } = useAuthStore();
  const { transactions, fetchTransactions, updateCategory } = useTransactionsStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'expenses' | 'income'>('all');
  const [config, setConfig] = useState<BudgetConfig | null>(null);
  const [distributingTx, setDistributingTx] = useState<Transaction | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (user) fetchTransactions(user.id);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from('budget_config').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setConfig(data as BudgetConfig | null));
  }, [user]);

  const filtered = transactions.filter((t) => {
    const matchesSearch =
      !search ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      (t.merchant ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'expenses' && t.amount < 0) ||
      (filter === 'income' && t.amount > 0);
    return matchesSearch && matchesFilter;
  });

  const handleClassify = (tx: Transaction) => {
    Alert.prompt(
      'Clasificar transacción',
      `¿En qué categoría va "${tx.merchant ?? tx.description}"?`,
      async (categoryName) => {
        if (!categoryName || !user) return;
        await learnFromCorrection(user.id, tx.description, tx.merchant, categoryName);
        // TODO: map categoryName → categoryId and update
      }
    );
  };

  const handleRowPress = (tx: Transaction) => {
    if (tx.amount > 0) setDistributingTx(tx);
  };

  const needsPct = (config?.needs_pct ?? 58) / 100;
  const wantsPct = (config?.wants_pct ?? 30) / 100;
  const savingsPct = (config?.savings_pct ?? 12) / 100;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={{ fontSize: 16, color: '#64748B', marginRight: 8 }}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar transacciones..."
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filters}>
        {(['all', 'expenses', 'income'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === 'all' ? 'Todos' : f === 'expenses' ? 'Gastos' : 'Ingresos'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/new-transaction')}>
          <Text style={{ color: '#22D3EE', fontSize: 20, fontWeight: '700' }}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.txRow} onPress={() => handleRowPress(item)} onLongPress={() => handleClassify(item)}>
            <View style={styles.txLeft}>
              <Text style={styles.txSource}>{SOURCE_LABELS[item.source] ?? '💳'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.txDesc} numberOfLines={1}>
                  {item.merchant ?? item.description}
                </Text>
                <Text style={styles.txMeta}>
                  {format(new Date(item.date), 'd MMM', { locale: es })}
                  {item.category && ` · ${item.category.name}`}
                  {!item.category_id && <Text style={{ color: '#FBBF24' }}> · Sin clasificar</Text>}
                </Text>
              </View>
            </View>
            <Text style={[styles.txAmount, { color: item.amount < 0 ? '#F87171' : '#4ADE80' }]}>
              {item.amount < 0 ? '' : '+'}{formatCOP(item.amount)}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>No hay transacciones</Text>
          </View>
        }
      />

      <Modal visible={!!distributingTx} transparent animationType="fade" onRequestClose={() => setDistributingTx(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {distributingTx && (
              <>
                <Text style={styles.modalTitle}>Repartir este ingreso</Text>
                <Text style={styles.modalAmount}>{formatCOP(distributingTx.amount)}</Text>
                <Text style={styles.modalDesc}>{distributingTx.merchant ?? distributingTx.description}</Text>

                <DistributionRow
                  icon="💚"
                  label="Ahorro"
                  pct={savingsPct}
                  amount={distributingTx.amount * savingsPct}
                  hint="Transfiere esto a tu Fiducuenta Nu"
                  color="#4ADE80"
                />
                <DistributionRow
                  icon="🏠"
                  label="Gastos Fijos"
                  pct={needsPct}
                  amount={distributingTx.amount * needsPct}
                  hint="Arriendo, servicios, suscripciones"
                  color="#22D3EE"
                />
                <DistributionRow
                  icon="🎉"
                  label="Gastos Variables"
                  pct={wantsPct}
                  amount={distributingTx.amount * wantsPct}
                  hint="Incluye el pago de tu tarjeta Nu al corte"
                  color="#A78BFA"
                />

                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDistributingTx(null)}>
                  <Text style={styles.modalCloseBtnText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DistributionRow({ icon, label, pct, amount, hint, color }: {
  icon: string; label: string; pct: number; amount: number; hint: string; color: string;
}) {
  return (
    <View style={[styles.distRow, { borderLeftColor: color }]}>
      <Text style={styles.distIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <View style={styles.distHeader}>
          <Text style={styles.distLabel}>{label} ({Math.round(pct * 100)}%)</Text>
          <Text style={[styles.distAmount, { color }]}>{formatCOP(amount)}</Text>
        </View>
        <Text style={styles.distHint}>{hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  searchBar: { flexDirection: 'row', alignItems: 'center', margin: 16, backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#334155' },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#F8FAFC' },
  filters: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4, gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: '#22D3EE', borderColor: '#22D3EE' },
  chipText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  chipTextActive: { color: '#0F172A', fontWeight: '700' },
  addBtn: { marginLeft: 'auto' as any, width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#22D3EE', justifyContent: 'center', alignItems: 'center' },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 8 },
  txLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  txSource: { fontSize: 22 },
  txDesc: { fontSize: 14, fontWeight: '600', color: '#F8FAFC' },
  txMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#64748B' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#1E293B', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 13, color: '#94A3B8', textAlign: 'center', fontWeight: '600' },
  modalAmount: { fontSize: 28, fontWeight: '800', color: '#4ADE80', textAlign: 'center', marginTop: 4 },
  modalDesc: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 20 },
  distRow: { flexDirection: 'row', gap: 12, backgroundColor: '#0F172A', borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3 },
  distIcon: { fontSize: 22 },
  distHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  distLabel: { fontSize: 13, color: '#F8FAFC', fontWeight: '700' },
  distAmount: { fontSize: 14, fontWeight: '800' },
  distHint: { fontSize: 11, color: '#64748B' },
  modalCloseBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  modalCloseBtnText: { fontSize: 14, fontWeight: '700', color: '#22D3EE' },
});
