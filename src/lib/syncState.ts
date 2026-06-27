import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  sms: 'glowcash:last_sms_sync_at',
  gmail: 'glowcash:last_gmail_sync_at',
};

/** Returns the epoch-ms timestamp of the last successful sync, or null if never. */
export async function getLastSyncTimestamp(source: 'sms' | 'gmail'): Promise<number | null> {
  const val = await AsyncStorage.getItem(KEYS[source]);
  return val ? parseInt(val, 10) : null;
}

/** Saves the current time as the last successful sync timestamp. */
export async function saveLastSyncTimestamp(source: 'sms' | 'gmail'): Promise<void> {
  await AsyncStorage.setItem(KEYS[source], Date.now().toString());
}
