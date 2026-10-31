# MarketreaderPro — deployment and security guide

## Scope
This release supports a read-only, public educational research site. It is **not a production bank, brokerage, or regulated investment advisory service**. No user accounts, financial transactions, credentials, trading permissions or personalized recommendations are implemented.

## Release checklist
1. Run `npm run verify` with Node 22 and `docker build -t marketreaderpro .`.
2. Deploy behind an HTTPS reverse proxy / managed load balancer; enable HSTS **at that layer**, after verifying HTTPS.
3. Run at least two instances with separate health probes to `GET /api/health` and `GET /api/ready`.
4. Restrict direct inbound access to the Node app to the reverse proxy; enable WAF and edge rate limits. The local per-process IP limiter is only defense-in-depth and does not share state between replicas.
5. Configure stdout JSON collection, monitoring for error rates, upstream failures, latency and availability. Alerts and dashboards are **not** provided by this repository.
6. Set memory/CPU limits and process restarts; roll back on health probe failures.
7. Verify public Kalshi/Polymarket endpoint availability from the hosting region and check API terms, limits and regional eligibility.
8. Run security scanning and a third-party penetration test before inviting external users; no such external audit is claimed.
9. Review privacy disclosures, accessibility and legal copy; reject all requests for bank credentials or investment account tokens.
10. Do not enable execution or user-linked financial features without proper licensing/partners, KYC/AML where required, security review and a separately reviewed architecture.

## APIs
`GET /api/health`, `GET /api/ready`, `GET /api/markets`, `GET /api/disclosures`, `POST /api/research`, `POST /api/risk`.

## Limits
- Requests are rate limited per socket IP per process; **do not trust direct IPs from an internet-facing, untrusted reverse proxy**.
- Market feeds are public upstream services and can be degraded; one failing upstream does not fail the other.
- Cache is per-process and lasts 30 seconds. There is no shared storage or user data.
- The research tool is transparent keyword-based educational logic, **not AI model inference**.
- `/api/ready` checks local readiness, not upstream operational status.
- In-memory limiters, errors, cache and health monitoring are insufficient alone for bank-grade deployments.

## Future regulated expansion
Add audited authentication/session management, durable data encryption/key rotation, secure financial aggregation, broker controls, order reconciliation, abuse prevention, granular authorization, tamper-evident audit logging, observability, disaster recovery and legal review before claiming real-money functionality.
