import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useBudgetStore } from '../../src/stores/budget';

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

const INCOME_GROSS = 2_800_000;
const INCOME_NET = 2_825_095;

export default function BudgetScreen() {
  const { config } = useBudgetStore();

  const income = config?.income ?? INCOME_NET;
  const savingsPct = config?.savings_pct ?? 12;
  const fixedPct = config?.needs_pct ?? 58;
  const wantsPct = config?.wants_pct ?? 30;

  const savings = income * (savingsPct / 100);
  const fixed = income * (fixedPct / 100);
  const wants = income * (wantsPct / 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Presupuesto mensual</Text>
      <Text style={styles.subtitle}>Modelo 3 Bolsillos Nu</Text>

      {/* Salary breakdown */}
      <View style={styles.salaryCard}>
        <Text style={styles.salaryLabel}>Salario bruto</Text>
        <Text style={styles.salaryGross}>{formatCOP(INCOME_GROSS)}</Text>
        <View style={styles.deductionRow}>
          <Text style={styles.deductionLabel}>Salud (4%)</Text>
          <Text style={styles.deductionValue}>- {formatCOP(112_000)}</Text>
        </View>
        <View style={styles.deductionRow}>
          <Text style={styles.deductionLabel}>Pensión (4%)</Text>
          <Text style={styles.deductionValue}>- {formatCOP(112_000)}</Text>
        </View>
        <View style={styles.deductionRow}>
          <Text style={styles.deductionLabel}>Subsidio transporte</Text>
          <Text style={[styles.deductionValue, { color: '#4ADE80' }]}>+ {formatCOP(249_095)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.deductionRow}>
          <Text style={[styles.deductionLabel, { color: '#F8FAFC', fontWeight: '700' }]}>Salario neto</Text>
          <Text style={[styles.deductionValue, { color: '#22D3EE', fontWeight: '700', fontSize: 18 }]}>{formatCOP(INCOME_NET)}</Text>
        </View>
      </View>

      {/* 3 bolsillos */}
      <Text style={styles.sectionTitle}>Distribución mensual</Text>

      <BolsilloCard
        icon="💚"
        title="Bolsillo Ahorro"
        subtitle="Primero tú — transferir a Nu el día de pago"
        pct={savingsPct}
        amount={savings}
        color="#4ADE80"
        tips={[
          'Transfiere el mismo día que recibes el sueldo',
          'No lo toques — es para emergencias e inversión',
          `Meta fondo emergencia: ${formatCOP(8_475_285)}`,
        ]}
      />

      <BolsilloCard
        icon="🏠"
        title="Gastos Fijos"
        subtitle="Obligaciones del mes"
        pct={fixedPct}
        amount={fixed}
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

function BolsilloCard({ icon, title, subtitle, pct, amount, color, tips }: {
  icon: string; title: string; subtitle: string; pct: number;
  amount: number; color: string; tips: string[];
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
          <Text style={[styles.bolsilloAmount, { color }]}>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount)}</Text>
          <Text style={styles.bolsilloPct}>{pct}%</Text>
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
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 12, marginTop: 8 },
  salaryCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#334155' },
  salaryLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  salaryGross: { fontSize: 24, fontWeight: '700', color: '#94A3B8', marginBottom: 12 },
  deductionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  deductionLabel: { fontSize: 14, color: '#64748B' },
  deductionValue: { fontSize: 14, color: '#F87171', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 10 },
  bolsilloCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, marginBottom: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: '#334155' },
  bolsilloHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  bolsilloIcon: { fontSize: 28 },
  bolsilloTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
  bolsilloSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  bolsilloAmount: { fontSize: 18, fontWeight: '800' },
  bolsilloPct: { fontSize: 12, color: '#64748B', marginTop: 2 },
  bolsilloTips: { gap: 4 },
  bolsilloTip: { fontSize: 13, color: '#94A3B8' },
  tipCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#334155', marginTop: 8 },
  tipTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginBottom: 8 },
  tipText: { fontSize: 13, color: '#94A3B8', lineHeight: 20 },
});
