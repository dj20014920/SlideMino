import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
  type AdmobConsentInfo,
} from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

const DEFAULT_BANNER_UNIT_ID_ANDROID = 'ca-app-pub-5319827978116991/6947103527';
const DEFAULT_BANNER_UNIT_ID_IOS = 'ca-app-pub-5319827978116991/1116192349';

const getBannerAdUnitId = (): string => {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return import.meta.env.VITE_ADMOB_BANNER_IOS ?? DEFAULT_BANNER_UNIT_ID_IOS;
  if (platform === 'android') return import.meta.env.VITE_ADMOB_BANNER_ANDROID ?? DEFAULT_BANNER_UNIT_ID_ANDROID;
  return '';
};

let started = false;
let startPromise: Promise<void> | null = null;
let bannerUsers = 0;
let canRequestAds: boolean | null = null;
let bannerShown = false;

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

export const acquireNativeBannerAd = async (): Promise<void> => {
  if (Capacitor.getPlatform() === 'web') return;

  bannerUsers += 1;

  // Only show banner when transitioning from 0 -> 1 users.
  if (bannerUsers !== 1) return;

  const adUnitId = getBannerAdUnitId();
  if (!adUnitId) return;

  await ensureStarted();
  if (canRequestAds === false) return;

  try {
    await AdMob.showBanner({
      adId: adUnitId,
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
    });
    bannerShown = true;
  } catch {
    // Keep app stable if banner fails to show.
    bannerShown = false;
  }
};

export const releaseNativeBannerAd = async (): Promise<void> => {
  if (Capacitor.getPlatform() === 'web') return;

  bannerUsers = Math.max(0, bannerUsers - 1);
  if (bannerUsers !== 0) return;

  if (!bannerShown) return;

  try {
    await AdMob.hideBanner();
  } catch {
    // If hide fails (e.g., not shown yet), keep app stable.
  } finally {
    bannerShown = false;
  }
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
