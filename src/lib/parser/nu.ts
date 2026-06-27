import { ParsedTransaction } from './bancolombia';
import { parseAmount } from './utils';

export const NU_SENDERS = [
  'noreply@nu.com.co',
  'notificaciones@nu.com.co',
  'hola@nu.com.co',
  'info@nu.com.co',
  'fatura@nubank.com.br',
  'noreply@nubank.com.br',
];

export const NU_SMS_SENDERS = ['Nu', 'Nubank', 'NU COLOMBIA'];

/*
 * Nu Colombia real email / push notification formats:
 *
 * Purchase:
 *   "Tu compra en KS*PAGSEGURO CO por $16.499,00 con tu tarjeta terminada en 6876 ha sido APROBADA."
 *   "Compra aprobada por $16.499,00 en KS*PAGSEGURO CO"
 *   "Compraste $45.000 en Starbucks el 01/06/2026."
 *
 * Transfer:
 *   "Transferiste $150.000 a tu bolsillo Ahorro."
 *   "Enviaste $80.000 a Juan García."
 *
 * Received:
 *   "Recibiste $200.000 de Juan García."
 *   "Ingresó $2.825.095 a tu cuenta Nu."
 */
export function parseNuEmail(body: string, receivedAt: string): ParsedTransaction | null {
  const text = body.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  // ── Amount extraction ────────────────────────────────────────────────────
  const amountMatch = text.match(/\$\s*([\d.,]+)/);
  if (!amountMatch) return null;

  const amount = parseAmount(amountMatch[1]);
  if (isNaN(amount) || amount <= 0) return null;

  // ── Determine sign ───────────────────────────────────────────────────────
  const isCredit = /recibiste|ingresó|ingreso|pago\s+procesado|abono|aprobó\s+tu\s+pago/i.test(text);
  const isSavingsTransfer = /bolsillo|cajita/i.test(text);
  const finalAmount = isCredit || isSavingsTransfer ? Math.abs(amount) : -Math.abs(amount);

  // ── Merchant extraction ──────────────────────────────────────────────────
  let merchant: string | undefined;

  // "Tu compra en [MERCHANT] por $X con tu tarjeta..."
  const compraEnMatch = text.match(/compra\s+(?:aprobada\s+)?(?:por\s+\$[\d.,]+\s+)?en\s+([A-Z][A-Za-záéíóúÁÉÍÓÚñÑ0-9*\s\-&.]+?)(?:\s+(?:por|con|el|ha sido|fue|\.))/i);

  // "Compraste $X en [MERCHANT] el..."
  const compraste1Match = text.match(/compraste\s+\$[\d.,]+\s+en\s+([A-Za-záéíóúÁÉÍÓÚñÑ0-9*\s\-&]+?)(?:\s+el\s+\d|\.)/i);

  // "Transferiste $X a [DEST]"
  const transferMatch = text.match(/transferiste\s+\$[\d.,]+\s+a\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\.|,|$)/i);

  // "Enviaste $X a [PERSON]"
  const enviasteMatch = text.match(/enviaste\s+\$[\d.,]+\s+a\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\.|,|$)/i);

  // "Recibiste $X de [PERSON]"
  const recibisteMatch = text.match(/recibiste\s+\$[\d.,]+\s+de\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\.|,|$)/i);

  // "Compra aprobada por $X" — subject-only format (no merchant in body)
  if (compraEnMatch) merchant = compraEnMatch[1].trim();
  else if (compraste1Match) merchant = compraste1Match[1].trim();
  else if (transferMatch) merchant = `Bolsillo ${transferMatch[1].trim()}`;
  else if (enviasteMatch) merchant = enviasteMatch[1].trim();
  else if (recibisteMatch) merchant = recibisteMatch[1].trim();

  // Clean up merchant: remove trailing filler words
  if (merchant) {
    merchant = merchant.replace(/\s+(ha sido|con tu|el \d|fue|la|de).*$/i, '').trim();
  }

  // ── Date extraction ──────────────────────────────────────────────────────
  const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const date = dateMatch
    ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T00:00:00.000Z`
    : receivedAt;

  return {
    amount: finalAmount,
    description: merchant ?? text.substring(0, 100),
    merchant,
    date,
    source: 'email',
    raw_text: text,
    bank: 'nu' as any,
  };
}

// Nu doesn't send SMS — push notifications only. This is kept for completeness
// in case Nu ever adds SMS alerts.
export function parseNuSms(smsBody: string, receivedAt: string): ParsedTransaction | null {
  return parseNuEmail(smsBody, receivedAt);
}
