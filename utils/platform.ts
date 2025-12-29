import { Capacitor } from '@capacitor/core';

export const isNativeApp = (): boolean => {
  // Capacitor returns: 'web' | 'ios' | 'android'
  // Keep it defensive for SSR/preview environments.
  try {
    return Capacitor.getPlatform() !== 'web';
  } catch {
    return false;
  }
};
