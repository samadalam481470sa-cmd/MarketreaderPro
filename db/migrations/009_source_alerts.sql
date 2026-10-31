-- Persist source-health incident transitions; separate operational alerts from prices.
CREATE TABLE IF NOT EXISTS source_health_alerts (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_name TEXT NOT NULL CHECK(length(source_name) BETWEEN 2 AND 150),
 state TEXT NOT NULL CHECK(state IN ('degraded','critical','stale','unknown')),
 opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 resolved_at TIMESTAMPTZ,
 observations INTEGER NOT NULL DEFAULT 1 CHECK(observations >= 1),
 reasons TEXT[] NOT NULL DEFAULT '{}',
 details JSONB NOT NULL DEFAULT '{}'::jsonb,
 CHECK(resolved_at IS NULL OR resolved_at >= opened_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS source_alert_one_active_idx
 ON source_health_alerts(source_name) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS source_alert_timeline_idx
 ON source_health_alerts(opened_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS source_alert_resolved_idx
 ON source_health_alerts(resolved_at DESC) WHERE resolved_at IS NOT NULL;
