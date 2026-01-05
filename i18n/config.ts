/**
 * i18next 설정 파일
 * 다국어 지원을 위한 i18next 초기화 및 설정을 담당합니다.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  NAMESPACES,
  type SupportedLanguage,
} from './constants';
import { detectDeviceLanguage, detectLanguageSync } from '../utils/deviceLanguage';

// 각 언어별 번역 리소스 import
import koCommon from '../public/locales/ko/common.json';
import koGame from '../public/locales/ko/game.json';
import koModals from '../public/locales/ko/modals.json';
import koPages from '../public/locales/ko/pages.json';

import enCommon from '../public/locales/en/common.json';
import enGame from '../public/locales/en/game.json';
import enModals from '../public/locales/en/modals.json';
import enPages from '../public/locales/en/pages.json';

import jaCommon from '../public/locales/ja/common.json';
import jaGame from '../public/locales/ja/game.json';
import jaModals from '../public/locales/ja/modals.json';
import jaPages from '../public/locales/ja/pages.json';

import zhCommon from '../public/locales/zh/common.json';
import zhGame from '../public/locales/zh/game.json';
import zhModals from '../public/locales/zh/modals.json';
import zhPages from '../public/locales/zh/pages.json';

// 리소스 구조 정의
const resources = {
  ko: {
    common: koCommon,
    game: koGame,
    modals: koModals,
    pages: koPages,
  },
  en: {
    common: enCommon,
    game: enGame,
    modals: enModals,
    pages: enPages,
  },
  ja: {
    common: jaCommon,
    game: jaGame,
    modals: jaModals,
    pages: jaPages,
  },
  zh: {
    common: zhCommon,
    game: zhGame,
    modals: zhModals,
    pages: zhPages,
  },
} as const;

/**
 * i18n 초기화 상태
 */
let i18nInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * i18next를 동기적으로 초기화합니다.
 * 웹 환경이나 빠른 초기화가 필요한 경우 사용합니다.
 */
const initI18nSync = (language: SupportedLanguage): void => {
  if (i18nInitialized) return;

  i18n.use(initReactI18next).init({
    resources,
    lng: language, // 감지된 언어로 직접 설정
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    ns: [...NAMESPACES],
    defaultNS: 'common',

    interpolation: {
      escapeValue: false, // React는 기본적으로 XSS 방지를 함
    },

    react: {
      useSuspense: false, // Suspense 사용 안 함 (필요시 true로 변경)
    },

    // 개발 환경에서만 디버그 모드 활성화
    debug: process.env.NODE_ENV === 'development',
  });

  i18nInitialized = true;
  console.log('[i18n] Initialized with language:', language);
};

/**
 * i18next를 비동기적으로 초기화합니다.
 * 네이티브 앱에서 기기 언어를 정확하게 감지한 후 초기화합니다.
 */
export const initI18n = async (): Promise<void> => {
  if (i18nInitialized) return;

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      // 기기 언어 감지 (네이티브에서는 Capacitor Device 사용)
      const detectedLanguage = await detectDeviceLanguage();
      console.log('[i18n] Detected device language:', detectedLanguage);

      // 감지된 언어로 i18n 초기화
      initI18nSync(detectedLanguage);

      // 감지된 언어를 localStorage에 저장 (다음 번 빠른 로드를 위해)
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, detectedLanguage);
      } catch {
        // localStorage 접근 실패 시 무시
      }
    } catch (error) {
      console.error('[i18n] Error during initialization:', error);
      // 오류 발생 시 기본 언어로 초기화
      initI18nSync(DEFAULT_LANGUAGE);
    }
  })();

  return initializationPromise;
};

/**
 * i18n이 이미 초기화되었는지 확인합니다.
 */
export const isI18nInitialized = (): boolean => i18nInitialized;

/**
 * 동기적 폴백 초기화 (앱이 빠르게 시작해야 하는 경우)
 * 웹 환경에서 사용하거나 비동기 초기화를 기다릴 수 없는 경우 사용
 */
export const initI18nFallback = (): void => {
  if (i18nInitialized) return;
  const syncLanguage = detectLanguageSync();
  initI18nSync(syncLanguage);
};

export default i18n;

// TypeScript를 위한 타입 선언
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof enCommon;
      game: typeof enGame;
      modals: typeof enModals;
      pages: typeof enPages;
    };
  }
}
