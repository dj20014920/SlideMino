import { Capacitor } from '@capacitor/core';

export type NativePlatform = 'web' | 'ios' | 'android';

/**
 * 앱 배포 스토어 타입
 * - 'google': Google Play Store
 * - 'appintos': 앱인토스 (ONE store 등 국내 스토어)
 * - 'apple': Apple App Store
 * - 'web': 웹 브라우저
 */
export type AppStore = 'google' | 'appintos' | 'apple' | 'web';

export const getNativePlatform = (): NativePlatform => {
  try {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios' || platform === 'android') return platform;
    return 'web';
  } catch {
    return 'web';
  }
};

export const isNativeApp = (): boolean => getNativePlatform() !== 'web';

export const isAndroidApp = (): boolean => getNativePlatform() === 'android';

const isIOSLikeWebDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ reports MacIntel; touch point count distinguishes it from macOS.
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
};

const IOS_IN_APP_BROWSER_UA_RE = /KAKAOTALK|FBAN|FBAV|Instagram|Line|NAVER|DaumApps|Twitter|MicroMessenger/i;

/**
 * iOS 인앱 브라우저(카카오톡/페이스북 등) 여부를 추정.
 * Safe-area env 값만으로 상단 chrome 높이가 반영되지 않는 케이스를 보정할 때 사용한다.
 */
export const isLikelyIOSInAppBrowser = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (isNativeApp()) return false;
  if (!isIOSLikeWebDevice()) return false;

  const ua = navigator.userAgent;
  const isStandalonePwa = window.matchMedia?.('(display-mode: standalone)').matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isStandalonePwa) return false;

  if (IOS_IN_APP_BROWSER_UA_RE.test(ua)) return true;

  // iOS WebView UA는 대개 AppleWebKit 이면서 Safari 토큰이 빠진다.
  const hasAppleWebKit = /AppleWebKit/i.test(ua);
  const hasSafariToken = /Safari/i.test(ua);
  return hasAppleWebKit && !hasSafariToken;
};

/**
 * 앱인토스 환경에서 실행 중인지 런타임 감지
 * 토스 앱 내에서 실행될 때 hostname이 다음과 같음:
 * - 실제 서비스: <appName>.apps.tossmini.com
 * - 테스트 환경: <appName>.private-apps.tossmini.com
 */
const isRunningInTossApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.includes('.tossmini.com') || hostname.includes('apps-in-toss');
};

/**
 * 앱인토스 빌드 여부 (빌드 타임 환경 변수 또는 런타임 감지)
 * - 빌드 시 VITE_APP_STORE=appintos 로 설정하면 앱인토스 전용 빌드
 * - 런타임에 토스 앱 WebView 내에서 실행 시 자동 감지
 */
export const getAppStore = (): AppStore => {
  // 런타임 감지: 토스 앱 WebView 내에서 실행 중인 경우
  if (isRunningInTossApp()) return 'appintos';

  const store = import.meta.env.VITE_APP_STORE as string | undefined;
  if (store === 'appintos') return 'appintos';
  if (store === 'google') return 'google';
  if (store === 'apple') return 'apple';

  // 환경변수 미설정 시 플랫폼 기반 기본값
  const platform = getNativePlatform();
  if (platform === 'ios') return 'apple';
  if (platform === 'android') return 'google';
  return 'web';
};

/**
 * 앱인토스 스토어 전용 빌드 여부 (런타임 자동 감지 포함)
 */
export const isAppIntoS = (): boolean => getAppStore() === 'appintos';
