/**
 * i18next 설정 파일
 * 다국어 지원을 위한 i18next 초기화 및 설정을 담당합니다.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  NAMESPACES,
  type SupportedLanguage,
} from './constants';

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

// i18next 초기화
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    ns: [...NAMESPACES],
    defaultNS: 'common',

    // LanguageDetector 설정
    detection: {
      order: ['navigator', 'localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },

    interpolation: {
      escapeValue: false, // React는 기본적으로 XSS 방지를 함
    },

    react: {
      useSuspense: false, // Suspense 사용 안 함 (필요시 true로 변경)
    },

    // 개발 환경에서만 디버그 모드 활성화
    debug: process.env.NODE_ENV === 'development',
  });

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
