/**
 * 점수 제출 API
 * Defense in Depth - Layer 3: 입력 검증, 안티-치트, 중복 방지
 */

import {
  validateName,
  validateScore,
  validateDifficulty,
  validateDuration,
  validateMoves,
  validateGameConsistency,
} from '../utils/validation';

interface Env {
  DB: D1Database;
  SUBMIT_RATE_LIMITER?: RateLimit; // Rate Limiting 바인딩 (선택적)
}

interface SubmitRequest {
  name: unknown;
  score: unknown;
  difficulty: unknown;
  duration: unknown;
  moves: unknown;
  timestamp?: unknown;
}

/**
 * CORS 헤더 생성
 * 프로덕션: 특정 도메인만 허용
 */
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';

  // 허용된 도메인 목록
  const allowedOrigins = [
    'https://slidemino.emozleep.space',
    'https://www.slidemino.emozleep.space',
  ];

  // 로컬 개발 환경 (localhost)
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    allowedOrigins.push(origin);
  }

  const isAllowed = allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed));

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://slidemino.emozleep.space',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
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

// 중복 제출 방지는 Rate Limiting으로 대체
// DB 쿼리 제거로 성능 최적화

/**
 * OPTIONS 요청 처리 (CORS Preflight)
 */
export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
};

/**
 * POST 요청 처리: 점수 제출
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // ========== Rate Limiting (Layer 2) ==========
    if (env.SUBMIT_RATE_LIMITER) {
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.SUBMIT_RATE_LIMITER.limit({ key: clientIP });

      if (!success) {
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

    // 1. 이름 검증
    const nameValidation = validateName(data.name);
    if (!nameValidation.valid) {
      return errorResponse(nameValidation.error!, 400, corsHeaders);
    }
    const sanitizedName = nameValidation.sanitized!;

    // 2. 난이도 검증
    const difficultyValidation = validateDifficulty(data.difficulty);
    if (!difficultyValidation.valid) {
      return errorResponse(difficultyValidation.error!, 400, corsHeaders);
    }
    const difficulty = difficultyValidation.value!;

    // 3. 점수 검증
    const scoreValidation = validateScore(data.score);
    if (!scoreValidation.valid) {
      return errorResponse(scoreValidation.error!, 400, corsHeaders);
    }
    const score = scoreValidation.value!;

    // 4. 게임 시간 검증
    const durationValidation = validateDuration(data.duration);
    if (!durationValidation.valid) {
      return errorResponse(durationValidation.error!, 400, corsHeaders);
    }
    const duration = durationValidation.value!;

    // 5. 이동 횟수 검증
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

    // 중복 제출은 Rate Limiting으로 방지 (DB 쿼리 제거로 성능 향상)

    // ========== 데이터베이스 삽입 (Layer 4) ==========
    try {
      await env.DB.prepare(
        `INSERT INTO rankings (name, score, difficulty, duration, moves, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        sanitizedName,
        score,
        difficulty,
        duration,
        moves,
        Date.now()
      ).run();

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 201,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );

    } catch (dbError) {
      // DB 에러는 로그만 하고 일반적인 메시지 반환
      console.error('Database error:', dbError);
      return errorResponse('Failed to save score', 500, corsHeaders, dbError);
    }

  } catch (error) {
    // 예상치 못한 에러
    console.error('Unexpected error:', error);
    return errorResponse('Internal server error', 500, corsHeaders, error);
  }
};
