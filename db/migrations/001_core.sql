-- MarketreaderPro public market intelligence schema
-- Stores public market observations only; no bank credentials or customer PII.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS market_sources (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_-]{1,31}$'),
  name TEXT NOT NULL,
  homepage TEXT NOT NULL CHECK (homepage LIKE 'https://%'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO market_sources (id,name,homepage) VALUES
 ('kalshi','Kalshi','https://kalshi.com'),
 ('polymarket','Polymarket','https://polymarket.com')
ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS markets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES market_sources(id),
  external_id TEXT NOT NULL CHECK(length(external_id) BETWEEN 1 AND 128),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 500),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_id,external_id)
);
CREATE INDEX IF NOT EXISTS markets_source_last_idx ON markets(source_id,last_seen_at DESC);
CREATE TABLE IF NOT EXISTS market_observations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  market_id BIGINT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  probability NUMERIC(12,8) CHECK (probability IS NULL OR (probability >= 0 AND probability <= 1)),
  price_raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  feed_status TEXT NOT NULL DEFAULT 'ok' CHECK(feed_status IN ('ok','partial')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(market_id,observed_at)
);
CREATE INDEX IF NOT EXISTS observations_market_time_idx ON market_observations(market_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS observations_recorded_idx ON market_observations(recorded_at);
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES market_sources(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  outcome TEXT NOT NULL DEFAULT 'started' CHECK(outcome IN ('started','success','failure')),
  inserted_count INTEGER NOT NULL DEFAULT 0 CHECK(inserted_count >= 0),
  error_code TEXT
);
CREATE INDEX IF NOT EXISTS ingestion_runs_recent_idx ON ingestion_runs(started_at DESC);
