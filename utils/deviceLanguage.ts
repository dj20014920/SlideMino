/**
 * 디바이스 언어 감지 유틸리티
 * 네이티브 앱에서는 Capacitor Device 플러그인을 사용하고,
 * 웹에서는 navigator.language를 사용합니다.
 */

import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LEGACY_LANGUAGE_STORAGE_KEY,
  type SupportedLanguage,
} from '../i18n/constants';

/**
 * 언어 코드를 지원되는 언어로 정규화합니다.
 * 예: 'ko-KR' -> 'ko', 'zh-Hans' -> 'zh'
 */
const normalizeToSupportedLanguage = (languageCode: string): SupportedLanguage => {
  if (!languageCode) return DEFAULT_LANGUAGE;

  // 기본 언어 코드 추출 (예: 'ko-KR' -> 'ko', 'zh-Hans-CN' -> 'zh')
  const base = languageCode.toLowerCase().split(/[-_]/)[0] as SupportedLanguage;

  return SUPPORTED_LANGUAGES.includes(base) ? base : DEFAULT_LANGUAGE;
};

/**
 * 네이티브 앱인지 확인합니다.
 */
const isNativePlatform = (): boolean => {
  try {
    return Capacitor.getPlatform() !== 'web';
  } catch {
    return false;
  }
};

/**
 * 사용자가 명시적으로 선택한 언어 오버라이드 값을 읽습니다.
 * 과거 자동 감지 캐시 키는 무시해서 현재 기기 언어가 다시 반영되도록 합니다.
 */
const getStoredLanguageOverride = (): SupportedLanguage | null => {
  try {
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && SUPPORTED_LANGUAGES.includes(savedLanguage as SupportedLanguage)) {
      return savedLanguage as SupportedLanguage;
    }

    // 레거시 키는 과거 자동 감지 캐시로 사용되었기 때문에 더 이상 신뢰하지 않습니다.
    if (localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY)) {
      localStorage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY);
    }
  } catch {
    // localStorage 접근 실패 시 무시
  }

  return null;
};

/**
 * 사용자가 메뉴에서 직접 고른 언어만 별도로 저장합니다.
 */
export const saveLanguageOverride = (language: SupportedLanguage): void => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    localStorage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY);
  } catch {
    // localStorage 접근 실패 시 무시
  }
};

/**
 * 디바이스의 시스템 언어를 감지합니다.
 *
 * 우선순위:
 * 1. 사용자가 직접 선택한 언어 (localStorage)
 * 2. 네이티브 디바이스 언어 (Capacitor Device)
 * 3. 브라우저 언어 (navigator.language)
 * 4. 기본 언어 (영어)
 */
export const detectDeviceLanguage = async (): Promise<SupportedLanguage> => {
  // 1. 먼저 사용자가 직접 선택한 언어가 있는지 확인
  const savedLanguage = getStoredLanguageOverride();
  if (savedLanguage) {
    return savedLanguage;
  }

  // 2. 네이티브 플랫폼에서는 Capacitor Device 사용
  if (isNativePlatform()) {
    try {
      const languageInfo = await Device.getLanguageCode();
      // languageInfo.value는 'ko', 'en', 'ja' 등의 언어 코드
      if (languageInfo.value) {
        const detectedLang = normalizeToSupportedLanguage(languageInfo.value);
        console.log('[i18n] Native device language detected:', languageInfo.value, '->', detectedLang);
        return detectedLang;
      }
    } catch (error) {
      console.warn('[i18n] Failed to get device language code:', error);
    }
  }

  // 3. 웹 또는 네이티브 실패 시 navigator.language 사용
  try {
    const browserLang = navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage;
    if (browserLang) {
      const detectedLang = normalizeToSupportedLanguage(browserLang);
      console.log('[i18n] Browser language detected:', browserLang, '->', detectedLang);
      return detectedLang;
    }
  } catch {
    // navigator 접근 실패 시 무시
  }

  // 4. 기본 언어 반환
  console.log('[i18n] Using default language:', DEFAULT_LANGUAGE);
  return DEFAULT_LANGUAGE;
};

/**
 * 동기적으로 언어를 감지합니다 (웹 전용, 네이티브에서는 기본값 반환)
 * i18n 초기화 전에 동기적으로 언어가 필요한 경우 사용
 */
export const detectLanguageSync = (): SupportedLanguage => {
  // localStorage에서 저장된 언어 확인
  const savedLanguage = getStoredLanguageOverride();
  if (savedLanguage) {
    return savedLanguage;
  }

  // 브라우저 언어 확인
  try {
    const browserLang = navigator.language;
    if (browserLang) {
      return normalizeToSupportedLanguage(browserLang);
    }
  } catch {
    // 무시
  }

  return DEFAULT_LANGUAGE;
};
