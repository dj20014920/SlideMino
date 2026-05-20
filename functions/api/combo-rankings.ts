/**
 * 콤보 랭킹 조회 API
 * Defense in Depth - Layer 3: SQL Injection 방어, Rate Limiting
 */

import { getSeasonBoundaries, resetSeasonIfNeeded } from '../utils/seasonReset';
import { checkConfiguredRateLimit, getClientIp, RATE_LIMITS } from '../utils/rateLimit';
import { buildCorsHeaders } from '../utils/cors';

interface Env {
  DB: D1Database;
  RANKINGS_RATE_LIMITER?: RateLimit;
}

type ComboRankingRow = {
  name: string;
  best_combo_multiplier: number;
  best_combo_count: number;
  best_score: number;
  game_mode: string;
  updated_at: number;
};

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
    headers: buildCorsHeaders(context.request, 'GET, OPTIONS'),
  });
};

/**
 * GET 요청 처리: 콤보 랭킹 조회
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = buildCorsHeaders(request, 'GET, OPTIONS');

  try {
    // ========== Rate Limiting (Layer 2) ==========
    const clientIP = getClientIp(request);
    if (env.RANKINGS_RATE_LIMITER) {
      const { success } = await env.RANKINGS_RATE_LIMITER.limit({ key: clientIP });

      if (!success) {
        return errorResponse('Too many requests. Please try again later.', 429, corsHeaders);
      }
    } else {
      const { allowed } = await checkConfiguredRateLimit(env.DB, `combo-rankings:${clientIP}`, RATE_LIMITS.COMBO_RANKINGS_READ);
      if (!allowed) {
        return errorResponse('Too many requests. Please try again later.', 429, corsHeaders);
      }
    }

    await resetSeasonIfNeeded(env);

    const requestUrl = new URL(request.url);
    const tab = requestUrl.searchParams.get('tab') || 'ALL';
    const { seasonId } = getSeasonBoundaries(new Date());
    const seasonParam = requestUrl.searchParams.get('season') || seasonId;

    // ========== 데이터베이스 조회 (Layer 4) ==========
    // Prepared statement로 SQL Injection 방어
    try {
      const query = `SELECT name, best_combo_multiplier, best_combo_count, best_score, game_mode, updated_at
FROM combo_rankings
WHERE season_id = ?1
ORDER BY best_combo_count DESC, best_combo_multiplier DESC, best_score DESC, updated_at ASC
LIMIT 100`;

      const { results } = await env.DB.prepare(query).bind(seasonParam).all<ComboRankingRow>();

      const rankings = (results ?? []).map((row: ComboRankingRow, index: number) => ({
        rank: index + 1,
        name: row.name,
        multiplier: row.best_combo_multiplier,
        comboCount: row.best_combo_count,
        score: row.best_score,
        gameMode: row.game_mode,
        updatedAt: row.updated_at,
      }));

      return new Response(
        JSON.stringify({ rankings }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );

    } catch (dbError) {
      console.error('Database error:', dbError);
      return errorResponse('Failed to fetch combo rankings', 500, corsHeaders);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
};
