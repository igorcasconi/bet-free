ALTER TABLE competitions ADD COLUMN external_id TEXT;
ALTER TABLE competitions ADD COLUMN external_source TEXT;
ALTER TABLE competitions ADD CONSTRAINT competitions_external_unique UNIQUE (external_source, external_id);

ALTER TABLE teams ADD COLUMN external_id TEXT;
ALTER TABLE teams ADD COLUMN external_source TEXT;
ALTER TABLE teams ADD CONSTRAINT teams_external_unique UNIQUE (external_source, external_id);

ALTER TABLE matches ADD COLUMN external_id TEXT;
ALTER TABLE matches ADD COLUMN external_source TEXT;
ALTER TABLE matches ADD CONSTRAINT matches_external_unique UNIQUE (external_source, external_id);
