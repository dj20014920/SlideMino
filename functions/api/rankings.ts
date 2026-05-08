/**
 * 랭킹 조회 API
 * Defense in Depth - Layer 3: SQL Injection 방어, Rate Limiting
 */

import { getSeasonBoundaries, resetSeasonIfNeeded } from '../utils/seasonReset';
import { checkConfiguredRateLimit, getClientIp, RATE_LIMITS } from '../utils/rateLimit';
import { validateDifficulty, validateScore } from '../utils/validation';
import { buildCorsHeaders } from '../utils/cors';

interface Env {
  DB: D1Database;
  RANKINGS_RATE_LIMITER?: RateLimit; // Rate Limiting 바인딩 (선택적)
}

const VALID_BOARD_SIZES = new Set(['4', '5', '7', '8', '10']);

const normalizeBoardTab = (rawTab: string | null): 'ALL' | string => {
  if (!rawTab) return 'ALL';
  const trimmed = rawTab.trim().toUpperCase();
  if (trimmed === 'ALL') return 'ALL';
  const match = trimmed.match(/^(\d+)(?:X\1)?$/i);
  if (!match) return 'ALL';
  const board = match[1];
  return VALID_BOARD_SIZES.has(board) ? board : 'ALL';
};

type LeaderboardRow = {
  name: string;
  score: number;
  difficulty: string;
  timestamp: number;
  levelBadge: string | null;
};

type MergedScoreBinding = string | number;

function buildMergedScoresCte(
  seasonId: string,
  seasonStartMs: number,
  seasonEndMs: number,
  boardTab: 'ALL' | string
): { cteSql: string; bindings: MergedScoreBinding[] } {
  const memberBestConditions = ['rmb.season_id = ?'];
  const legacyConditions = [
    'r.updated_at >= ?',
    'r.updated_at <= ?',
    `r.difficulty IN ('4', '5', '7', '8', '10')`,
  ];
  const memberBestBindings: MergedScoreBinding[] = [seasonId];
  const legacyBindings: MergedScoreBinding[] = [seasonStartMs, seasonEndMs];

  if (boardTab !== 'ALL') {
    memberBestConditions.push('rmb.board_size = ?');
    legacyConditions.push('r.difficulty = ?');
    memberBestBindings.push(boardTab);
    legacyBindings.push(boardTab);
  }

  return {
    cteSql: `WITH merged_scores AS (
       SELECT
         rmb.name,
         rmb.best_score AS score,
         rmb.board_size AS difficulty,
         rmb.updated_at AS timestamp,
         rmb.session_id,
         rmb.member_key,
          0 AS source_priority -- 동일 기록 동률 시 집계 테이블(ranking_member_best) 우선
       FROM ranking_member_best rmb
       WHERE ${memberBestConditions.join(' AND ')}
       UNION ALL
       SELECT
         r.name,
         r.score,
         r.difficulty,
         r.updated_at AS timestamp,
         r.session_id,
         COALESCE(NULLIF(r.install_id_hash, ''), 'legacy:' || r.session_id) AS member_key,
          1 AS source_priority -- legacy(rankings)는 fallback 소스로 사용
       FROM rankings r
       WHERE ${legacyConditions.join(' AND ')}
     )`,
    bindings: [...memberBestBindings, ...legacyBindings],
  };
}

async function fetchMergedLeaderboard(
  env: Env,
  seasonId: string,
  seasonStartMs: number,
  seasonEndMs: number,
  boardTab: 'ALL' | string
): Promise<LeaderboardRow[]> {
  const { cteSql, bindings } = buildMergedScoresCte(seasonId, seasonStartMs, seasonEndMs, boardTab);
  const partitionBy = boardTab === 'ALL' ? 'member_key' : 'difficulty, member_key';
  const query = await env.DB.prepare(
    `${cteSql},
     deduped AS (
       SELECT
         ms.name,
         ms.score,
         ms.difficulty,
         ms.timestamp,
          ms.session_id,
          ms.source_priority,
          ROW_NUMBER() OVER (
            PARTITION BY ${partitionBy}
            ORDER BY
              ms.score DESC,
              ms.timestamp ASC,
              ms.source_priority ASC,
              ms.difficulty ASC,
              ms.name ASC,
              ms.session_id ASC
          ) AS row_num
        FROM merged_scores ms
      )
      SELECT d.name, d.score, d.difficulty, d.timestamp, rb.level_badge AS levelBadge
      FROM deduped d
      LEFT JOIN ranking_badges rb ON rb.session_id = d.session_id
      WHERE d.row_num = 1
      ORDER BY
        d.score DESC,
        d.timestamp ASC,
        d.source_priority ASC,
        d.difficulty ASC,
        d.name ASC,
        d.session_id ASC
      LIMIT 100`
  ).bind(...bindings).all<LeaderboardRow>();
  return query.results ?? [];
}

type LiveRankMetrics = {
  higher_count: number | string;
  next_higher_score: number | null;
  total: number | string;
};

async function fetchLiveRankMetrics(
  env: Env,
  seasonId: string,
  seasonStartMs: number,
  seasonEndMs: number,
  difficulty: string,
  score: number
): Promise<LiveRankMetrics | null> {
  const { cteSql, bindings } = buildMergedScoresCte(seasonId, seasonStartMs, seasonEndMs, difficulty);
  return env.DB.prepare(
    `${cteSql},
     deduped AS (
       SELECT
          ms.score,
           ROW_NUMBER() OVER (
             PARTITION BY ms.difficulty, ms.member_key
             ORDER BY
               ms.score DESC,
               ms.timestamp ASC,
               ms.source_priority ASC,
               ms.difficulty ASC,
               ms.name ASC,
               ms.session_id ASC
           ) AS row_num
         FROM merged_scores ms
       )
     SELECT
       SUM(CASE WHEN row_num = 1 AND score > ? THEN 1 ELSE 0 END) AS higher_count,
       MIN(CASE WHEN row_num = 1 AND score > ? THEN score ELSE NULL END) AS next_higher_score,
       SUM(CASE WHEN row_num = 1 THEN 1 ELSE 0 END) AS total
     FROM deduped`
  ).bind(...bindings, score, score).first<LiveRankMetrics>();
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
      const { allowed } = await checkConfiguredRateLimit(env.DB, `rankings:${clientIP}`, RATE_LIMITS.RANKINGS_READ);
      if (!allowed) {
        return errorResponse('Too many requests. Please try again later.', 429, corsHeaders);
      }
    }

    await resetSeasonIfNeeded(env);

    const requestUrl = new URL(request.url);
    const mode = requestUrl.searchParams.get('mode');
    const boardTab = normalizeBoardTab(requestUrl.searchParams.get('tab'));
    const { seasonId, seasonStartMs, seasonEndMs } = getSeasonBoundaries(new Date());

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
        const metrics = await fetchLiveRankMetrics(env, seasonId, seasonStartMs, seasonEndMs, difficulty, score);
        const higherCount = Number(metrics?.higher_count ?? 0);
        const nextHigherScore = typeof metrics?.next_higher_score === 'number'
          ? metrics.next_higher_score
          : null;
        const totalEntries = Number(metrics?.total ?? 0);

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
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS ranking_badges (
           session_id TEXT PRIMARY KEY,
           level_badge TEXT NOT NULL,
           updated_at INTEGER NOT NULL
         )`
      ).run();

      const results = await fetchMergedLeaderboard(env, seasonId, seasonStartMs, seasonEndMs, boardTab);

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
