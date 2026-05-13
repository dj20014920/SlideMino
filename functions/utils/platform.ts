const NATIVE_APP_ORIGINS = new Set([
  'capacitor://localhost',
  'ionic://localhost',
  'https://localhost',
]);

const normalizeOrigin = (origin: string | null): string | null => {
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
};

/** 네이티브 앱 WebView 요청 여부 판정 */
export function isNativeAppRequest(request: Request): boolean {
  const origin = normalizeOrigin(request.headers.get('Origin'));
  if (origin && NATIVE_APP_ORIGINS.has(origin)) return true;

  const ua = (request.headers.get('User-Agent') ?? '').toLowerCase();
  // 최소 길이 검증: 극단적으로 짧거나 비정상적인 UA 차단
  if (ua.length < 10) return false;
  // Origin이 없는 구형 WebView/네이티브 브리지 요청을 위한 보조 판정
  return ua.includes('capacitor') || ua.includes('slidemino')
    || (ua.includes('mobile') && (ua.includes('wv') || ua.includes('crosswalk')));
}
