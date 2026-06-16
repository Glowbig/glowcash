import { TransactionSource } from '../../types';

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
];

export const BANCOLOMBIA_SMS_SENDERS = ['Bancolombia', '4132', '4133'];

/*
 * Sample email body formats Bancolombia sends:
 * "Bancolombia le informa: Pago desde su Cuenta de Ahorros *1234 por $150,000.00 en ALMACEN EXITO S.A.S. 01/06/2026 12:30."
 * "Le informamos débito en cuenta *1234 por $50,000.00 en PAGO PSE - CODENSA 01/06/2026."
 * "Su tarjeta de crédito *5678 fue usada en RAPPI por $25,000.00 el 01/06/2026."
 */
export function parseBancolombiaEmail(body: string, receivedAt: string): ParsedTransaction | null {
  // Normalize
  const text = body.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Match amount pattern: $150,000.00 or $1.500.000 or $150000
  const amountMatch = text.match(/\$\s*([\d.,]+)/);
  if (!amountMatch) return null;

  const amountStr = amountMatch[1].replace(/\./g, '').replace(',', '.');
  const amount = parseFloat(amountStr);
  if (isNaN(amount)) return null;

  // Determine if debit or credit
  const isCredit = /recib[oó]|ingres[oó]|crédito|pago recibido/i.test(text);
  const finalAmount = isCredit ? Math.abs(amount) : -Math.abs(amount);

  // Extract merchant/description
  const merchantPatterns = [
    /en\s+([A-Z][A-Z0-9\s\.\-&,]+?)(?:\s+\d{2}\/\d{2}\/\d{4}|\s+por|\s+el\s+\d)/i,
    /PSE\s*-\s*([A-Z][A-Z0-9\s\.\-&]+?)(?:\s+\d{2}|\s+por)/i,
    /PAGO\s+([A-Z][A-Z0-9\s\.\-&]+?)(?:\s+\d{2}|\s+por)/i,
  ];

  let merchant: string | undefined;
  for (const pattern of merchantPatterns) {
    const m = text.match(pattern);
    if (m) {
      merchant = m[1].trim().replace(/\s+/g, ' ');
      break;
    }
  }

  // Extract date from body or use received date
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
    bank: 'bancolombia',
  };
}

export function parseBancolombiaSmS(smsBody: string, receivedAt: string): ParsedTransaction | null {
  return parseBancolombiaEmail(smsBody, receivedAt);
}
