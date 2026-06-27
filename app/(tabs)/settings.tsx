import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth';
import { supabase } from '../../src/lib/supabase';
import { getLastSyncTimestamp } from '../../src/lib/syncState';
import {
  isNotificationListenerAvailable,
  isNotificationListenerEnabled,
} from '../../src/lib/notificationListener';
import { PayCycle } from '../../src/types';

function formatSyncAge(ts: number | null): string {
  if (!ts) return 'Nunca';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days}d`;
}

const PAY_CYCLES: { value: PayCycle; label: string; desc: string }[] = [
  { value: 'monthly', label: 'Mensual', desc: 'Un pago al mes' },
  { value: 'biweekly', label: 'Quincenal', desc: 'Días 1 y 15' },
  { value: 'bimonthly', label: 'Catorcenal', desc: 'Cada 14 días (jueves)' },
  { value: 'daily_labor', label: 'Diario', desc: 'Pago por jornal' },
];

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [cedulaInput, setCedulaInput] = useState('');
  const [cedulaId, setCedulaId] = useState<string | null>(null);
  const [savingCedula, setSavingCedula] = useState(false);

  const [payCycle, setPayCycle] = useState<PayCycle>('monthly');
  const [budgetConfigId, setBudgetConfigId] = useState<string | null>(null);
  const [lastSmsSync, setLastSmsSync] = useState<number | null>(null);
  const [lastGmailSync, setLastGmailSync] = useState<number | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('statement_passwords')
      .select('id, password')
      .eq('user_id', user.id)
      .eq('label', 'Cédula')
      .maybeSingle()
      .then(({ data }) => {
        if (data) { setCedulaId(data.id); setCedulaInput(data.password); }
      });

    supabase
      .from('budget_config')
      .select('id, pay_cycle')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) { setBudgetConfigId(data.id); setPayCycle((data.pay_cycle as PayCycle) ?? 'monthly'); }
      });

    getLastSyncTimestamp('sms').then(setLastSmsSync);
    getLastSyncTimestamp('gmail').then(setLastGmailSync);
    if (isNotificationListenerAvailable()) {
      isNotificationListenerEnabled().then(setNotifEnabled);
    }
  }, [user]);

  const handlePayCycleChange = async (cycle: PayCycle) => {
    if (!user) return;
    setPayCycle(cycle);
    if (budgetConfigId) {
      await supabase.from('budget_config').update({ pay_cycle: cycle }).eq('id', budgetConfigId);
    } else {
      const { data } = await supabase
        .from('budget_config')
        .insert({ user_id: user.id, pay_cycle: cycle, income: 2825095, model: '3_bolsillos', period: 'monthly', needs_pct: 58, wants_pct: 30, savings_pct: 12 })
        .select('id').single();
      if (data) setBudgetConfigId(data.id);
    }
  };

  const handleSaveCedula = async () => {
    if (!user || !cedulaInput.trim()) return;
    setSavingCedula(true);
    try {
      if (cedulaId) {
        await supabase
          .from('statement_passwords')
          .update({ password: cedulaInput.trim() })
          .eq('id', cedulaId);
      } else {
        const { data } = await supabase
          .from('statement_passwords')
          .insert({ user_id: user.id, label: 'Cédula', password: cedulaInput.trim() })
          .select('id')
          .single();
        if (data) setCedulaId(data.id);
      }
      Alert.alert('Guardado', 'Tu cédula se usará automáticamente como contraseña de extractos PDF.');
    } finally {
      setSavingCedula(false);
    }
  };

  const handleClearCedula = () => {
    if (!cedulaId) return;
    Alert.alert('Eliminar cédula', '¿Quitar la cédula como contraseña de PDFs?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('statement_passwords').delete().eq('id', cedulaId);
          setCedulaId(null);
          setCedulaInput('');
        },
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Configuración</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cuenta</Text>
          <View style={styles.card}>
            <Row icon="👤" label="Correo" value={user?.email ?? '—'} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Finanzas</Text>
          <View style={styles.card}>
            <RowAction icon="💰" label="Salario y modelo" onPress={() => router.push('/salary-setup')} />
            <RowAction icon="🏷️" label="Categorías" onPress={() => router.push('/categories')} />
            <RowAction icon="🏦" label="Cuentas bancarias" onPress={() => router.push('/accounts')} />
          </View>
        </View>

        {/* Pay cycle selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ciclo de pago</Text>
          <View style={styles.cycleCard}>
            {PAY_CYCLES.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[styles.cycleOption, payCycle === c.value && styles.cycleOptionActive]}
                onPress={() => handlePayCycleChange(c.value)}
              >
                <Text style={[styles.cycleLabel, payCycle === c.value && styles.cycleLabelActive]}>{c.label}</Text>
                <Text style={[styles.cycleDesc, payCycle === c.value && styles.cycleDescActive]}>{c.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Importación</Text>
          <View style={styles.card}>
            <RowAction icon="📧" label="Conectar Gmail" onPress={() => router.push('/import')} />
            <RowAction icon="💬" label="Permisos SMS" onPress={() => router.push('/sms-setup')} />
            <RowActionBadge
              icon="🔔"
              label="Notificaciones bancarias"
              badge={isNotificationListenerAvailable() ? (notifEnabled ? 'Activo' : 'Inactivo') : 'Solo Android'}
              badgeActive={notifEnabled}
              onPress={() => router.push('/notification-setup')}
            />
            <RowAction icon="📄" label="Importar extracto PDF" onPress={() => router.push('/import-pdf')} />
          </View>
        </View>

        {/* Cédula / document number → auto PDF password */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Documentos PDF</Text>
          <View style={styles.cedulaCard}>
            <Text style={styles.cedulaTitle}>Número de cédula / documento</Text>
            <Text style={styles.cedulaHint}>
              Los bancos colombianos protegen los extractos PDF con tu número de cédula.
              Guardándolo aquí se usa automáticamente al abrir cualquier extracto.
            </Text>
            <View style={styles.cedulaRow}>
              <TextInput
                style={styles.cedulaInput}
                placeholder="Ej: 1000533462"
                placeholderTextColor="#64748B"
                value={cedulaInput}
                onChangeText={setCedulaInput}
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.cedulaSaveBtn, (!cedulaInput.trim() || savingCedula) && styles.btnDisabled]}
                onPress={handleSaveCedula}
                disabled={!cedulaInput.trim() || savingCedula}
              >
                {savingCedula
                  ? <ActivityIndicator size="small" color="#0F172A" />
                  : <Text style={styles.cedulaSaveBtnText}>{cedulaId ? 'Actualizar' : 'Guardar'}</Text>}
              </TouchableOpacity>
            </View>
            {cedulaId && (
              <TouchableOpacity onPress={handleClearCedula}>
                <Text style={styles.cedulaClearBtn}>Eliminar contraseña guardada</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Última sincronización</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowIcon}>💬</Text>
              <Text style={[styles.rowLabel, { flex: 1 }]}>SMS bancarios</Text>
              <Text style={styles.rowValue}>{formatSyncAge(lastSmsSync)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowIcon}>📧</Text>
              <Text style={[styles.rowLabel, { flex: 1 }]}>Gmail</Text>
              <Text style={styles.rowValue}>{formatSyncAge(lastGmailSync)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>App</Text>
          <View style={styles.card}>
            <RowAction icon="🎨" label="Apariencia" onPress={() => {}} />
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Glowcash v1.0.0 · Por Glowbig 💸</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function RowAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <Text style={{ color: '#64748B', fontSize: 16 }}>›</Text>
    </TouchableOpacity>
  );
}

function RowActionBadge({
  icon, label, badge, badgeActive, onPress,
}: {
  icon: string; label: string; badge: string; badgeActive: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <Text style={[styles.badge, badgeActive ? styles.badgeActive : styles.badgeInactive]}>
        {badge}
      </Text>
      <Text style={{ color: '#64748B', fontSize: 16, marginLeft: 6 }}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '800', color: '#F8FAFC', marginBottom: 28 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#1E293B', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  rowIcon: { fontSize: 18, marginRight: 12 },
  rowLabel: { fontSize: 15, color: '#F8FAFC', flex: 1 },
  rowValue: { fontSize: 13, color: '#64748B', maxWidth: 180 },
  // Pay cycle
  cycleCard: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cycleOption: { flex: 1, minWidth: '45%', backgroundColor: '#1E293B', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#334155' },
  cycleOptionActive: { borderColor: '#22D3EE', backgroundColor: '#0F2A35' },
  cycleLabel: { fontSize: 14, fontWeight: '700', color: '#94A3B8', marginBottom: 2 },
  cycleLabelActive: { color: '#22D3EE' },
  cycleDesc: { fontSize: 11, color: '#475569' },
  cycleDescActive: { color: '#94A3B8' },
  // Cédula card
  cedulaCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#334155', gap: 10 },
  cedulaTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
  cedulaHint: { fontSize: 12, color: '#64748B', lineHeight: 18 },
  cedulaRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  cedulaInput: {
    flex: 1, backgroundColor: '#0F172A', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#F8FAFC',
    borderWidth: 1, borderColor: '#334155',
  },
  cedulaSaveBtn: { backgroundColor: '#22D3EE', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  btnDisabled: { opacity: 0.4 },
  cedulaSaveBtnText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  cedulaClearBtn: { fontSize: 12, color: '#F87171', textAlign: 'right' },
  // Badge
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeActive: { backgroundColor: '#14532D', color: '#4ADE80' },
  badgeInactive: { backgroundColor: '#1E293B', color: '#64748B' },
  // Sign out
  signOutBtn: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F87171', marginTop: 12 },
  signOutText: { color: '#F87171', fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 24 },
});
