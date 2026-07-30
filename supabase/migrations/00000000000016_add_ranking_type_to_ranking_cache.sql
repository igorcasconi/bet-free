-- ranking_cache has zero rows so far (no code has ever written to it),
-- hence no backfill is needed before SET NOT NULL below.
ALTER TABLE ranking_cache ADD COLUMN ranking_type TEXT
  CHECK (ranking_type IN ('accuracy', 'discipline', 'money_saved'));

ALTER TABLE ranking_cache ALTER COLUMN ranking_type SET NOT NULL;

-- ranking_cache_user_id_competition_id_key is the default Postgres naming
-- for an unnamed table-level UNIQUE(user_id, competition_id), confirmed
-- against 00000000000009_create_ranking_cache.sql where no explicit name
-- was given (same care already applied in migration 15 for
-- sync_runs_type_check).
ALTER TABLE ranking_cache DROP CONSTRAINT IF EXISTS ranking_cache_user_id_competition_id_key;
ALTER TABLE ranking_cache ADD CONSTRAINT ranking_cache_user_competition_type_key
  UNIQUE (user_id, competition_id, ranking_type);

DROP INDEX IF EXISTS ranking_cache_general_unique;
CREATE UNIQUE INDEX ranking_cache_general_unique
  ON ranking_cache (user_id, ranking_type)
  WHERE competition_id IS NULL;

DROP INDEX IF EXISTS ranking_cache_competition_points_idx;
CREATE INDEX ranking_cache_competition_points_idx
  ON ranking_cache (competition_id, ranking_type, points DESC);

-- sync_runs_type_check is the default Postgres naming for an unnamed column
-- CHECK constraint (<table>_<column>_check), confirmed against
-- 00000000000012_create_sync_runs.sql where no explicit name was given.
ALTER TABLE sync_runs DROP CONSTRAINT IF EXISTS sync_runs_type_check;
ALTER TABLE sync_runs ADD CONSTRAINT sync_runs_type_check
  CHECK (type IN ('competitions', 'teams', 'matches', 'live', 'finished', 'predictions', 'rankings'));
