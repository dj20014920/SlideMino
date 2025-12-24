/**
 * 랭킹 조회 API
 * Defense in Depth - Layer 3: SQL Injection 방어, Rate Limiting
 */

import { resetRankingsIfNewMonth } from '../utils/monthlyReset';

interface Env {
  DB: D1Database;
  RANKINGS_RATE_LIMITER?: RateLimit; // Rate Limiting 바인딩 (선택적)
}

/**
 * CORS 헤더 생성
 */
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';

  const allowedOrigins = [
    'https://slidemino.emozleep.space',
    'https://www.slidemino.emozleep.space',
  ];

  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    allowedOrigins.push(origin);
  }

  const isAllowed = allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed));

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://slidemino.emozleep.space',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * 에러 응답 생성
 */
function errorResponse(message: string, status: number, headers: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * OPTIONS 요청 처리 (CORS Preflight)
 */
export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
};

/**
 * GET 요청 처리: 랭킹 조회
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // ========== Rate Limiting (Layer 2) ==========
    if (env.RANKINGS_RATE_LIMITER) {
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.RANKINGS_RATE_LIMITER.limit({ key: clientIP });

      if (!success) {
        return errorResponse('Too many requests. Please try again later.', 429, corsHeaders);
      }
    }

    await resetRankingsIfNewMonth(env);

    // ========== 데이터베이스 조회 (Layer 4) ==========
    // Prepared statement로 SQL Injection 방어
    // 최신 50개 랭킹만 반환 (성능 최적화)
    try {
      const { results } = await env.DB.prepare(
        `SELECT name, score, difficulty
         FROM rankings
         ORDER BY score DESC
         LIMIT 50`
      ).all();

      return new Response(
        JSON.stringify(results),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=15', // 15초 캐시 (사용자 경험과 성능 균형)
          },
        }
      );

    } catch (dbError) {
      console.error('Database error:', dbError);
      return errorResponse('Failed to fetch rankings', 500, corsHeaders);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
};
