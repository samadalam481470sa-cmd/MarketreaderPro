# Legal, licensing and data-compliance notes

> **This document is an engineering risk checklist, not legal advice.**
> No software change can protect a maintainer from legal liability. It can
> only remove obvious hazards, document assumptions and make the remaining
> questions visible to a qualified lawyer. Laws differ by country and by how
> the app is used. If you operate this publicly, charge money, accept user
> accounts or process bank data, have a lawyer review your terms, privacy
> notice and data-provider contracts before launch.

## 1. What the application does and does not do

| Area | Current behavior | Compliance consequence |
|---|---|---|
| Trading | No order routing; paper ledger only, user-supplied prices | Not a broker or trading system |
| Advice | Descriptive statistics; no recommendations | Must not be marketed as advice |
| Banking | Optional Plaid read-only balances; disabled by default | Plaid end-user terms and privacy duties apply when enabled |
| Data | Retrieves public feeds; imports operator-supplied CSVs | Provider terms govern storage and redistribution |
| Accounts | Email + password, disabled by default | Privacy notice and deletion path required if enabled |
| Payments | None | No card data, PCI scope avoided |

The README and the dashboard must keep stating that outputs are research, that
data may be delayed or wrong, and that nothing is a recommendation. Do not
remove those disclaimers when rebranding or embedding the app.

## 2. Financial promotion and advice risk

- Present outputs as **historical, hypothetical and descriptive**. Do not
  claim predictive accuracy, guaranteed returns or "alpha".
- Keep hypothetical-performance descriptions next to any backtest, walk-forward
  or rebalancing result. Hypothetical results do not reflect actual trading and
  ignore many real costs.
- Do not present the app as an investment adviser, broker-dealer, fiduciary or
  robo-adviser. In the United States those labels trigger registration
  regimes. Marketing language creates the risk, not the code.
- If you personalize recommendations to a specific person for compensation,
  stop and get legal advice first.
- Include the disclaimer in the UI footer, not only in the README, and keep it
  visible on any screenshot used for promotion.

## 3. Data sources: terms, attribution and redistribution

| Source | Typical constraint | What this repo does |
|---|---|---|
| SEC EDGAR | Fair-access policy limits request rate; a descriptive `User-Agent` with contact details is required | Requires `SEC_USER_AGENT`; ingestion is opt-in |
| Federal Reserve / BLS | US government works are generally public domain; attribution is good practice | Used as public feeds |
| GDELT | Free for research under its terms; check attribution requirements | Topic-based news discovery |
| Kalshi / Polymarket | API terms, rate limits and jurisdictional restrictions; no redistribution of order-book data as your own product | Public feeds, no resale |
| Plaid | Contract, end-user consent, privacy policy, data-retention limits | Optional, read-only, tokens encrypted, disabled by default |
| House/Senate disclosures | Public records, but ethics rules and site terms still apply; PDFs are not fully machine-extracted | Index links only, PDFs not verified |
| Operator CSV imports | Operator must hold the rights | `MRP_PUBLIC_HISTORY` off by default; import requires a license note |

Rules that follow from the table:

1. **Never enable redistribution of imported history unless you own the
   redistribution right.** `MRP_PUBLIC_HISTORY=true` publishes stored datasets
   through the API. Leave it unset for licensed vendor data.
2. **Do not scrape** providers that prohibit it. Use documented APIs and obey
   rate limits; the scheduler is deliberately conservative.
3. **Keep provenance.** Imports store source label, URL, license note and a
   SHA-256 checksum. Keep them; they are your audit trail.
4. **Do not strip attribution** from provider content displayed in the UI.
5. **Respect jurisdictional limits.** Some prediction-market data is not
   offerable in every country. Do not market the app there.

## 4. Copyright and third-party code

- Dependencies are installed, not copied into the tree. Their licenses remain
  with their authors. `NOTICE` lists them and `npm run license:report`
  generates the full texts.
- CI runs `npm run license:audit` and fails on GPL/AGPL/SSPL/unknown licenses,
  which would otherwise impose source-disclosure or resale conditions on a
  distributed build.
- Do not paste code from blogs, Stack Overflow, other repositories or an AI
  assistant without checking its license and provenance. A copied function can
  taint the whole distribution.
- Do not commit screenshots, logos, article text, filing PDFs or market data
  that you did not create or license. Link to the source instead.
- If you receive a takedown notice, preserve the notice, remove or disable the
  disputed material promptly, and respond in writing. Do not argue with the
  complainant in public.
- **The repository currently has no `LICENSE` file.** Default copyright applies
  and others may not reuse it. That is legally protective for the owner but
  unhelpful if you want contributors. Adding MIT, Apache-2.0 or a proprietary
  notice is an ownership decision only you can make; do it deliberately rather
  than by copying a license you have not read.

## 5. Privacy and data protection

Applies when `ENABLE_EXPERIMENTAL_FEATURES=true`:

- Collect the minimum: an email address and a password hash. No analytics, no
  advertising trackers, no third-party cookies.
- Passwords use scrypt with per-user salts. Session tokens are random, stored
  only as SHA-256 digests, and expire after 12 hours.
- Bank access tokens are sealed with AES-256-GCM using `BANK_TOKEN_KEY`; the
  key must live in a secret manager, never in the repository.
- Have a deletion path before launch. Today there is no self-service account
  deletion endpoint; add one, or handle deletion requests manually and document
  the process.
- Publish a privacy notice naming the legal entity, the data collected, the
  purpose, retention, processors (hosting, Plaid, AI provider) and contact.
- GDPR/UK GDPR and CCPA/CPRA may apply as soon as you serve users in those
  regions: lawful basis, access/portability, erasure, and a data-processing
  agreement with each processor.
- Do not log request bodies, emails, tokens or bank identifiers. Logs are
  evidence in a breach investigation and a liability if over-collected.
- If a breach exposes personal data, notification duties have short deadlines.
  Know who to call before it happens.

## 6. Trademarks and branding

Provider names are used descriptively to identify integrations. Do not use
their logos, imply partnership or endorsement, or register a name confusingly
similar to theirs. "MarketreaderPro" itself should be cleared for trademark
use in your jurisdiction before you invest in branding.

## 7. Security duties that reduce legal exposure

Security failures are often the trigger for legal and contractual claims, not
just technical incidents. At minimum:

- Enable everything in [GITHUB_HARDENING.md](GITHUB_HARDENING.md).
- Keep dependencies patched; the security workflow and Dependabot exist for
  this reason.
- Rotate every credential that has ever been committed or shared in chat.
- Keep an incident runbook with an owner, contact list, rollback plan and
  breach-assessment steps.
- Do not promise "bank-level security" or "unhackable" anywhere. Those claims
  become contractual representations.

## 8. Prohibited and high-risk uses

Do not use or market this project for: live trading or fund management without
registration; sanctions-evasion or restricted-party activity; market
manipulation; reselling licensed market data; collecting bank credentials;
surveillance of individuals; or automated decision-making about people's
credit, employment or insurance.

## 9. Open items that need a human decision

These cannot be resolved by code and should be settled before a public launch:

1. Choose a license (or keep "all rights reserved") and add a `LICENSE` file.
2. Form the legal entity that will own and operate the service.
3. Write Terms of Service and a Privacy Policy; publish both in the app.
4. Sign data-provider agreements where required (especially Plaid and any paid
   market-data vendor).
5. Register a DMCA agent and publish a takedown contact if user-generated
   content is ever accepted.
6. Obtain professional liability / cyber insurance if operating commercially.
7. Have a lawyer review this list against your jurisdiction and business model.
