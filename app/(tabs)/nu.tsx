import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBudgetStore } from '../../src/stores/budget';

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

const STATUS_COLORS = { green: '#4ADE80', yellow: '#FBBF24', red: '#F87171' };
const STATUS_ICONS = { green: '✅', yellow: '⚠️', red: '🚨' };

export default function NuScreen() {
  const { computeNuRecommendation, nuRecommendation } = useBudgetStore();
  const insets = useSafeAreaInsets();

  const [cycleSpend, setCycleSpend] = useState('');
  const [savedSoFar, setSavedSoFar] = useState('');
  const [computed, setComputed] = useState(false);

  const handleCompute = () => {
    const spend = parseFloat(cycleSpend.replace(/[.,]/g, '')) || 0;
    const saved = parseFloat(savedSoFar.replace(/[.,]/g, '')) || 0;
    computeNuRecommendation(spend, saved);
    setComputed(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Text style={styles.nuLogo}>💜</Text>
        <Text style={styles.title}>Mi Nu</Text>
        <Text style={styles.subtitle}>Recomendación de pago y ahorro</Text>
      </View>

      {/* Input section */}
      <View style={styles.inputCard}>
        <Text style={styles.inputLabel}>¿Cuánto llevas gastado en tu tarjeta Nu este mes? (COP)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 350000"
          placeholderTextColor="#64748B"
          value={cycleSpend}
          onChangeText={setCycleSpend}
          keyboardType="numeric"
        />

        <Text style={styles.inputLabel}>¿Cuánto llevas ahorrado en total en Nu? (COP)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 1200000"
          placeholderTextColor="#64748B"
          value={savedSoFar}
          onChangeText={setSavedSoFar}
          keyboardType="numeric"
        />

        <TouchableOpacity style={styles.calcButton} onPress={handleCompute}>
          <Text style={styles.calcButtonText}>Calcular recomendación</Text>
        </TouchableOpacity>
      </View>

      {/* Recommendation */}
      {computed && nuRecommendation && (
        <>
          <View style={[styles.recoCard, { borderColor: STATUS_COLORS[nuRecommendation.status] }]}>
            <Text style={styles.recoIcon}>{STATUS_ICONS[nuRecommendation.status]}</Text>
            <Text style={[styles.recoStatus, { color: STATUS_COLORS[nuRecommendation.status] }]}>
              {nuRecommendation.status === 'green' ? 'Todo bien' : nuRecommendation.status === 'yellow' ? 'Atención' : 'Alerta'}
            </Text>
            <Text style={styles.recoMessage}>{nuRecommendation.message}</Text>
          </View>

          <View style={styles.detailCard}>
            <DetailRow label="Gasto del ciclo" value={formatCOP(nuRecommendation.cycleSpend)} />
            <DetailRow label="Disponible para pagar" value={formatCOP(nuRecommendation.availableForPayment)} />
            <View style={styles.divider} />
            <DetailRow
              label="Pago recomendado"
              value={formatCOP(nuRecommendation.paymentAmount)}
              highlight={STATUS_COLORS[nuRecommendation.status]}
            />
            <DetailRow
              label="Transferir a tu Fiducuenta"
              value={formatCOP(nuRecommendation.savingsTransfer)}
              highlight="#4ADE80"
            />
          </View>

          {/* Emergency fund progress */}
          <View style={styles.emergencyCard}>
            <Text style={styles.emergencyTitle}>Fondo de emergencia</Text>
            <View style={styles.emergencyRow}>
              <Text style={styles.emergencyLabel}>Progreso</Text>
              <Text style={styles.emergencyPct}>{nuRecommendation.emergencyFundProgress.toFixed(1)}%</Text>
            </View>
            <View style={styles.emergencyTrack}>
              <View style={[styles.emergencyFill, { width: `${nuRecommendation.emergencyFundProgress}%` as any }]} />
            </View>
            <Text style={styles.emergencyTarget}>
              Meta: {formatCOP(nuRecommendation.emergencyFundTarget)} (3 meses de gastos)
            </Text>
            {nuRecommendation.emergencyFundProgress < 100 && (
              <Text style={styles.emergencyETA}>
                Ahorrando {formatCOP(nuRecommendation.savingsTransfer)}/mes → meta en ~{
                  Math.ceil((nuRecommendation.emergencyFundTarget * (1 - nuRecommendation.emergencyFundProgress / 100)) / nuRecommendation.savingsTransfer)
                } meses
              </Text>
            )}
          </View>

          {/* Tips */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>💡 Consejos Nu</Text>
            <Text style={styles.tip}>• Paga SIEMPRE el total de la tarjeta — nunca solo el mínimo.</Text>
            <Text style={styles.tip}>• Tu Fiducuenta Nu da rentabilidad diaria — mejor que tener el dinero quieto.</Text>
            <Text style={styles.tip}>• Activa el débito automático del total para no olvidar el pago.</Text>
            <Text style={styles.tip}>• Compra en 1 cuota siempre que puedas — sin intereses.</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight ? { color: highlight, fontWeight: '700' } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 28 },
  nuLogo: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: '#F8FAFC' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  inputCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#334155', gap: 12 },
  inputLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  input: { backgroundColor: '#0F172A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, color: '#F8FAFC', borderWidth: 1, borderColor: '#334155' },
  calcButton: { backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  calcButtonText: { fontSize: 16, fontWeight: '700', color: '#F8FAFC' },
  recoCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 14, borderWidth: 2, alignItems: 'center' },
  recoIcon: { fontSize: 40, marginBottom: 8 },
  recoStatus: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  recoMessage: { fontSize: 14, color: '#CBD5E1', textAlign: 'center', lineHeight: 20 },
  detailCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  detailLabel: { fontSize: 14, color: '#94A3B8' },
  detailValue: { fontSize: 14, color: '#F8FAFC', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 4 },
  emergencyCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  emergencyTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginBottom: 12 },
  emergencyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  emergencyLabel: { fontSize: 13, color: '#94A3B8' },
  emergencyPct: { fontSize: 13, color: '#4ADE80', fontWeight: '700' },
  emergencyTrack: { height: 10, backgroundColor: '#0F172A', borderRadius: 5, overflow: 'hidden', marginBottom: 10 },
  emergencyFill: { height: 10, backgroundColor: '#4ADE80', borderRadius: 5 },
  emergencyTarget: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  emergencyETA: { fontSize: 12, color: '#94A3B8' },
  tipsCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#334155', gap: 8 },
  tipsTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginBottom: 4 },
  tip: { fontSize: 13, color: '#94A3B8', lineHeight: 20 },
});
