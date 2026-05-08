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
  validateComboCount,
} from '../../utils/validation';
import { hashInstallId } from '../../utils/hash';
import { checkConfiguredRateLimit, getClientIp, RATE_LIMITS } from '../../utils/rateLimit';
import { buildCorsHeaders, createJsonResponse, isCrossSiteMutation, isTrustedRequestOrigin } from '../../utils/cors';
import { getSeasonBoundaries } from '../../utils/seasonReset';
import { ensureComboRankingsSchema } from '../../utils/comboRankingsSchema';

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
    // CSRF Protection
    if (isCrossSiteMutation(request) || !isTrustedRequestOrigin(request)) {
      return createJsonResponse(request, 'POST, OPTIONS', { error: 'Blocked by origin policy' }, 403);
    }

    // Rate limiting
    const clientIP = getClientIp(request);
    const { allowed } = await checkConfiguredRateLimit(env.DB, `daily-submit:${clientIP}`, RATE_LIMITS.DAILY_SUBMIT);
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
    const rawCombo = typeof data.comboMultiplier === 'number' && Number.isFinite(data.comboMultiplier) && data.comboMultiplier >= 1 ? data.comboMultiplier : 1;
    const comboMultiplier = Math.max(1, Math.min(3, rawCombo)); // 1~3 clamp
    const comboCount = validateComboCount(data.comboCount ?? 0);
    const consistency = validateGameConsistency(score, '5', duration, moves, undefined, comboMultiplier);
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
      await ensureComboRankingsSchema(env);

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
        ...(comboCount > 0 || comboMultiplier > 1.0
          ? [
            env.DB.prepare(
              `INSERT INTO combo_rankings (season_id, install_id_hash, name, best_combo_multiplier, best_combo_count, best_score, game_mode, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(season_id, install_id_hash) DO UPDATE SET
                 name = excluded.name,
                 best_combo_multiplier = excluded.best_combo_multiplier,
                 best_combo_count = excluded.best_combo_count,
                 best_score = excluded.best_score,
                 game_mode = excluded.game_mode,
                 updated_at = excluded.updated_at
                WHERE excluded.best_combo_count > combo_rankings.best_combo_count
                   OR (excluded.best_combo_count = combo_rankings.best_combo_count AND excluded.best_combo_multiplier > combo_rankings.best_combo_multiplier)
                   OR (excluded.best_combo_count = combo_rankings.best_combo_count AND excluded.best_combo_multiplier = combo_rankings.best_combo_multiplier AND excluded.best_score > combo_rankings.best_score)`
             ).bind(getSeasonBoundaries(new Date(now)).seasonId, installIdHash, name, comboMultiplier, comboCount, score, 'daily_challenge', now),
          ]
          : []),
      ]);

      // 유저의 현재 최고 기록 조회
      const bestResult = await env.DB.prepare(
        `SELECT score, moves, duration FROM daily_challenges
         WHERE challenge_date = ? AND install_id_hash = ?`
      ).bind(challengeDate, installIdHash).first();

      const bestScore = (bestResult as any)?.score ?? score;
      const bestMoves = (bestResult as any)?.moves ?? moves;
      const bestDuration = (bestResult as any)?.duration ?? duration;

      // 순위 조회: 실제 저장된 최고 기록 기준으로 계산
      const rankResult = await env.DB.prepare(
        `SELECT COUNT(*) + 1 as rank
         FROM daily_challenges
         WHERE challenge_date = ?
           AND (score > ? OR (score = ? AND moves < ?) OR (score = ? AND moves = ? AND duration < ?))`
      ).bind(challengeDate, bestScore, bestScore, bestMoves, bestScore, bestMoves, bestDuration).first();

      const totalResult = await env.DB.prepare(
        `SELECT COUNT(*) as total FROM daily_challenges WHERE challenge_date = ?`
      ).bind(challengeDate).first();

      const rank = (rankResult as { rank: number } | null)?.rank ?? 1;
      const total = (totalResult as { total: number } | null)?.total ?? 1;

      return new Response(
        JSON.stringify({
          success: true,
          rank,
          total,
          bestScore,
          bestMoves,
          bestDuration,
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
