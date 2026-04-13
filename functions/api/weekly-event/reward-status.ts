/**
 * 주간 이벤트 보상 상태 확인 API
 * GET /api/weekly-event/reward-status?installId=...
 *
 * 이전 주 이벤트의 참여 여부·순위·보상 수령 상태를 반환한다.
 * 클라이언트가 보상 버튼 표시 여부를 판단하는 데 사용.
 */

import { hashInstallId } from '../../utils/hash';
import { checkRateLimit, getClientIp } from '../../utils/rateLimit';
import { buildCorsHeaders } from '../../utils/cors';
import { getPreviousEventId, REWARD_FRAGMENTS } from '../../utils/eventSchedule';
import { ensureWeeklyEventSchema } from '../../utils/weeklyEventSchema';

interface Env {
  DB: D1Database;
  ANALYTICS_HASH_SALT?: string;
}

function jsonResponse(body: Record<string, unknown>, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
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
    // Rate limiting (60 req / 60s)
    const clientIP = getClientIp(request);
    const { allowed } = await checkRateLimit(env.DB, `event-reward-status:${clientIP}`, 60, 60);
    if (!allowed) {
      return jsonResponse({ error: 'Too many requests' }, 429, corsHeaders);
    }

    const url = new URL(request.url);
    const installId = url.searchParams.get('installId');
    if (!installId || installId.length < 8 || installId.length > 128) {
      return jsonResponse({ error: 'Missing installId' }, 400, corsHeaders);
    }

    await ensureWeeklyEventSchema(env);

    const installIdHash = await hashInstallId(installId, env.ANALYTICS_HASH_SALT);
    if (!installIdHash) {
      // ANALYTICS_HASH_SALT 미설정 — 일반 200으로 숨기면 운영자가 인지하지 못함
      return jsonResponse({ error: 'Server configuration error' }, 500, corsHeaders);
    }

    const prevEventId = getPreviousEventId();

    // 이전 이벤트 참여 기록 + 수령 상태 조회
    const row = await env.DB.prepare(
      `SELECT score, moves, duration, reward_claimed_at FROM event_rankings
       WHERE event_id = ? AND install_id_hash = ?`
    ).bind(prevEventId, installIdHash).first<{
      score: number;
      moves: number;
      duration: number;
      reward_claimed_at: number | null;
    }>();

    if (!row) {
      return jsonResponse({
        participated: false,
        claimed: false,
        rank: null,
        fragments: 0,
        eventId: prevEventId,
      }, 200, corsHeaders);
    }

    // 순위 계산
    const rankResult = await env.DB.prepare(
      `SELECT COUNT(*) + 1 as rank FROM event_rankings
       WHERE event_id = ? AND (score > ? OR (score = ? AND moves < ?) OR (score = ? AND moves = ? AND duration < ?))`
    ).bind(prevEventId, row.score, row.score, row.moves, row.score, row.moves, row.duration)
      .first<{ rank: number }>();

    const rank = rankResult?.rank ?? 999;
    let fragments: number;
    if (rank === 1) fragments = REWARD_FRAGMENTS.FIRST_PLACE;
    else if (rank <= 10) fragments = REWARD_FRAGMENTS.TOP_10;
    else fragments = REWARD_FRAGMENTS.PARTICIPATION;

    return jsonResponse({
      participated: true,
      claimed: row.reward_claimed_at !== null,
      rank,
      fragments,
      eventId: prevEventId,
    }, 200, corsHeaders);

  } catch (error) {
    console.error('[WeeklyEvent/reward-status] error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500, corsHeaders);
  }
};
