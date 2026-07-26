CREATE TABLE matches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE NO ACTION,
  home_team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE NO ACTION,
  away_team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE NO ACTION,
  match_date     TIMESTAMPTZ NOT NULL,
  round          TEXT,
  status         TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  home_score     INTEGER,
  away_score     INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX matches_competition_id_idx ON matches (competition_id);
CREATE INDEX matches_home_team_id_idx ON matches (home_team_id);
CREATE INDEX matches_away_team_id_idx ON matches (away_team_id);
CREATE INDEX matches_status_match_date_idx ON matches (status, match_date);

CREATE TRIGGER set_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
