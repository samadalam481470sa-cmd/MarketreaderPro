<div align="center">

# ◈ MarketreaderPro

### Source-backed financial intelligence workspace

**Financial news · Government disclosures · Prediction market discovery · Historical analytics · Local GPU research**

[![CI](https://github.com/samadalam481470sa-cmd/MarketreaderPro/actions/workflows/ci.yml/badge.svg)](https://github.com/samadalam481470sa-cmd/MarketreaderPro/actions/workflows/ci.yml)
[![Packages](https://github.com/samadalam481470sa-cmd/MarketreaderPro/actions/workflows/package.yml/badge.svg)](https://github.com/samadalam481470sa-cmd/MarketreaderPro/actions/workflows/package.yml)
![Node](https://img.shields.io/badge/Node.js-22%2B-339933)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1)
![MIT dependency](https://img.shields.io/badge/Technical_Indicators-MIT-67d5a8)

**[Download app package](https://github.com/samadalam481470sa-cmd/MarketreaderPro/actions/workflows/package.yml)** · **[Download source ZIP](https://github.com/samadalam481470sa-cmd/MarketreaderPro/archive/refs/heads/main.zip)** · **[Install guide](docs/QUICKSTART.md)**

</div>

## Application dashboard

The application now contains an interactive dark financial workspace with source-status cards, morning news, government filings, and prediction-market feeds. Panels connect to the real backend and explicitly display unavailable sources and missing history.

![MarketreaderPro dashboard design](docs/images/intelligence-dashboard.svg)

*The illustration shows the design direction; the actual running dashboard uses the matching dark theme and fetches its contents from API endpoints. The illustration itself is not a live screenshot.*

## Install and launch

**Windows (Docker Desktop required)**

```powershell
# In the extracted MarketreaderPro folder
$env:POSTGRES_PASSWORD="YOUR_UNIQUE_LONG_PASSWORD"
.\scripts\start-windows.ps1
```

**macOS / Linux (Docker Compose required)**

```bash
export POSTGRES_PASSWORD="YOUR_UNIQUE_LONG_PASSWORD"
sh scripts/start-unix.sh
```

Open **http://localhost:3000**. The startup scripts migrate PostgreSQL, attempt initial source ingestion and start the scheduled 7 AM Central intelligence worker while the Docker host remains available.

A lighter read-only run is possible with `npm install && npm start`, but historical/briefing features require a configured database. This is a downloadable application source package, **not a signed native desktop installer**.

## Historical archive audits, independent holdouts and source incidents (v1.8)

**Historical archive integrity:** The CLI recomputes SHA-256 checksums from persisted PostgreSQL values, reports missing rows or modified prices and compares two independently imported archives by date and symbol. The operator-only commands are `npm run history:verify` and `npm run history:diff -- ORIGINAL_SHA256 REVISED_SHA256`. [Historical archive checks](docs/HISTORY_IMPORT.md).

**Independent holdout selection:** Walk-forward research now distinguishes folds used to select a predefined allocation model from the final untouched fold. The dashboard identifies the selected model and final-fold outcome, and can optionally repeat the exact test observations under higher assumed fees/slippage. This limits some lookahead errors but cannot guarantee future performance or eliminate adaptive selection bias. [Methodology](docs/WALK_FORWARD.md).

**Persistent source incidents:** Collection failures, degraded reporting and stale updates now create durable PostgreSQL incident records. A source must make a fresh successful recovery before an incident resolves. `GET /api/source-incidents` displays active alerts; `?resolved=true` also shows past incidents. [Operational source health](docs/SOURCE_HEALTH.md).

**Expanded integration coverage:** SQL tests detect price tampering, compare revisions, check deduplication and verify incident creation/recovery. GitHub's first-party line audit now explicitly counts database integration tests.

## Historical import, walk-forward and data quality (v1.7)

- **Operator-only historical archive:** validated, permission-annotated OHLC close CSV imports into immutable PostgreSQL datasets; deduplication by SHA-256. Run `npm run history:import -- --file ./prices.csv --source "Authorized provider" --license "Permitted internal research"`. Run `npm run history:catalog` to inspect stored sources. Historical data API export is off by default and requires `MRP_PUBLIC_HISTORY=true`.
- **Causal multi-asset walk-forward testing:** train/test windows, optional purged periods, equal-weight/inverse-volatility/momentum baselines, fee-aware simulated performance on untouched folds. Open **Walk-forward Lab** in the dashboard.
- **Source-health monitoring:** actual collection attempts, failure ratios, freshness warnings and a dedicated status API/dashboard. Run `GET /api/data-health`.
- **Database integration tests:** import deduplication, provenance, default-private data routes, and real persisted source status after migrations.

[History importer guide](docs/HISTORY_IMPORT.md) · [Walk-forward methodology](docs/WALK_FORWARD.md) · [Source health](docs/SOURCE_HEALTH.md).

## Portfolio rebalancing laboratory

The **Rebalancing Lab** accepts aligned historical closing-price CSVs, then simulates long-only target-weight rebalancing with explicit costs, drift thresholds and a **next-close execution delay**. It compares portfolio return/drawdown against fee-aware passive buy-and-hold, and exposes an auditable trade ledger and final weights. [Methodology](docs/PORTFOLIO_REBALANCING.md). Source prices are supplied by the user and are not independently authenticated.

## Multi-asset risk workstation

The **Portfolio Risk Lab** accepts an aligned multi-asset closing-price CSV with 2–12 symbols and user-supplied or equal target weights. It calculates covariance/correlation, risk contributions, historical VaR/expected shortfall, drawdown, and explicitly hypothetical shocks—without treating the data as verified live quotes. [Read the methodology](docs/PORTFOLIO_RISK.md).

## Historical strategy backtesting

The **Strategy Backtesting** dashboard now accepts your own historical OHLCV CSV, simulates next-open long-only orders under fees and slippage, charts equity against buy-and-hold, and reports drawdown plus optional historical bootstrap risk scenarios. [Read the methodology and assumptions](docs/BACKTEST.md). This does not trade live markets or authenticate the uploaded prices.

## Historical research lab

The source-backed research lab adds rolling probability analytics, anomaly detection, max drawdown measures, and leak-resistant walk-forward baseline comparisons. Read [the methodology](docs/RESEARCH_LAB.md) or call `GET /api/research-lab?source=kalshi&id=MARKET_ID&window=10&evaluation=true` after storing observations. These statistics are descriptive, not trading recommendations.

## Capabilities

| Component | Current function |
|---|---|
| Dashboard | Real API-populated navigation, intelligence panels and status cards |
| Market discovery | Kalshi and Polymarket public feed integration, limited by provider access |
| Financial news | Federal Reserve, BLS, and GDELT topic-based discovery |
| Government filings | SEC Form 4 XML transactions for configured CIKs; opt-in House filing index; Senate portal links |
| Historical market indicators | SMA, EMA and RSI via MIT-licensed [technicalindicators](https://github.com/anandanand84/technicalindicators) |
| Data quality | Timestamps, invalid-value rejection, stale data labels, original source links |
| Scheduled morning briefs | Dedicated server worker, targeting 7 AM America/Chicago |
| AI | Optional source-grounded narrative when an external AI API is configured |
| Local GPU research | Opt-in Python agent using CUDA/Metal when the computer is awake |
| Persistence | PostgreSQL plus separate local agent SQLite history |

### Open-source contribution

MarketreaderPro integrates the MIT-licensed **technicalindicators** package for SMA, EMA and RSI calculations. Its original authors retain attribution. See [third-party software and licensing](docs/THIRD_PARTY.md). The tool is used for descriptive statistics on historical public-market probability observations, not live order signals.

## Releases & packages

On every push to `main`, GitHub Actions is configured to upload a **MarketreaderPro-application** ZIP artifact and publish the Docker image to **GitHub Container Registry**.

[**Download release artifact from successful workflow**](https://github.com/samadalam481470sa-cmd/MarketreaderPro/actions/workflows/package.yml)

Container command, after the workflow publishes and the package visibility permits access:

```bash
docker pull ghcr.io/samadalam481470sa-cmd/marketreaderpro:latest
```

The ZIP includes the server, frontend, GPU companion, migrations, scripts, Docker Compose and documentation. A local database and source access are still required for continuous intelligence collection.

## Source architecture

```text
 Federal Reserve / BLS ─┐
 GDELT financial news ───┤
 Public market APIs ─────├──> Validation + provenance ──> PostgreSQL ──> Research API ──> Interactive dashboard
 SEC Form 4 / House ─────┘                                        │
                                                         Morning scheduler
 Local GPU research (optional) ──> SQLite + PyTorch
```

Read the [database guide](docs/DATABASE.md), [intelligence sources](docs/INTELLIGENCE.md), [government disclosure constraints](docs/GOVERNMENT_DISCLOSURES.md), and [GPU companion](docs/LOCAL_GPU_AGENT.md).

## Code-size audit

Run `npm run code:audit` to view source lines by component, excluding vendored third-party packages, generated assets and documentation. The CI workflow attaches the same audit as a JSON artifact. This makes progress toward the requested 50,000-line milestone measurable without artificial padding. [Methodology](docs/CODEBASE_SIZE.md).

## Verify locally

```bash
npm install
npm run verify
npm run package:check
python3 -m unittest discover -s tests_py -v
```

CI also validates PostgreSQL migrations, a Docker build, and HTTP smoke tests. A passing build does not guarantee an external data provider is reachable in your location or license every global exchange.

## Financial safety and product scope

This is a **read-only research application**. Real-money trading, banking transfers, every global exchange/news channel, complete House PDF trading extraction and automated Senate disclosure ingestion are **not supported**. Experimental accounts and integrations are disabled by default. Source articles, filings and prices may be inaccurate or delayed; verify originals before making financial decisions.

The app is ready to download and run locally with its prerequisites, but a publicly deployed or independently audited financial platform is a different release milestone.

[Deployment checklist](docs/PRODUCTION_RELEASE.md) · [Setup](docs/QUICKSTART.md) · [GitHub Actions](https://github.com/samadalam481470sa-cmd/MarketreaderPro/actions)