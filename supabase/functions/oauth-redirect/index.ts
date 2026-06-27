// Edge Function: oauth-redirect
//
// Google solo acepta http/https como redirect_uri para clientes OAuth tipo "Web",
// pero la app nativa necesita volver vía un esquema personalizado (glowcash://).
// Esta función hace un redirect HTTP 302 puro (sin HTML/JS — Supabase aplica un
// Content-Security-Policy estricto a las Edge Functions que bloquea cualquier
// <script>, así que un bounce vía JS no funciona aquí).

Deno.serve((req) => {
  const url = new URL(req.url);
  const redirectTo = `glowcash://oauthredirect${url.search}`;
  return new Response(null, { status: 302, headers: { Location: redirectTo } });
});
