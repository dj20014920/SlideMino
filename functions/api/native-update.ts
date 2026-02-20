/**
 * 네이티브 업데이트 정책 API
 * - iOS 최신 App Store 버전을 서버에서 조회해 반환한다.
 * - 클라이언트(WebView)는 이 값을 현재 앱 버전과 비교해 업데이트 필요 여부를 판단한다.
 */

import { buildCorsHeaders } from '../utils/cors';

interface AppleLookupResponse {
  resultCount?: number;
  results?: Array<{
    version?: string;
    trackId?: number | string;
    trackViewUrl?: string;
  }>;
}

const IOS_APP_STORE_ID = '6757861065';
const IOS_LOOKUP_URL = `https://itunes.apple.com/lookup?id=${IOS_APP_STORE_ID}&country=kr`;
const IOS_DEFAULT_TRACK_URL = `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`;

const buildFallbackPayload = (): Record<string, unknown> => ({
  ios: {
    latestVersion: null,
    trackId: IOS_APP_STORE_ID,
    trackViewUrl: IOS_DEFAULT_TRACK_URL,
  },
});

/**
 * OPTIONS 요청 처리 (CORS Preflight)
 */
export const onRequestOptions: PagesFunction = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request, 'GET, OPTIONS'),
  });
};

/**
 * GET 요청 처리: iOS 최신 버전 조회
 */
export const onRequestGet: PagesFunction = async (context) => {
  const corsHeaders = buildCorsHeaders(context.request, 'GET, OPTIONS');

  try {
    const response = await fetch(IOS_LOOKUP_URL, {
      headers: {
        Accept: 'application/json',
      },
      cf: {
        cacheTtl: 300,
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify(buildFallbackPayload()),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    const parsed = await response.json() as AppleLookupResponse;
    const first = Array.isArray(parsed.results) ? parsed.results[0] : undefined;

    const latestVersion = typeof first?.version === 'string' ? first.version.trim() : null;
    const trackId = first?.trackId != null ? String(first.trackId) : IOS_APP_STORE_ID;
    const trackViewUrl = typeof first?.trackViewUrl === 'string'
      ? first.trackViewUrl
      : IOS_DEFAULT_TRACK_URL;

    return new Response(
      JSON.stringify({
        ios: {
          latestVersion,
          trackId,
          trackViewUrl,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch {
    return new Response(
      JSON.stringify(buildFallbackPayload()),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
};
