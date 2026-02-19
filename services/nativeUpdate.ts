
import { BASE_URL } from '../config/constants';
import { getNativePlatform, type NativePlatform } from '../utils/platform';

type UpdatableNativePlatform = Extract<NativePlatform, 'ios' | 'android'>;

interface PlatformUpdatePolicy {
  minimumVersion: string;
  latestVersion?: string;
  storeUrl?: string;
  fallbackUrl?: string;
}

interface NativeUpdatePolicy {
  schemaVersion?: number;
  ios?: PlatformUpdatePolicy;
  android?: PlatformUpdatePolicy;
}

interface IosLiveUpdatePayload {
  ios?: {
    latestVersion?: string;
    trackId?: string;
    trackViewUrl?: string;
  };
}

export interface NativeUpdateRequirement {
  platform: UpdatableNativePlatform;
  currentVersion: string;
  minimumVersion: string;
  latestVersion: string | null;
  storeUrl: string;
  fallbackUrl: string | null;
}

const UPDATE_POLICY_URL = `${BASE_URL}/native-update.json`;
const IOS_LIVE_UPDATE_URL = `${BASE_URL}/api/native-update`;

const ANDROID_PACKAGE_ID = 'com.slidemino.app';
const IOS_DEFAULT_APP_STORE_ID = '6757861065';
const IOS_APP_STORE_ID = (import.meta.env.VITE_IOS_APP_STORE_ID ?? IOS_DEFAULT_APP_STORE_ID).trim();

const ANDROID_DEFAULT_STORE_LINKS = {
  primary: `market://details?id=${ANDROID_PACKAGE_ID}`,
  fallback: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}`,
} as const;

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

const normalizeVersion = (version: string): number[] => {
  const cleaned = version.trim().replace(/^[^\d]*/, '');
  if (!cleaned) return [];

  const rawSegments = cleaned.split(/[._-]/);
  const segments: number[] = [];

  for (const segment of rawSegments) {
    const match = segment.match(/^\d+/);
    if (!match) break;
    segments.push(Number.parseInt(match[0], 10));
  }

  return segments;
};

export const compareVersions = (leftVersion: string, rightVersion: string): number => {
  const left = normalizeVersion(leftVersion);
  const right = normalizeVersion(rightVersion);
  const maxLength = Math.max(left.length, right.length);

  for (let i = 0; i < maxLength; i += 1) {
    const leftPart = left[i] ?? 0;
    const rightPart = right[i] ?? 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
};

const selectHighestVersion = (versions: string[]): string => {
  return versions.reduce((best, candidate) => (
    compareVersions(candidate, best) > 0 ? candidate : best
  ));
};

const normalizeStoreUrl = (value: unknown): string | null => {
  if (!isNonEmptyString(value)) return null;
  return value.trim();
};

const buildIosStoreLinks = (trackId: string | null): { primary: string; fallback: string } => {
  const resolvedTrackId = (trackId ?? IOS_APP_STORE_ID).trim();
  if (resolvedTrackId) {
    return {
      primary: `itms-apps://itunes.apple.com/app/id${resolvedTrackId}`,
      fallback: `https://apps.apple.com/app/id${resolvedTrackId}`,
    };
  }
  return {
    primary: 'itms-apps://itunes.apple.com/search?term=block%20slide%20puzzle',
    fallback: 'https://apps.apple.com/search?term=block%20slide%20puzzle',
  };
};

