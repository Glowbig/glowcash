import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subMonths } from 'date-fns';
import { useBudgetStore } from '../../src/stores/budget';
import { useAuthStore } from '../../src/stores/auth';
import { supabase } from '../../src/lib/supabase';
import { Transaction, BudgetConfig, PayCycle } from '../../src/types';

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

const CANDIDATE_MODELS = [
  { id: '3_bolsillos', name: '3 Bolsillos Nu', needs: 58, wants: 30, savings: 12 },
  { id: '50_30_20', name: '50/30/20', needs: 50, wants: 30, savings: 20 },
];

const CYCLE_LABELS: Record<PayCycle, string> = {
  monthly: 'mensual',
  biweekly: 'por quincena',
  bimonthly: 'cada 14 días',
  daily_labor: 'diario',
};

// How many cycles per month (approximate)
const CYCLES_PER_MONTH: Record<PayCycle, number> = {
  monthly: 1,
  biweekly: 2,
  bimonthly: 26 / 12,  // ~2.17 cycles/month
  daily_labor: 30,
};

export default function BudgetScreen() {
  const { config: storeConfig, setConfig } = useBudgetStore();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [actual, setActual] = useState<{ needs: number; wants: number; savings: number } | null>(null);
  const [config, setLocalConfig] = useState<BudgetConfig | null>(storeConfig);

  // Load budget_config from Supabase if not in store
  useEffect(() => {
    if (!user) return;
    supabase
      .from('budget_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLocalConfig(data as BudgetConfig);
          setConfig(data as BudgetConfig);
        }
      });
  }, [user]);

  useEffect(() => {
    if (storeConfig) setLocalConfig(storeConfig);
  }, [storeConfig]);

  const income = config?.income ?? 2_825_095;
  const savingsPct = config?.savings_pct ?? 12;
  const fixedPct = config?.needs_pct ?? 58;
  const wantsPct = config?.wants_pct ?? 30;
  const payCycle: PayCycle = (config?.pay_cycle as PayCycle) ?? 'monthly';

  const savings = income * (savingsPct / 100);
  const fixed = income * (fixedPct / 100);
  const wants = income * (wantsPct / 100);

  const cyclesPerMonth = CYCLES_PER_MONTH[payCycle];
  const cycleIncome = income / cyclesPerMonth;
  const cycleSavings = savings / cyclesPerMonth;
  const cycleFixed = fixed / cyclesPerMonth;
  const cycleWants = wants / cyclesPerMonth;

  const showCycleBreakdown = payCycle !== 'monthly';

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = subMonths(new Date(), 3).toISOString();
      const { data } = await supabase
        .from('transactions')
        .select('*, category:categories(*)')
        .eq('user_id', user.id)
        .lt('amount', 0)
        .gte('date', since);

      const txs = (data as Transaction[]) ?? [];
      const totals = { need: 0, want: 0, saving: 0 };
      for (const t of txs) {
        if (!t.category) continue;
        totals[t.category.type] += Math.abs(t.amount);
      }
      const total = totals.need + totals.want + totals.saving;
      if (total === 0) { setActual(null); return; }
      setActual({
        needs: (totals.need / total) * 100,
        wants: (totals.want / total) * 100,
        savings: (totals.saving / total) * 100,
      });
    })();
  }, [user]);

  const bestModel = actual
    ? CANDIDATE_MODELS.reduce((best, m) => {
        const dist = Math.abs(m.needs - actual.needs) + Math.abs(m.wants - actual.wants) + Math.abs(m.savings - actual.savings);
        const bestDist = Math.abs(best.needs - actual.needs) + Math.abs(best.wants - actual.wants) + Math.abs(best.savings - actual.savings);
        return dist < bestDist ? m : best;
      }, CANDIDATE_MODELS[0])
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>Presupuesto</Text>
      <Text style={styles.subtitle}>{config?.model === '50_30_20' ? '50/30/20' : '3 Bolsillos Nu'} · {CYCLE_LABELS[payCycle]}</Text>

      {/* Income card */}
      <View style={styles.incomeCard}>
        <View style={styles.incomeRow}>
          <Text style={styles.incomeLabel}>Salario neto</Text>
          <Text style={styles.incomeValue}>{formatCOP(income)}</Text>
        </View>
        {showCycleBreakdown && (
          <View style={[styles.incomeRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#334155' }]}>
            <Text style={styles.incomeCycleLabel}>Cada pago ({CYCLE_LABELS[payCycle]})</Text>
            <Text style={styles.incomeCycleValue}>{formatCOP(cycleIncome)}</Text>
          </View>
        )}
      </View>

      {/* Análisis de modelo ideal */}
      {actual && bestModel && (
        <View style={styles.analysisCard}>
          <Text style={styles.analysisTitle}>📊 Tu modelo ideal (últimos 3 meses)</Text>
          <Text style={styles.analysisSubtitle}>Según cómo gastas de verdad, no el modelo configurado</Text>

          <View style={styles.analysisRow}>
            <Text style={styles.analysisLabel}>Fijos</Text>
            <Text style={styles.analysisValue}>{actual.needs.toFixed(0)}%</Text>
          </View>
          <View style={styles.analysisRow}>
            <Text style={styles.analysisLabel}>Variables</Text>
            <Text style={styles.analysisValue}>{actual.wants.toFixed(0)}%</Text>
          </View>
          <View style={styles.analysisRow}>
            <Text style={styles.analysisLabel}>Ahorro</Text>
            <Text style={styles.analysisValue}>{actual.savings.toFixed(0)}%</Text>
          </View>

          <View style={styles.analysisRecommendation}>
            <Text style={styles.analysisRecoText}>
              El modelo que más se parece a tu gasto real es{' '}
              <Text style={{ fontWeight: '800', color: '#22D3EE' }}>{bestModel.name}</Text>
              {' '}({bestModel.needs}/{bestModel.wants}/{bestModel.savings}).
              {bestModel.id !== (config?.model ?? '3_bolsillos')
                ? ' Puede que te convenga cambiar el modelo en Configuración.'
                : ' Coincide con el que ya tienes configurado.'}
            </Text>
          </View>
        </View>
      )}

      {/* 3 bolsillos */}
      <Text style={styles.sectionTitle}>Distribución</Text>

      <BolsilloCard
        icon="💚"
        title="Bolsillo Ahorro"
        subtitle="Primero tú — transferir a tu Fiducuenta Nu el día de pago"
        pct={savingsPct}
        amount={savings}
        cycleAmount={showCycleBreakdown ? cycleSavings : undefined}
        cycleLabel={CYCLE_LABELS[payCycle]}
        color="#4ADE80"
        tips={[
          'Transfiere el mismo día que recibes el sueldo',
          'No lo toques — es para emergencias e inversión',
          `Meta fondo emergencia: ${formatCOP(income * 3)}`,
        ]}
      />

      <BolsilloCard
        icon="🏠"
        title="Gastos Fijos"
        subtitle="Obligaciones del mes"
        pct={fixedPct}
        amount={fixed}
        cycleAmount={showCycleBreakdown ? cycleFixed : undefined}
        cycleLabel={CYCLE_LABELS[payCycle]}
        color="#22D3EE"
        tips={[
          'Arriendo / cuota vivienda',
          'Servicios: luz, agua, gas, internet, celular',
          'Suscripciones, seguros',
        ]}
      />

      <BolsilloCard
        icon="🎉"
        title="Gastos Variables"
        subtitle="Comida, transporte, entretenimiento, tarjeta Nu"
        pct={wantsPct}
        amount={wants}
        cycleAmount={showCycleBreakdown ? cycleWants : undefined}
        cycleLabel={CYCLE_LABELS[payCycle]}
        color="#A78BFA"
        tips={[
          'Mercado y restaurantes',
          'Transporte (Uber, combustible)',
          'Pago de tarjeta Nu al corte',
          'Ropa, ocio, compras personales',
        ]}
      />

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>💡 Regla de oro</Text>
        <Text style={styles.tipText}>
          Paga el total de tu tarjeta Nu cada mes. Un solo mes con intereses puede costar más de {formatCOP(30_000)} adicionales.
          La pantalla "Mi Nu" te dice exactamente cuánto pagar.
        </Text>
      </View>
    </ScrollView>
  );
}

