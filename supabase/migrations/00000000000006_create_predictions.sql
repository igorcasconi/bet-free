CREATE TABLE predictions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  match_id             UUID NOT NULL REFERENCES matches(id) ON DELETE NO ACTION,
  predicted_home_score INTEGER NOT NULL,
  predicted_away_score INTEGER NOT NULL,
  points_earned        INTEGER,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, match_id)
);

CREATE INDEX predictions_user_id_idx ON predictions (user_id);
CREATE INDEX predictions_match_id_idx ON predictions (match_id);

CREATE TRIGGER set_predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
