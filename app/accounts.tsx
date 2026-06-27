import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/auth';
import { supabase } from '../src/lib/supabase';
import { Account, Bank, AccountType } from '../src/types';

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

const BANKS: { value: Bank; label: string; icon: string }[] = [
  { value: 'bancolombia', label: 'Bancolombia', icon: '🟡' },
  { value: 'nequi', label: 'Nequi', icon: '💜' },
  { value: 'nu', label: 'Nu', icon: '💳' },
  { value: 'davivienda', label: 'Davivienda', icon: '🔴' },
  { value: 'cash', label: 'Efectivo', icon: '💵' },
  { value: 'other', label: 'Otro', icon: '🏦' },
];

const TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Cuenta corriente' },
  { value: 'savings', label: 'Cuenta de ahorros' },
  { value: 'credit', label: 'Tarjeta de crédito' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'wallet', label: 'Billetera digital' },
];

export default function AccountsScreen() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [bank, setBank] = useState<Bank>('bancolombia');
  const [type, setType] = useState<AccountType>('savings');
  const [balance, setBalance] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchAccounts = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at');
    setAccounts((data as Account[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, [user]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setBank('bancolombia');
    setType('savings');
    setBalance('');
    setLastFour('');
    setShowForm(false);
  };

  const handleEdit = (acc: Account) => {
    setEditingId(acc.id);
    setName(acc.name);
    setBank(acc.bank);
    setType(acc.type);
    setBalance(String(acc.balance));
    setLastFour(acc.last_four ?? '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    const numericBalance = parseFloat(balance.replace(/[^0-9.-]/g, '')) || 0;

    if (editingId) {
      await supabase
        .from('accounts')
        .update({ name: name.trim(), bank, type, balance: numericBalance, last_four: lastFour || null })
        .eq('id', editingId);
    } else {
      await supabase.from('accounts').insert({
        user_id: user.id,
        name: name.trim(),
        bank,
        type,
        balance: numericBalance,
        last_four: lastFour || null,
      });
    }

    resetForm();
    fetchAccounts();
  };

  const handleDelete = (acc: Account) => {
    Alert.alert('Eliminar cuenta', `¿Eliminar "${acc.name}"? Las transacciones asociadas no se borran.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('accounts').delete().eq('id', acc.id);
          fetchAccounts();
        },
      },
    ]);
  };

  const total = accounts.reduce((s, a) => s + (a.type === 'credit' ? 0 : a.balance), 0);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Cuentas</Text>
        <TouchableOpacity onPress={() => (showForm ? resetForm() : setShowForm(true))}>
          <Text style={styles.addBtn}>{showForm ? 'Cancelar' : '+ Agregar'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Saldo total (sin tarjetas de crédito)</Text>
          <Text style={styles.totalValue}>{formatCOP(total)}</Text>
        </View>

        {showForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>{editingId ? 'Editar cuenta' : 'Nueva cuenta'}</Text>

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder='Ej: "Bancolombia Ahorros"'
              placeholderTextColor="#64748B"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Banco</Text>
            <View style={styles.chipRow}>
              {BANKS.map((b) => (
                <TouchableOpacity
                  key={b.value}
                  style={[styles.chip, bank === b.value && styles.chipActive]}
                  onPress={() => setBank(b.value)}
                >
                  <Text style={styles.chipText}>{b.icon} {b.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Tipo</Text>
            <View style={styles.chipRow}>
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.chip, type === t.value && styles.chipActive]}
                  onPress={() => setType(t.value)}
                >
                  <Text style={styles.chipText}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Saldo actual</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#64748B"
              value={balance}
              onChangeText={setBalance}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Últimos 4 dígitos (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="1234"
              placeholderTextColor="#64748B"
              value={lastFour}
              onChangeText={setLastFour}
              keyboardType="numeric"
              maxLength={4}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>{editingId ? 'Guardar cambios' : 'Crear cuenta'}</Text>
            </TouchableOpacity>

            {editingId && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  const acc = accounts.find((a) => a.id === editingId);
                  if (acc) handleDelete(acc);
                }}
              >
                <Text style={styles.deleteBtnText}>Eliminar cuenta</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!loading && accounts.length === 0 && !showForm && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏦</Text>
            <Text style={styles.emptyText}>No tienes cuentas registradas</Text>
            <Text style={styles.emptySubtext}>Agrega tus cuentas para llevar el saldo al día</Text>
          </View>
        )}

        {accounts.map((acc) => {
          const bankInfo = BANKS.find((b) => b.value === acc.bank);
          return (
            <TouchableOpacity key={acc.id} style={styles.accountCard} onPress={() => handleEdit(acc)}>
              <Text style={styles.accountIcon}>{bankInfo?.icon ?? '🏦'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountName}>{acc.name}</Text>
                <Text style={styles.accountMeta}>
                  {TYPES.find((t) => t.value === acc.type)?.label}
                  {acc.last_four ? ` · *${acc.last_four}` : ''}
                </Text>
              </View>
              <Text style={[styles.accountBalance, acc.type === 'credit' && { color: '#F87171' }]}>
                {formatCOP(acc.balance)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  closeBtn: { fontSize: 20, color: '#94A3B8', width: 24 },
  title: { fontSize: 17, fontWeight: '700', color: '#F8FAFC' },
  addBtn: { fontSize: 14, fontWeight: '700', color: '#22D3EE' },
  content: { padding: 20, paddingBottom: 60 },
  totalCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  totalLabel: { fontSize: 12, color: '#64748B', marginBottom: 6 },
  totalValue: { fontSize: 28, fontWeight: '800', color: '#4ADE80' },
  form: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#334155', gap: 4 },
  formTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600', color: '#94A3B8', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#0F172A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#F8FAFC', borderWidth: 1, borderColor: '#334155' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155' },
  chipActive: { borderColor: '#22D3EE', backgroundColor: '#22D3EE22' },
  chipText: { fontSize: 12, color: '#CBD5E1', fontWeight: '500' },
  saveBtn: { backgroundColor: '#22D3EE', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  deleteBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: '#F87171' },
  empty: { alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  accountCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  accountIcon: { fontSize: 24 },
  accountName: { fontSize: 14, fontWeight: '700', color: '#F8FAFC' },
  accountMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  accountBalance: { fontSize: 15, fontWeight: '800', color: '#4ADE80' },
});
