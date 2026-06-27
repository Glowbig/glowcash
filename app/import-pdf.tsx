import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/auth';
import { useTransactionsStore } from '../src/stores/transactions';
import { supabase } from '../src/lib/supabase';

interface StatementPassword {
  id: string;
  label: string;
  password: string;
}

interface GeminiTransaction {
  date: string;
  description: string;
  merchant?: string | null;
  amount: number;
}

export default function ImportPdfScreen() {
  const { user } = useAuthStore();
  const { addTransaction } = useTransactionsStore();
  const insets = useSafeAreaInsets();

  const [passwords, setPasswords] = useState<StatementPassword[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ imported: number; duplicates: number; usedPassword: string | null } | null>(null);

  const fetchPasswords = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('statement_passwords')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at');
    setPasswords((data as StatementPassword[]) ?? []);
  };

  useEffect(() => {
    fetchPasswords();
  }, [user]);

  const handleAddPassword = async () => {
    if (!user || !newLabel.trim() || !newPassword.trim()) return;
    await supabase.from('statement_passwords').insert({
      user_id: user.id,
      label: newLabel.trim(),
      password: newPassword.trim(),
    });
    setNewLabel('');
    setNewPassword('');
    setShowPasswordForm(false);
    fetchPasswords();
  };

  const handleDeletePassword = async (id: string) => {
    await supabase.from('statement_passwords').delete().eq('id', id);
    fetchPasswords();
  };

  const handlePickFile = async () => {
    setError('');
    setResult(null);
    // Allow any file — Android assigns wrong MIME types to some bank PDFs.
    // We validate the .pdf extension client-side and let the Edge Function confirm.
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/octet-stream', '*/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;

    const asset = res.assets[0];
    if (!asset.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor selecciona un archivo PDF (.pdf).');
      return;
    }
    setFileName(asset.name);
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    setPdfBase64(base64);
  };

  const handleProcess = async () => {
    if (!pdfBase64 || !user) return;
    setProcessing(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-pdf-statement', {
        body: { pdfBase64, passwords: passwords.map((p) => p.password) },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      const transactions: GeminiTransaction[] = data.transactions ?? [];
      let imported = 0;
      let duplicates = 0;

      for (const tx of transactions) {
        const saved = await addTransaction({
          user_id: user.id,
          amount: tx.amount,
          description: tx.description,
          merchant: tx.merchant ?? undefined,
          date: new Date(tx.date).toISOString(),
          source: 'pdf',
          raw_text: JSON.stringify(tx),
          is_pending: false,
        });
        if (saved) imported++;
        else duplicates++;
      }

      setResult({ imported, duplicates, usedPassword: data.usedPassword });
      setFileName(null);
      setPdfBase64(null);
    } catch (e: any) {
      setError(e.message ?? 'Error al procesar el PDF.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Importar extracto PDF</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.icon}>📄</Text>
        <Text style={styles.heading}>Extracto bancario PDF</Text>
        <Text style={styles.subtext}>
          Sube el PDF de tu extracto mensual. Si está protegido con contraseña, probamos las que tengas guardadas.
        </Text>

        {/* Passwords section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Contraseñas guardadas</Text>
            <TouchableOpacity onPress={() => setShowPasswordForm(!showPasswordForm)}>
              <Text style={styles.sectionAction}>{showPasswordForm ? 'Cancelar' : '+ Agregar'}</Text>
            </TouchableOpacity>
          </View>

          {passwords.length === 0 && !showPasswordForm && (
            <Text style={styles.emptyHint}>No tienes ninguna guardada. La mayoría de bancos usan tu cédula.</Text>
          )}

          {passwords.map((p) => (
            <View key={p.id} style={styles.passwordRow}>
              <Text style={styles.passwordLabel}>{p.label}</Text>
              <Text style={styles.passwordValue}>{'•'.repeat(Math.min(p.password.length, 10))}</Text>
              <TouchableOpacity onPress={() => handleDeletePassword(p.id)}>
                <Text style={styles.passwordDelete}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {showPasswordForm && (
            <View style={styles.passwordForm}>
              <TextInput
                style={styles.input}
                placeholder='Etiqueta, ej: "Cédula"'
                placeholderTextColor="#64748B"
                value={newLabel}
                onChangeText={setNewLabel}
              />
              <TextInput
                style={styles.input}
                placeholder="Contraseña"
                placeholderTextColor="#64748B"
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.savePasswordBtn} onPress={handleAddPassword}>
                <Text style={styles.savePasswordBtnText}>Guardar contraseña</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* File picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Archivo</Text>
          <TouchableOpacity style={styles.pickBtn} onPress={handlePickFile}>
            <Text style={styles.pickBtnText}>{fileName ?? '📎 Seleccionar PDF'}</Text>
          </TouchableOpacity>

          {pdfBase64 && (
            <TouchableOpacity
              style={[styles.processBtn, processing && styles.processBtnDisabled]}
              onPress={handleProcess}
              disabled={processing}
            >
              {processing ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.processBtnText}>Procesar extracto</Text>}
            </TouchableOpacity>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {result && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Importación completa</Text>
            {result.usedPassword && <Text style={styles.resultHint}>Abierto con contraseña guardada ✓</Text>}
            <ResultRow label="Nuevas transacciones" value={result.imported} color="#4ADE80" />
            <ResultRow label="Duplicados (ya existían)" value={result.duplicates} color="#94A3B8" />
            <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.doneBtnText}>Ver mis transacciones</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  icon: { fontSize: 56, marginTop: 12, marginBottom: 16 },
  heading: { fontSize: 22, fontWeight: '800', color: '#F8FAFC', marginBottom: 8 },
  subtext: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  section: { width: '100%', backgroundColor: '#1E293B', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#F8FAFC' },
  sectionAction: { fontSize: 13, fontWeight: '600', color: '#22D3EE' },
  emptyHint: { fontSize: 12, color: '#64748B' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155', gap: 10 },
  passwordLabel: { fontSize: 13, color: '#CBD5E1', flex: 1 },
  passwordValue: { fontSize: 13, color: '#64748B' },
  passwordDelete: { fontSize: 14, color: '#F87171', paddingHorizontal: 4 },
  passwordForm: { gap: 10, marginTop: 10 },
  input: { backgroundColor: '#0F172A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#F8FAFC', borderWidth: 1, borderColor: '#334155' },
  savePasswordBtn: { backgroundColor: '#334155', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  savePasswordBtnText: { fontSize: 13, fontWeight: '700', color: '#F8FAFC' },
  pickBtn: { backgroundColor: '#0F172A', borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155', borderStyle: 'dashed' },
  pickBtnText: { fontSize: 14, color: '#CBD5E1', fontWeight: '600' },
  processBtn: { backgroundColor: '#22D3EE', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  processBtnDisabled: { opacity: 0.6 },
  processBtnText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  errorText: { fontSize: 13, color: '#F87171', textAlign: 'center', marginTop: 8 },
  resultBox: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, width: '100%', marginTop: 8, borderWidth: 1, borderColor: '#334155' },
  resultTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 8, textAlign: 'center' },
  resultHint: { fontSize: 12, color: '#4ADE80', textAlign: 'center', marginBottom: 12 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  resultLabel: { fontSize: 14, color: '#CBD5E1' },
  resultValue: { fontSize: 14, fontWeight: '700' },
  doneBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  doneBtnText: { color: '#22D3EE', fontWeight: '700', fontSize: 14 },
});
