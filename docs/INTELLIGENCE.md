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
