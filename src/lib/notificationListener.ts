import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { GlowcashNotificationListener } = NativeModules;

const emitter = GlowcashNotificationListener
  ? new NativeEventEmitter(GlowcashNotificationListener)
  : null;

export interface BankNotification {
  title: string;
  text: string;
  packageName: string;
}

export function isNotificationListenerAvailable(): boolean {
  return Platform.OS === 'android' && !!GlowcashNotificationListener;
}

export async function isNotificationListenerEnabled(): Promise<boolean> {
  if (!GlowcashNotificationListener) return false;
  try {
    return await GlowcashNotificationListener.isEnabled();
  } catch {
    return false;
  }
}

export function openNotificationListenerSettings(): void {
  GlowcashNotificationListener?.openSettings();
}

export function addNotificationListener(
  callback: (notification: BankNotification) => void
): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('GlowcashNotification', callback);
  return () => sub.remove();
}
