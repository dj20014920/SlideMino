/**
 * 주간 이벤트 점수 제출 API
 * POST /api/weekly-event/submit
 *
 * - 3회 도전 제한 서버 강제
 * - 타이머 서버 검증 (30분 + 여유 30초)
 * - UPSERT: 최고점만 event_rankings에 반영
 */
import {
  validateName,
  validateScore,
  validateDuration,
  validateMoves,
  validateGameConsistency,
} from '../../utils/validation';
import { hashInstallId } from '../../utils/hash';
import { checkRateLimit, getClientIp } from '../../utils/rateLimit';
import { buildCorsHeaders } from '../../utils/cors';

interface Env {
  DB: D1Database;
  ANALYTICS_HASH_SALT?: string;
}

/** 이벤트 타입별 시간 제한(초) */
const EVENT_TIME_LIMITS: Record<string, number> = {
  SPEED_RUN: 900,     // 15분
};
const DEFAULT_TIME_LIMIT = 1800; // 30분
const TIMER_TOLERANCE_SEC = 30;  // 네트워크 지연 여유

/** 이벤트 타입별 점수 배율 (BURNING=1.5x, TRIPLE_KILL=~1.3x 보정) */
const EVENT_SCORE_MULTIPLIER: Record<string, number> = {
  BURNING: 1.5,
  TRIPLE_KILL: 1.5,  // +333 보너스 고려하여 여유 배율
};

function errorResponse(message: string, status: number, headers: Record<string, string>): Response {
  const safe = status === 500 ? 'Internal server error' : message;
  return new Response(JSON.stringify({ success: false, error: safe }), {
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

  try {
    // Rate limiting
    const clientIP = getClientIp(request);
    const { allowed } = await checkRateLimit(env.DB, `event-submit:${clientIP}`, 30, 60);
    if (!allowed) {
      return errorResponse('Too many requests', 429, corsHeaders);
    }

    // 요청 파싱
    let data: Record<string, unknown>;
    try {
      data = await request.json() as Record<string, unknown>;
    } catch {
      return errorResponse('Invalid JSON', 400, corsHeaders);
    }

    // 기본 입력 검증
    const eventId = typeof data.eventId === 'string' ? data.eventId : '';
    const eventType = typeof data.eventType === 'string' ? data.eventType : '';
    const attemptNumber = typeof data.attemptNumber === 'number' ? data.attemptNumber : 0;

    if (!eventId || !eventType || attemptNumber < 1 || attemptNumber > 3) {
      return errorResponse('Invalid event parameters', 400, corsHeaders);
    }

    const nameV = validateName(data.name);
    if (!nameV.valid) return errorResponse(nameV.error!, 400, corsHeaders);
    const name = nameV.sanitized!;

    const scoreV = validateScore(data.score);
    if (!scoreV.valid) return errorResponse(scoreV.error!, 400, corsHeaders);
    const score = scoreV.value!;

    const durationV = validateDuration(data.duration);
    if (!durationV.valid) return errorResponse(durationV.error!, 400, corsHeaders);
    const duration = durationV.value!;

    const movesV = validateMoves(data.moves);
    if (!movesV.valid) return errorResponse(movesV.error!, 400, corsHeaders);
    const moves = movesV.value!;

    // install_id 해싱
    const installId = typeof data.installId === 'string' && data.installId.length > 0
      ? data.installId : null;
    if (!installId) {
      return errorResponse('Install ID required', 400, corsHeaders);
    }
    const installIdHash = await hashInstallId(installId, env.ANALYTICS_HASH_SALT);
    if (!installIdHash) {
      return errorResponse('Server configuration error', 500, corsHeaders);
    }

    // 타이머 서버 검증
    const timeLimit = (EVENT_TIME_LIMITS[eventType] ?? DEFAULT_TIME_LIMIT) + TIMER_TOLERANCE_SEC;
    if (duration > timeLimit) {
      return errorResponse('Time limit exceeded', 403, corsHeaders);
    }

    // 이벤트 타입별 점수 일관성 검증
    const multiplier = EVENT_SCORE_MULTIPLIER[eventType] ?? 1;
    const consistencyCheck = validateGameConsistency(score, '5', duration, moves, multiplier);
    if (!consistencyCheck.valid) {
      return errorResponse(consistencyCheck.error ?? 'Inconsistent game data', 403, corsHeaders);
    }

    // 3회 도전 제한 서버 검증
    const attemptCountResult = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM event_attempts
       WHERE event_id = ? AND install_id_hash = ?`
    ).bind(eventId, installIdHash).first();

    const currentCount = (attemptCountResult as { count: number } | null)?.count ?? 0;
    if (currentCount >= 3) {
      return errorResponse('Maximum attempts reached (3/3)', 403, corsHeaders);
    }

    // 실제 attempt_number 서버 결정 (클라이언트 값 무시)
    const serverAttemptNumber = currentCount + 1;
    const now = Date.now();

    try {
      // 도전 기록 저장
      await env.DB.prepare(
        `INSERT INTO event_attempts (event_id, install_id_hash, attempt_number, score, moves, duration, started_at, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(eventId, installIdHash, serverAttemptNumber, score, moves, duration, now - (duration * 1000), now).run();

      // 랭킹 UPSERT: 최고점만 반영
      await env.DB.batch([
        // INSERT if not exists
        env.DB.prepare(
          `INSERT INTO event_rankings (event_id, install_id_hash, name, score, moves, duration, submitted_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?
           WHERE NOT EXISTS (
             SELECT 1 FROM event_rankings WHERE event_id = ? AND install_id_hash = ?
           )`
        ).bind(eventId, installIdHash, name, score, moves, duration, now, now, eventId, installIdHash),
        // UPDATE if better score
        env.DB.prepare(
          `UPDATE event_rankings
           SET score = ?, name = ?, moves = ?, duration = ?, updated_at = ?
           WHERE event_id = ? AND install_id_hash = ?
             AND (? > score
               OR (? = score AND ? < moves)
               OR (? = score AND ? = moves AND ? < duration))`
        ).bind(
          score, name, moves, duration, now,
          eventId, installIdHash,
          score, score, moves, score, moves, duration
        ),
      ]);

      // 순위 조회
      const rankResult = await env.DB.prepare(
        `SELECT COUNT(*) + 1 as rank
         FROM event_rankings
         WHERE event_id = ?
           AND (score > ? OR (score = ? AND moves < ?) OR (score = ? AND moves = ? AND duration < ?))`
      ).bind(eventId, score, score, moves, score, moves, duration).first();

      const totalResult = await env.DB.prepare(
        `SELECT COUNT(*) as total FROM event_rankings WHERE event_id = ?`
      ).bind(eventId).first();

      const bestResult = await env.DB.prepare(
        `SELECT score FROM event_rankings WHERE event_id = ? AND install_id_hash = ?`
      ).bind(eventId, installIdHash).first();

      const rank = (rankResult as { rank: number } | null)?.rank ?? 1;
      const total = (totalResult as { total: number } | null)?.total ?? 1;
      const bestScore = (bestResult as { score: number } | null)?.score ?? score;

      return new Response(JSON.stringify({
        success: true,
        rank,
        total,
        bestScore,
        attemptNumber: serverAttemptNumber,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (dbError) {
      console.error('[WeeklyEvent/submit] DB error:', dbError);
      return errorResponse('Failed to save score', 500, corsHeaders);
    }
  } catch (error) {
    console.error('[WeeklyEvent/submit] unexpected error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
};
