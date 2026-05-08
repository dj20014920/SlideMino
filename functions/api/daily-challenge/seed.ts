/**
 * 데일리 챌린지 시드 API
 * 
 * 오늘의 챌린지 시드를 반환한다.
 * 시드 = SHA-256(YYYYMMDD + SERVER_SECRET_SALT) 의 앞 8자리를 정수로 변환.
 * 클라이언트는 이 시드를 mulberry32 PRNG에 넣어 동일한 블록 시퀀스를 재현한다.
 */

import { sha256Hex } from '../../utils/hash';
import { buildCorsHeaders } from '../../utils/cors';
import { checkConfiguredRateLimit, getClientIp, RATE_LIMITS } from '../../utils/rateLimit';

interface Env {
  DB: D1Database;
  DAILY_CHALLENGE_SALT?: string;   // 시드 생성용 서버 비밀 솔트
}

// KST = UTC+9
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 오늘 날짜를 YYYYMMDD 문자열로 반환 */
function getTodayKst(): string {
  const now = new Date();
  const kstMs = now.getTime() + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** KST 기준 오늘 자정(00:00)의 UTC ms — 타이머/만료 계산용 */
function getTodayEndKstMs(): number {
  const now = new Date();
  const kstMs = now.getTime() + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  // 내일 00:00 KST = 오늘 자정
  const tomorrowKst = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1));
  return tomorrowKst.getTime() - KST_OFFSET_MS;
}

/**
 * 날짜 문자열 + 솔트로부터 PRNG 시드(정수) 생성
 */
async function generateSeed(dateStr: string, salt: string): Promise<number> {
  const hash = await sha256Hex(`${dateStr}:${salt}`);
  // 앞 8자리 16진수를 정수로 변환 (0 ~ 4,294,967,295)
  return parseInt(hash.substring(0, 8), 16);
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
    const { allowed } = await checkConfiguredRateLimit(env.DB, `daily-seed:${clientIP}`, RATE_LIMITS.DAILY_SEED);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const salt = env.DAILY_CHALLENGE_SALT;
    if (!salt) {
      console.error('[DailyChallenge] DAILY_CHALLENGE_SALT not configured');
      return new Response(JSON.stringify({ error: 'Service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const todayStr = getTodayKst();
    const seed = await generateSeed(todayStr, salt);
    const endsAt = getTodayEndKstMs();

    return new Response(
      JSON.stringify({
        challengeDate: todayStr,
        seed,
        endsAt,        // UTC ms — 클라이언트에서 카운트다운 표시용
        boardSize: 5,  // 데일리 챌린지는 5×5 고정
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
    console.error('[DailyChallenge] seed error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
