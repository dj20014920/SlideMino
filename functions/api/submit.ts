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
  validateSessionId,
} from '../utils/validation';
import { resetRankingsIfNewMonth } from '../utils/monthlyReset';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';

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
 * CORS 헤더 생성
 * 프로덕션: 특정 도메인만 허용
 */
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';

  // 허용된 도메인 목록
  const allowedOrigins = [
    'https://slidemino.emozleep.space',
    'https://www.slidemino.emozleep.space',
    // Capacitor/Ionic native app origins (WebView)
    'capacitor://localhost',
    'ionic://localhost',
    // Some WebView stacks may report as http(s) localhost
    'http://localhost',
    'https://localhost',
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

function alreadySubmittedResponse(headers: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: 'This game has already been submitted.',
      code: 'SESSION_ALREADY_SUBMITTED',
    }),
    {
      status: 409,
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

    // ========== 데이터베이스 저장 (한 세션 1회 등록) ==========
    try {
      const now = Date.now();

      // 한 세션당 1회 등록만 허용
      const existing = await env.DB.prepare(
        `SELECT id FROM rankings WHERE session_id = ? LIMIT 1`
      ).bind(sessionId).first<{ id: number }>();

      if (existing) {
        return alreadySubmittedResponse(corsHeaders);
      }

      await env.DB.prepare(
        `INSERT INTO rankings (session_id, name, score, difficulty, duration, moves, timestamp, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
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
      ).bind(difficulty, score).first<{ rank: number }>();

      const currentRank = rankResult?.rank || 1;

      return new Response(
        JSON.stringify({
          success: true,
          rank: currentRank
        }),
        {
          status: 201,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );

    } catch (dbError) {
      const dbErrorText = String(dbError ?? '');
      // 동시 요청 경쟁 상태에서도 세션당 1회 규칙을 유지한다.
      if (dbErrorText.includes('UNIQUE') && dbErrorText.includes('session_id')) {
        return alreadySubmittedResponse(corsHeaders);
      }

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
