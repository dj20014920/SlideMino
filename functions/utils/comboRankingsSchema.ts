type Env = {
  DB: D1Database;
};

export async function ensureComboRankingsSchema(env: Env): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS combo_rankings (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         season_id TEXT NOT NULL,
         install_id_hash TEXT NOT NULL,
         name TEXT NOT NULL,
         best_combo_multiplier REAL NOT NULL DEFAULT 1.0,
         best_combo_count INTEGER NOT NULL DEFAULT 0,
         best_score INTEGER NOT NULL DEFAULT 0,
         game_mode TEXT NOT NULL DEFAULT 'normal',
         updated_at INTEGER NOT NULL
       )`
    ),
    env.DB.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_combo_rankings_uniq
       ON combo_rankings (season_id, install_id_hash)`
    ),
  ]);
}
