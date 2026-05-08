export interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfter: number;
}

export interface RateLimitConfig {
  limit: number;
  periodSeconds: number;
}

const RATE_LIMIT_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

export const RATE_LIMITS = {
  SCORE_SUBMIT: { limit: 120, periodSeconds: 60 },
  RANKINGS_READ: { limit: 120, periodSeconds: 60 },
  COMBO_RANKINGS_READ: { limit: 30, periodSeconds: 60 },
  DAILY_SUBMIT: { limit: 60, periodSeconds: 60 },
  DAILY_READ: { limit: 120, periodSeconds: 60 },
  DAILY_SEED: { limit: 60, periodSeconds: 60 },
  WEEKLY_EVENT_SUBMIT: { limit: 30, periodSeconds: 60 },
  WEEKLY_EVENT_ATTEMPTS: { limit: 120, periodSeconds: 60 },
  WEEKLY_EVENT_RANKINGS: { limit: 120, periodSeconds: 60 },
  WEEKLY_EVENT_CLAIM: { limit: 30, periodSeconds: 60 },
  WEEKLY_EVENT_REWARD_STATUS: { limit: 60, periodSeconds: 60 },
  SEASON_REWARD_CHECK: { limit: 60, periodSeconds: 60 },
  SEASON_REWARD_CLAIM: { limit: 30, periodSeconds: 60 },
  SKIN_GIFT_CLAIM: { limit: 120, periodSeconds: 60 },
  ANALYTICS_EVENTS: { limit: 600, periodSeconds: 60 },
  ANALYTICS_NEW_INSTALL: { limit: 10, periodSeconds: 3600 },
  ANALYTICS_INSTALL: { limit: 1800, periodSeconds: 60 },
  ANALYTICS_SESSION: { limit: 240, periodSeconds: 60 },
  ADMIN_AUTH: { limit: 20, periodSeconds: 900 },
  ADMIN_ANALYTICS: { limit: 120, periodSeconds: 60 },
  ADMIN_GIFTS: { limit: 30, periodSeconds: 60 },
  ADMIN_LOGS: { limit: 300, periodSeconds: 60 },
  ADMIN_LOGOUT: { limit: 10, periodSeconds: 60 },
} as const satisfies Record<string, RateLimitConfig>;

const getHeaderValue = (request: Request, name: string): string => {
  return request.headers.get(name) || '';
};

export const getClientIp = (request: Request): string => {
  const cfIp = getHeaderValue(request, 'CF-Connecting-IP');
  if (cfIp) return cfIp;

  const forwarded = getHeaderValue(request, 'X-Forwarded-For');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';

  return 'unknown';
};

export const checkRateLimit = async (
  db: D1Database,
  key: string,
  limit: number,
  periodSeconds: number
): Promise<RateLimitResult> => {
  const periodMs = periodSeconds * 1000;
  const now = Date.now();
  const bucket = Math.floor(now / periodMs);
  const windowStart = bucket * periodMs;
  const bucketKey = `${key}:${bucket}`;

  if (bucket % 30 === 0) {
    try {
      await db.prepare(
        'DELETE FROM rate_limits WHERE window_start < ?'
      ).bind(now - RATE_LIMIT_RETENTION_MS).run();
    } catch (error) {
      console.error('[rateLimit] cleanup failed:', error);
    }
  }

  // RETURNING count으로 증가와 읽기를 원자적으로 처리 (TOCTOU race 방지)
  const result = await db.prepare(
    `INSERT INTO rate_limits (key, window_start, count)
     VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET count = count + 1
     RETURNING count`
  ).bind(bucketKey, windowStart).first<{ count: number }>();

  const count = result?.count ?? 0;
  const retryAfter = Math.ceil((windowStart + periodMs - now) / 1000);
  return { allowed: count <= limit, count, retryAfter };
};

export const checkConfiguredRateLimit = (
  db: D1Database,
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> => checkRateLimit(db, key, config.limit, config.periodSeconds);
