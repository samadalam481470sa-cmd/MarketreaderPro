# MarketreaderPro

![Illustrative preview of the MarketreaderPro interface](docs/images/dashboard-preview.svg)

> **Visual note:** This is a concept illustration based on the current dashboard layout, not a live brokerage account or screenshot of deployed software.

![Current application architecture diagram](docs/images/architecture.svg)


**Your market command center.** A runnable financial intelligence prototype for students combining public prediction market feeds, government disclosure portals and educational financial research.

> **Status: functional research prototype, not a bank, brokerage or deployed AI adviser.** No account linking, identity verification, trading execution, regulated banking, or real model-powered advisory is implemented.

## Start
Requires Node.js 20 or newer.

```bash
npm start
# Open http://localhost:3000
npm test
```

Docker: `docker build -t marketreaderpro . && docker run -p 3000:3000 marketreaderpro`.

## Built functionality
- Responsive finance dashboard with market and research panels.
- Best-effort public Kalshi and Polymarket market retrieval with independent timeouts and explicit availability.
- Links to SEC EDGAR, House and Senate financial disclosure portals (no automated ingestion yet).
- Educational rule-based research responses (not a live LLM).
- Weighted portfolio concentration and Herfindahl index calculator.
- HTTP input validation, response security headers, tests and CI.

## APIs
`GET /api/health` · `GET /api/markets` · `GET /api/disclosures` · `POST /api/research` · `POST /api/risk`

Example:
```bash
curl -X POST http://localhost:3000/api/risk -H 'content-type: application/json' -d '{"positions":[{"symbol":"ETF-A","value":600},{"symbol":"ETF-B","value":400}]}'
```

## Architecture
- `apps/web`: static dashboard and accessible interaction UI
- `apps/api`: Node.js HTTP API, market adapters and financial math
- `tests`: built-in test runner
- `.github/workflows/ci.yml`: continuous testing
- `Dockerfile`: reproducible packaging

## Future work: not implemented
1. Secure login, MFA, identity authorization, secret management and durable storage.
2. Banking links through approved aggregation partners and brokerage account aggregation.
3. Filing-level SEC and congressional ingestion with official provenance and delay timestamps.
4. Retrieval-grounded LLM analysis with testing and safe advisory guardrails.
5. Paper trading and then optional regulated, authorized execution integrations.
6. Comprehensive integration/e2e/security tests, monitoring, rate limiting, audit infrastructure and production compliance.

Congressional disclosures are not evidence of unlawful insider trading. Never use nonpublic material or mistake delayed filings for real-time signals. External market data can be stale or unavailable. No deposits or orders are supported.
