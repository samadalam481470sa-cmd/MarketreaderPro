-- Operator-controlled, immutable historical data imports. No automatic public writes.
CREATE TABLE IF NOT EXISTS historical_datasets (
  dataset_id TEXT PRIMARY KEY CHECK (dataset_id ~ '^[a-f0-9]{64}$'),
  source_label TEXT NOT NULL CHECK (length(source_label) BETWEEN 3 AND 120),
  source_url TEXT CHECK (source_url IS NULL OR source_url LIKE 'https://%'),
  license_note TEXT NOT NULL CHECK (length(license_note) BETWEEN 8 AND 500),
  checksum_sha256 TEXT NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  symbols TEXT[] NOT NULL,
  observation_count INTEGER NOT NULL CHECK (observation_count BETWEEN 35 AND 500),
  asset_count INTEGER NOT NULL CHECK (asset_count BETWEEN 2 AND 12),
  quality JSONB NOT NULL,
  CHECK (end_date >= start_date),
  CHECK (cardinality(symbols)=asset_count)
);
CREATE INDEX IF NOT EXISTS historical_datasets_imported_idx
  ON historical_datasets(imported_at DESC);
CREATE TABLE IF NOT EXISTS historical_daily_closes (
  dataset_id TEXT NOT NULL REFERENCES historical_datasets(dataset_id) ON DELETE CASCADE,
  symbol TEXT NOT NULL CHECK (symbol ~ '^[A-Z0-9._-]{1,20}$'),
  observed_on DATE NOT NULL,
  close_price DOUBLE PRECISION NOT NULL CHECK (close_price > 0 AND close_price <= 1000000000 AND isfinite(close_price)),
  PRIMARY KEY(dataset_id,symbol,observed_on)
);
CREATE INDEX IF NOT EXISTS historical_daily_closes_time_idx
  ON historical_daily_closes(dataset_id,observed_on);
CREATE TABLE IF NOT EXISTS source_health_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_name TEXT NOT NULL CHECK (length(source_name) BETWEEN 2 AND 150),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('ok','partial','unavailable')),
  item_count INTEGER NOT NULL CHECK (item_count >= 0),
  reason_code TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS source_health_events_idx
  ON source_health_events(source_name,checked_at DESC);
