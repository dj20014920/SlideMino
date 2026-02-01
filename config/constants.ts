/**
 * 애플리케이션 전역 상수 관리
 * DRY 원칙 준수 및 환경별 설정 중앙화
 */

// ==========================================
// 도메인 & API 엔드포인트
// ==========================================

/** 프로덕션 도메인 (www 제외) */
export const DOMAIN = 'slidemino.emozleep.space' as const;

/** 프로덕션 전체 URL */
export const BASE_URL = `https://${DOMAIN}` as const;

/** www 포함 도메인 (CORS 허용용) */
export const WWW_DOMAIN = `www.${DOMAIN}` as const;
export const WWW_URL = `https://${WWW_DOMAIN}` as const;

// ==========================================
// CORS 허용 Origin 목록
// ==========================================

export const ALLOWED_ORIGINS = [
    BASE_URL,
    WWW_URL,
    // Capacitor/Ionic native app origins (WebView)
    'capacitor://localhost',
    'ionic://localhost',
    // Some WebView stacks may report as http(s) localhost
    'http://localhost',
    'https://localhost',
] as const;

// ==========================================
// Contact 정보
// ==========================================

export const CONTACT_EMAIL = 'studio@emozleep.space' as const;

// ==========================================
// SEO 관련
// ==========================================

export const OG_IMAGE_PATH = '/og-image.png' as const;
export const OG_IMAGE_URL = `${BASE_URL}${OG_IMAGE_PATH}` as const;

// ==========================================
// 타입 정의
// ==========================================

export type AllowedOrigin = typeof ALLOWED_ORIGINS[number];
