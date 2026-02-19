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

export interface AdMobRequestPolicy {
  shouldUseTestAds: boolean;
}

const normalizeCanRequestAds = (info: AdmobConsentInfo | null | undefined): boolean => {
  if (!info) return true;
  return info.canRequestAds ?? true;
};

const ensureStarted = async (): Promise<void> => {
  if (started) return;
  if (startPromise) return startPromise;

  startPromise = (async () => {
    let consentInfo: AdmobConsentInfo | null = null;
    let isVirtual = false;

    // Device 정보를 먼저 가져와야 initialize 옵션에 반영 가능
    try {
      const deviceInfo = await Device.getInfo();
      isVirtual = Boolean(deviceInfo.isVirtual);
    } catch {
      isVirtual = false;
    }

    await AdMob.initialize({
      // 시뮬레이터/에뮬레이터에서는 자동으로 테스트 광고 사용 (fill 없음 오류 방지)
      initializeForTesting: isVirtual,
    });

    try {
      consentInfo = await AdMob.requestConsentInfo();
    } catch {
      consentInfo = null;
    }

    // iOS only: ATT status can affect ad personalization.
    // Keep this best-effort and never block startup on failures.
    if (Capacitor.getPlatform() === 'ios' && !isVirtual) {
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
        // Ignore: if the form fails to show, continue without blocking app startup.
      }
    }

    canRequestAds = normalizeCanRequestAds(consentInfo);
    started = true;
  })();

  return startPromise;
};

export const getAdMobRequestPolicy = async (): Promise<AdMobRequestPolicy> => ({
  shouldUseTestAds: false,
});

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
