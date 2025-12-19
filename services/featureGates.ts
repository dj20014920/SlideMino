export type FeatureId = 'blockCustomization';

export type FeatureGateDecision = {
  allowed: boolean;
  reason?: string;
};

const LOCAL_OVERRIDE_KEY: Record<FeatureId, string> = {
  blockCustomization: 'slidemino.feature.blockCustomization',
};

const readLocalOverride = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const getFeatureGateDecision = (feature: FeatureId): FeatureGateDecision => {
  // 1) Local override (manual QA / future paywall hook)
  // - "locked" -> force disable
  // - "unlocked" -> force enable
  const override = readLocalOverride(LOCAL_OVERRIDE_KEY[feature]);
  if (override === 'locked') {
    return { allowed: false, reason: '프리미엄 기능' };
  }
  if (override === 'unlocked') {
    return { allowed: true };
  }

  // 2) Build-time flag (Vite): VITE_FEATURE_BLOCK_CUSTOMIZATION=false
  const envFlag = import.meta.env.VITE_FEATURE_BLOCK_CUSTOMIZATION;
  if (typeof envFlag === 'string' && envFlag.length > 0) {
    const normalized = envFlag.trim().toLowerCase();
    if (normalized === '0' || normalized === 'false' || normalized === 'off') {
      return { allowed: false, reason: '프리미엄 기능' };
    }
  }

  // 3) Default: enabled (later, replace with real entitlement check)
  return { allowed: true };
};

