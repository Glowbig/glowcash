import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/auth';
import { useTransactionsStore } from '../src/stores/transactions';
import { useGmailAuthStore } from '../src/stores/gmailAuth';
import { importBankEmails } from '../src/lib/gmail';

WebBrowser.maybeCompleteAuthSession();

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export default function ImportScreen() {
  const { user } = useAuthStore();
  const { addTransaction } = useTransactionsStore();
  const insets = useSafeAreaInsets();
  const { accessToken, setAccessToken, setCodeVerifier, exchangeError } = useGmailAuthStore();

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ imported: number; duplicates: number; unparsed: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (exchangeError) setError(exchangeError);
  }, [exchangeError]);

  // Google solo acepta http/https como redirect_uri en clientes tipo "Web" (no
  // esquemas personalizados). En nativo usamos una Edge Function como "rebote":
  // Google redirige ahí (https), y esa página rebota a la app vía glowcash://.
  const clientId = process.env.EXPO_PUBLIC_GMAIL_CLIENT_ID;
  const redirectUri = Platform.OS === 'web'
    ? AuthSession.makeRedirectUri({ scheme: 'glowcash' })
    : 'https://fjfiugeulnxtgrquydxk.supabase.co/functions/v1/oauth-redirect';

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId,
    scopes: GMAIL_SCOPES,
    redirectUri,
  });

  // El navegador externo no siempre deja que esto resuelva solo (ver oauthredirect.tsx
  // para el camino manual), pero se guarda igual por si el Custom Tab sí lo captura.
  useEffect(() => {
    if (request?.codeVerifier) setCodeVerifier(request.codeVerifier);
  }, [request?.codeVerifier]);

  useEffect(() => {
    if (response?.type === 'success') {
      setAccessToken(response.authentication?.accessToken ?? null);
      setError('');
    } else if (response?.type === 'error') {
      setError(response.error?.message ?? 'No se pudo conectar con Gmail.');
    }
  }, [response]);

  const handleImport = async () => {
    if (!accessToken || !user) return;
    setImporting(true);
    setError('');
    setResult(null);

    try {
      const { parsed, unparsed } = await importBankEmails(accessToken, (current, total) =>
        setProgress({ current, total })
      );

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
      setError(e.message ?? 'Error al importar correos.');
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
        <Text style={styles.title}>Importar de Gmail</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.icon}>📧</Text>
        <Text style={styles.heading}>Conecta tu correo</Text>
        <Text style={styles.subtext}>
          Buscamos correos de Bancolombia, Nequi y Nu del último año y los convertimos en transacciones automáticamente.
        </Text>

        {!clientId ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Falta configurar EXPO_PUBLIC_GMAIL_CLIENT_ID en tu .env.local.{'\n\n'}
              Redirect URI para Google Cloud Console:{'\n'}{redirectUri}
            </Text>
          </View>
        ) : !accessToken ? (
          <TouchableOpacity style={styles.connectBtn} disabled={!request} onPress={() => promptAsync()}>
            <Text style={styles.connectBtnText}>Conectar Gmail</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.connectedBadge}>
              <Text style={styles.connectedText}>✓ Gmail conectado</Text>
            </View>

            <TouchableOpacity
              style={[styles.connectBtn, importing && styles.connectBtnDisabled]}
              onPress={handleImport}
              disabled={importing}
            >
              {importing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color="#0F172A" />
                  <Text style={styles.connectBtnText}>
                    Importando {progress.current}/{progress.total}...
                  </Text>
                </View>
              ) : (
                <Text style={styles.connectBtnText}>Importar ahora</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {clientId && redirectUri && (
          <Text style={styles.redirectHint}>Redirect URI: {redirectUri}</Text>
        )}

        {result && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Importación completa</Text>
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
  subtext: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  connectBtn: { backgroundColor: '#22D3EE', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
  connectBtnDisabled: { opacity: 0.7 },
  connectBtnText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  connectedBadge: { backgroundColor: '#14532D', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 16 },
  connectedText: { color: '#4ADE80', fontWeight: '700', fontSize: 14 },
  warningBox: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#FBBF24' },
  warningText: { color: '#FBBF24', fontSize: 12, lineHeight: 18 },
  errorText: { fontSize: 13, color: '#F87171', textAlign: 'center', marginTop: 16 },
  redirectHint: { fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 20 },
  resultBox: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, width: '100%', marginTop: 24, borderWidth: 1, borderColor: '#334155' },
  resultTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 16, textAlign: 'center' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  resultLabel: { fontSize: 14, color: '#CBD5E1' },
  resultValue: { fontSize: 14, fontWeight: '700' },
  doneBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  doneBtnText: { color: '#22D3EE', fontWeight: '700', fontSize: 14 },
});
