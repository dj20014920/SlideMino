/**
 * 데일리 챌린지 점수 제출 API
 *
 * - 같은 날 같은 유저 = 1기록만 유지 (더 높은 점수면 갱신)
 * - 서버 시각 기준 KST 날짜 검증 (타임존 악용 방지)
 * - 기존 submit.ts 안티치트 패턴 재사용
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

function errorResponse(message: string, status: number, headers: Record<string, string>): Response {
  const safe = status === 500 ? 'Internal server error' : message;
  return new Response(JSON.stringify({ error: safe }), {
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
    const { allowed } = await checkRateLimit(env.DB, `daily-submit:${clientIP}`, 60, 60);
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

    // 입력 검증
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

    // 안티치트: 게임 일관성 검증 (난이도 5 고정)
    const consistency = validateGameConsistency(score, '5', duration, moves);
    if (!consistency.valid) {
      console.log(`[DailyChallenge] anti-cheat blocked: ${consistency.error}`);
      return errorResponse('Score could not be saved. Please play normally.', 403, corsHeaders);
    }

    // challengeDate 검증 — 서버 시각 기준 KST 오늘과 일치해야 함
    const challengeDate = typeof data.challengeDate === 'string' ? data.challengeDate : '';
    const todayKst = getTodayKst();
    if (challengeDate !== todayKst) {
      return errorResponse('Challenge date mismatch. Please refresh and try again.', 400, corsHeaders);
    }

    // install_id 해싱 (유저 식별)
    const installId = typeof data.installId === 'string' && data.installId.length > 0
      ? data.installId : null;
    if (!installId) {
      return errorResponse('Install ID required for daily challenge', 400, corsHeaders);
    }
    const installIdHash = await hashInstallId(installId, env.ANALYTICS_HASH_SALT);
    if (!installIdHash) {
      return errorResponse('Server configuration error', 500, corsHeaders);
    }

    // DB 저장: UPSERT — 더 높은 점수일 때만 갱신
    const now = Date.now();
    try {
      await env.DB.batch([
        // INSERT if not exists
        env.DB.prepare(
          `INSERT INTO daily_challenges (challenge_date, install_id_hash, name, score, moves, duration, submitted_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?
           WHERE NOT EXISTS (
             SELECT 1 FROM daily_challenges WHERE challenge_date = ? AND install_id_hash = ?
           )`
        ).bind(challengeDate, installIdHash, name, score, moves, duration, now, now, challengeDate, installIdHash),
        // UPDATE if better score (higher score, or same score with fewer moves, or same score+moves with shorter duration)
        env.DB.prepare(
          `UPDATE daily_challenges
           SET score = ?, name = ?, moves = ?, duration = ?, updated_at = ?
           WHERE challenge_date = ? AND install_id_hash = ?
             AND (? > score
               OR (? = score AND ? < moves)
               OR (? = score AND ? = moves AND ? < duration))`
        ).bind(
          score, name, moves, duration, now,
          challengeDate, installIdHash,
          score, score, moves, score, moves, duration
        ),
      ]);

      // 순위 조회: 같은 날짜 내에서 현재 점수보다 높은 기록 수 + 1
      const rankResult = await env.DB.prepare(
        `SELECT COUNT(*) + 1 as rank
         FROM daily_challenges
         WHERE challenge_date = ?
           AND (score > ? OR (score = ? AND moves < ?) OR (score = ? AND moves = ? AND duration < ?))`
      ).bind(challengeDate, score, score, moves, score, moves, duration).first();

      const totalResult = await env.DB.prepare(
        `SELECT COUNT(*) as total FROM daily_challenges WHERE challenge_date = ?`
      ).bind(challengeDate).first();

      const rank = (rankResult as { rank: number } | null)?.rank ?? 1;
      const total = (totalResult as { total: number } | null)?.total ?? 1;

      // 유저의 현재 최고 기록 조회
      const bestResult = await env.DB.prepare(
        `SELECT score, moves, duration FROM daily_challenges
         WHERE challenge_date = ? AND install_id_hash = ?`
      ).bind(challengeDate, installIdHash).first();

      return new Response(
        JSON.stringify({
          success: true,
          rank,
          total,
          bestScore: (bestResult as any)?.score ?? score,
          bestMoves: (bestResult as any)?.moves ?? moves,
          bestDuration: (bestResult as any)?.duration ?? duration,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (dbError) {
      console.error('[DailyChallenge] DB error:', dbError);
      return errorResponse('Failed to save score', 500, corsHeaders);
    }
  } catch (error) {
    console.error('[DailyChallenge] unexpected error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
};
