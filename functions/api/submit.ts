/**
 * 점수 제출 API
 * Defense in Depth - Layer 3: 입력 검증, 안티-치트
 * 중간 저장 지원: 같은 세션에서 더 높은 점수로 재제출 시 UPDATE
 */

import {
  validateName,
  validateScore,
  validateDifficulty,
  validateDuration,
  validateMoves,
  validateGameConsistency,
  validateSessionId,
} from '../utils/validation';
import { getSeasonBoundaries, resetSeasonIfNeeded } from '../utils/seasonReset';
import { hashInstallId } from '../utils/hash';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { buildCorsHeaders } from '../utils/cors';

interface Env {
  DB: D1Database;
  SUBMIT_RATE_LIMITER?: RateLimit; // Rate Limiting 바인딩 (선택적)
  ANALYTICS_HASH_SALT?: string;    // install_id 해싱용 솔트
}

interface SubmitRequest {
  sessionId: unknown;
  name: unknown;
  score: unknown;
  difficulty: unknown;
  duration: unknown;
  moves: unknown;
  timestamp?: unknown;
  installId?: unknown;             // 시즌 보상 지급을 위한 install ID (선택적)
  platform?: unknown;              // 플랫폼 ('android', 'ios', 'web')
  levelBadge?: unknown;            // 레벨 배지 ID (예: lv15)
  mode?: unknown;                  // 'final' | 'progress' (진행 중 자동 저장)
}

const VALID_LEVEL_BADGES = new Set([
  'lv5', 'lv10', 'lv15', 'lv20', 'lv25', 'lv30', 'lv35', 'lv40', 'lv45', 'lv50',
]);

const toMemberKey = (installIdHash: string | null, sessionId: string): string => {
  if (typeof installIdHash === 'string' && installIdHash.length > 0) {
    return installIdHash;
  }
  return `legacy:${sessionId}`;
};

/**
 * 에러 응답 생성 (보안 강화: 상세 정보 숨김)
 */
function errorResponse(
  message: string,
  status: number,
  headers: Record<string, string>,
  _details?: unknown // 로깅용, 응답에 포함 안 함
): Response {
  // 프로덕션에서는 일반적인 메시지만 반환
  const safeMessage = status === 500 ? 'Internal server error' : message;

  return new Response(
    JSON.stringify({ error: safeMessage }),
    {
      status,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    }
  );
}

type RankingMemberBestRow = {
  best_score: number;
};

/**
 * OPTIONS 요청 처리 (CORS Preflight)
 */
export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request, 'POST, OPTIONS'),
  });
};

