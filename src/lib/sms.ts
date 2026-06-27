import { Platform } from 'react-native';
import { BANCOLOMBIA_SMS_SENDERS, parseBancolombiaSmS, ParsedTransaction } from './parser/bancolombia';
import { NEQUI_SMS_SENDERS, parseNequiSms } from './parser/nequi';
import { NU_SMS_SENDERS, parseNuSms } from './parser/nu';

interface RawSms {
  address: string;
  body: string;
  date: string; // epoch millis as string
}

// react-native-get-sms-android has no native module on web/iOS — only require it on Android.
function getSmsModule(): any | null {
  if (Platform.OS !== 'android') return null;
  try {
    const mod = require('react-native-get-sms-android');
    const resolved = mod?.default ?? mod;
    return typeof resolved?.list === 'function' ? resolved : null;
  } catch {
    return null;
  }
}

// False in Expo Go and on web/iOS — the native module only exists in an EAS development build.
export function isSmsReadingAvailable(): boolean {
  return getSmsModule() !== null;
}

// since: epoch-ms. Searches from (since - 1 day) to avoid missing messages near boundary.
function listInboxSms(since?: number): Promise<RawSms[]> {
  return new Promise((resolve, reject) => {
    const SmsAndroid = getSmsModule();
    if (!SmsAndroid) {
      reject(new Error('Lectura de SMS solo disponible en Android con un build de desarrollo (no funciona en Expo Go).'));
      return;
    }
    const filter: Record<string, unknown> = { box: 'inbox', maxCount: 1000 };
    if (since) {
      filter.minDate = since - 24 * 60 * 60 * 1000; // 1 day overlap to catch boundary messages
    }
    SmsAndroid.list(
      JSON.stringify(filter),
      (fail: string) => reject(new Error(fail)),
      (_count: number, smsList: string) => resolve(JSON.parse(smsList) as RawSms[])
    );
  });
}

// El remitente puede llegar distorsionado por apps como Truecaller (lo reclasifican
// como "Spam" o le ponen un nombre random) — por eso se detecta primero por el
// CONTENIDO del mensaje (todos los bancos se identifican a sí mismos al inicio del
// SMS) y solo se usa el remitente como respaldo si el contenido no es concluyente.
function detectBank(address: string, body: string): 'bancolombia' | 'nequi' | 'nu' | null {
  if (/bancolombia/i.test(body)) return 'bancolombia';
  if (/nequi/i.test(body)) return 'nequi';
  if (/\bnu\b|nubank|fiducuenta/i.test(body)) return 'nu';

  const addr = address.toLowerCase();
  if (BANCOLOMBIA_SMS_SENDERS.some((s) => addr.includes(s.toLowerCase()))) return 'bancolombia';
  if (NEQUI_SMS_SENDERS.some((s) => addr.includes(s.toLowerCase()))) return 'nequi';
  if (NU_SMS_SENDERS.some((s) => addr.includes(s.toLowerCase()))) return 'nu';
  return null;
}

export interface SmsImportResult {
  parsed: ParsedTransaction[];
  totalFound: number;
  unparsed: number;
}

export async function importBankSms(since?: number): Promise<SmsImportResult> {
  const messages = await listInboxSms(since);
  const parsed: ParsedTransaction[] = [];
  let unparsed = 0;

  for (const sms of messages) {
    const bank = detectBank(sms.address, sms.body);
    if (!bank) continue;

    const receivedAt = new Date(parseInt(sms.date, 10)).toISOString();
    const parser = bank === 'bancolombia' ? parseBancolombiaSmS : bank === 'nequi' ? parseNequiSms : parseNuSms;
    const result = parser(sms.body, receivedAt);

    if (result) parsed.push(result);
    else unparsed++;
  }

  return { parsed, totalFound: messages.length, unparsed };
}
