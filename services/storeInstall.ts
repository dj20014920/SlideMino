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
    installInfoPromise = StoreInstall.getInstallInfo()
      .then(normalizeNativeInstallInfo)
      .catch(() => ({
        ...DEFAULT_NON_STORE,
        platform: normalizePlatform(platform),
      }));
  }

  return installInfoPromise;
};
