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

export const AD_MOB_CONSENT_UPDATED_EVENT = 'slidemino:admob-consent-updated';

export interface AdMobRequestPolicy {
  shouldUseTestAds: boolean;
}

const normalizeCanRequestAds = (info: AdmobConsentInfo | null | undefined): boolean => {
  if (!info) return true;
  return info.canRequestAds ?? true;
};

const normalizeBoolEnv = (value?: string): boolean => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const publishConsentState = (nextCanRequestAds: boolean): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AD_MOB_CONSENT_UPDATED_EVENT, {
    detail: { canRequestAds: nextCanRequestAds },
  }));
};

const updateCanRequestAds = (info: AdmobConsentInfo | null | undefined): void => {
  const nextCanRequestAds = normalizeCanRequestAds(info);
  if (canRequestAds === nextCanRequestAds) return;
  canRequestAds = nextCanRequestAds;
  publishConsentState(nextCanRequestAds);
};

const refreshConsentInfo = async (): Promise<AdmobConsentInfo | null> => {
  try {
    const consentInfo = await AdMob.requestConsentInfo();
    updateCanRequestAds(consentInfo);
    return consentInfo;
  } catch {
    return null;
  }
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

    consentInfo = await refreshConsentInfo();

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
        updateCanRequestAds(consentInfo);
      } catch {
        consentInfo = await refreshConsentInfo();
      }
    }

    if (consentInfo) {
      updateCanRequestAds(consentInfo);
    }
    started = true;
  })();

  return startPromise;
};

export const getAdMobRequestPolicy = async (): Promise<AdMobRequestPolicy> => ({
  shouldUseTestAds:
    normalizeBoolEnv(import.meta.env.VITE_ADMOB_TEST_ADS)
    || (await isVirtualDevice()),
});

export const ensureAdMobReady = async (): Promise<boolean> => {
  if (Capacitor.getPlatform() === 'web') return false;
  await ensureStarted();
  if (canRequestAds === false) {
    await refreshConsentInfo();
  }
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
  } finally {
    await refreshConsentInfo();
  }
};