/**
 * POST 요청 처리: 점수 제출
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = buildCorsHeaders(request, 'POST, OPTIONS');

  try {
    // ========== Rate Limiting (Layer 2) ==========
    const clientIP = getClientIp(request);
    if (env.SUBMIT_RATE_LIMITER) {
      const { success } = await env.SUBMIT_RATE_LIMITER.limit({ key: clientIP });

      if (!success) {
        return errorResponse('Too many requests. Please try again later.', 429, corsHeaders);
      }
    } else {
      const { allowed } = await checkRateLimit(env.DB, `submit:${clientIP}`, 120, 60);
      if (!allowed) {
        return errorResponse('Too many requests. Please try again later.', 429, corsHeaders);
      }
    }

    // ========== 요청 파싱 ==========
    let data: SubmitRequest;
    try {
      data = await request.json() as SubmitRequest;
    } catch {
      return errorResponse('Invalid JSON', 400, corsHeaders);
    }

    // ========== 입력 검증 (Layer 3) ==========

    // 1. 세션 ID 검증
    const sessionIdValidation = validateSessionId(data.sessionId);
    if (!sessionIdValidation.valid) {
      return errorResponse(sessionIdValidation.error!, 400, corsHeaders);
    }
    const sessionId = sessionIdValidation.value!;

    // 2. 이름 검증
    const nameValidation = validateName(data.name);
    if (!nameValidation.valid) {
      return errorResponse(nameValidation.error!, 400, corsHeaders);
    }
    const sanitizedName = nameValidation.sanitized!;

    // 3. 난이도 검증
    const difficultyValidation = validateDifficulty(data.difficulty);
    if (!difficultyValidation.valid) {
      return errorResponse(difficultyValidation.error!, 400, corsHeaders);
    }
    const difficulty = difficultyValidation.value!;

    // 4. 점수 검증
    const scoreValidation = validateScore(data.score);
    if (!scoreValidation.valid) {
      return errorResponse(scoreValidation.error!, 400, corsHeaders);
    }
    const score = scoreValidation.value!;

    // 5. 게임 시간 검증
    const durationValidation = validateDuration(data.duration);
    if (!durationValidation.valid) {
      return errorResponse(durationValidation.error!, 400, corsHeaders);
    }
    const duration = durationValidation.value!;

    // 6. 이동 횟수 검증
    const movesValidation = validateMoves(data.moves);
    if (!movesValidation.valid) {
      return errorResponse(movesValidation.error!, 400, corsHeaders);
    }
    const moves = movesValidation.value!;

    // 7. 레벨 배지 검증 (선택값)
    const levelBadge = typeof data.levelBadge === 'string' && VALID_LEVEL_BADGES.has(data.levelBadge)
      ? data.levelBadge
      : null;
    const submitMode = data.mode === 'progress' ? 'progress' : 'final';

    // ========== 안티-치트 검증 (Layer 3) ==========
    const consistencyCheck = validateGameConsistency(score, difficulty, duration, moves);
    if (!consistencyCheck.valid) {
      // 일반적인 메시지로 치터에게 정보 노출 방지
      console.log(`Anti-cheat blocked: ${consistencyCheck.error}`); // 서버 로그에만 기록
      return errorResponse('Your score could not be saved. Please play normally and try again.', 403, corsHeaders);
    }

    await resetSeasonIfNeeded(env);

    // ========== install_id 해싱 (시즌 보상용) ==========
    const installIdHash = typeof data.installId === 'string' && data.installId.length > 0
      ? await hashInstallId(data.installId, env.ANALYTICS_HASH_SALT)
      : null;

    // ========== 플랫폼 식별 (서버 추론 — User-Agent 기반) ==========
    const ua = request.headers.get('User-Agent') ?? '';
    const platform: string = /Android/i.test(ua)
      ? 'android'
      : /iPhone|iPad|iPod/i.test(ua)
        ? 'ios'
        : 'web';

    // ========== 데이터베이스 저장 (D1 batch: UNIQUE 제약 없이 원자적 동작) ==========
    // D1 batch()는 단일 트랜잭션으로 실행되어 레이스 컨디션을 방지한다.
    // UPSERT(ON CONFLICT)를 사용하지 않아 session_id UNIQUE 인덱스가 없어도 동작한다.
    try {
      const now = Date.now();
      const seasonId = getSeasonBoundaries(new Date(now)).seasonId;
      const memberKey = toMemberKey(installIdHash, sessionId);

      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS ranking_member_best (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           season_id TEXT NOT NULL,
           board_size TEXT NOT NULL,
           member_key TEXT NOT NULL,
           name TEXT NOT NULL,
           best_score INTEGER NOT NULL DEFAULT 0,
           session_id TEXT NOT NULL,
           install_id_hash TEXT,
           platform TEXT,
           updated_at INTEGER NOT NULL
         )`
      ).run();

      await env.DB.prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_ranking_member_best_uniq
         ON ranking_member_best (season_id, board_size, member_key)`
      ).run();

      // 중간 저장 지원 (원자적):
      //   1) session_id 미존재 → INSERT (WHERE NOT EXISTS로 중복 방지)
      //   2) session_id 존재 + 새 점수 > 기존 점수 → UPDATE
      //   3) 같거나 낮은 점수 → no-op
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO rankings (session_id, name, score, difficulty, duration, moves, timestamp, updated_at, install_id_hash, platform)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE NOT EXISTS (SELECT 1 FROM rankings WHERE session_id = ?)`
        ).bind(sessionId, sanitizedName, score, difficulty, duration, moves, now, now, installIdHash, platform, sessionId),
        env.DB.prepare(
          `UPDATE rankings
           SET score = ?, name = ?, moves = ?, duration = ?, updated_at = ?, install_id_hash = COALESCE(?, install_id_hash), platform = COALESCE(?, platform)
           WHERE session_id = ? AND ? > score`
        ).bind(score, sanitizedName, moves, duration, now, installIdHash, platform, sessionId, score),
        ...(submitMode === 'final'
          ? [
            env.DB.prepare(
              `UPDATE rankings
               SET name = ?, updated_at = ?, install_id_hash = COALESCE(?, install_id_hash), platform = COALESCE(?, platform)
               WHERE session_id = ?`
            ).bind(sanitizedName, now, installIdHash, platform, sessionId),
          ]
          : []),
        env.DB.prepare(
          `INSERT INTO ranking_member_best (
             season_id, board_size, member_key, name, best_score, session_id, install_id_hash, platform, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(season_id, board_size, member_key) DO UPDATE SET
             name = excluded.name,
             best_score = excluded.best_score,
             session_id = excluded.session_id,
             install_id_hash = COALESCE(excluded.install_id_hash, ranking_member_best.install_id_hash),
             platform = COALESCE(excluded.platform, ranking_member_best.platform),
             updated_at = excluded.updated_at
           WHERE excluded.best_score > ranking_member_best.best_score`
        ).bind(seasonId, difficulty, memberKey, sanitizedName, score, sessionId, installIdHash, platform, now),
        ...(submitMode === 'final'
          ? [
            env.DB.prepare(
              `UPDATE ranking_member_best
               SET name = ?,
                   install_id_hash = COALESCE(?, install_id_hash),
                   platform = COALESCE(?, platform),
                   session_id = CASE WHEN best_score = ? THEN ? ELSE session_id END,
                   updated_at = CASE WHEN best_score = ? THEN ? ELSE updated_at END
               WHERE season_id = ? AND board_size = ? AND member_key = ?`
            ).bind(
              sanitizedName,
              installIdHash,
              platform,
              score,
              sessionId,
              score,
              now,
              seasonId,
              difficulty,
              memberKey
            ),
          ]
          : []),
      ]);

      if (levelBadge) {
        // 랭킹 배지 별도 테이블 저장 (기존 rankings 스키마와 분리해 호환성 유지)
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS ranking_badges (
             session_id TEXT PRIMARY KEY,
             level_badge TEXT NOT NULL,
             updated_at INTEGER NOT NULL
           )`
        ).run();

        await env.DB.prepare(
          `INSERT INTO ranking_badges (session_id, level_badge, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(session_id) DO UPDATE SET
             level_badge = excluded.level_badge,
             updated_at = excluded.updated_at`
        ).bind(sessionId, levelBadge, now).run();
      }

      if (submitMode === 'progress') {
        return new Response(
          JSON.stringify({ success: true }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // ========== 순위 조회 ==========
      // 자동 저장(progress)이 먼저 들어간 뒤 최종 제출(final)이 같은 점수로 들어와도,
      // 실제 저장된 최고 기록 기준 순위를 반환해야 클라이언트 표기와 공개 랭킹이 어긋나지 않는다.
      const storedBest = await env.DB.prepare(
        `SELECT best_score
         FROM ranking_member_best
         WHERE season_id = ? AND board_size = ? AND member_key = ?`
      ).bind(seasonId, difficulty, memberKey).first<RankingMemberBestRow>();
      const effectiveBestScore = storedBest?.best_score ?? score;

      const rankResult = await env.DB.prepare(
        `SELECT COUNT(*) + 1 as rank
         FROM ranking_member_best
         WHERE season_id = ? AND board_size = ? AND best_score > ?`
      ).bind(seasonId, difficulty, effectiveBestScore).first();

      const currentRank = (rankResult as { rank: number } | null)?.rank ?? 1;

      return new Response(
        JSON.stringify({ success: true, rank: currentRank }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (dbError) {
      console.error('Database error:', dbError);
      return errorResponse('Failed to save score', 500, corsHeaders, dbError);
    }

  } catch (error) {
    // 예상치 못한 에러
    console.error('Unexpected error:', error);
    return errorResponse('Internal server error', 500, corsHeaders, error);
  }
};
