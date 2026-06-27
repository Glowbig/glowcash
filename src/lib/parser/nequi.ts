import { TransactionSource } from '../../types';
import { ParsedTransaction } from './bancolombia';
import { parseAmount } from './utils';

export const NEQUI_SENDERS = [
  'noreply@nequi.com.co',
  'notificaciones@nequi.com.co',
  'alertas@nequi.com.co',
];

export const NEQUI_SMS_SENDERS = ['Nequi', 'NEQUI'];

/*
 * Sample Nequi notification formats:
 * "Nequi: Enviaste $50,000 a Juan Perez. Saldo: $320,000."
 * "Recibiste $120,000 de Maria Lopez. Saldo: $440,000."
 * "Pagaste $35,000 en Rappi. Saldo: $285,000."
 * "Retiraste $200,000 en Bancolombia cajero *1234."
 */
export function parseNequiEmail(body: string, receivedAt: string): ParsedTransaction | null {
  const text = body.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  const amountMatch = text.match(/\$\s*([\d.,]+)/);
  if (!amountMatch) return null;

  const amount = parseAmount(amountMatch[1]);
  if (isNaN(amount) || amount <= 0) return null;

  const isCredit = /recibiste|recibió|ingresó|cargaron/i.test(text);
  const finalAmount = isCredit ? Math.abs(amount) : -Math.abs(amount);

  // Extract counterpart or merchant
  let merchant: string | undefined;

  const sendToMatch = text.match(/enviaste\s+\$[\d.,]+\s+a\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\.|saldo|$)/i);
  const receiveFromMatch = text.match(/recibiste\s+\$[\d.,]+\s+de\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)(?:\.|saldo|$)/i);
  const paidAtMatch = text.match(/pagaste\s+\$[\d.,]+\s+en\s+([A-Za-záéíóúÁÉÍÓÚñÑ0-9\s]+?)(?:\.|saldo|$)/i);

  if (sendToMatch) merchant = sendToMatch[1].trim();
  else if (receiveFromMatch) merchant = receiveFromMatch[1].trim();
  else if (paidAtMatch) merchant = paidAtMatch[1].trim();

  return {
    amount: finalAmount,
    description: merchant ?? text.substring(0, 100),
    merchant,
    date: receivedAt,
    source: 'email',
    raw_text: text,
    bank: 'bancolombia', // Nequi is owned by Bancolombia; use as sub-category
  };
}

export function parseNequiSms(smsBody: string, receivedAt: string): ParsedTransaction | null {
  return parseNequiEmail(smsBody, receivedAt);
}