const fetchNativeUpdatePolicy = async (): Promise<NativeUpdatePolicy | null> => {
  try {
    const response = await fetch(UPDATE_POLICY_URL, {
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const parsed = await response.json();
    if (!parsed || typeof parsed !== 'object') return null;

    return parsed as NativeUpdatePolicy;
  } catch {
    return null;
  }
};

const fetchIosLiveUpdateInfo = async (): Promise<IosLiveUpdatePayload['ios'] | null> => {
  try {
    const response = await fetch(IOS_LIVE_UPDATE_URL, {
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const parsed = await response.json() as IosLiveUpdatePayload;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.ios || typeof parsed.ios !== 'object') return null;

    return parsed.ios;
  } catch {
    return null;
  }
};

const getCurrentNativeAppVersion = async (): Promise<string | null> => {
  try {
    const { App: CapacitorApp } = await import('@capacitor/app');
    const appInfo = await CapacitorApp.getInfo();
    if (isNonEmptyString(appInfo.version)) {
      return appInfo.version.trim();
    }
  } catch {
    // ignore
  }

  return null;
};

const resolveAndroidRequirement = (
  currentVersion: string,
  policy: NativeUpdatePolicy | null
): NativeUpdateRequirement | null => {
  const androidPolicy = policy?.android;
  if (!androidPolicy || !isNonEmptyString(androidPolicy.minimumVersion)) return null;

  const minimumVersion = androidPolicy.minimumVersion.trim();
  if (compareVersions(currentVersion, minimumVersion) >= 0) return null;

  return {
    platform: 'android',
    currentVersion,
    minimumVersion,
    latestVersion: isNonEmptyString(androidPolicy.latestVersion)
      ? androidPolicy.latestVersion.trim()
      : null,
    storeUrl: normalizeStoreUrl(androidPolicy.storeUrl) ?? ANDROID_DEFAULT_STORE_LINKS.primary,
    fallbackUrl: normalizeStoreUrl(androidPolicy.fallbackUrl) ?? ANDROID_DEFAULT_STORE_LINKS.fallback,
  };
};

const resolveIosRequirement = (
  currentVersion: string,
  policy: NativeUpdatePolicy | null,
  iosLiveInfo: IosLiveUpdatePayload['ios'] | null
): NativeUpdateRequirement | null => {
  const iosPolicy = policy?.ios;

  const versionCandidates: string[] = [];
  if (isNonEmptyString(iosPolicy?.minimumVersion)) {
    versionCandidates.push(iosPolicy.minimumVersion.trim());
  }
  if (isNonEmptyString(iosLiveInfo?.latestVersion)) {
    versionCandidates.push(iosLiveInfo.latestVersion.trim());
  }

  if (versionCandidates.length === 0) return null;

  const minimumVersion = selectHighestVersion(versionCandidates);
  if (compareVersions(currentVersion, minimumVersion) >= 0) return null;

  const trackId = isNonEmptyString(iosLiveInfo?.trackId)
    ? iosLiveInfo.trackId.trim()
    : null;
  const defaultStoreLinks = buildIosStoreLinks(trackId);

  return {
    platform: 'ios',
    currentVersion,
    minimumVersion,
    latestVersion: isNonEmptyString(iosLiveInfo?.latestVersion)
      ? iosLiveInfo.latestVersion.trim()
      : (isNonEmptyString(iosPolicy?.latestVersion) ? iosPolicy.latestVersion.trim() : minimumVersion),
    storeUrl: normalizeStoreUrl(iosPolicy?.storeUrl) ?? defaultStoreLinks.primary,
    fallbackUrl: normalizeStoreUrl(iosPolicy?.fallbackUrl)
      ?? normalizeStoreUrl(iosLiveInfo?.trackViewUrl)
      ?? defaultStoreLinks.fallback,
  };
};

export const checkNativeUpdateRequirement = async (): Promise<NativeUpdateRequirement | null> => {
  const platform = getNativePlatform();
  if (platform !== 'ios' && platform !== 'android') return null;

  const [policy, currentVersion, iosLiveInfo] = await Promise.all([
    fetchNativeUpdatePolicy(),
    getCurrentNativeAppVersion(),
    platform === 'ios' ? fetchIosLiveUpdateInfo() : Promise.resolve(null),
  ]);

  if (!currentVersion) return null;

  if (platform === 'ios') {
    return resolveIosRequirement(currentVersion, policy, iosLiveInfo);
  }

  return resolveAndroidRequirement(currentVersion, policy);
};

export const openNativeMarketForUpdate = (requirement: NativeUpdateRequirement): void => {
  if (typeof window === 'undefined') return;

  const primaryUrl = requirement.storeUrl;
  const fallbackUrl = requirement.fallbackUrl;

  try {
    window.location.href = primaryUrl;
  } catch {
    if (fallbackUrl) {
      window.location.href = fallbackUrl;
    }
    return;
  }

  if (!fallbackUrl || fallbackUrl === primaryUrl) return;

  globalThis.setTimeout(() => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'visible') {
      window.location.href = fallbackUrl;
    }
  }, 900);
};
