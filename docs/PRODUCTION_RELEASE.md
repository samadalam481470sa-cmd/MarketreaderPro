# MarketreaderPro production release checklist (v0.8)

## Bounded release scope
This is a **public educational research web application**, not a production bank, brokerage or financial adviser. No live orders or transfers are available. `ENABLE_EXPERIMENTAL_FEATURES=false` by default; all user accounts, bank aggregation, paper orders and optional AI completion routes return 503 in this mode.

## Security and compliance gates
- `SECURITY.md` defines how to report vulnerabilities privately. Enable private vulnerability reporting in GitHub so the intake works.
- `docs/GITHUB_HARDENING.md` covers account 2FA, secret scanning, push protection, branch protection and least-privilege Actions.
- `docs/COMPLIANCE.md` lists the legal hazards this project cannot remove: financial-promotion language, data-provider terms, privacy duties, licensing and trademarks. Review it before any public or commercial launch.
- CI runs `npm run security:check` (credential scan), `npm run license:audit` (permissive dependency licenses only), CodeQL and `npm audit --omit=dev --audit-level=high`. A red security workflow blocks release.
- Containers run as the unprivileged `node` user; the Compose web service is read-only with all capabilities dropped. Keep that property when deploying.

## Deploying the public research site
- Use a container host supporting a persistent Node.js process. Vercel serverless hosting is not directly compatible with this repository's existing HTTP server and separately running GPU desktop process.
- Build a reviewed CI-passing commit: `docker build -t marketreaderpro:release .`.
- Run `docker run --rm -e NODE_ENV=production -e ENABLE_EXPERIMENTAL_FEATURES=false -p 127.0.0.1:3000:3000 marketreaderpro:release`.
- Terminate HTTPS at a reverse proxy, configure HSTS, WAF/edge rate limits, security monitoring and logs.
- Run `SMOKE_URL=https://your-production-domain npm run smoke` and verify real responses from both market data providers, including their timestamps and jurisdictional restrictions.
- When using database persistence, use managed PostgreSQL, migrations, encrypted private networking, credentials in secrets management, backup/restore and a separately scheduled ingestion worker.
- Maintain an incident runbook, rollback deployment and security review before public traffic.

## Not production-complete
Banking and brokerage connectors require approved provider accounts, full identity verification, authorization, fraud protection, account recovery, privacy compliance and external security assessments. Model-generated financial advice and automated trading are not approved for production. The local learning agent can operate only on an awake, powered computer and never rewrites code without review.

GitHub CI passing and a Docker boot smoke check verify this bounded release; they are not financial-industry certification. A live URL requires an authorized connected deployment account.
