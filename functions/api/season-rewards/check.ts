/**
 * 시즌 보상 확인 API
 * 미수령 보상 목록 + 현재 시즌 정보 반환
 */

import { hashInstallId } from '../../utils/hash';
import { getSeasonBoundaries, resetSeasonIfNeeded } from '../../utils/seasonReset';
import { checkConfiguredRateLimit, getClientIp, RATE_LIMITS } from '../../utils/rateLimit';
import { buildCorsHeaders } from '../../utils/cors';

interface Env {
  DB: D1Database;
  ANALYTICS_HASH_SALT?: string;
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request, 'GET, OPTIONS'),
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = buildCorsHeaders(request, 'GET, OPTIONS');

  try {
    // Rate limiting
    const clientIP = getClientIp(request);
    const { allowed } = await checkConfiguredRateLimit(env.DB, `season-check:${clientIP}`, RATE_LIMITS.SEASON_REWARD_CHECK);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const installId = url.searchParams.get('installId');
    if (!installId || installId.length < 8 || installId.length > 128) {
      return new Response(JSON.stringify({ error: 'Missing installId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 시즌 교체 직후 보상 미생성 방지
    await resetSeasonIfNeeded(env);

    const installHash = await hashInstallId(installId, env.ANALYTICS_HASH_SALT);
    if (!installHash) {
      return new Response(JSON.stringify({ rewards: [], seasonInfo: null }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 미수령 + 미만료 보상 조회
    const now = Date.now();
    const { results } = await env.DB.prepare(
      `SELECT season_id, difficulty, reward_type, fragment_amount
       FROM season_rewards
       WHERE install_id_hash = ?
         AND claimed_at IS NULL
         AND expires_at > ?
       ORDER BY created_at DESC`
    ).bind(installHash, now).all();

    // 현재 시즌 정보
    const seasonInfo = getSeasonBoundaries(new Date());

    return new Response(
      JSON.stringify({
        rewards: results ?? [],
        seasonInfo: {
          seasonId: seasonInfo.seasonId,
          endsAt: seasonInfo.seasonEndMs,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Season rewards check error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
