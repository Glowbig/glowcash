// Edge Function: gmail-token-exchange
//
// Intercambia el código de autorización de Google por un access_token de Gmail.
// Este paso necesita el client_secret de OAuth, que NUNCA debe vivir en la app
// (cualquiera podría extraerlo del APK) — por eso corre acá, donde el secreto
// queda guardado como variable de entorno del servidor.

const CLIENT_ID = Deno.env.get('GMAIL_CLIENT_ID');
const CLIENT_SECRET = Deno.env.get('GMAIL_CLIENT_SECRET');
const REDIRECT_URI = 'https://fjfiugeulnxtgrquydxk.supabase.co/functions/v1/oauth-redirect';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { code, codeVerifier } = await req.json();
    if (!code || !codeVerifier) {
      return new Response(JSON.stringify({ error: 'Falta code o codeVerifier' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = new URLSearchParams({
      client_id: CLIENT_ID ?? '',
      client_secret: CLIENT_SECRET ?? '',
      code,
      code_verifier: codeVerifier,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.error_description ?? data.error ?? 'Token exchange failed' }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ accessToken: data.access_token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
