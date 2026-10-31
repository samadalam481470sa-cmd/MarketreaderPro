# Measured source-health monitoring

The morning intelligence collector writes a status event for each official news feed, GDELT topic, configured SEC filer, and scanned prediction-market source.

Source-health history is stored in `source_health_events`, while the most recent source state is stored in `source_coverage`. Both are introduced/used through the PostgreSQL migration chain.

`GET /api/data-health` produces an operational evaluation:

- **Healthy:** recent successful collection without material errors.
- **Degraded:** partial collection, stale success or too many recent failures.
- **Critical:** last attempt unavailable, or repeated consecutive unsuccessful attempts.
- **Stale:** last attempt older than the configured default 36-hour freshness window.
- **Unknown/unconfigured:** there are no useful measurements yet.

Each source includes the last attempt/success timestamps, item count, recent 20-attempt weighted success proportion, and consecutive non-success count.

Operational freshness **does not confirm that vendor prices, economic news, or government records are complete, timely or legally licensed**. A feed may return zero items while responding successfully; assess this separately against known published-source cadence.

The app's **Source Coverage** dashboard now shows the database-backed health status and counts. The operator can inspect the API without connecting a personal bank or brokerage account.

The health history is measured each time the intelligence job runs. It does not install a recurring job by itself. See [intelligence scheduling](INTELLIGENCE.md).


## Durable source incidents (v1.8)

The collector also writes to `source_health_alerts` through `apps/api/quality-alerts.js`. An unresolved incident is unique per source:

- A degraded, critical, stale or unknown source has one active incident. Repeated unhealthy checks update its state, last-seen time, reason codes and observation counter.
- A subsequent **fresh healthy** collection resolves its incident and preserves the historical record.
- A source disappearing from collection is never silently considered recovered.
- A later outage after recovery creates a new incident rather than erasing the original event.

`GET /api/source-incidents` shows up to 30 active incidents by default. `?resolved=true&limit=100` includes prior resolved incidents. These routes describe the app's feed operations—not completeness, truthfulness or tradeability of source content.

The schema uses a partial unique index preventing duplicate unresolved incidents and supports database integration tests for outage → recovery → second outage.
