import { ParsedTransaction } from './bancolombia';
import { parseAmount } from './utils';

export const NU_SENDERS = [
  'noreply@nu.com.co',
  'notificaciones@nu.com.co',
  'hola@nu.com.co',
  'fatura@nubank.com.br',
];

export const NU_SMS_SENDERS = ['Nu', 'Nubank', 'NU COLOMBIA'];

/*
 * Sample Nu email notification formats:
 * "Compraste $45,000 en Starbucks el 01/06/2026."
 * "Transferiste $150,000 a tu bolsillo Ahorro."
 * "Recibiste $200,000 de Juan."
 * "Tu pago de $120,000 fue procesado."
 */
export function parseNuEmail(body: string, receivedAt: string): ParsedTransaction | null {
  const text = body.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  const amountMatch = text.match(/\$\s*([\d.,]+)/);
  if (!amountMatch) return null;

  const amount = parseAmount(amountMatch[1]);
  if (isNaN(amount) || amount <= 0) return null;

  const isCredit = /recibiste|ingresó|pago procesado|abono/i.test(text);
  const isSavings = /bolsillo|cajita|ahorro/i.test(text);
  const finalAmount = isCredit || isSavings ? Math.abs(amount) : -Math.abs(amount);

  let merchant: string | undefined;

  const purchaseMatch = text.match(/compraste\s+\$[\d.,]+\s+en\s+([A-Za-záéíóúÁÉÍÓÚñÑ0-9\s\-&]+?)(?:\s+el\s+\d|\.)/i);
  const transferToMatch = text.match(/transferiste\s+\$[\d.,]+\s+a\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\.|$)/i);
  const receiveMatch = text.match(/recibiste\s+\$[\d.,]+\s+de\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\.|$)/i);

  if (purchaseMatch) merchant = purchaseMatch[1].trim();
  else if (transferToMatch) merchant = `Bolsillo: ${transferToMatch[1].trim()}`;
  else if (receiveMatch) merchant = receiveMatch[1].trim();

  // Extract date
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

export function parseNuSms(smsBody: string, receivedAt: string): ParsedTransaction | null {
  return parseNuEmail(smsBody, receivedAt);
}
