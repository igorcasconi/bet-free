CREATE TABLE ranking_cache (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  competition_id UUID REFERENCES competitions(id) ON DELETE NO ACTION,
  points         INTEGER NOT NULL DEFAULT 0,
  position       INTEGER,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, competition_id)
);

CREATE INDEX ranking_cache_user_id_idx ON ranking_cache (user_id);
CREATE INDEX ranking_cache_competition_id_idx ON ranking_cache (competition_id);
CREATE INDEX ranking_cache_competition_points_idx ON ranking_cache (competition_id, points DESC);

-- UNIQUE(user_id, competition_id) alone does not block duplicate NULLs (competition_id IS NULL = general ranking)
CREATE UNIQUE INDEX ranking_cache_general_unique
  ON ranking_cache (user_id)
  WHERE competition_id IS NULL;

CREATE TRIGGER set_ranking_cache_updated_at
  BEFORE UPDATE ON ranking_cache
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
