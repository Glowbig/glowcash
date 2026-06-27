import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { format, addDays, subDays, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/auth';
import { useTransactionsStore } from '../src/stores/transactions';
import { categorizeTransaction } from '../src/lib/categorizer';
import { supabase } from '../src/lib/supabase';
import { Category } from '../src/types';

export default function NewTransactionScreen() {
  const { user } = useAuthStore();
  const { addTransaction } = useTransactionsStore();
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(new Date());
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${user.id},is_default.eq.true`)
      .order('type')
      .then(({ data }) => setCategories((data as Category[]) ?? []));
  }, [user]);

  const handleSave = async () => {
    setError('');
    const numericAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));

    if (!numericAmount || numericAmount <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }
    if (!description.trim()) {
      setError('Describe la transacción.');
      return;
    }
    if (!user) return;

    setSaving(true);

    let finalCategoryId = categoryId;
    if (!finalCategoryId) {
      const result = await categorizeTransaction(description, merchant || undefined, user.id);
      finalCategoryId = result.categoryId;
    }

    const result = await addTransaction({
      user_id: user.id,
      amount: type === 'expense' ? -Math.abs(numericAmount) : Math.abs(numericAmount),
      description: description.trim(),
      merchant: merchant.trim() || undefined,
      category_id: finalCategoryId ?? undefined,
      date: date.toISOString(),
      source: 'manual',
      is_pending: false,
    });

    setSaving(false);

    if (!result) {
      setError('No se pudo guardar — puede que ya exista una transacción igual.');
      return;
    }

    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Nueva transacción</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Tipo */}
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'expense' && styles.typeBtnExpenseActive]}
            onPress={() => setType('expense')}
          >
            <Text style={[styles.typeBtnText, type === 'expense' && styles.typeBtnTextActive]}>Gasto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'income' && styles.typeBtnIncomeActive]}
            onPress={() => setType('income')}
          >
            <Text style={[styles.typeBtnText, type === 'income' && styles.typeBtnTextActive]}>Ingreso</Text>
          </TouchableOpacity>
        </View>

        {/* Monto */}
        <Text style={styles.label}>Monto</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currencyPrefix}>$</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor="#475569"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />
        </View>

        {/* Descripción */}
        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Mercado de la semana"
          placeholderTextColor="#64748B"
          value={description}
          onChangeText={setDescription}
        />

        {/* Comercio */}
        <Text style={styles.label}>Comercio (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: D1, Rappi, Uber..."
          placeholderTextColor="#64748B"
          value={merchant}
          onChangeText={setMerchant}
        />

        {/* Fecha */}
        <Text style={styles.label}>Fecha</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateArrow} onPress={() => setDate((d) => subDays(d, 1))}>
            <Text style={styles.dateArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>
            {isToday(date) ? 'Hoy' : format(date, "d 'de' MMMM", { locale: es })}
          </Text>
          <TouchableOpacity
            style={styles.dateArrow}
            onPress={() => setDate((d) => (isToday(d) ? d : addDays(d, 1)))}
          >
            <Text style={styles.dateArrowText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Categoría */}
        <Text style={styles.label}>Categoría (opcional — se clasifica sola si la dejas vacía)</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, categoryId === cat.id && { borderColor: cat.color, backgroundColor: cat.color + '22' }]}
              onPress={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
            >
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text style={styles.categoryName}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar transacción'}</Text>
        </TouchableOpacity>
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
  content: { padding: 20, paddingBottom: 60, gap: 4 },
  typeToggle: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 12, padding: 4, marginBottom: 20 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  typeBtnExpenseActive: { backgroundColor: '#F87171' },
  typeBtnIncomeActive: { backgroundColor: '#4ADE80' },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  typeBtnTextActive: { color: '#0F172A' },
  label: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginTop: 16, marginBottom: 8 },
  amountRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#334155',
  },
  currencyPrefix: { fontSize: 22, color: '#64748B', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '800', color: '#F8FAFC', paddingVertical: 14 },
  input: {
    backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#F8FAFC', borderWidth: 1, borderColor: '#334155',
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 8, borderWidth: 1, borderColor: '#334155',
  },
  dateArrow: { paddingHorizontal: 18, paddingVertical: 12 },
  dateArrowText: { fontSize: 20, color: '#22D3EE', fontWeight: '700' },
  dateText: { fontSize: 15, fontWeight: '600', color: '#F8FAFC', textTransform: 'capitalize' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
  },
  categoryIcon: { fontSize: 14 },
  categoryName: { fontSize: 13, color: '#CBD5E1', fontWeight: '500' },
  errorText: { fontSize: 13, color: '#F87171', textAlign: 'center', marginTop: 16 },
  saveBtn: { backgroundColor: '#22D3EE', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
});
