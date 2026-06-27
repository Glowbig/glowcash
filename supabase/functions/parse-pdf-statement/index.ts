// Edge Function: parse-pdf-statement
//
// Recibe un extracto bancario en PDF (puede venir cifrado con contraseña),
// prueba una lista de contraseñas candidatas hasta abrirlo, extrae el texto
// y le pide a Gemini que devuelva las transacciones como JSON estructurado.
//
// Body esperado (JSON):
//   { pdfBase64: string, passwords: string[] }
// Respuesta:
//   { transactions: Array<{date, description, amount, merchant?}>, usedPassword: string | null }

import { getDocument } from 'npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('EXPO_PUBLIC_GEMINI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function extractText(bytes: Uint8Array, password?: string): Promise<string | null> {
  try {
    const loadingTask = getDocument({ data: bytes, password, useSystemFonts: true });
    const pdf = await loadingTask.promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // deno-lint-ignore no-explicit-any
      text += content.items.map((it: any) => it.str).join(' ') + '\n';
    }
    return text;
  } catch {
    return null;
  }
}

async function tryAllPasswords(bytes: Uint8Array, passwords: string[]): Promise<{ text: string; usedPassword: string | null } | null> {
  // Intenta primero sin contraseña (PDF sin cifrar)
  const noPassword = await extractText(bytes);
  if (noPassword) return { text: noPassword, usedPassword: null };

  for (const pw of passwords) {
    const text = await extractText(bytes, pw);
    if (text) return { text, usedPassword: pw };
  }
  return null;
}

async function extractTransactionsWithGemini(statementText: string) {
  const prompt = `Eres un extractor de datos financieros. Te paso el texto de un extracto bancario colombiano.
Devuelve SOLO un array JSON (sin markdown, sin explicación) con todas las transacciones encontradas, en este formato:
[{"date": "YYYY-MM-DD", "description": "texto original", "merchant": "comercio si aplica o null", "amount": numero}]

Reglas:
- amount negativo = gasto/débito, positivo = ingreso/crédito
- Si no hay forma de saber el signo, asume gasto (negativo)
- Ignora encabezados, totales y resumenes — solo movimientos individuales
- Las fechas vienen en formato DD/MM/YYYY en el texto, conviértelas a YYYY-MM-DD

Texto del extracto:
${statementText.substring(0, 30000)}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { pdfBase64, passwords } = await req.json();
    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: 'Falta pdfBase64' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bytes = base64ToBytes(pdfBase64);
    const result = await tryAllPasswords(bytes, passwords ?? []);

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'No se pudo abrir el PDF con ninguna de las contraseñas guardadas.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transactions = await extractTransactionsWithGemini(result.text);

    return new Response(JSON.stringify({ transactions, usedPassword: result.usedPassword }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
