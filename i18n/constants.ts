/**
 * 국제화(i18n) 상수 정의
 * 지원 언어 목록과 메타데이터를 관리합니다.
 */

export const SUPPORTED_LANGUAGES = ['ko', 'en', 'ja', 'zh'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export interface LanguageConfig {
  code: SupportedLanguage;
  displayName: string;
  flag: string;
}

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  ko: {
    code: 'ko',
    displayName: '한국어',
    flag: '🇰🇷',
  },
  en: {
    code: 'en',
    displayName: 'English',
    flag: '🇺🇸',
  },
  ja: {
    code: 'ja',
    displayName: '日本語',
    flag: '🇯🇵',
  },
  zh: {
    code: 'zh',
    displayName: '中文',
    flag: '🇨🇳',
  },
};

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
export const LANGUAGE_STORAGE_KEY = 'slidemino-language';

export const NAMESPACES = ['common', 'game', 'modals', 'pages'] as const;
export type Namespace = typeof NAMESPACES[number];

export const normalizeLanguage = (language?: string): SupportedLanguage => {
  if (!language) return DEFAULT_LANGUAGE;
  const base = language.toLowerCase().split('-')[0] as SupportedLanguage;
  return SUPPORTED_LANGUAGES.includes(base) ? base : DEFAULT_LANGUAGE;
};