function BolsilloCard({ icon, title, subtitle, pct, amount, cycleAmount, cycleLabel, color, tips }: {
  icon: string; title: string; subtitle: string; pct: number;
  amount: number; cycleAmount?: number; cycleLabel: string; color: string; tips: string[];
}) {
  return (
    <View style={[styles.bolsilloCard, { borderLeftColor: color }]}>
      <View style={styles.bolsilloHeader}>
        <Text style={styles.bolsilloIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.bolsilloTitle}>{title}</Text>
          <Text style={styles.bolsilloSubtitle}>{subtitle}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.bolsilloAmount, { color }]}>{formatCOP(amount)}</Text>
          <Text style={styles.bolsilloPct}>{pct}% mensual</Text>
          {cycleAmount !== undefined && (
            <Text style={[styles.bolsilloCycle, { color }]}>{formatCOP(cycleAmount)} {cycleLabel}</Text>
          )}
        </View>
      </View>
      <View style={styles.bolsilloTips}>
        {tips.map((tip, i) => (
          <Text key={i} style={styles.bolsilloTip}>• {tip}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#F8FAFC', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 12, marginTop: 8 },
  incomeCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  incomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  incomeLabel: { fontSize: 14, color: '#64748B' },
  incomeValue: { fontSize: 22, fontWeight: '800', color: '#22D3EE' },
  incomeCycleLabel: { fontSize: 13, color: '#475569' },
  incomeCycleValue: { fontSize: 16, fontWeight: '700', color: '#94A3B8' },
  bolsilloCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, marginBottom: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: '#334155' },
  bolsilloHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  bolsilloIcon: { fontSize: 28 },
  bolsilloTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
  bolsilloSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  bolsilloAmount: { fontSize: 18, fontWeight: '800' },
  bolsilloPct: { fontSize: 11, color: '#64748B', marginTop: 2 },
  bolsilloCycle: { fontSize: 12, fontWeight: '700', marginTop: 4, opacity: 0.9 },
  bolsilloTips: { gap: 4 },
  bolsilloTip: { fontSize: 13, color: '#94A3B8' },
  tipCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#334155', marginTop: 8 },
  tipTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginBottom: 8 },
  tipText: { fontSize: 13, color: '#94A3B8', lineHeight: 20 },
  analysisCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#334155', marginBottom: 20 },
  analysisTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginBottom: 2 },
  analysisSubtitle: { fontSize: 12, color: '#64748B', marginBottom: 14 },
  analysisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#334155' },
  analysisLabel: { fontSize: 13, color: '#94A3B8' },
  analysisValue: { fontSize: 13, fontWeight: '700', color: '#F8FAFC' },
  analysisRecommendation: { marginTop: 12, backgroundColor: '#0F172A', borderRadius: 10, padding: 12 },
  analysisRecoText: { fontSize: 13, color: '#CBD5E1', lineHeight: 19 },
});
