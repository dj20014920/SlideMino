import {
  AdMob,
  AdmobConsentStatus,
  type AdmobConsentInfo,
} from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { getNativeInstallInfo } from './storeInstall';

let started = false;
let startPromise: Promise<void> | null = null;
let canRequestAds: boolean | null = null;
let isVirtualPromise: Promise<boolean> | null = null;
let requestPolicyPromise: Promise<AdMobRequestPolicy> | null = null;

type AdDistributionChannel = 'store' | 'beta' | 'internal' | 'qa' | 'dev';
type AdTestModeReason =
  | 'development'
  | 'virtual-device'
  | 'env-force-test'
  | 'non-store-channel'
  | 'store-channel';

export interface AdMobRequestPolicy {
  shouldUseTestAds: boolean;
  reason: AdTestModeReason;
  distributionChannel: AdDistributionChannel;
  isVirtualDevice: boolean;
}

const normalizeBool = (value?: string | null): boolean => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const normalizeDistributionChannel = (value?: string | null): AdDistributionChannel | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'store') return 'store';
  if (normalized === 'beta' || normalized === 'alpha' || normalized === 'rc' || normalized === 'testflight') {
    return 'beta';
  }
  if (normalized === 'internal') return 'internal';
  if (normalized === 'qa' || normalized === 'staging') return 'qa';
  if (normalized === 'dev' || normalized === 'debug') return 'dev';
  return null;
};

const resolveDistributionChannel = async (): Promise<AdDistributionChannel> => {
  const envChannel = normalizeDistributionChannel(import.meta.env.VITE_AD_DISTRIBUTION_CHANNEL as string | undefined);
  if (envChannel) return envChannel;

  if (import.meta.env.DEV) return 'dev';

  if (Capacitor.getPlatform() !== 'web') {
    try {
      const installInfo = await getNativeInstallInfo();
      if (installInfo.isStoreInstall) {
        return 'store';
      }

      if (installInfo.channel === 'debug_signed') {
        return 'dev';
      }

      return 'beta';
    } catch {
      // 앱 정보 조회 실패 시 보수적으로 처리한다.
      return 'beta';
    }
  }

  return 'store';
};

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
    let isVirtual = false;

    try {
      consentInfo = await AdMob.requestConsentInfo();
    } catch {
      // If consent info cannot be loaded (network/config), keep app stable.
      // We'll avoid blocking the game and let the SDK handle limited ads behavior.
      consentInfo = null;
    }

    try {
      const deviceInfo = await Device.getInfo();
      isVirtual = Boolean(deviceInfo.isVirtual);
    } catch {
      isVirtual = false;
    }

    // iOS only: ATT status can affect ad personalization.
    // We keep this best-effort and never block startup on failures.
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
        // Ignore: if the form fails to show, we'll continue without ads.
      }
    }

    // 시뮬레이터에서는 테스트 광고 QA 재현성을 우선한다.
    // 실제 기기 동의 정책에는 영향을 주지 않도록 virtual device 에서만 우회한다.
    canRequestAds = isVirtual ? true : normalizeCanRequestAds(consentInfo);

    started = true;
  })();

  return startPromise;
};

export const getAdMobRequestPolicy = async (): Promise<AdMobRequestPolicy> => {
  if (Capacitor.getPlatform() === 'web') {
    return {
      shouldUseTestAds: false,
      reason: 'store-channel',
      distributionChannel: 'store',
      isVirtualDevice: false,
    };
  }

  if (!requestPolicyPromise) {
    requestPolicyPromise = (async () => {
      const virtual = await isVirtualDevice();
      const distributionChannel = await resolveDistributionChannel();

      const envForce = normalizeBool(import.meta.env.VITE_AD_FORCE_TEST_MODE as string | undefined);
      if (import.meta.env.DEV) {
        return {
          shouldUseTestAds: true,
          reason: 'development',
          distributionChannel,
          isVirtualDevice: virtual,
        };
      }

      if (virtual) {
        return {
          shouldUseTestAds: true,
          reason: 'virtual-device',
          distributionChannel,
          isVirtualDevice: true,
        };
      }

      if (envForce) {
        return {
          shouldUseTestAds: true,
          reason: 'env-force-test',
          distributionChannel,
          isVirtualDevice: virtual,
        };
      }

      if (distributionChannel !== 'store') {
        return {
          shouldUseTestAds: true,
          reason: 'non-store-channel',
          distributionChannel,
          isVirtualDevice: virtual,
        };
      }

      return {
        shouldUseTestAds: false,
        reason: 'store-channel',
        distributionChannel,
        isVirtualDevice: virtual,
      };
    })();
  }

  return requestPolicyPromise;
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
