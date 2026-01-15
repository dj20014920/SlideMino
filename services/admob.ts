import {
  AdMob,
  AdmobConsentStatus,
  type AdmobConsentInfo,
} from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

let started = false;
let startPromise: Promise<void> | null = null;
let canRequestAds: boolean | null = null;
let isVirtualPromise: Promise<boolean> | null = null;

const normalizeCanRequestAds = (info: AdmobConsentInfo | null | undefined): boolean => {
  // `canRequestAds` is available on newer plugin versions (7.0.3+).
  // If it's missing, default to true to avoid breaking ad requests.
  if (!info) return true;
  return info.canRequestAds ?? true;
};

const ensureStarted = async (): Promise<void> => {
  if (started) return;
  if (startPromise) return startPromise;

  startPromise = (async () => {
    await AdMob.initialize();

    let consentInfo: AdmobConsentInfo | null = null;

    try {
      consentInfo = await AdMob.requestConsentInfo();
    } catch {
      // If consent info cannot be loaded (network/config), keep app stable.
      // We'll avoid blocking the game and let the SDK handle limited ads behavior.
      consentInfo = null;
    }

    // iOS only: ATT status can affect ad personalization.
    // We keep this best-effort and never block startup on failures.
    if (Capacitor.getPlatform() === 'ios') {
      try {
        const tracking = await AdMob.trackingAuthorizationStatus();
        if (tracking.status === 'notDetermined') {
          await AdMob.requestTrackingAuthorization();
        }
      } catch {
        // Ignore: ATT prompt may be unavailable or denied.
      }
    }

    // UMP: show consent form only if required & available.
    if (consentInfo?.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
      try {
        consentInfo = await AdMob.showConsentForm();
      } catch {
        // Ignore: if the form fails to show, we'll continue without ads.
      }
    }

    canRequestAds = normalizeCanRequestAds(consentInfo);

    started = true;
  })();

  return startPromise;
};

export const ensureAdMobReady = async (): Promise<boolean> => {
  if (Capacitor.getPlatform() === 'web') return false;
  await ensureStarted();
  return canRequestAds !== false;
};

export const isVirtualDevice = async (): Promise<boolean> => {
  if (Capacitor.getPlatform() === 'web') return false;
  if (!isVirtualPromise) {
    isVirtualPromise = Device.getInfo()
      .then((info) => Boolean(info.isVirtual))
      .catch(() => false);
  }
  return isVirtualPromise;
};

export const openNativePrivacyOptionsForm = async (): Promise<void> => {
  if (Capacitor.getPlatform() === 'web') return;

  await ensureStarted();

  try {
    await AdMob.showPrivacyOptionsForm();
  } catch {
    // Keep app stable if the form is unavailable.
  }
};
