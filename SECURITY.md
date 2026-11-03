# Security policy

## Supported versions

Security fixes are applied to the latest release on `main`. Older commits and
packaged archives are not maintained. Run the newest tagged release, or the
current `main` commit after CI passes.

## Reporting a vulnerability

**Do not open a public issue, pull request or discussion for a security bug.**

Use GitHub's private vulnerability reporting for this repository:

1. Open the **Security** tab.
2. Choose **Report a vulnerability**.
3. Describe the affected endpoint, file or dependency, the steps to reproduce
   it, the impact you believe it has, and any suggested fix.

If private reporting is unavailable, contact the repository owner through the
public profile and ask for a private channel. Never send live credentials,
bank account data, access tokens or another person's personal data in a report.

This is a single-maintainer research project. Reports are reviewed on a
best-effort basis; there is no bug bounty and no guaranteed response time.
Please allow reasonable time for a fix before public disclosure.

## Scope

In scope:

- The HTTP server and its API routes (`apps/api/**`).
- Static asset handling and response headers.
- Authentication, session and banking helpers (`accounts.js`, `banking.js`),
  even though they are disabled by default.
- CSV/JSON parsers that process untrusted operator or browser input.
- Database access and migration code.
- GitHub Actions workflows and packaging scripts in this repository.

Out of scope:

- Vulnerabilities that require an attacker to already control the host, the
  database, the reverse proxy or the operator's machine.
- Missing hardening that only applies to a deployment the project explicitly
  does not support (for example a public multi-tenant sign-up service).
- Rate-limit or resource-exhaustion findings against a deliberately public
  instance with no edge proxy; see the operator checklist below.
- Third-party data providers being unavailable, inaccurate or delayed. Report
  those to the provider.
- Social engineering of the maintainer.

## Security model and known limitations

Read these before exposing the app to the internet. They are documented rather
than silently assumed.

- **Read-only research tool.** There is no live trading, no money movement and
  no custody of funds. The paper-trading ledger is a simulation.
- **Accounts and banking are off by default.** `ENABLE_EXPERIMENTAL_FEATURES`
  must be `true` for registration, sessions, paper orders, Plaid linking and
  the optional AI route. They return `503` otherwise.
- **No authentication on read-only research endpoints.** Endpoints such as
  `/api/markets`, `/api/backtest` and `/api/portfolio-risk` are public by
  design. Do not place private data behind them.
- **Historical datasets are private by default.** `/api/historical-*` returns
  `403` unless `MRP_PUBLIC_HISTORY=true`, which should only be set when the
  operator holds redistribution rights for the imported data.
- **Rate limiting is in-process memory.** It is per Node process, resets on
  restart, and is not shared across replicas. Behind a reverse proxy all
  clients can appear as one address; enforce real edge rate limits at the
  proxy. Do not trust `X-Forwarded-For` unless a trusted proxy sets it.
- **TLS is terminated upstream.** The server speaks HTTP. Use a reverse proxy
  with HTTPS, HSTS at the edge and a WAF for any public deployment.
- **Uploaded CSV/JSON is untrusted.** Parsers bound input size, but the
  application is not a sandbox; do not run it as a privileged user. The
  container image runs as the unprivileged `node` user.
- **Not independently audited.** Passing CI and a Docker smoke test is not a
  security certification.

## Credential handling

- Never commit `.env`, `.dev.vars`, private keys, session tokens or provider
  credentials. `.gitignore` blocks them and `npm run security:check` fails CI
  if key material or provider tokens are found in tracked files. The only
  exception is a deliberate documentation or test fixture line marked
  `security-check: ignore`; never use that marker on a real credential.
- Provide secrets through the runtime environment or a managed secret store.
- `BANK_TOKEN_KEY` must be 32 random bytes encoded as 64 hex characters. Bank
  access tokens are sealed with AES-256-GCM before storage.
- Passwords are hashed with scrypt; session tokens are stored only as SHA-256
  digests and expire after 12 hours.
- Rotate any credential that has ever been committed, pasted into a chat or
  included in a support request. Removing it from the latest commit is not
  enough; assume it is compromised.

## Operator hardening checklist

See [docs/GITHUB_HARDENING.md](docs/GITHUB_HARDENING.md) for repository and
account settings, and [docs/COMPLIANCE.md](docs/COMPLIANCE.md) for the legal
and data-handling risks this project can and cannot remove.

Before a public deployment:

- Set `NODE_ENV=production`, `ENABLE_EXPERIMENTAL_FEATURES=false` and leave
  `MRP_PUBLIC_HISTORY` unset unless redistribution is licensed.
- Terminate HTTPS at a reverse proxy, enable HSTS and edge rate limits.
- Run `npm ci`, then `npm run security:check`, `npm run license:audit` and
  `npm audit --omit=dev --audit-level=high`.
- Use a managed PostgreSQL instance with encrypted connections, least-privilege
  roles and tested backups. Never expose port 5432 publicly.
- Keep the container read-only where possible and run it as a non-root user.
- Monitor logs for repeated `401`, `403`, `413`, `429` and `500` responses.
