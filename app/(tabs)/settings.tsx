import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth';

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore();

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
  signOutBtn: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F87171', marginTop: 12 },
  signOutText: { color: '#F87171', fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 24 },
});
