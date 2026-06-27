import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform, PermissionsAndroid,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/auth';
import { useTransactionsStore } from '../src/stores/transactions';
import { importBankSms, isSmsReadingAvailable } from '../src/lib/sms';

type PermissionStatus = 'unknown' | 'granted' | 'denied';

export default function SmsSetupScreen() {
  const { user } = useAuthStore();
  const { addTransaction } = useTransactionsStore();
  const insets = useSafeAreaInsets();

  const [permission, setPermission] = useState<PermissionStatus>('unknown');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; duplicates: number; unparsed: number } | null>(null);
  const [error, setError] = useState('');

  const isAndroid = Platform.OS === 'android';
  const moduleAvailable = isSmsReadingAvailable();

  useEffect(() => {
    if (!isAndroid) return;
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS).then((granted) =>
      setPermission(granted ? 'granted' : 'unknown')
    );
  }, []);

  const requestPermission = async () => {
    setError('');
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
      title: 'Permiso de lectura de SMS',
      message: 'Glowcash necesita leer tus SMS para detectar automáticamente transacciones de Bancolombia, Nequi y Nu.',
      buttonPositive: 'Permitir',
      buttonNegative: 'Cancelar',
    });
    setPermission(result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
  };

  const handleImport = async () => {
    if (!user) return;
    setImporting(true);
    setError('');
    setResult(null);

    try {
      const { parsed, unparsed } = await importBankSms();

      let imported = 0;
      let duplicates = 0;

      for (const tx of parsed) {
        const saved = await addTransaction({
          user_id: user.id,
          amount: tx.amount,
          description: tx.description,
          merchant: tx.merchant,
          date: tx.date,
          source: tx.source,
          raw_text: tx.raw_text,
          is_pending: false,
        });
        if (saved) imported++;
        else duplicates++;
      }

      setResult({ imported, duplicates, unparsed });
    } catch (e: any) {
      setError(e.message ?? 'Error al leer los SMS.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lectura de SMS</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.icon}>💬</Text>
        <Text style={styles.heading}>Detecta gastos por SMS</Text>
        <Text style={styles.subtext}>
          Cuando Bancolombia, Nequi o Nu te envíen un SMS de una transacción, Glowcash lo puede leer y registrar automáticamente.
        </Text>

        {!isAndroid && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              La lectura de SMS solo funciona en Android. Estás usando {Platform.OS}.
            </Text>
          </View>
        )}

        {isAndroid && !moduleAvailable && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Esta función necesita un build de desarrollo de Android (EAS Build) — no funciona dentro de Expo Go.
              Una vez generes el APK, vuelve a esta pantalla.
            </Text>
          </View>
        )}

        {isAndroid && (
          <>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Permiso de SMS</Text>
              <Text style={[styles.statusValue, permission === 'granted' && { color: '#4ADE80' }, permission === 'denied' && { color: '#F87171' }]}>
                {permission === 'granted' ? 'Concedido ✓' : permission === 'denied' ? 'Denegado' : 'No solicitado'}
              </Text>
            </View>

            {permission !== 'granted' ? (
              <TouchableOpacity style={styles.actionBtn} onPress={requestPermission}>
                <Text style={styles.actionBtnText}>Activar permiso</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, (importing || !moduleAvailable) && styles.actionBtnDisabled]}
                onPress={handleImport}
                disabled={importing || !moduleAvailable}
              >
                {importing ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.actionBtnText}>Buscar transacciones en mis SMS</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {result && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Búsqueda completa</Text>
            <ResultRow label="Nuevas transacciones" value={result.imported} color="#4ADE80" />
            <ResultRow label="Duplicados (ya existían)" value={result.duplicates} color="#94A3B8" />
            <ResultRow label="No se pudieron leer" value={result.unparsed} color="#FBBF24" />
            <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.doneBtnText}>Ver mis transacciones</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ResultRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, { color }]}>{value}</Text>
    </View>
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
  content: { padding: 24, alignItems: 'center' },
  icon: { fontSize: 56, marginTop: 20, marginBottom: 16 },
  heading: { fontSize: 22, fontWeight: '800', color: '#F8FAFC', marginBottom: 8 },
  subtext: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  warningBox: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#FBBF24', marginBottom: 20, width: '100%' },
  warningText: { color: '#FBBF24', fontSize: 13, lineHeight: 18 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  statusLabel: { fontSize: 14, color: '#CBD5E1' },
  statusValue: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  actionBtn: { backgroundColor: '#22D3EE', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  errorText: { fontSize: 13, color: '#F87171', textAlign: 'center', marginTop: 16 },
  resultBox: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, width: '100%', marginTop: 24, borderWidth: 1, borderColor: '#334155' },
  resultTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 16, textAlign: 'center' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  resultLabel: { fontSize: 14, color: '#CBD5E1' },
  resultValue: { fontSize: 14, fontWeight: '700' },
  doneBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  doneBtnText: { color: '#22D3EE', fontWeight: '700', fontSize: 14 },
});
