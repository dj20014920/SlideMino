/** User-Agent 기반 네이티브 앱 여부 판정 (서버측, 클라이언트 입력을 신뢰하지 않음) */
export function isNativeAppRequest(request: Request): boolean {
  const ua = (request.headers.get('User-Agent') ?? '').toLowerCase();
  // 최소 길이 검증: 극단적으로 짧거나 비정상적인 UA 차단
  if (ua.length < 10) return false;
  // Capacitor/iOS WebView 또는 Android WebView에서 오는 요청만 네이티브로 인정
  return ua.includes('capacitor') || ua.includes('slidemino')
    || (ua.includes('mobile') && (ua.includes('wv') || ua.includes('crosswalk')));
}