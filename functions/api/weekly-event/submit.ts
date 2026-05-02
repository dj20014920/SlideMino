/**
 * 주간 이벤트 점수 제출 API
 * POST /api/weekly-event/submit
 *
 * - 3회 도전 제한 서버 강제
 * - 타이머 서버 검증 (30분 + 여유 30초)
 * - UPSERT: 최고점만 event_rankings에 반영
 * - isIntermediate=true: 도전 횟수 소모 없이 랭킹만 업데이트 (중간 저장)
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
import { buildCorsHeaders, createJsonResponse, isCrossSiteMutation, isTrustedRequestOrigin } from '../../utils/cors';
import { getCurrentEventId } from '../../utils/eventSchedule';
import { ensureWeeklyEventSchema } from '../../utils/weeklyEventSchema';

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

/** 유효 이벤트 타입 화이트리스트 */
const VALID_EVENT_TYPES = [
  'NO_ROTATION', 'BURNING', 'PLUS_RUSH', 'EXPERT_4X4',
  'SPEED_RUN', 'TRIPLE_KILL', 'I_BLOCK_RUSH', 'PLAINS_10X10',
] as const;

/** 이벤트 타입별 보드 크기 (difficulty) */
const EVENT_BOARD_SIZE: Record<string, '4' | '5' | '10'> = {
  NO_ROTATION: '5',
  BURNING: '5',
  PLUS_RUSH: '5',
  EXPERT_4X4: '4',
  SPEED_RUN: '5',
  TRIPLE_KILL: '5',
  I_BLOCK_RUSH: '5',
  PLAINS_10X10: '10',
};

/** 이벤트 타입별 점수 배율 (BURNING=1.5x, TRIPLE_KILL=~1.3x 보정) */
const EVENT_SCORE_MULTIPLIER: Record<string, number> = {
  BURNING: 1.5,
  TRIPLE_KILL: 1.5,  // +333 보너스 고려하여 여유 배율
};
const VALID_LEVEL_BADGES = new Set([
  'lv5', 'lv10', 'lv15', 'lv20', 'lv25', 'lv30', 'lv35', 'lv40', 'lv45', 'lv50',
]);

