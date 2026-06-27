import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  isNotificationListenerAvailable,
  isNotificationListenerEnabled,
  openNotificationListenerSettings,
  addNotificationListener,
  BankNotification,
} from '../src/lib/notificationListener';

const MONITORED_APPS = [
  { icon: '🟣', name: 'Nu Colombia', pkg: 'com.nu.production' },
  { icon: '💚', name: 'Nequi', pkg: 'com.nequi.mobile' },
  { icon: '🔵', name: 'Bancolombia App', pkg: 'com.bancolombia.bancolombia' },
];

export default function NotificationSetupScreen() {
  const insets = useSafeAreaInsets();
  const available = isNotificationListenerAvailable();

  const [enabled, setEnabled] = useState(false);
  const [recent, setRecent] = useState<BankNotification[]>([]);

  const refresh = async () => {
    if (!available) return;
    setEnabled(await isNotificationListenerEnabled());
  };

  useEffect(() => {
    refresh();
    // Poll permission state every 2s (user may have enabled in Settings)
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!available) return;
    const unsub = addNotificationListener((n) => {
      setRecent((prev) => [n, ...prev].slice(0, 5));
    });
    return unsub;
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notificaciones bancarias</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.icon}>🔔</Text>
        <Text style={styles.heading}>Detección en tiempo real</Text>
        <Text style={styles.subtext}>
          Cuando Nu, Nequi o Bancolombia te manden una notificación de compra o transferencia,
          Glowcash la registra automáticamente — sin que tengas que abrir la app.
        </Text>

        {!available && Platform.OS === 'android' && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Esta función necesita un build de desarrollo de Android (EAS Build).
              No funciona dentro de Expo Go.
            </Text>
          </View>
        )}

        {!available && Platform.OS !== 'android' && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              La lectura de notificaciones solo funciona en Android.
            </Text>
          </View>
        )}

        {/* Permission status */}
        {available && (
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: enabled ? '#4ADE80' : '#F87171' }]} />
              <Text style={styles.statusLabel}>
                {enabled ? 'Acceso a notificaciones: Activo' : 'Acceso a notificaciones: Inactivo'}
              </Text>
            </View>
            {!enabled && (
              <>
                <Text style={styles.statusHint}>
                  Glowcash necesita permiso para leer notificaciones de otras apps.
                  Toca "Activar" y habilita Glowcash en la lista.
                </Text>
                <TouchableOpacity style={styles.activateBtn} onPress={openNotificationListenerSettings}>
                  <Text style={styles.activateBtnText}>Activar acceso</Text>
                </TouchableOpacity>
              </>
            )}
            {enabled && (
              <Text style={[styles.statusHint, { color: '#4ADE80' }]}>
                Glowcash está monitoreando tus notificaciones bancarias. Las transacciones
                se guardan automáticamente en segundo plano.
              </Text>
            )}
          </View>
        )}

        {/* Apps monitored */}
        <Text style={styles.sectionTitle}>Apps monitoreadas</Text>
        <View style={styles.appsCard}>
          {MONITORED_APPS.map((app) => (
            <View key={app.pkg} style={styles.appRow}>
              <Text style={styles.appIcon}>{app.icon}</Text>
              <Text style={styles.appName}>{app.name}</Text>
              {enabled && <Text style={styles.appActive}>● Activo</Text>}
            </View>
          ))}
        </View>

        {/* Privacy note */}
        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>🔒 Privacidad</Text>
          <Text style={styles.privacyText}>
            Glowcash solo lee notificaciones de las apps bancarias listadas arriba.
            El texto de las notificaciones se procesa localmente en tu dispositivo y
            se guarda en tu cuenta de Supabase personal. Nunca se comparte con terceros.
          </Text>
        </View>

        {/* Recent intercepted */}
        {recent.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Últimas interceptadas (esta sesión)</Text>
            <View style={styles.recentCard}>
              {recent.map((n, i) => (
                <View key={i} style={[styles.recentRow, i < recent.length - 1 && styles.recentBorder]}>
                  <Text style={styles.recentTitle}>{n.title}</Text>
                  <Text style={styles.recentText} numberOfLines={2}>{n.text}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  closeBtn: { fontSize: 20, color: '#94A3B8', width: 24 },
  title: { fontSize: 17, fontWeight: '700', color: '#F8FAFC' },
  content: { padding: 24, alignItems: 'center', paddingBottom: 48 },
  icon: { fontSize: 56, marginTop: 20, marginBottom: 16 },
  heading: { fontSize: 22, fontWeight: '800', color: '#F8FAFC', marginBottom: 8 },
  subtext: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  warningBox: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 16, borderWidth: 1,
    borderColor: '#FBBF24', marginBottom: 20, width: '100%',
  },
  warningText: { color: '#FBBF24', fontSize: 13, lineHeight: 18 },
  statusCard: {
    backgroundColor: '#1E293B', borderRadius: 16, padding: 18, borderWidth: 1,
    borderColor: '#334155', width: '100%', marginBottom: 24, gap: 12,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
  statusHint: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  activateBtn: {
    backgroundColor: '#22D3EE', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
  },
  activateBtnText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 8, alignSelf: 'flex-start',
  },
  appsCard: {
    backgroundColor: '#1E293B', borderRadius: 16, width: '100%', borderWidth: 1,
    borderColor: '#334155', marginBottom: 16, overflow: 'hidden',
  },
  appRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#334155', gap: 12,
  },
  appIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  appName: { flex: 1, fontSize: 14, color: '#CBD5E1', fontWeight: '600' },
  appActive: { fontSize: 11, color: '#4ADE80', fontWeight: '700' },
  privacyCard: {
    backgroundColor: '#1E293B', borderRadius: 16, padding: 18, width: '100%',
    borderWidth: 1, borderColor: '#334155', marginBottom: 20, gap: 8,
  },
  privacyTitle: { fontSize: 14, fontWeight: '700', color: '#F8FAFC' },
  privacyText: { fontSize: 12, color: '#64748B', lineHeight: 18 },
  recentCard: {
    backgroundColor: '#1E293B', borderRadius: 16, width: '100%', borderWidth: 1,
    borderColor: '#334155', overflow: 'hidden',
  },
  recentRow: { padding: 14, gap: 4 },
  recentBorder: { borderBottomWidth: 1, borderBottomColor: '#334155' },
  recentTitle: { fontSize: 13, fontWeight: '700', color: '#F8FAFC' },
  recentText: { fontSize: 12, color: '#64748B', lineHeight: 16 },
});
