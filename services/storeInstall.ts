import { Capacitor, registerPlugin } from '@capacitor/core';

type NativePlatform = 'ios' | 'android' | 'web';
type NativeInstallChannel =
  | 'store'
  | 'testflight_or_sandbox'
  | 'simulator'
  | 'debug_signed'
  | 'sideload'
  | 'non_store_installer'
  | 'unknown';

interface StoreInstallPluginResult {
  platform?: string;
  isStoreInstall?: boolean;
  channel?: string;
  installerPackage?: string | null;
  initiatingPackage?: string | null;
  packageSource?: number;
  receiptFileName?: string;
  hasSandboxReceipt?: boolean;
  hasEmbeddedProvision?: boolean;
  hasReceiptFile?: boolean;
}

interface StoreInstallPlugin {
  getInstallInfo(): Promise<StoreInstallPluginResult>;
}

export interface NativeInstallInfo {
  platform: NativePlatform;
  isStoreInstall: boolean;
  channel: NativeInstallChannel;
  installerPackage: string | null;
  initiatingPackage: string | null;
  packageSource: number;
  receiptFileName: string | null;
  hasSandboxReceipt: boolean;
  hasEmbeddedProvision: boolean;
  hasReceiptFile: boolean;
  detection: 'native-plugin' | 'fallback';
}

const DEFAULT_NON_STORE: NativeInstallInfo = {
  platform: 'web',
  isStoreInstall: false,
  channel: 'unknown',
  installerPackage: null,
  initiatingPackage: null,
  packageSource: -1,
  receiptFileName: null,
  hasSandboxReceipt: false,
  hasEmbeddedProvision: false,
  hasReceiptFile: false,
  detection: 'fallback',
};

const StoreInstall = registerPlugin<StoreInstallPlugin>('StoreInstall');

let installInfoPromise: Promise<NativeInstallInfo> | null = null;

const createFallbackInfo = (platform: string): NativeInstallInfo => ({
  ...DEFAULT_NON_STORE,
  platform: normalizePlatform(platform),
});

const wait = (ms: number): Promise<void> => new Promise((resolve) => {
  globalThis.setTimeout(resolve, ms);
});

const normalizePlatform = (value: unknown): NativePlatform => {
  if (value === 'ios' || value === 'android' || value === 'web') return value;
  const platform = Capacitor.getPlatform();
  if (platform === 'ios' || platform === 'android') return platform;
  return 'web';
};

const normalizeChannel = (value: unknown): NativeInstallChannel => {
  if (
    value === 'store'
    || value === 'testflight_or_sandbox'
    || value === 'simulator'
    || value === 'debug_signed'
    || value === 'sideload'
    || value === 'non_store_installer'
    || value === 'unknown'
  ) {
    return value;
  }
  return 'unknown';
};

const normalizeNativeInstallInfo = (raw: StoreInstallPluginResult): NativeInstallInfo => {
  const platform = normalizePlatform(raw.platform);
  return {
    platform,
    isStoreInstall: Boolean(raw.isStoreInstall),
    channel: normalizeChannel(raw.channel),
    installerPackage: raw.installerPackage ?? null,
    initiatingPackage: raw.initiatingPackage ?? null,
    packageSource: typeof raw.packageSource === 'number' ? raw.packageSource : -1,
    receiptFileName: typeof raw.receiptFileName === 'string' ? raw.receiptFileName : null,
    hasSandboxReceipt: Boolean(raw.hasSandboxReceipt),
    hasEmbeddedProvision: Boolean(raw.hasEmbeddedProvision),
    hasReceiptFile: Boolean(raw.hasReceiptFile),
    detection: 'native-plugin',
  };
};

export const getNativeInstallInfo = async (): Promise<NativeInstallInfo> => {
  const platform = Capacitor.getPlatform();
  if (platform === 'web') {
    return {
      ...DEFAULT_NON_STORE,
      platform: 'web',
    };
  }

  if (!installInfoPromise) {
    installInfoPromise = (async () => {
      try {
        const first = await StoreInstall.getInstallInfo();
        return normalizeNativeInstallInfo(first);
      } catch {
        // 브리지 초기화 타이밍으로 첫 호출이 실패할 수 있어 짧게 1회 재시도한다.
      }

      await wait(250);

      try {
        const second = await StoreInstall.getInstallInfo();
        return normalizeNativeInstallInfo(second);
      } catch {
        return createFallbackInfo(platform);
      }
    })();
  }

  const info = await installInfoPromise;

  // 플러그인 준비 타이밍 이슈 등 일시 실패를 다음 호출에서 재시도할 수 있게 한다.
  if (info.detection === 'fallback') {
    installInfoPromise = null;
  }

  return info;
};
