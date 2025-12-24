interface Env {
  DB: D1Database;
}

function getMonthStartUtcMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0);
}

export async function resetRankingsIfNewMonth(env: Env, now: Date = new Date()): Promise<void> {
  const monthStart = getMonthStartUtcMs(now);

  const last = await env.DB.prepare(
    'SELECT MAX(updated_at) AS last_updated FROM rankings'
  ).first<{ last_updated: number | null }>();

  if (!last?.last_updated || last.last_updated >= monthStart) {
    return;
  }

  await env.DB.prepare('DELETE FROM rankings').run();
}
