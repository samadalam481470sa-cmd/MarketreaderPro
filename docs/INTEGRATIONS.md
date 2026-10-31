# Integrations and production boundaries

## What works in this release
- Database-backed email/password registration and revocable 12-hour bearer sessions. Passwords use salted scrypt, session tokens are generated randomly and stored as SHA-256 hashes. HTTPS is mandatory for real deployment. A complete production identity system additionally requires email verification, MFA, credential recovery, bot protection, audit logging, privacy procedures, distributed throttling, and external security assessment.
- Multi-user **simulation-only** accounts, balances, positions and orders; no broker is called. Orders are priced from user-provided cents and are not market quotes.
- Optional OpenAI model-based research via `AI_API_KEY` and `AI_MODEL`; otherwise explicit rule-based fallback. No automatic trade placement.
- SEC Form 4 **filing metadata** ingestion for a supplied CIK with compliant SEC User-Agent. Not transaction parsing; not congressional trade ingestion. No material nonpublic information.
- Existing public Kalshi/Polymarket market feeds and snapshot storage.

## Banking
A real Plaid integration uses Link initialization and public-token exchange, followed by encrypted server-side access-token storage and revocation handling. The backend Link-token exchange, encrypted access-token storage, read-only account retrieval and revocation are now implemented. **The official browser Link flow, production partner onboarding, webhook handling, encryption key rotation and real provider end-to-end verification are not finished.** Refer to https://plaid.com/docs/link/ . Never ask users to type bank credentials into MarketreaderPro.

## Brokerage
Alpaca publishes separate paper and live trading credentials, see https://docs.alpaca.markets/us/docs/trading-api . This app **does not submit live brokerage orders**. Use approved regulated counterparties, account authorization, and order-risk controls before enabling any live path.

## Production hardening still required
- Identity proofing, MFA, email verification, account recovery, consent and compliance controls.
- Persistent distributed session/rate limiting, secrets storage and rotation, encryption at rest, backup/restore, metrics/tracing, security review.
- True paper order matching with verified bid/ask/market data, fill rules, corporate actions and settlement.
- Secure bank provider onboarding and brokerage account connection, reconciliations and regional permissions.
- SEC Form 4 XML transaction extraction with accurate codes, amendments, filing-time lag and provenance.
- Official House and Senate disclosure ingestion with document-level legal review and source-specific format handling.
- AI retrieval augmentation, citations, evaluations, policy testing, human escalation, model cost and abuse controls.
