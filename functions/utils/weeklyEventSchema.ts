interface EventSchemaEnv {
  DB: D1Database;
}

const ensureRewardClaimedColumn = async (env: EventSchemaEnv): Promise<void> => {
  const columnsResult = await env.DB.prepare('PRAGMA table_info(event_rankings)').all<{ name: string }>();
  const columnNames = new Set((columnsResult.results ?? []).map((column) => String(column.name)));
  if (!columnNames.has('reward_claimed_at')) {
    await env.DB.prepare(
      'ALTER TABLE event_rankings ADD COLUMN reward_claimed_at INTEGER'
    ).run();
  }
};

export async function ensureWeeklyEventSchema(env: EventSchemaEnv): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS event_attempts (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         event_id TEXT NOT NULL,
         install_id_hash TEXT NOT NULL,
         attempt_number INTEGER NOT NULL,
         score INTEGER NOT NULL,
         moves INTEGER NOT NULL,
         duration INTEGER NOT NULL,
         started_at INTEGER NOT NULL,
         submitted_at INTEGER NOT NULL
       )`
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS event_rankings (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         event_id TEXT NOT NULL,
         install_id_hash TEXT NOT NULL,
         name TEXT NOT NULL,
         score INTEGER NOT NULL,
         moves INTEGER NOT NULL,
         duration INTEGER NOT NULL,
         submitted_at INTEGER NOT NULL,
         updated_at INTEGER NOT NULL,
         reward_claimed_at INTEGER
       )`
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS event_ranking_badges (
         event_id TEXT NOT NULL,
         install_id_hash TEXT NOT NULL,
         level_badge TEXT NOT NULL,
         updated_at INTEGER NOT NULL,
         PRIMARY KEY (event_id, install_id_hash)
       )`
    ),
  ]);

  await ensureRewardClaimedColumn(env);

  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM event_attempts
       WHERE rowid IN (
         SELECT rowid
         FROM (
           SELECT
             rowid,
             ROW_NUMBER() OVER (
               PARTITION BY event_id, install_id_hash, attempt_number
               ORDER BY submitted_at ASC, rowid ASC
             ) AS row_num
           FROM event_attempts
         ) ranked
         WHERE ranked.row_num > 1
       )`
    ),
    env.DB.prepare(
      `DELETE FROM event_rankings
       WHERE rowid IN (
         SELECT rowid
         FROM (
           SELECT
             rowid,
             ROW_NUMBER() OVER (
               PARTITION BY event_id, install_id_hash
               ORDER BY score DESC, moves ASC, duration ASC, updated_at ASC, rowid ASC
             ) AS row_num
           FROM event_rankings
         ) ranked
         WHERE ranked.row_num > 1
       )`
    ),
    env.DB.prepare(
      `DELETE FROM event_ranking_badges
       WHERE rowid IN (
         SELECT rowid
         FROM (
           SELECT
             rowid,
             ROW_NUMBER() OVER (
               PARTITION BY event_id, install_id_hash
               ORDER BY updated_at DESC, rowid DESC
             ) AS row_num
           FROM event_ranking_badges
         ) ranked
         WHERE ranked.row_num > 1
       )`
    ),
  ]);

  await env.DB.batch([
    env.DB.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_event_attempts_uniq
       ON event_attempts (event_id, install_id_hash, attempt_number)`
    ),
    env.DB.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_event_rankings_uniq
       ON event_rankings (event_id, install_id_hash)`
    ),
    env.DB.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_event_ranking_badges_uniq
       ON event_ranking_badges (event_id, install_id_hash)`
    ),
  ]);
}
