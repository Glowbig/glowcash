import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/auth';
import { useBudgetStore } from '../src/stores/budget';
import { supabase } from '../src/lib/supabase';
import { BudgetConfig, BudgetModel } from '../src/types';

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
}

const MODELS: { id: BudgetModel; name: string; desc: string; needs: number; wants: number; savings: number }[] = [
  { id: '3_bolsillos', name: '3 Bolsillos Nu', desc: 'Recomendado para Colombia', needs: 58, wants: 30, savings: 12 },
  { id: '50_30_20', name: '50/30/20', desc: 'Modelo estándar internacional', needs: 50, wants: 30, savings: 20 },
  { id: 'custom', name: 'Personalizado', desc: 'Define tus propios porcentajes', needs: 50, wants: 30, savings: 20 },
];

export default function SalarySetupScreen() {
  const { user } = useAuthStore();
  const { setConfig } = useBudgetStore();
  const insets = useSafeAreaInsets();

  const [configId, setConfigId] = useState<string | null>(null);
  const [incomeInput, setIncomeInput] = useState('2825095');
  const [selectedModel, setSelectedModel] = useState<BudgetModel>('3_bolsillos');
  const [customNeeds, setCustomNeeds] = useState('50');
  const [customWants, setCustomWants] = useState('30');
  const [customSavings, setCustomSavings] = useState('20');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('budget_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setConfigId(data.id);
        setIncomeInput(String(data.income ?? 2825095));
        setSelectedModel((data.model as BudgetModel) ?? '3_bolsillos');
        setCustomNeeds(String(data.needs_pct ?? 50));
        setCustomWants(String(data.wants_pct ?? 30));
        setCustomSavings(String(data.savings_pct ?? 20));
      });
  }, [user]);

  const income = parseFloat(incomeInput.replace(/[.,\s]/g, '')) || 0;

  const activePcts = () => {
    if (selectedModel === 'custom') {
      return { needs: parseFloat(customNeeds) || 0, wants: parseFloat(customWants) || 0, savings: parseFloat(customSavings) || 0 };
    }
    const m = MODELS.find((m) => m.id === selectedModel)!;
    return { needs: m.needs, wants: m.wants, savings: m.savings };
  };

  const pcts = activePcts();
  const totalPct = pcts.needs + pcts.wants + pcts.savings;

  const handleSave = async () => {
    if (!user || income <= 0) return;
    if (selectedModel === 'custom' && Math.abs(totalPct - 100) > 0.5) {
      Alert.alert('Porcentajes inválidos', `La suma debe ser 100%. Actualmente es ${totalPct.toFixed(1)}%.`);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        income,
        model: selectedModel,
        period: 'monthly' as const,
        needs_pct: pcts.needs,
        wants_pct: pcts.wants,
        savings_pct: pcts.savings,
      };
      if (configId) {
        await supabase.from('budget_config').update(payload).eq('id', configId);
      } else {
        const { data } = await supabase.from('budget_config').insert(payload).select('id').single();
        if (data) setConfigId(data.id);
      }
      setConfig({ id: configId ?? '', ...payload } as BudgetConfig);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Salario y modelo</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Income */}
        <Text style={styles.label}>Salario neto mensual (COP)</Text>
        <TextInput
          style={styles.input}
          value={incomeInput}
          onChangeText={setIncomeInput}
          keyboardType="numeric"
          placeholder="2825095"
          placeholderTextColor="#64748B"
        />
        <Text style={styles.hint}>
          Ingresa tu salario neto (después de descuentos de salud y pensión).
        </Text>

        {/* Model selector */}
        <Text style={[styles.label, { marginTop: 24 }]}>Modelo de presupuesto</Text>
        {MODELS.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.modelCard, selectedModel === m.id && styles.modelCardActive]}
            onPress={() => setSelectedModel(m.id)}
          >
            <View style={styles.modelHeader}>
              <Text style={[styles.modelName, selectedModel === m.id && styles.modelNameActive]}>{m.name}</Text>
              {selectedModel === m.id && <Text style={styles.modelCheck}>✓</Text>}
            </View>
            <Text style={styles.modelDesc}>{m.desc}</Text>
            {m.id !== 'custom' && (
              <Text style={styles.modelPcts}>
                {m.needs}% Fijos · {m.wants}% Variables · {m.savings}% Ahorro
              </Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Custom percentage inputs */}
        {selectedModel === 'custom' && (
          <View style={styles.customCard}>
            <PctInput label="Gastos Fijos %" value={customNeeds} onChange={setCustomNeeds} />
            <PctInput label="Gastos Variables %" value={customWants} onChange={setCustomWants} />
            <PctInput label="Ahorro %" value={customSavings} onChange={setCustomSavings} />
            <Text style={[styles.hint, { textAlign: 'center', marginTop: 4 }]}>
              Total: {totalPct.toFixed(1)}% {Math.abs(totalPct - 100) <= 0.5 ? '✓' : '⚠️ debe sumar 100%'}
            </Text>
          </View>
        )}

        {/* Distribution preview */}
        {income > 0 && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Tu distribución mensual</Text>
            <PreviewRow label="Gastos Fijos" pct={pcts.needs} amount={income * pcts.needs / 100} color="#22D3EE" />
            <PreviewRow label="Gastos Variables" pct={pcts.wants} amount={income * pcts.wants / 100} color="#A78BFA" />
            <PreviewRow label="Ahorro" pct={pcts.savings} amount={income * pcts.savings / 100} color="#4ADE80" />
            <View style={styles.previewDivider} />
            <View style={styles.previewTotal}>
              <Text style={styles.previewTotalLabel}>Total neto</Text>
              <Text style={styles.previewTotalValue}>{formatCOP(income)}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || income <= 0}
        >
          {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.saveBtnText}>Guardar configuración</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PctInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.pctRow}>
      <Text style={styles.pctLabel}>{label}</Text>
      <TextInput
        style={styles.pctInput}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholderTextColor="#64748B"
      />
      <Text style={styles.pctSign}>%</Text>
    </View>
  );
}

