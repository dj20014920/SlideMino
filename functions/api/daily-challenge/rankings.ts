/**
 * 데일리 챌린지 랭킹 조회 API
 *
 * - 날짜별 랭킹 TOP 100 반환
 * - 특정 유저의 기록 포함
 * - 최근 7일 히스토리 지원
 */

import { buildCorsHeaders } from '../../utils/cors';
import { checkConfiguredRateLimit, getClientIp, RATE_LIMITS } from '../../utils/rateLimit';
import { hashInstallId } from '../../utils/hash';

interface Env {
  DB: D1Database;
  ANALYTICS_HASH_SALT?: string;
}

// KST = UTC+9
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 오늘 YYYYMMDD */
function getTodayKst(): string {
  const now = new Date();
  const kstMs = now.getTime() + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** KST 기준 N일 전 YYYYMMDD */
function getDateKstDaysAgo(daysAgo: number): string {
  const now = new Date();
  const kstMs = now.getTime() + KST_OFFSET_MS - daysAgo * 86400000;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request, 'GET, OPTIONS'),
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = buildCorsHeaders(request, 'GET, OPTIONS');

  try {
    // Rate limiting
    const clientIP = getClientIp(request);
    const { allowed } = await checkConfiguredRateLimit(env.DB, `daily-rank:${clientIP}`, RATE_LIMITS.DAILY_READ);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date') || getTodayKst();
    const installId = url.searchParams.get('installId') || '';

    // 날짜 형식 검증 (YYYYMMDD, 8자리 숫자)
    if (!/^\d{8}$/.test(dateParam)) {
      return new Response(JSON.stringify({ error: 'Invalid date format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 최근 7일 이내만 조회 가능
    const sevenDaysAgo = getDateKstDaysAgo(7);
    if (dateParam < sevenDaysAgo) {
      return new Response(JSON.stringify({ error: 'Only last 7 days available' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TOP 100 랭킹 조회 (점수 DESC → 이동수 ASC → 시간 ASC)
    const rankingsResult = await env.DB.prepare(
      `SELECT name, score, moves, duration, updated_at
       FROM daily_challenges
       WHERE challenge_date = ?
       ORDER BY score DESC, moves ASC, duration ASC
       LIMIT 100`
    ).bind(dateParam).all();

    const rankings = (rankingsResult.results ?? []).map((row: any) => ({
      name: row.name,
      score: row.score,
      moves: row.moves,
      duration: row.duration,
      updatedAt: row.updated_at,
    }));

    // 전체 참가자 수
    const totalResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM daily_challenges WHERE challenge_date = ?`
    ).bind(dateParam).first();
    const totalParticipants = (totalResult as { total: number } | null)?.total ?? 0;

    // 유저 본인 기록 조회 (installId 있는 경우)
    let myRecord: { score: number; moves: number; duration: number; rank: number } | null = null;
    if (installId) {
      const installIdHash = await hashInstallId(installId, env.ANALYTICS_HASH_SALT);
      if (installIdHash) {
        const myResult = await env.DB.prepare(
          `SELECT score, moves, duration FROM daily_challenges
           WHERE challenge_date = ? AND install_id_hash = ?`
        ).bind(dateParam, installIdHash).first();

        if (myResult) {
          const myScore = (myResult as any).score;
          const myMoves = (myResult as any).moves;
          const myDuration = (myResult as any).duration;

          const rankResult = await env.DB.prepare(
            `SELECT COUNT(*) + 1 as rank FROM daily_challenges
             WHERE challenge_date = ?
               AND (score > ? OR (score = ? AND moves < ?) OR (score = ? AND moves = ? AND duration < ?))`
          ).bind(dateParam, myScore, myScore, myMoves, myScore, myMoves, myDuration).first();

          myRecord = {
            score: myScore,
            moves: myMoves,
            duration: myDuration,
            rank: (rankResult as { rank: number } | null)?.rank ?? 1,
          };
        }
      }
    }

    return new Response(
      JSON.stringify({
        challengeDate: dateParam,
        rankings,
        totalParticipants,
        myRecord,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('[DailyChallenge] rankings error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
