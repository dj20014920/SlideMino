/**
 * 시즌 보상 수령 API
 * 특정 시즌+난이도 보상을 수령 처리
 */

import { hashInstallId } from '../../utils/hash';
import { checkConfiguredRateLimit, getClientIp, RATE_LIMITS } from '../../utils/rateLimit';
import { buildCorsHeaders, createJsonResponse, isCrossSiteMutation, isTrustedRequestOrigin } from '../../utils/cors';
import { isNativeAppRequest } from '../../utils/platform';

interface Env {
  DB: D1Database;
  ANALYTICS_HASH_SALT?: string;
}

interface ClaimRequest {
  installId?: unknown;
  seasonId?: unknown;
  difficulty?: unknown;
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
    // Rate limiting
    const clientIP = getClientIp(request);
    const { allowed } = await checkConfiguredRateLimit(env.DB, `season-claim:${clientIP}`, RATE_LIMITS.SEASON_REWARD_CLAIM);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let data: ClaimRequest;
    try {
      data = await request.json() as ClaimRequest;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 입력 검증
    if (typeof data.installId !== 'string' || data.installId.length < 8) {
      return new Response(JSON.stringify({ error: 'Invalid installId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // printable ASCII + escape sequence 차단
    if (!/^[\x20-\x7E]+$/.test(data.installId)) {
      return new Response(JSON.stringify({ error: 'Invalid installId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (typeof data.seasonId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.seasonId)) {
      return new Response(JSON.stringify({ error: 'Invalid seasonId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (typeof data.difficulty !== 'string' || !['4', '5', '7', '8', '10'].includes(data.difficulty)) {
      return new Response(JSON.stringify({ error: 'Invalid difficulty' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 웹 유저는 스킨 조각 보상 수령 불가 (서버측 UA 기반 판정 — 클라이언트 입력 불신)
    if (!isNativeAppRequest(request)) {
      return new Response(JSON.stringify({ error: 'Web users cannot claim skin fragment rewards' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const installHash = await hashInstallId(data.installId, env.ANALYTICS_HASH_SALT);
    if (!installHash) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = Date.now();

    // 트랜잭션: SELECT 선검증 + 조건부 UPDATE (레이스 방지)
    const selectStmt = env.DB.prepare(
      `SELECT claimed_at FROM season_rewards
       WHERE season_id = ? AND difficulty = ? AND install_id_hash = ?`
    ).bind(data.seasonId, data.difficulty, installHash);

    const updateStmt = env.DB.prepare(
      `UPDATE season_rewards
       SET claimed_at = ?
       WHERE season_id = ?
         AND difficulty = ?
         AND install_id_hash = ?
         AND claimed_at IS NULL
         AND expires_at > ?`
    ).bind(now, data.seasonId, data.difficulty, installHash, now);

    const [selectResult, updateResult] = await env.DB.batch([selectStmt, updateStmt]);

    // SELECT 결과 확인: 이미 수령된 경우
    const rows = selectResult.results as { claimed_at: number | null }[] | undefined;
    if (rows && rows.length > 0 && rows[0].claimed_at !== null) {
      return new Response(
        JSON.stringify({ success: true, fragmentAmount: 0, alreadyClaimed: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // UPDATE 결과 확인: 동시 요청으로 인한 레이스
    if (!updateResult.meta.changes || updateResult.meta.changes === 0) {
      return new Response(
        JSON.stringify({ success: true, fragmentAmount: 0, alreadyClaimed: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 수령한 보상의 조각 수 조회
    const reward = await env.DB.prepare(
      `SELECT fragment_amount FROM season_rewards
       WHERE season_id = ? AND difficulty = ? AND install_id_hash = ?`
    ).bind(data.seasonId, data.difficulty, installHash).first<{ fragment_amount: number }>();

    return new Response(
      JSON.stringify({
        success: true,
        fragmentAmount: reward?.fragment_amount ?? 0,
        alreadyClaimed: false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Season rewards claim error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
