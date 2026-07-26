CREATE TABLE user_achievements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE NO ACTION,
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, achievement_id)
);

CREATE INDEX user_achievements_user_id_idx ON user_achievements (user_id);
CREATE INDEX user_achievements_achievement_id_idx ON user_achievements (achievement_id);
