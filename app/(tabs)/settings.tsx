import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth';
import { supabase } from '../../src/lib/supabase';

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [cedulaInput, setCedulaInput] = useState('');
  const [cedulaId, setCedulaId] = useState<string | null>(null);
  const [savingCedula, setSavingCedula] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('statement_passwords')
      .select('id, password')
      .eq('user_id', user.id)
      .eq('label', 'Cédula')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCedulaId(data.id);
          setCedulaInput(data.password);
        }
      });
  }, [user]);

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

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Importación</Text>
          <View style={styles.card}>
            <RowAction icon="📧" label="Conectar Gmail" onPress={() => router.push('/import')} />
            <RowAction icon="💬" label="Permisos SMS" onPress={() => router.push('/sms-setup')} />
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
          <Text style={styles.sectionLabel}>App</Text>
          <View style={styles.card}>
            <RowAction icon="🔔" label="Notificaciones" onPress={() => {}} />
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
  // Sign out
  signOutBtn: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F87171', marginTop: 12 },
  signOutText: { color: '#F87171', fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 24 },
});
