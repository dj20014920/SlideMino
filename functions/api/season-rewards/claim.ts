/**
 * 시즌 보상 수령 API
 * 특정 시즌+난이도 보상을 수령 처리
 */

import { hashInstallId } from '../../utils/hash';
import { checkRateLimit, getClientIp } from '../../utils/rateLimit';
import { buildCorsHeaders } from '../../utils/cors';

interface Env {
  DB: D1Database;
  ANALYTICS_HASH_SALT?: string;
}

interface ClaimRequest {
  installId?: unknown;
  seasonId?: unknown;
  difficulty?: unknown;
}

/** User-Agent 기반 네이티브 앱 여부 판정 (클라이언트 입력을 신뢰하지 않음) */
function isNativeAppRequest(request: Request): boolean {
  const ua = (request.headers.get('User-Agent') ?? '').toLowerCase();
  // Capacitor/iOS WebView 또는 Android WebView에서 오는 요청만 네이티브로 인정
  return ua.includes('capacitor') || ua.includes('slidemino')
    || (ua.includes('mobile') && (ua.includes('wv') || ua.includes('crosswalk')));
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
    const { allowed } = await checkRateLimit(env.DB, `season-claim:${clientIP}`, 30, 60);
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

    // 보상 수령 처리 (미수령 + 미만료만)
    const result = await env.DB.prepare(
      `UPDATE season_rewards
       SET claimed_at = ?
       WHERE season_id = ?
         AND difficulty = ?
         AND install_id_hash = ?
         AND claimed_at IS NULL
         AND expires_at > ?`
    ).bind(now, data.seasonId, data.difficulty, installHash, now).run();

    if (!result.meta.changes || result.meta.changes === 0) {
      // 이미 수령했거나 만료됨 — 에러가 아닌 성공으로 처리 (멱등성)
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
