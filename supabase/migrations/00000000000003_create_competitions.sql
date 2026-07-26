CREATE TABLE competitions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  season     TEXT NOT NULL,
  logo_url   TEXT,
  status     TEXT NOT NULL DEFAULT 'upcoming'
             CHECK (status IN ('upcoming', 'active', 'finished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX competitions_status_idx ON competitions (status);

CREATE TRIGGER set_competitions_updated_at
  BEFORE UPDATE ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
