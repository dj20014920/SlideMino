/**
 * 광고 통합 설정 파일
 * - 앱인토스 (Apps in Toss)
 * - AdSense (웹)
 * - AdMob (네이티브)
 */

import { getNativePlatform, isNativeApp } from '../utils/platform';

// ==========================================
// 📌 스크린샷 전용 모드 (광고 비활성화)
// ==========================================

const normalizeBoolEnv = (value?: string): boolean => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const SCREENSHOT_MODE = import.meta.env.DEV
  && normalizeBoolEnv(import.meta.env.VITE_SCREENSHOT_MODE);

export const isScreenshotMode = (): boolean => SCREENSHOT_MODE;

// ==========================================
// 📌 광고 ID 전역 설정 (환경별로 분리)
// ==========================================

/**
 * 앱인토스 광고 ID
 * - 개발: 테스트용 ID 사용
 * - 프로덕션: 실제 승인된 ID로 교체 필요
 */
export const APPS_IN_TOSS_AD_IDS = {
  // 리워드 광고 (되돌리기 충전)
  REWARD_UNDO: import.meta.env.MODE === 'production'
    ? 'ait.v2.live.f077d286af8d4300' // 앱인토스 리워드 광고 (되돌리기 기회 3회)
    : 'ait-ad-test-rewarded-id', // 테스트용 ID

  // 보상형 전면 광고 (게임오버 부활)
  REWARD_INTERSTITIAL_REVIVE: import.meta.env.MODE === 'production'
    ? '' // TODO: 앱인토스 보상형 전면 광고 승인 후 실제 ID로 교체
    : 'ait-ad-test-rewarded-interstitial-id', // 테스트용 ID

  // 전면형 광고 (게임 오버 후 등)
  INTERSTITIAL_GAMEOVER: import.meta.env.MODE === 'production'
    ? 'YOUR_PRODUCTION_INTERSTITIAL_AD_ID' // TODO: 승인 후 실제 ID로 교체
    : 'ait-ad-test-interstitial-id', // 테스트용 ID

  // 🆕 배너 광고 (하단 고정 배너)
  BANNER_BOTTOM: import.meta.env.MODE === 'production'
    ? 'YOUR_PRODUCTION_BANNER_AD_ID' // TODO: 앱인토스 배너 광고 승인 후 실제 ID로 교체
    : 'ait-ad-test-banner-id', // 테스트용 ID
} as const;

/**
 * Google AdSense 광고 ID (웹 환경)
 */
export const ADSENSE_AD_IDS = {
  // 배너 광고
  BANNER: 'ca-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // TODO: AdSense 승인 후 교체

  // 전면 광고
  INTERSTITIAL: 'ca-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ', // TODO: AdSense 승인 후 교체
} as const;

/**
 * Google AdMob 광고 ID (네이티브 앱 환경)
 */
export const ADMOB_AD_IDS = {
  // Android
  ANDROID: {
    // 프로덕션: 실제 광고 ID / 개발: 테스트 광고 ID
    REWARD: import.meta.env.MODE === 'production'
      ? 'ca-app-pub-5319827978116991/4879909972' // ✅ 사용자 제공 Android 리워드 광고 ID
      : 'ca-app-pub-3940256099942544/5224354917', // Google 공식 테스트 ID
    // 게임오버 부활용 보상형 전면 광고
    REWARD_INTERSTITIAL: import.meta.env.MODE === 'production'
      ? 'ca-app-pub-5319827978116991/5753319580' // ✅ 사용자 제공 Android 보상형 전면 광고 ID
      : 'ca-app-pub-3940256099942544/5354046379', // Google 공식 테스트 ID
    INTERSTITIAL: import.meta.env.MODE === 'production'
      ? 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ' // TODO: AdMob 승인 후 교체
      : 'ca-app-pub-3940256099942544/1033173712', // Google 공식 테스트 ID
    // 🆕 배너 광고 (프로덕션: 사용자 제공 실제 ID)
    BANNER: import.meta.env.MODE === 'production'
      ? 'ca-app-pub-5319827978116991/6947103527' // ✅ 사용자 제공 Android 배너 광고 ID
      : 'ca-app-pub-3940256099942544/6300978111', // Google 공식 테스트 배너 ID
  },

  // iOS
  IOS: {
    // 프로덕션: 실제 광고 ID / 개발: 테스트 광고 ID
    REWARD: import.meta.env.MODE === 'production'
      ? 'ca-app-pub-5319827978116991/7585964362' // ✅ 사용자 제공 iOS 리워드 광고 ID
      : 'ca-app-pub-3940256099942544/1712485313', // Google 공식 테스트 ID
    // ✅ 사용자 제공 iOS 보상형 전면 광고 ID (게임오버 부활)
    REWARD_INTERSTITIAL: import.meta.env.MODE === 'production'
      ? 'ca-app-pub-5319827978116991/1969153095'
      : 'ca-app-pub-3940256099942544/6978759866', // Google 공식 테스트 ID
    INTERSTITIAL: import.meta.env.MODE === 'production'
      ? 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ' // TODO: AdMob 승인 후 교체
      : 'ca-app-pub-3940256099942544/4411468910', // Google 공식 테스트 ID
    // 🆕 배너 광고 (프로덕션: 사용자 제공 실제 ID)
    BANNER: import.meta.env.MODE === 'production'
      ? 'ca-app-pub-5319827978116991/1116192349' // ✅ 사용자 제공 iOS 배너 광고 ID
      : 'ca-app-pub-3940256099942544/2934735716', // Google 공식 테스트 배너 ID
  },
} as const;

