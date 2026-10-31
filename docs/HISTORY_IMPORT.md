# Provenance-preserving historical imports

Historical data are **operator-uploaded, license-annotated CSVs**. The application does not scrape protected financial data, infer vendor rights, or silently create live stock prices.

## Input and provenance

Use an aligned closing-price CSV with 2–12 security columns and 35–500 date rows, such as:

```text
date,AAA,BBB
2025-01-02,100.50,71.20
2025-01-03,100.80,70.90
```

This example illustrates only the shape; real imports need at least 35 rows. Your supplier's prices should be split/dividend/currency-adjusted as appropriate for your analysis. The app does not verify prices against a licensed exchange feed.

Run a data-quality check without the database:

```bash
npm run history:import -- --file /path/to/prices.csv --source "Authorized historical vendor" --license "Internal research permitted" --dry-run
```

Persist the validated dataset to PostgreSQL (after `npm run db:migrate`):

```bash
npm run history:import -- --file /path/to/prices.csv --source "Authorized historical vendor" --license "Internal research permitted" --url "https://example.org/vendor"
npm run history:catalog
```

Use the genuine provider name and access/redistribution license terms. A license note is an operator assertion, not independent verification. **Do not publish sensitive or restricted historical datasets merely because they were imported.**

## Storage properties

The import validates symbol names, dates and price bounds, then checks for calendar gaps, unchanged-price concentration, large single-bar returns, and old sample end dates.

The PostgreSQL transaction creates:

- One `historical_datasets` metadata row with SHA-256 checksum, source label, date span, symbols, license note, and a stored quality assessment.
- A set of `historical_daily_closes` rows using the dataset ID as a foreign key. Observations are inserted atomically.
- Duplicate imports with the exact same normalized data **and source metadata** result in the same ID and no duplicate observations.
- Different source/permission notes create separate immutable archival datasets even when prices match.

No source is asserted current or factually verified. Invalid/missing prices and unaligned or nonascending dates cause a rejected import.

## Privacy and opt-in exports

No public data-import endpoint exists. Local operators import via an explicit CLI command. `GET /api/historical-catalog` and `GET /api/historical-dataset?id=SHA256` both return HTTP 403 by default.

Set `MRP_PUBLIC_HISTORY=true` **only if all imported data may lawfully be redistributed publicly**. This exposes the catalog and every stored dataset, not just selected ones; do not enable it with restricted data. The recommended deployment leaves this flag unset.

## Database and retention

`db/migrations/008_history_quality.sql` creates the relevant tables. Existing imports are preserved until deliberately deleted by a database administrator. Back up PostgreSQL and do not expose its port publicly.

The import is bounded to 160 KB CSVs and at most 6,000 daily rows per batch. No automatic external provider crawling is added.
