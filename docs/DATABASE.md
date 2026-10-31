# Database architecture

## Licensed upstream components
The schema and data access layer in this repository are newly authored. The database engine uses PostgreSQL (PostgreSQL License, https://github.com/postgres/postgres); the official node-postgres `pg` driver (MIT, https://github.com/brianc/node-postgres) is an npm dependency. No third-party datasets, private customer information, or other repositories' proprietary application code have been copied.

## Setup
Node.js 22+, PostgreSQL 17+ recommended.

```bash
npm install
export DATABASE_URL='postgres://marketreader:YOUR_PASSWORD@localhost:5432/marketreader'
npm run db:migrate
npm run db:ingest
npm start
```

Local Docker (choose a unique strong password):

```bash
export POSTGRES_PASSWORD='replace-this-with-a-unique-long-secret'
docker compose up -d --build postgres web
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm ingest
```

Visit `http://localhost:3000/api/db/status` and `/api/history?source=kalshi&id=MARKET_TICKER&limit=100`.

For public production deployments: use managed PostgreSQL, encryption in transit, a private network, database backups, least-privilege roles, secrets management and an external ingestion scheduler. Do not expose the database port publicly. Never commit credentials.

## Tables
`schema_migrations` records database versions.
`market_sources` identifies allowed public providers.
`markets` stores unique provider market IDs with first/last seen dates.
`market_observations` stores source provenance, time stamps, and normalized probabilities where safely supported.
`ingestion_runs` records ingestion executions.
`disclosure_sources` lists official government portals.
`public_disclosures` is a validated schema for future official-filing ingestion, **currently empty** until a real connector and licensing/provenance verification are implemented.

## Caveats
- Market API retrieval is best-effort; upstream restrictions can produce empty snapshots.
- Snapshot ingestion is an explicit job; scheduled ingestion is not configured in the application.
- No client financial accounts, customer PII, deposits, order execution, wallet secrets, or nonpublic trading information are stored.
- Database migrations are ordered, transactional and serialized with an advisory lock.
- This is not yet an audited or regulated financial platform.
