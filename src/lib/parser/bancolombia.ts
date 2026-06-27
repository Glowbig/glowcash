import { TransactionSource } from '../../types';
import { parseAmount } from './utils';

export interface ParsedTransaction {
  amount: number;
  description: string;
  merchant?: string;
  date: string;
  source: TransactionSource;
  raw_text: string;
  bank: 'bancolombia';
}

// Known Bancolombia notification senders
export const BANCOLOMBIA_SENDERS = [
  'alertas@notificacionesbancolombia.com',
  'alertasynotificaciones@bancolombia.com.co',
  'alertas@bancolombia.com.co',
  'notificaciones@notificacionesbancolombia.com',
  'info@bancolombia.com.co',
  'noreply@bancolombia.com.co',
];

export const BANCOLOMBIA_SMS_SENDERS = ['Bancolombia', '4132', '4133'];

/*
 * Formatos reales observados (SMS de Bancolombia, junio 2026):
 * "Bancolombia: Recibiste una transferencia por $259,000 de ASDRUBAL ESTRADA en tu cuenta **3048, el 31/05/2026 a las 12:55..."
 * "Bancolombia: Compraste $254,00 en RAPPI COLOMBIA*DL con tu T.Deb *3724, el 31/05/2026 a las 18:43..."
 * "Bancolombia: Transferiste $27,000.00 desde tu cuenta 3048 a la cuenta *3025387529 el 12/06/2026 a las 22:49..."
 * "Bancolombia le informa Recarga de Tarjeta Civica por $20,000.00 desde cta *3048. 12/06/2026 17:19..."
 */
export function parseBancolombiaEmail(body: string, receivedAt: string): ParsedTransaction | null {
  const text = body.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  const amountMatch = text.match(/\$\s*([\d.,]+)/);
  if (!amountMatch) return null;

  const amount = parseAmount(amountMatch[1]);
  if (isNaN(amount) || amount <= 0) return null;

  const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const date = dateMatch
    ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T00:00:00.000Z`
    : receivedAt;

  // 1a. Recibiste (una transferencia) por $X de NOMBRE en tu cuenta
  let m = text.match(/recibiste\s+(?:una\s+transferencia\s+)?por\s+\$[\d.,]+\s+de\s+([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+?)\s+en\s+tu\s+cuenta/i);
  if (m) {
    const counterpart = m[1].trim();
    return { amount: Math.abs(amount), description: counterpart, merchant: counterpart, date, source: 'email', raw_text: text, bank: 'bancolombia' };
  }

  // 1b. Recibiste un pago de CONCEPTO por $X (ej: "Recibiste un pago de Nómina por $2,800,000")
  m = text.match(/recibiste\s+un\s+pago\s+de\s+([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+?)\s+por\s+\$/i);
  if (m) {
    const concept = m[1].trim();
    return { amount: Math.abs(amount), description: concept, merchant: concept, date, source: 'email', raw_text: text, bank: 'bancolombia' };
  }

  // 2. Compraste $X en MERCHANT con tu T.Deb/T.Cred
  m = text.match(/compraste\s+\$[\d.,]+\s+en\s+([A-Z0-9*Á-Úá-ú.\-\s]+?)\s+con\s+tu/i);
  if (m) {
    const merchant = m[1].trim();
    return { amount: -Math.abs(amount), description: merchant, merchant, date, source: 'email', raw_text: text, bank: 'bancolombia' };
  }

  // 3. Transferiste $X desde tu cuenta * a la cuenta *NNNN
  m = text.match(/transferiste\s+\$[\d.,]+\s+desde\s+tu\s+cuenta\s+\*?(\d+)\s+a\s+la\s+cuenta\s+\*?(\d+)/i);
  if (m) {
    const dest = m[2].slice(-4);
    return { amount: -Math.abs(amount), description: `Transferencia a cuenta *${dest}`, date, source: 'email', raw_text: text, bank: 'bancolombia' };
  }

  // 4. Recarga de Tarjeta Cívica / similar por $X desde cta
  m = text.match(/recarga\s+de\s+([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+?)\s+por\s+\$/i);
  if (m) {
    const concept = m[1].trim();
    return { amount: -Math.abs(amount), description: concept, merchant: concept, date, source: 'email', raw_text: text, bank: 'bancolombia' };
  }

  // Fallback genérico (PSE, formatos antiguos no contemplados arriba)
  const merchantPatterns = [
    /en\s+([A-Z][A-Z0-9\s.\-&,]+?)(?:\s+\d{2}\/\d{2}\/\d{4}|\s+con\s+tu|\s+por|\s+el\s+\d)/i,
    /PSE\s*-\s*([A-Z][A-Z0-9\s.\-&]+?)(?:\s+\d{2}|\s+por)/i,
  ];
  let merchant: string | undefined;
  for (const pattern of merchantPatterns) {
    const mm = text.match(pattern);
    if (mm) {
      merchant = mm[1].trim().replace(/\s+/g, ' ');
      break;
    }
  }

  const isCredit = /recib[ií]ste|recib[oó]|ingres[oó]|crédito|pago recibido/i.test(text);
  const finalAmount = isCredit ? Math.abs(amount) : -Math.abs(amount);

  return {
    amount: finalAmount,
    description: merchant ?? text.substring(0, 100),
    merchant,
    date,
    source: 'email',
    raw_text: text,
    bank: 'bancolombia',
  };
}

export function parseBancolombiaSmS(smsBody: string, receivedAt: string): ParsedTransaction | null {
  return parseBancolombiaEmail(smsBody, receivedAt);
}
