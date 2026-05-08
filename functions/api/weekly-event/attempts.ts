/**
 * 주간 이벤트 도전 횟수 조회 API
 * GET /api/weekly-event/attempts?eventId=...&installId=...
 */
import { hashInstallId } from '../../utils/hash';
import { buildCorsHeaders } from '../../utils/cors';
import { checkConfiguredRateLimit, getClientIp, RATE_LIMITS } from '../../utils/rateLimit';
import { ensureWeeklyEventSchema } from '../../utils/weeklyEventSchema';

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
    const clientIP = getClientIp(request);
    const { allowed } = await checkConfiguredRateLimit(env.DB, `event-attempts:${clientIP}`, RATE_LIMITS.WEEKLY_EVENT_ATTEMPTS);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const eventId = url.searchParams.get('eventId');
    const installId = url.searchParams.get('installId');

    await ensureWeeklyEventSchema(env);

    if (!eventId || !installId) {
      return new Response(JSON.stringify({ count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const installIdHash = await hashInstallId(installId, env.ANALYTICS_HASH_SALT);
    if (!installIdHash) {
      return new Response(JSON.stringify({ count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM event_attempts
       WHERE event_id = ? AND install_id_hash = ?`
    ).bind(eventId, installIdHash).first();

    const count = (result as { count: number } | null)?.count ?? 0;

    return new Response(JSON.stringify({ count }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[WeeklyEvent/attempts] error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', count: 0 }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
