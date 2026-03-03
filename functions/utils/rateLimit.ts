export interface RateLimitResult {
  allowed: boolean;
  count: number;
}

const RATE_LIMIT_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

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
  return { allowed: count <= limit, count };
};