function PreviewRow({ label, pct, amount, color }: { label: string; pct: number; amount: number; color: string }) {
  return (
    <View style={styles.previewRow}>
      <View style={[styles.previewDot, { backgroundColor: color }]} />
      <Text style={styles.previewLabel}>{label} ({pct}%)</Text>
      <Text style={[styles.previewAmount, { color }]}>{formatCOP(amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  closeBtn: { fontSize: 20, color: '#94A3B8', width: 24 },
  title: { fontSize: 17, fontWeight: '700', color: '#F8FAFC' },
  content: { padding: 24, paddingBottom: 48, backgroundColor: '#0F172A' },
  label: { fontSize: 13, fontWeight: '700', color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 18, color: '#F8FAFC', borderWidth: 1, borderColor: '#334155',
  },
  hint: { fontSize: 12, color: '#475569', marginTop: 6 },
  modelCard: {
    backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#334155',
  },
  modelCardActive: { borderColor: '#22D3EE', backgroundColor: '#0F2A35' },
  modelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modelName: { fontSize: 15, fontWeight: '700', color: '#94A3B8' },
  modelNameActive: { color: '#22D3EE' },
  modelCheck: { fontSize: 16, color: '#22D3EE' },
  modelDesc: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  modelPcts: { fontSize: 12, color: '#475569' },
  customCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155', gap: 12 },
  pctRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pctLabel: { flex: 1, fontSize: 13, color: '#94A3B8' },
  pctInput: {
    width: 70, backgroundColor: '#0F172A', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 16, color: '#F8FAFC', borderWidth: 1, borderColor: '#334155',
    textAlign: 'center',
  },
  pctSign: { fontSize: 14, color: '#64748B', width: 16 },
  previewCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 18, marginTop: 20, marginBottom: 24, borderWidth: 1, borderColor: '#334155' },
  previewTitle: { fontSize: 14, fontWeight: '700', color: '#F8FAFC', marginBottom: 14 },
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  previewDot: { width: 10, height: 10, borderRadius: 5 },
  previewLabel: { flex: 1, fontSize: 13, color: '#94A3B8' },
  previewAmount: { fontSize: 14, fontWeight: '700' },
  previewDivider: { height: 1, backgroundColor: '#334155', marginVertical: 8 },
  previewTotal: { flexDirection: 'row', justifyContent: 'space-between' },
  previewTotalLabel: { fontSize: 13, color: '#64748B' },
  previewTotalValue: { fontSize: 14, fontWeight: '700', color: '#F8FAFC' },
  saveBtn: { backgroundColor: '#22D3EE', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
});