/**
 * Google 공식 테스트 광고 ID (모드/환경과 무관한 고정값)
 * - 시뮬레이터/에뮬레이터 검증 시 강제 사용
 */
export const ADMOB_TEST_AD_IDS = {
  ANDROID: {
    REWARD: 'ca-app-pub-3940256099942544/5224354917',
    REWARD_INTERSTITIAL: 'ca-app-pub-3940256099942544/5354046379',
    INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
    BANNER: 'ca-app-pub-3940256099942544/6300978111',
  },
  IOS: {
    REWARD: 'ca-app-pub-3940256099942544/1712485313',
    REWARD_INTERSTITIAL: 'ca-app-pub-3940256099942544/6978759866',
    INTERSTITIAL: 'ca-app-pub-3940256099942544/4411468910',
    BANNER: 'ca-app-pub-3940256099942544/2934735716',
  },
} as const;

// ==========================================
// 📌 플랫폼 감지 및 환경 타입
// ==========================================

/**
 * 광고 플랫폼 타입
 */
export type AdPlatform = 'apps-in-toss' | 'adsense' | 'admob-android' | 'admob-ios' | 'none';

/**
 * 현재 실행 환경의 광고 플랫폼 감지
 */
export function detectAdPlatform(): AdPlatform {
  // 1. 앱인토스 환경 체크 (우선순위 최상)
  // 토스 앱 내 실행 시: <appName>.apps.tossmini.com 또는 <appName>.private-apps.tossmini.com
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('.tossmini.com') || hostname.includes('apps-in-toss')) {
      return 'apps-in-toss';
    }
  }

  // 2. 네이티브 앱 체크 (Capacitor)
  if (isNativeApp()) {
    // iOS/Android 구분 (Capacitor 모듈 API 사용)
    const platform = getNativePlatform();
    if (platform === 'ios') {
      return 'admob-ios';
    } else if (platform === 'android') {
      return 'admob-android';
    }
  }

  // 3. 웹 환경 (AdSense)
  if (typeof window !== 'undefined' && !isNativeApp()) {
    return 'adsense';
  }

  return 'none';
}

/**
 * 현재 플랫폼
 */
export const CURRENT_AD_PLATFORM = detectAdPlatform();

const isConfiguredAdUnitId = (adId: string): boolean => {
  const normalized = adId.trim();
  if (!normalized) return false;
  if (normalized.includes('YOUR_PRODUCTION_')) return false;
  if (normalized.includes('XXXXXXXXXXXXXXXX')) return false;
  return true;
};

// ==========================================
// 📌 플랫폼별 광고 ID 가져오기
// ==========================================

/**
 * 리워드 광고 ID 가져오기 (플랫폼별 분기)
 */
export function getRewardAdId(): string {
  if (SCREENSHOT_MODE) return '';
  switch (CURRENT_AD_PLATFORM) {
    case 'apps-in-toss':
      return APPS_IN_TOSS_AD_IDS.REWARD_UNDO;

    case 'admob-android':
      return ADMOB_AD_IDS.ANDROID.REWARD;

    case 'admob-ios':
      return ADMOB_AD_IDS.IOS.REWARD;

    case 'adsense':
      // AdSense는 리워드 광고를 직접 지원하지 않으므로 대체 로직 필요
      console.warn('[AdConfig] AdSense는 리워드 광고를 지원하지 않습니다.');
      return '';

    default:
      console.warn('[AdConfig] 지원되지 않는 플랫폼입니다.');
      return '';
  }
}

