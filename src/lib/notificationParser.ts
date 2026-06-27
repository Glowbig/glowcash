import { parseBancolombiaEmail } from './parser/bancolombia';
import { parseNequiEmail } from './parser/nequi';
import { parseNuEmail } from './parser/nu';
import { ParsedTransaction } from './parser/bancolombia';

const BANK_PACKAGES: Record<string, 'bancolombia' | 'nequi' | 'nu'> = {
  'com.nu.production': 'nu',
  'com.nequi.mobile': 'nequi',
  'com.bancolombia.bancolombia': 'bancolombia',
  'com.bancolombia.servicios': 'bancolombia',
};

const PARSERS = {
  bancolombia: parseBancolombiaEmail,
  nequi: parseNequiEmail,
  nu: parseNuEmail,
};

export function parseFinancialNotification(
  title: string,
  text: string,
  packageName: string
): (ParsedTransaction & { source: 'notification' }) | null {
  const bank = BANK_PACKAGES[packageName];
  if (!bank) return null;

  // Combine title + text — notifications often split the info across both
  const combined = [title, text].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!combined) return null;

  const now = new Date().toISOString();
  const result = PARSERS[bank](combined, now);
  if (!result) return null;

  return { ...result, source: 'notification' as const };
}
