# Daily market intelligence release (v0.9)

## Actual integrated coverage
- Federal Reserve all-press-release RSS (official)
- U.S. Bureau of Labor Statistics headline RSS (official)
- Kalshi and Polymarket public market snapshot APIs
- Optional SEC Form 4 **filing metadata** from up to ten explicitly configured CIKs

Not included: comprehensive Senate/House individual transaction parsing, all government officials, all exchanges, all news channels or licensed news stories. These need additional official feeds, agreements and data-quality reviews. No paywall bypass or scraping of third-party market trackers.

## Start now

```bash
npm install
npm run db:migrate
npm run intelligence:once
npm start
```

Requires PostgreSQL `DATABASE_URL`; see docs/DATABASE.md. Set `SEC_USER_AGENT` to a real operator contact and `MRP_SEC_CIKS` to comma-separated CIKs for SEC inclusion. No SE CIKs means no SEC lookup within scheduled digest.

Open `http://localhost:3000` for the Morning Intelligence panel and `GET /api/intelligence`. Run the job again to update. An outage in one source doesn't prevent a partial briefing.

## Daily 7 AM America/Chicago

Run the CLI on a persistent host with scheduler support (crontab / managed CronJob) rather than in the browser:

```bash
# Host machine timezone must be America/Chicago. Schedule as an unprivileged user.
0 7 * * * cd /path/to/MarketreaderPro && /usr/bin/node scripts/intelligence.js >> /path/to/logs/intelligence.log 2>&1
```

The timezone of the scheduler must be verified. The script uses America/Chicago for briefing dates, so daylight-saving changes are reflected in the database date. Restart / failure alerts belong in your hosting provider.

## Quality and safety
- Content is brief source metadata, not copied full articles.
- Source identifiers deduplicate published entries; SQL parameters protect queries.
- API returns persisted records only when database configured and ingestion ran.
- The briefing is deterministic, source-linked, and **not LLM-produced**. Optional AI elsewhere in the app remains disabled by default.
- SEC Form 4 metadata does not prove suspicious transactions.
- **No morning briefing exists before the first successful ingestion job.**
- Credentials and banking services are not used by ingestion.

## Automatic daily worker in Docker Compose

After running the database migration, launch the background worker on an always-on host:

```bash
docker compose --profile intelligence up -d intelligence-worker
```

The worker targets 7:00 AM in America/Chicago including daylight saving, attempts one briefing per local calendar day, and uses a Postgres advisory lock to prevent duplicate concurrent runs. It can continue working while a user's computer is off **only if deployed on an always-on server**. No cloud host has been provisioned by this repository. A dashboard visit alone does not start the scheduler. Use `docker compose logs intelligence-worker` for diagnostic output.

## Optional AI contextual summary

In the server's secrets manager set `AI_BRIEFING_ENABLED=true`, `AI_API_KEY` and `AI_MODEL`. Re-run `npm run intelligence:once` or wait for a scheduled next-day briefing. The worker sends at most fifteen **public** source titles, timestamps and URLs to the configured AI provider. The AI commentary is labeled and is never treated as a verified price, a trade recommendation, or a replacement for the original linked sources. If the provider fails, the factual digest still saves successfully. AI costs and provider terms apply.

The Docker worker must be provisioned with these environment variables separately; merely setting variables on the host shell does not automatically expose them inside the worker container.

## Expanded coverage (v1.0)

- GDELT article discovery across four bounded public-news topics (markets, crypto, commodities and government-financial policy). The app records the original publisher URL and title, not article content. GDELT does not include every news organization and rate limits/unavailability are possible.
- Paginated Kalshi and Polymarket public market discovery (default three pages × up to 100 markets per source). Results are a rolling snapshot, not a guaranteed full-exchange mirror.
- Up to 50 operator-supplied SEC CIK identifiers (metadata only). Requests are paced. Tracking every individual filer globally is not implemented.
- `GET /api/coverage` shows connector outcomes and last successful collection. Source failures remain visible.

Official House and Senate portals remain links; automated transaction-by-transaction Congress ingestion and complete global financial-market quotes require separately verified feeds, commercial permissions where applicable, and additional code. Senate disclosure data has restrictions on some commercial uses.

## Source accuracy and freshness

The ingestion pipeline validates HTTPS source URLs, source timestamps, sane market quote ranges and duplicates. The web app displays when the briefing was generated, when news was published and when public market feeds were retrieved. These timestamps are different: retrieving a price does not prove when the exchange first published it. Stale records remain marked instead of being presented as current. Invalid source data is rejected and counted as a quality warning. LLM commentary is clearly separate from verified source records and may be wrong; users should inspect the linked primary filings and market terms before taking any action.
