/**
 * 주간 이벤트 참여 보상 수령 API
 * POST /api/weekly-event/claim-reward
 *
 * 이전 주 이벤트에 참여한 유저에게 보상(스킨 조각)을 지급한다.
 * - DB(event_rankings)에서 참여 여부와 순위를 서버가 직접 검증
 * - reward_claimed_at 컬럼으로 중복 수령 원천 차단
 * - 보상 수량은 순위에 따라 서버가 결정 (클라이언트 입력 불신)
 * - 네이티브 앱(Capacitor)에서만 수령 가능
 */

import { hashInstallId } from '../../utils/hash';
import { checkConfiguredRateLimit, getClientIp, RATE_LIMITS } from '../../utils/rateLimit';
import { buildCorsHeaders, createJsonResponse, isCrossSiteMutation, isTrustedRequestOrigin } from '../../utils/cors';
import { getPreviousEventId, REWARD_FRAGMENTS } from '../../utils/eventSchedule';
import { ensureWeeklyEventSchema } from '../../utils/weeklyEventSchema';
import { isNativeAppRequest } from '../../utils/platform';

interface Env {
  DB: D1Database;
  ANALYTICS_HASH_SALT?: string;
}


function jsonResponse(body: Record<string, unknown>, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request, 'POST, OPTIONS'),
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = buildCorsHeaders(request, 'POST, OPTIONS');

  if (isCrossSiteMutation(request) || !isTrustedRequestOrigin(request)) {
    return createJsonResponse(request, 'POST, OPTIONS', { error: 'Blocked by origin policy' }, 403);
  }

  try {
    // Rate limiting (30 req / 60s)
    const clientIP = getClientIp(request);
    const { allowed } = await checkConfiguredRateLimit(env.DB, `event-claim:${clientIP}`, RATE_LIMITS.WEEKLY_EVENT_CLAIM);
    if (!allowed) {
      return jsonResponse({ success: false, error: 'Too many requests' }, 429, corsHeaders);
    }

    // 네이티브 앱에서만 수령 가능
    if (!isNativeAppRequest(request)) {
      return jsonResponse({ success: false, error: 'App only' }, 403, corsHeaders);
    }

    // 요청 파싱
    let data: Record<string, unknown>;
    try {
      data = await request.json() as Record<string, unknown>;
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON' }, 400, corsHeaders);
    }

    const installId = typeof data.installId === 'string'
      && data.installId.length >= 8
      && data.installId.length <= 128
      && /^[\x20-\x7E]+$/.test(data.installId)
      ? data.installId : null;
    if (!installId) {
      return jsonResponse({ success: false, error: 'Invalid installId' }, 400, corsHeaders);
    }

    await ensureWeeklyEventSchema(env);

    const installIdHash = await hashInstallId(installId, env.ANALYTICS_HASH_SALT);
    if (!installIdHash) {
      return jsonResponse({ success: false, error: 'Server configuration error' }, 500, corsHeaders);
    }

    // 서버가 독립적으로 이전 주 이벤트 ID 계산 (클라이언트 입력을 신뢰하지 않음)
    const prevEventId = getPreviousEventId();

    // 1. 트랜잭션: SELECT + UPDATE (레이스 방지)
    const now = Date.now();
    const selectStmt = env.DB.prepare(
      `SELECT score, moves, duration, reward_claimed_at FROM event_rankings
       WHERE event_id = ? AND install_id_hash = ?`
    ).bind(prevEventId, installIdHash);

    const updateStmt = env.DB.prepare(
      `UPDATE event_rankings
       SET reward_claimed_at = ?
       WHERE event_id = ? AND install_id_hash = ? AND reward_claimed_at IS NULL`
    ).bind(now, prevEventId, installIdHash);

    const [selectResult, updateResult] = await env.DB.batch([selectStmt, updateStmt]);

    // SELECT 결과 확인
    const existingRow = selectResult.results?.[0] as
      { score: number; moves: number; duration: number; reward_claimed_at: number | null } | undefined;

    if (!existingRow) {
      // 이전 이벤트에 참여 기록 없음
      return jsonResponse({
        success: false,
        error: 'No participation found',
        fragments: 0,
      }, 404, corsHeaders);
    }

    if (existingRow.reward_claimed_at !== null) {
      // 이미 수령 완료 — 에러가 아닌 멱등 성공으로 처리
      return jsonResponse({
        success: true,
        fragments: 0,
        alreadyClaimed: true,
      }, 200, corsHeaders);
    }

    // 2. 순위 계산 — 서버가 직접 결정 (correlated subquery 없이 직접 파라미터 사용)
    const rankResult = await env.DB.prepare(
      `SELECT COUNT(*) + 1 as rank FROM event_rankings
       WHERE event_id = ?
         AND (score > ?
           OR (score = ? AND moves < ?)
           OR (score = ? AND moves = ? AND duration < ?))`
    ).bind(
      prevEventId,
      existingRow.score,
      existingRow.score, existingRow.moves,
      existingRow.score, existingRow.moves, existingRow.duration,
    ).first<{ rank: number }>();

    const rank = rankResult?.rank ?? 999;

    // 3. 순위별 보상 수량 결정
    let fragments: number;
    if (rank === 1) {
      fragments = REWARD_FRAGMENTS.FIRST_PLACE;
    } else if (rank <= 10) {
      fragments = REWARD_FRAGMENTS.TOP_10;
    } else {
      fragments = REWARD_FRAGMENTS.PARTICIPATION;
    }

    // UPDATE 결과 확인: 동시 요청으로 이미 수령됨
    if (!updateResult.meta?.changes) {
      return jsonResponse({
        success: true,
        fragments: 0,
        alreadyClaimed: true,
      }, 200, corsHeaders);
    }

    return jsonResponse({
      success: true,
      fragments,
      rank,
      alreadyClaimed: false,
    }, 200, corsHeaders);

  } catch (error) {
    console.error('[WeeklyEvent/claim-reward] error:', error);
    return jsonResponse({ success: false, error: 'Internal server error' }, 500, corsHeaders);
  }
};
