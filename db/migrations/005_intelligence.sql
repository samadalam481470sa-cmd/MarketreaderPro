CREATE TABLE IF NOT EXISTS intelligence_items (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('macro','sec')),
 source_key TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL,
 published_at TIMESTAMPTZ NOT NULL, seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 summary TEXT NOT NULL DEFAULT '', UNIQUE(source,source_key)
);
CREATE INDEX IF NOT EXISTS intelligence_items_recent ON intelligence_items(published_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS intelligence_runs (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ,
 status TEXT NOT NULL DEFAULT 'running',
 results JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS daily_briefings (
 briefing_date DATE PRIMARY KEY, timezone TEXT NOT NULL, title TEXT NOT NULL,
 generated_at TIMESTAMPTZ NOT NULL DEFAULT now(), body JSONB NOT NULL
);
