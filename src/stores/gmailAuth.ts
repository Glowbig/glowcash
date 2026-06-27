import { create } from 'zustand';

// El navegador externo (no Custom Tab rastreada) no deja que expo-auth-session
// resuelva el code exchange automáticamente — el deep link de vuelta llega como
// una navegación normal de Expo Router. Por eso el code_verifier (PKCE) se guarda
// aquí cuando se arma el request, y se usa luego en app/oauthredirect.tsx para
// completar el intercambio manualmente.
interface GmailAuthState {
  codeVerifier: string | null;
  accessToken: string | null;
  exchangeError: string | null;
  setCodeVerifier: (v: string | null) => void;
  setAccessToken: (t: string | null) => void;
  setExchangeError: (e: string | null) => void;
}

export const useGmailAuthStore = create<GmailAuthState>((set) => ({
  codeVerifier: null,
  accessToken: null,
  exchangeError: null,
  setCodeVerifier: (codeVerifier) => set({ codeVerifier }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setExchangeError: (exchangeError) => set({ exchangeError }),
}));
