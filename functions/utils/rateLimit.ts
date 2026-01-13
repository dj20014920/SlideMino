export interface RateLimitResult {
  allowed: boolean;
  count: number;
}

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

  await db.prepare(
    `INSERT INTO rate_limits (key, window_start, count)
     VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET count = count + 1`
  ).bind(bucketKey, windowStart).run();

  const row = await db.prepare(
    `SELECT count FROM rate_limits WHERE key = ?`
  ).bind(bucketKey).first<{ count: number }>();

  const count = row?.count ?? 0;
  return { allowed: count <= limit, count };
};
