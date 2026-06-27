import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/auth';
import { useTransactionsStore } from '../src/stores/transactions';
import { importBankSms, isSmsReadingAvailable } from '../src/lib/sms';
import { getLastSyncTimestamp, saveLastSyncTimestamp } from '../src/lib/syncState';

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);
  const user = useAuthStore((s) => s.user);
  const addTransaction = useTransactionsStore((s) => s.addTransaction);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-sync SMS en segundo plano cuando el usuario está autenticado.
  // Solo Android, solo si el módulo nativo está disponible (build de desarrollo).
  useEffect(() => {
    if (!user || Platform.OS !== 'android' || !isSmsReadingAvailable()) return;

    (async () => {
      try {
        const lastSync = await getLastSyncTimestamp('sms');
        const { parsed } = await importBankSms(lastSync ?? undefined);
        for (const tx of parsed) {
          await addTransaction({
            user_id: user.id,
            amount: tx.amount,
            description: tx.description,
            merchant: tx.merchant,
            date: tx.date,
            source: tx.source,
            raw_text: tx.raw_text,
            is_pending: false,
          });
        }
        await saveLastSyncTimestamp('sms');
      } catch {
        // Silent — auto-sync is best-effort, user can always sync manually
      }
    })();
  }, [user?.id]);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="new-transaction" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sms-setup" options={{ presentation: 'modal' }} />
        <Stack.Screen name="accounts" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import-pdf" options={{ presentation: 'modal' }} />
        <Stack.Screen name="salary-setup" options={{ presentation: 'modal' }} />
        <Stack.Screen name="categories" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
