CREATE TABLE IF NOT EXISTS rankings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  difficulty TEXT,
  duration INTEGER,
  moves INTEGER,
  timestamp INTEGER
);

CREATE INDEX IF NOT EXISTS idx_rankings_score ON rankings (score DESC);
