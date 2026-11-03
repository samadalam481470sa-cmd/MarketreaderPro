# GitHub account and repository hardening

This checklist applies to **every repository** you own, not only this one. The
workflow files in this repository automate the parts that live in code; the
settings below live in GitHub and must be enabled per account and per
repository.

## Account level (do this once)

1. **Two-factor authentication.** Settings → Password and authentication →
   enable a passkey or TOTP app. Save recovery codes offline.
2. **SSH keys and tokens.** Remove unused keys and personal access tokens.
   Prefer fine-grained tokens with an expiry and the minimum scopes. Never
   grant `repo` scope to a token that only needs to read public data.
3. **Active sessions.** Review and revoke unknown sessions and OAuth apps.
4. **Security log.** Enable email alerts for new sign-ins and key changes.
5. **Recovery.** Add a verified backup email and, if available, a second
   recovery method.

## Per repository settings

Open **Settings → Code security and analysis** and enable:

- **Dependency graph** — required for the rest.
- **Dependabot alerts** — automatic vulnerability alerts.
- **Dependabot security updates** — automatic fix pull requests.
- **Code scanning** — use the workflow in `.github/workflows/security.yml`
  (CodeQL). If you prefer GitHub's default setup instead, disable one of the
  two so they do not conflict.
- **Secret scanning** and **Push protection** — blocks commits containing
  known credential formats. Private repositories need GitHub Secret Protection
  enabled on the account.
- **Private vulnerability reporting** — gives `SECURITY.md` a working intake.
- **Grouped security updates** — keeps dependency noise manageable.

Then open **Settings → Actions → General**:

- **Workflow permissions:** choose *Read repository contents and packages
  permissions* (least privilege). Each workflow must opt in explicitly, which
  this repository's workflows already do.
- **Fork pull request workflows:** require approval for all outside
  contributors.
- **Allow GitHub Actions to create and approve pull requests:** off.
- Limit allowed actions to GitHub-owned and verified creators if your plan
  supports it.

Then protect the default branch (**Settings → Branches → Add branch
protection rule** for `main`):

- Require a pull request before merging, with at least one approval.
- Require status checks to pass: `CI / verify`, `Security / CodeQL` and
  `Security / Dependency and repository checks`.
- Require conversation resolution.
- Dismiss stale approvals on new commits.
- Block force pushes and deletions.
- If you are the only maintainer, enable *Do not allow bypassing the above
  settings* only after you are comfortable with a GitHub outage blocking
  urgent fixes; otherwise keep an explicit break-glass procedure.

## What this repository automates

| Control | Where |
|---|---|
| Vulnerability disclosure policy | `SECURITY.md` |
| Weekly npm, Actions and Docker updates | `.github/dependabot.yml` |
| CodeQL static analysis (JS/TS and Python) | `.github/workflows/security.yml` |
| `npm audit` gate for production dependencies | `.github/workflows/security.yml` |
| Dependency license gate | `scripts/license-audit.js` |
| Secret scanning of tracked files | `scripts/security-check.js` |
| Least-privilege workflow permissions | all workflows |
| Lockfile-based installs (`npm ci`) | CI, security workflow, Dockerfile |
| Third-party attribution and license report | `NOTICE`, `npm run license:report` |

## What GitHub settings cannot fix

Repository settings reduce supply-chain and account risk. They do not replace
reviewing pull requests, rotating leaked credentials, keeping dependencies
patched, or the legal work described in `docs/COMPLIANCE.md`.
