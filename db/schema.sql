-- Raid Clash Tracker — local SQLite (libSQL) schema.
-- Applied by `npm run db:init` (scripts/db-init.ts). Safe to re-run.
-- IDs are text so the bundled seed (m-..., w25, ...) keeps referential integrity;
-- ingestion derives stable ids from member name + week number.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
  id           TEXT PRIMARY KEY,
  in_game_name TEXT NOT NULL,
  level        INTEGER NOT NULL DEFAULT 0,
  hero_level   INTEGER NOT NULL DEFAULT 0,
  avatar_url   TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weeks (
  id          TEXT PRIMARY KEY,
  week_number INTEGER NOT NULL UNIQUE,
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clash_results (
  id           TEXT PRIMARY KEY,
  week_id      TEXT NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  member_id    TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  clash_type   TEXT NOT NULL CHECK (clash_type IN ('hydra', 'chimera')),
  keys_used    REAL NOT NULL DEFAULT 0,
  total_damage INTEGER NOT NULL DEFAULT 0,
  UNIQUE (week_id, member_id, clash_type)
);

CREATE TABLE IF NOT EXISTS clash_meta (
  week_id    TEXT NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  clash_type TEXT NOT NULL CHECK (clash_type IN ('hydra', 'chimera')),
  progress   REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (week_id, clash_type)
);

CREATE INDEX IF NOT EXISTS idx_clash_results_week ON clash_results(week_id);
CREATE INDEX IF NOT EXISTS idx_clash_results_member ON clash_results(member_id);

-- Convenience view for ad-hoc inspection of damage-per-key.
CREATE VIEW IF NOT EXISTS member_clash_averages AS
SELECT
  cr.member_id,
  m.in_game_name,
  cr.clash_type,
  AVG(cr.keys_used)                                              AS avg_keys,
  AVG(cr.total_damage)                                          AS avg_damage,
  CAST(SUM(cr.total_damage) AS REAL) / NULLIF(SUM(cr.keys_used), 0) AS avg_damage_per_key
FROM clash_results cr
JOIN members m ON m.id = cr.member_id
WHERE cr.keys_used > 0
GROUP BY cr.member_id, m.in_game_name, cr.clash_type;
