/**
 * 랭킹 조회 API
 * Defense in Depth - Layer 3: SQL Injection 방어, Rate Limiting
 */

import { resetSeasonIfNeeded } from '../utils/seasonReset';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { validateDifficulty, validateScore } from '../utils/validation';
import { buildCorsHeaders } from '../utils/cors';

interface Env {
  DB: D1Database;
  RANKINGS_RATE_LIMITER?: RateLimit; // Rate Limiting 바인딩 (선택적)
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
    headers: buildCorsHeaders(context.request, 'GET, OPTIONS'),
  });
};

/**
 * GET 요청 처리: 랭킹 조회
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
      const { allowed } = await checkRateLimit(env.DB, `rankings:${clientIP}`, 120, 60);
      if (!allowed) {
        return errorResponse('Too many requests. Please try again later.', 429, corsHeaders);
      }
    }

    await resetSeasonIfNeeded(env);

    const requestUrl = new URL(request.url);
    const mode = requestUrl.searchParams.get('mode');

    // mode=live: 현재 점수 기준 실시간 순위 계산 (게임 중 헤더 표시용)
    if (mode === 'live') {
      const difficultyParam = requestUrl.searchParams.get('difficulty');
      const scoreParam = requestUrl.searchParams.get('score');

      if (!difficultyParam || scoreParam === null) {
        return errorResponse('Missing difficulty or score', 400, corsHeaders);
      }

      const difficultyValidation = validateDifficulty(difficultyParam);
      if (!difficultyValidation.valid) {
        return errorResponse(difficultyValidation.error ?? 'Invalid difficulty', 400, corsHeaders);
      }

      const parsedScore = Number(scoreParam);
      if (!Number.isFinite(parsedScore)) {
        return errorResponse('Score must be a number', 400, corsHeaders);
      }

      const scoreValidation = validateScore(parsedScore);
      if (!scoreValidation.valid) {
        return errorResponse(scoreValidation.error ?? 'Invalid score', 400, corsHeaders);
      }

      const difficulty = difficultyValidation.value!;
      const score = scoreValidation.value!;

      try {
        // 3개의 쿼리를 병렬 실행: 상위 점수 수, 바로 윗 점수, 해당 난이도 총 엔트리 수
        const [higherCountResult, nextHigherScoreResult, totalEntriesResult] = await Promise.all([
          env.DB.prepare(
            `SELECT COUNT(*) as higher_count
             FROM rankings
             WHERE difficulty = ? AND score > ?`
          ).bind(difficulty, score).first<{ higher_count: number | string }>(),

          env.DB.prepare(
            `SELECT MIN(score) as next_higher_score
             FROM rankings
             WHERE difficulty = ? AND score > ?`
          ).bind(difficulty, score).first<{ next_higher_score: number | null }>(),

          env.DB.prepare(
            `SELECT COUNT(*) as total
             FROM rankings
             WHERE difficulty = ?`
          ).bind(difficulty).first<{ total: number | string }>(),
        ]);

        const higherCount = Number(higherCountResult?.higher_count ?? 0);
        const nextHigherScore = typeof nextHigherScoreResult?.next_higher_score === 'number'
          ? nextHigherScoreResult.next_higher_score
          : null;
        const totalEntries = Number(totalEntriesResult?.total ?? 0);

        const rank = Math.max(1, higherCount + 1);
        // 동점이면 같은 순위이므로 nextHigherScore에 도달하면 순위 상승 (+1 불필요)
        const pointsToNext = nextHigherScore === null ? 0 : Math.max(0, nextHigherScore - score);

        return new Response(
          JSON.stringify({
            rank,
            pointsToNext,
            totalEntries,
            difficulty,
            score,
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
      } catch (dbError) {
        console.error('Database error (live rank):', dbError);
        return errorResponse('Failed to calculate live rank', 500, corsHeaders);
      }
    }

    // ========== 데이터베이스 조회 (Layer 4) ==========
    // Prepared statement로 SQL Injection 방어
    try {
      const { results } = await env.DB.prepare(
        `SELECT name, score, difficulty, timestamp
         FROM rankings
         ORDER BY score DESC, updated_at ASC
         LIMIT 100`
      ).all();

      // 구버전 클라이언트(6e7394a) 호환: 배열을 직접 반환한다.
      // 현재 클라이언트의 rankingService.getLeaderboard()는 배열/객체 양쪽 모두 파싱 가능.
      // 시즌 정보는 클라이언트가 seasonService.getSeasonCountdown()으로 독립 계산한다.
      return new Response(
        JSON.stringify(results),
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
      return errorResponse('Failed to fetch rankings', 500, corsHeaders);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
};
