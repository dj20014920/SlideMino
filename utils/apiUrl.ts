/**
 * API URL 헬퍼 — 네이티브(Capacitor) 빌드에서 올바른 origin을 붙여주는 공용 유틸리티
 *
 * 웹에서는 상대 경로(`/api/...`)를 그대로 사용하고,
 * 네이티브에서는 프로덕션 origin을 prefix로 붙인다.
 */
import { isNativeApp } from './platform';
import { BASE_URL } from '../config/constants';

const API_BASE_URL: string = (() => {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!fromEnv) return BASE_URL;
  return fromEnv.replace(/\/+$/, '');
})();

/**
 * API 경로에 적절한 origin을 붙여 반환한다.
 * @param path - `/api/...` 형태의 상대 경로
 */
export const getApiUrl = (path: string): string => {
  if (isNativeApp()) return `${API_BASE_URL}${path}`;
  return path;
};
