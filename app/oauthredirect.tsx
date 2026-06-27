import { useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useGmailAuthStore } from '../src/stores/gmailAuth';

// Expo Router intercepta el deep link "glowcash://oauthredirect?code=..." como una
// ruta de navegación (el navegador externo no deja que expo-auth-session lo capture
// solo). Esta pantalla termina el login llamando a la Edge Function que hace el
// intercambio del código con el client_secret (que nunca debe estar en la app).
export default function OAuthRedirectScreen() {
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const { codeVerifier, setAccessToken, setExchangeError } = useGmailAuthStore();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      if (params.error) {
        setExchangeError(params.error);
        router.replace('/import');
        return;
      }

      if (!params.code || !codeVerifier) {
        setExchangeError(`Faltan datos para completar el login (code: ${!!params.code}, codeVerifier: ${!!codeVerifier}).`);
        router.replace('/import');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('gmail-token-exchange', {
          body: { code: params.code, codeVerifier },
        });

        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        setAccessToken(data.accessToken);
        setExchangeError(null);
      } catch (e: any) {
        setExchangeError(e?.message ?? String(e));
      } finally {
        router.replace('/import');
      }
    })();
  }, []);

  return null;
}
