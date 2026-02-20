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

    // Device 정보는 시뮬레이터에서 ATT 요청을 생략하기 위해 사용한다.
    try {
      const deviceInfo = await Device.getInfo();
      isVirtual = Boolean(deviceInfo.isVirtual);
    } catch {
      isVirtual = false;
    }

    await AdMob.initialize({
      // 테스트 모드는 앱 코드에서 강제하지 않는다.
      // (실기기 테스트는 AdMob 콘솔 테스트 기기 설정으로만 제어)
      initializeForTesting: false,
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