/**
 * 전면 광고 ID 가져오기 (플랫폼별 분기)
 */
export function getInterstitialAdId(): string {
  if (SCREENSHOT_MODE) return '';
  switch (CURRENT_AD_PLATFORM) {
    case 'apps-in-toss':
      return APPS_IN_TOSS_AD_IDS.INTERSTITIAL_GAMEOVER;

    case 'admob-android':
      return ADMOB_AD_IDS.ANDROID.INTERSTITIAL;

    case 'admob-ios':
      return ADMOB_AD_IDS.IOS.INTERSTITIAL;

    case 'adsense':
      return ADSENSE_AD_IDS.INTERSTITIAL;

    default:
      return '';
  }
}

/**
 * 보상형 전면 광고 ID 가져오기 (게임오버 부활 전용)
 */
export function getRewardInterstitialAdId(): string {
  if (SCREENSHOT_MODE) return '';
  switch (CURRENT_AD_PLATFORM) {
    case 'apps-in-toss':
      return APPS_IN_TOSS_AD_IDS.REWARD_INTERSTITIAL_REVIVE;

    case 'admob-android':
      return ADMOB_AD_IDS.ANDROID.REWARD_INTERSTITIAL;

    case 'admob-ios':
      return ADMOB_AD_IDS.IOS.REWARD_INTERSTITIAL;

    default:
      return '';
  }
}

/**
 * 🆕 배너 광고 ID 가져오기 (플랫폼별 분기 - 토스 인앱 리워드와 동일한 패턴)
 */
export function getBannerAdId(): string {
  if (SCREENSHOT_MODE) return '';
  switch (CURRENT_AD_PLATFORM) {
    case 'apps-in-toss':
      return APPS_IN_TOSS_AD_IDS.BANNER_BOTTOM;

    case 'admob-android':
      return ADMOB_AD_IDS.ANDROID.BANNER;

    case 'admob-ios':
      return ADMOB_AD_IDS.IOS.BANNER;

    case 'adsense':
      return ADSENSE_AD_IDS.BANNER;

    default:
      console.warn('[AdConfig] 배너 광고 미지원 플랫폼');
      return '';
  }
}

// ==========================================
// 📌 광고 기능 지원 여부 체크
// ==========================================

/**
 * 리워드 광고 지원 여부
 */
export function isRewardAdSupported(): boolean {
  if (SCREENSHOT_MODE) return false;
  // 앱인토스, AdMob (iOS/Android)에서 리워드 광고 지원
  // (AdSense는 리워드 광고 미지원)
  return CURRENT_AD_PLATFORM === 'apps-in-toss'
    || CURRENT_AD_PLATFORM === 'admob-ios'
    || CURRENT_AD_PLATFORM === 'admob-android';
}

/**
 * 보상형 전면 광고 지원 여부
 */
export function isRewardInterstitialAdSupported(): boolean {
  if (SCREENSHOT_MODE) return false;

  const isSupportedPlatform = CURRENT_AD_PLATFORM === 'apps-in-toss'
    || CURRENT_AD_PLATFORM === 'admob-ios'
    || CURRENT_AD_PLATFORM === 'admob-android';

  if (!isSupportedPlatform) return false;

  return isConfiguredAdUnitId(getRewardInterstitialAdId());
}

/**
 * 배너 광고 지원 여부
 */
export function isBannerAdSupported(): boolean {
  if (SCREENSHOT_MODE) return false;
  // 모든 플랫폼에서 배너 광고 지원
  return CURRENT_AD_PLATFORM !== 'none';
}

/**
 * 광고 기능 전체 지원 여부
 */
export function isAdSupported(): boolean {
  if (SCREENSHOT_MODE) return false;
  return CURRENT_AD_PLATFORM !== 'none';
}

// ==========================================
// 📌 디버그 로깅
// ==========================================

if (import.meta.env.DEV) {
  console.log('[AdConfig] 광고 설정 초기화');
  console.log('[AdConfig] 현재 플랫폼:', CURRENT_AD_PLATFORM);
  console.log('[AdConfig] 리워드 광고 ID:', getRewardAdId());
  console.log('[AdConfig] 리워드 광고 지원:', isRewardAdSupported());
  console.log('[AdConfig] 보상형 전면 광고 ID:', getRewardInterstitialAdId());
  console.log('[AdConfig] 보상형 전면 광고 지원:', isRewardInterstitialAdSupported());
  console.log('[AdConfig] 배너 광고 ID:', getBannerAdId());
  console.log('[AdConfig] 배너 광고 지원:', isBannerAdSupported());
}