function errorResponse(message: string, status: number, headers: Record<string, string>): Response {
  const safe = status === 500 ? 'Internal server error' : message;
  return new Response(JSON.stringify({ success: false, error: safe }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

type EventBestRow = {
  score: number;
  moves: number;
  duration: number;
};

const fetchStoredBestForEvent = async (
  env: Env,
  eventId: string,
  installIdHash: string,
): Promise<EventBestRow | null> => {
  return env.DB.prepare(
    `SELECT score, moves, duration
     FROM event_rankings
     WHERE event_id = ? AND install_id_hash = ?`
  ).bind(eventId, installIdHash).first<EventBestRow>();
};

const fetchRankAndTotalForEvent = async (
  env: Env,
  eventId: string,
  best: EventBestRow,
): Promise<{ rank: number; total: number }> => {
  const [rankResult, totalResult] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) + 1 as rank
       FROM event_rankings
       WHERE event_id = ?
         AND (score > ? OR (score = ? AND moves < ?) OR (score = ? AND moves = ? AND duration < ?))`
    ).bind(eventId, best.score, best.score, best.moves, best.score, best.moves, best.duration).first<{ rank: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) as total FROM event_rankings WHERE event_id = ?`
    ).bind(eventId).first<{ total: number }>(),
  ]);

  return {
    rank: rankResult?.rank ?? 1,
    total: totalResult?.total ?? 1,
  };
};

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
    // CSRF Protection
    if (isCrossSiteMutation(request) || !isTrustedRequestOrigin(request)) {
      return createJsonResponse(request, 'POST, OPTIONS', { error: 'Blocked by origin policy' }, 403);
    }

    // Rate limiting
    const clientIP = getClientIp(request);
    const { allowed } = await checkRateLimit(env.DB, `event-submit:${clientIP}`, 30, 60);
    if (!allowed) {
      return errorResponse('Too many requests', 429, corsHeaders);
    }

    await ensureWeeklyEventSchema(env);

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
    const isIntermediate = data.isIntermediate === true;
    const isProgress = data.isProgress === true;

    if (!eventId || !eventType || attemptNumber < 1 || attemptNumber > 3) {
      return errorResponse('Invalid event parameters', 400, corsHeaders);
    }

    // 이벤트 타입 화이트리스트 검증
    if (!(VALID_EVENT_TYPES as readonly string[]).includes(eventType)) {
      return errorResponse('Invalid event type', 400, corsHeaders);
    }

    // 이벤트 ID 서버 검증 — 현재 진행 중인 이벤트만 점수 제출 가능
    // (과거 이벤트 ID로 사기 제출하여 보상 편취 방지)
    if (eventId !== getCurrentEventId()) {
      return errorResponse('Event has ended or invalid event', 403, corsHeaders);
    }

    const nameV = validateName(data.name);
    if (!nameV.valid) return errorResponse(nameV.error!, 400, corsHeaders);
    const name = nameV.sanitized!;
    const levelBadge = typeof data.levelBadge === 'string' && VALID_LEVEL_BADGES.has(data.levelBadge)
      ? data.levelBadge
      : null;

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

    // 콤보 배율 추출 및 clamp (1~3)
    const rawCombo = typeof data.comboMultiplier === 'number' && Number.isFinite(data.comboMultiplier) && data.comboMultiplier >= 1 ? data.comboMultiplier : 1;
    const comboMultiplier = Math.max(1, Math.min(3, rawCombo));

    // 이벤트 타입별 점수 일관성 검증
    const multiplier = EVENT_SCORE_MULTIPLIER[eventType] ?? 1;
    const boardSize = EVENT_BOARD_SIZE[eventType] ?? '5';
    const consistencyCheck = validateGameConsistency(score, boardSize, duration, moves, multiplier, comboMultiplier);
    if (!consistencyCheck.valid) {
      return errorResponse(consistencyCheck.error ?? 'Inconsistent game data', 403, corsHeaders);
    }

    // 도전 횟수 조회 (중간 저장/최종 제출 공통)
    const attemptCountResult = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM event_attempts
       WHERE event_id = ? AND install_id_hash = ?`
    ).bind(eventId, installIdHash).first();

    const currentCount = (attemptCountResult as { count: number } | null)?.count ?? 0;
    const now = Date.now();
    const shouldPromoteMetadata = !isProgress;

    if (isIntermediate) {
      // ── 중간 저장: 도전 횟수 소모 없이 랭킹만 UPSERT ──
      // ⚠️ 3회 제한: 최종 제출 소진 후 isIntermediate=true로 무한 갱신 악용 차단
      if (currentCount >= 3) {
        return errorResponse('Maximum attempts reached (3/3)', 403, corsHeaders);
      }
      try {
        await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO event_rankings (event_id, install_id_hash, name, score, moves, duration, submitted_at, updated_at)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?
             WHERE NOT EXISTS (
               SELECT 1 FROM event_rankings WHERE event_id = ? AND install_id_hash = ?
             )`
          ).bind(eventId, installIdHash, name, score, moves, duration, now, now, eventId, installIdHash),
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
          ...(shouldPromoteMetadata
            ? [
              env.DB.prepare(
                `UPDATE event_rankings
                 SET name = ?, updated_at = ?
                 WHERE event_id = ? AND install_id_hash = ?`
              ).bind(name, now, eventId, installIdHash),
            ]
            : []),
        ]);

        // 중간 저장에서도 배지 저장 (앱 크래시 대비)
        if (levelBadge && !isProgress) {
          await env.DB.prepare(
            `INSERT INTO event_ranking_badges (event_id, install_id_hash, level_badge, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(event_id, install_id_hash) DO UPDATE SET
               level_badge = excluded.level_badge,
               updated_at = excluded.updated_at`
          ).bind(eventId, installIdHash, levelBadge, now).run();
        }

        if (isProgress) {
          return new Response(JSON.stringify({
            success: true,
            isIntermediate: true,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const best = await fetchStoredBestForEvent(env, eventId, installIdHash);
        const effectiveBest = best ?? { score, moves, duration };
        const { rank, total } = await fetchRankAndTotalForEvent(env, eventId, effectiveBest);

        return new Response(JSON.stringify({
          success: true,
          rank,
          total,
          bestScore: effectiveBest.score,
          isIntermediate: true,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (dbError) {
        console.error('[WeeklyEvent/submit] intermediate DB error:', dbError);
        return errorResponse('Failed to save intermediate score', 500, corsHeaders);
      }
    }

    // ── 최종 제출: 도전 횟수 소모 + 랭킹 UPSERT ──
    if (currentCount >= 3) {
      return errorResponse('Maximum attempts reached (3/3)', 403, corsHeaders);
    }

    // 실제 attempt_number 서버 결정 (클라이언트 값 무시)
    const serverAttemptNumber = currentCount + 1;

    try {
      // 도전 기록 저장 (INSERT OR IGNORE: 동시 요청으로 인한 UNIQUE 충돌 방지)
      const insertResult = await env.DB.prepare(
        `INSERT OR IGNORE INTO event_attempts (event_id, install_id_hash, attempt_number, score, moves, duration, started_at, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(eventId, installIdHash, serverAttemptNumber, score, moves, duration, now - (duration * 1000), now).run();

      // INSERT OR IGNORE로 인해 실제 삽입이 안 된 경우 (동시 요청 충돌)
      if (!insertResult.meta?.changes) {
        const best = await fetchStoredBestForEvent(env, eventId, installIdHash);
        if (!best) {
          return errorResponse('Concurrent submission detected, please retry', 409, corsHeaders);
        }
        const { rank, total } = await fetchRankAndTotalForEvent(env, eventId, best);
        return new Response(JSON.stringify({
          success: true,
          rank,
          total,
          bestScore: best.score,
          attemptNumber: currentCount + 1,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

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
        ...(shouldPromoteMetadata
          ? [
            env.DB.prepare(
              `UPDATE event_rankings
               SET name = ?, updated_at = ?
               WHERE event_id = ? AND install_id_hash = ?`
            ).bind(name, now, eventId, installIdHash),
          ]
          : []),
      ]);

      if (levelBadge) {
        await env.DB.prepare(
          `INSERT INTO event_ranking_badges (event_id, install_id_hash, level_badge, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(event_id, install_id_hash) DO UPDATE SET
             level_badge = excluded.level_badge,
             updated_at = excluded.updated_at`
        ).bind(eventId, installIdHash, levelBadge, now).run();
      }

      // 순위 조회
      const best = await fetchStoredBestForEvent(env, eventId, installIdHash);
      const effectiveBest = best ?? { score, moves, duration };
      const { rank, total } = await fetchRankAndTotalForEvent(env, eventId, effectiveBest);
      const bestScore = effectiveBest.score;

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
