import { BANCOLOMBIA_SENDERS, parseBancolombiaEmail } from './parser/bancolombia';
import { NEQUI_SENDERS, parseNequiEmail } from './parser/nequi';
import { NU_SENDERS, parseNuEmail } from './parser/nu';
import { ParsedTransaction } from './parser/bancolombia';

const ALL_SENDERS = [...BANCOLOMBIA_SENDERS, ...NEQUI_SENDERS, ...NU_SENDERS];

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface GmailMessageRef {
  id: string;
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Manual base64 decoder — Hermes (Android/iOS) has no built-in atob, unlike web.
function base64Decode(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = base64Decode(base64);
  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
  }
}

function extractBody(payload: any): string {
  if (!payload) return '';

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts?.length) {
    const plainPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (plainPart?.body?.data) return decodeBase64Url(plainPart.body.data);

    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      return decodeBase64Url(htmlPart.body.data).replace(/<[^>]+>/g, ' ');
    }

    // Recurse into nested multiparts
    for (const part of payload.parts) {
      const body = extractBody(part);
      if (body) return body;
    }
  }

  return '';
}

function getHeader(headers: any[], name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function detectBank(fromHeader: string): 'bancolombia' | 'nequi' | 'nu' | null {
  const from = fromHeader.toLowerCase();
  if (BANCOLOMBIA_SENDERS.some((s) => from.includes(s))) return 'bancolombia';
  if (NEQUI_SENDERS.some((s) => from.includes(s))) return 'nequi';
  if (NU_SENDERS.some((s) => from.includes(s))) return 'nu';
  return null;
}

export interface ImportResult {
  parsed: ParsedTransaction[];
  totalFound: number;
  unparsed: number;
}

/**
 * Searches Gmail for messages from known Colombian bank senders and parses each
 * one into a transaction. Uses pagination to fetch all results (Gmail caps at
 * 500 per page).
 *
 * @param since - If provided, only search from (since - 1 day) to avoid missing
 *   messages near the boundary. If null, searches last 365 days (full history).
 */
export async function importBankEmails(
  accessToken: string,
  onProgress?: (current: number, total: number) => void,
  since?: Date | null
): Promise<ImportResult> {
  // Primary: match by sender. Secondary: subject keywords for unknown sender addresses.
  const senderQuery = ALL_SENDERS.map((s) => `from:${s}`).join(' OR ');
  const subjectQuery = 'subject:(alerta movimiento transacción pago transferencia Bancolombia Nequi)';

  let timeFilter: string;
  if (since) {
    const safeDate = new Date(since.getTime() - 24 * 60 * 60 * 1000); // 1 day overlap
    const yyyy = safeDate.getFullYear();
    const mm = String(safeDate.getMonth() + 1).padStart(2, '0');
    const dd = String(safeDate.getDate()).padStart(2, '0');
    timeFilter = `after:${yyyy}/${mm}/${dd}`;
  } else {
    timeFilter = 'newer_than:365d';
  }

  const query = `(${senderQuery} OR ${subjectQuery}) ${timeFilter}`;

  // Paginate through all results — Gmail API maxResults is 500 per page.
  const messages: GmailMessageRef[] = [];
  let pageToken: string | undefined;
  do {
    const url = `${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=500${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Gmail API error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    messages.push(...(data.messages ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  const parsed: ParsedTransaction[] = [];
  let unparsed = 0;

  for (let i = 0; i < messages.length; i++) {
    onProgress?.(i + 1, messages.length);

    const msgRes = await fetch(`${GMAIL_API}/messages/${messages[i].id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!msgRes.ok) continue;
    const msg = await msgRes.json();

    const headers = msg.payload?.headers ?? [];
    const from = getHeader(headers, 'From');
    const dateHeader = getHeader(headers, 'Date');
    const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

    const bank = detectBank(from);
    if (!bank) continue;

    const body = extractBody(msg.payload);
    if (!body) {
      unparsed++;
      continue;
    }

    const parser = bank === 'bancolombia' ? parseBancolombiaEmail : bank === 'nequi' ? parseNequiEmail : parseNuEmail;
    const result = parser(body, receivedAt);

    if (result) {
      parsed.push(result);
    } else {
      unparsed++;
    }
  }

  return { parsed, totalFound: messages.length, unparsed };
}
