CREATE TABLE sync_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL
              CHECK (type IN ('competitions', 'teams', 'matches', 'live', 'finished')),
  status      TEXT NOT NULL DEFAULT 'running'
              CHECK (status IN ('running', 'finished', 'failed')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX sync_runs_type_idx ON sync_runs (type);

-- Atomicidade do lock: só pode existir 1 linha 'running' por type ao mesmo
-- tempo. Um segundo INSERT concorrente para o mesmo type falha aqui
-- (unique_violation), não numa checagem SELECT-then-INSERT sujeita a race.
CREATE UNIQUE INDEX sync_runs_one_running_per_type
  ON sync_runs (type)
  WHERE status = 'running';

ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sync_runs_deny_all ON sync_runs FOR ALL TO anon, authenticated USING (false);
