-- Fuses the stale-lock reap and the lock acquisition into a single
-- round-trip (was 2 separate statements from the app: UPDATE then INSERT).
CREATE OR REPLACE FUNCTION acquire_sync_lock(
  p_type TEXT,
  p_stale_after_seconds INTEGER DEFAULT 600
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  UPDATE sync_runs
  SET status = 'failed', finished_at = now()
  WHERE type = p_type
    AND status = 'running'
    AND started_at < now() - (p_stale_after_seconds || ' seconds')::interval;

  INSERT INTO sync_runs (type, status)
  VALUES (p_type, 'running')
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;
