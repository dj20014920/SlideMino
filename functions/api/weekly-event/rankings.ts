/**
 * 주간 이벤트 랭킹 조회 API
 * GET /api/weekly-event/rankings?eventId=...&installId=...
 */
import { hashInstallId } from '../../utils/hash';
import { buildCorsHeaders } from '../../utils/cors';

interface Env {
  DB: D1Database;
  ANALYTICS_HASH_SALT?: string;
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
    const url = new URL(request.url);
    const eventId = url.searchParams.get('eventId');
    const installId = url.searchParams.get('installId');

    if (!eventId) {
      return new Response(JSON.stringify({ rankings: [], total: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TOP 100 랭킹 조회
    const rankings = await env.DB.prepare(
      `SELECT name, score, moves, duration
       FROM event_rankings
       WHERE event_id = ?
       ORDER BY score DESC, moves ASC, duration ASC
       LIMIT 100`
    ).bind(eventId).all();

    const total = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM event_rankings WHERE event_id = ?`
    ).bind(eventId).first();

    const totalCount = (total as { total: number } | null)?.total ?? 0;

    const rankingList = (rankings.results ?? []).map((row: any, idx: number) => ({
      rank: idx + 1,
      name: row.name,
      score: row.score,
      moves: row.moves,
      duration: row.duration,
    }));

    // 내 랭킹 정보
    let myRank: number | undefined;
    let myScore: number | undefined;

    if (installId) {
      const installIdHash = await hashInstallId(installId, env.ANALYTICS_HASH_SALT);
      if (installIdHash) {
        const myRecord = await env.DB.prepare(
          `SELECT score, moves, duration FROM event_rankings
           WHERE event_id = ? AND install_id_hash = ?`
        ).bind(eventId, installIdHash).first();

        if (myRecord) {
          const mScore = (myRecord as any).score;
          const mMoves = (myRecord as any).moves;
          const mDuration = (myRecord as any).duration;
          myScore = mScore;

          const rankResult = await env.DB.prepare(
            `SELECT COUNT(*) + 1 as rank
             FROM event_rankings
             WHERE event_id = ?
               AND (score > ? OR (score = ? AND moves < ?) OR (score = ? AND moves = ? AND duration < ?))`
          ).bind(eventId, mScore, mScore, mMoves, mScore, mMoves, mDuration).first();

          myRank = (rankResult as { rank: number } | null)?.rank;
        }
      }
    }

    return new Response(JSON.stringify({
      rankings: rankingList,
      myRank,
      myScore,
      total: totalCount,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[WeeklyEvent/rankings] error:', error);
    return new Response(JSON.stringify({ rankings: [], total: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
