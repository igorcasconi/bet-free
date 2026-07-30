ALTER TABLE predictions
  ADD COLUMN wagered_amount NUMERIC(10,2) CHECK (wagered_amount > 0);

ALTER TABLE users
  ADD COLUMN last_streak_date DATE;

-- sync_runs_type_check is the default Postgres naming for an unnamed column
-- CHECK constraint (<table>_<column>_check), confirmed against
-- 00000000000012_create_sync_runs.sql where no explicit name was given.
ALTER TABLE sync_runs DROP CONSTRAINT IF EXISTS sync_runs_type_check;
ALTER TABLE sync_runs ADD CONSTRAINT sync_runs_type_check
  CHECK (type IN ('competitions', 'teams', 'matches', 'live', 'finished', 'predictions'));
