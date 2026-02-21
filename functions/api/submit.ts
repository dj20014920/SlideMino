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
import { resetRankingsIfNewMonth } from '../utils/monthlyReset';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { buildCorsHeaders } from '../utils/cors';

interface Env {
  DB: D1Database;
  SUBMIT_RATE_LIMITER?: RateLimit; // Rate Limiting 바인딩 (선택적)
}

interface SubmitRequest {
  sessionId: unknown;
  name: unknown;
  score: unknown;
  difficulty: unknown;
  duration: unknown;
  moves: unknown;
  timestamp?: unknown;
}

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

    // ========== 안티-치트 검증 (Layer 3) ==========
    const consistencyCheck = validateGameConsistency(score, difficulty, duration, moves);
    if (!consistencyCheck.valid) {
      // 일반적인 메시지로 치터에게 정보 노출 방지
      console.log(`Anti-cheat blocked: ${consistencyCheck.error}`); // 서버 로그에만 기록
      return errorResponse('Your score could not be saved. Please play normally and try again.', 403, corsHeaders);
    }

    await resetRankingsIfNewMonth(env);

    // ========== 데이터베이스 저장 (UPSERT: 더 높은 점수일 때만 UPDATE) ==========
    try {
      const now = Date.now();

      // 중간 저장 지원:
      //   - 처음 제출이면 INSERT
      //   - 같은 session_id가 이미 있고 새 점수가 더 높으면 UPDATE
      //   - 같거나 낮은 점수면 기존 레코드 유지 (no-op)
      await env.DB.prepare(
        `INSERT INTO rankings (session_id, name, score, difficulty, duration, moves, timestamp, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           score      = CASE WHEN excluded.score > score      THEN excluded.score      ELSE score      END,
           name       = CASE WHEN excluded.score > score      THEN excluded.name       ELSE name       END,
           moves      = CASE WHEN excluded.score > score      THEN excluded.moves      ELSE moves      END,
           duration   = CASE WHEN excluded.score > score      THEN excluded.duration   ELSE duration   END,
           updated_at = CASE WHEN excluded.score > score      THEN excluded.updated_at ELSE updated_at END`
      ).bind(
        sessionId,
        sanitizedName,
        score,
        difficulty,
        duration,
        moves,
        now,
        now
      ).run();

      // ========== 순위 조회 ==========
      // 같은 난이도 내에서 현재 점수보다 높은 점수의 개수 + 1
      const rankResult = await env.DB.prepare(
        `SELECT COUNT(*) + 1 as rank
         FROM rankings
         WHERE difficulty = ? AND score > ?`
      ).bind(difficulty, score).first();

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
