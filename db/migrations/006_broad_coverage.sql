ALTER TABLE intelligence_items DROP CONSTRAINT IF EXISTS intelligence_items_category_check;
ALTER TABLE intelligence_items ADD CONSTRAINT intelligence_items_category_check CHECK(category IN ('macro','sec','news','government'));
CREATE TABLE IF NOT EXISTS source_coverage (
 source_name TEXT PRIMARY KEY,
 last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_success_at TIMESTAMPTZ,
 last_status TEXT NOT NULL CHECK(last_status IN ('ok','partial','unavailable')),
 item_count INTEGER NOT NULL DEFAULT 0,
 note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS coverage_recent ON source_coverage(last_attempt_at DESC);
