# Start MarketreaderPro on your computer

This is a downloadable **source-code application**, not yet a signed Windows .exe or macOS .app installer. The browser dashboard runs locally through Docker.

## Requirements
- Docker Desktop (Windows/macOS) or Docker Engine + Compose (Linux).
- A running Docker daemon and internet access to permitted public information providers.
- Choose a **strong alphanumeric** PostgreSQL password for this local test environment. Keep it private.

## Windows PowerShell
```powershell
git clone https://github.com/samadalam481470sa-cmd/MarketreaderPro.git
cd MarketreaderPro
$env:POSTGRES_PASSWORD="REPLACE_WITH_LONG_RANDOM_ALPHANUMERIC_SECRET"
.\scripts\start-windows.ps1
```
If local script execution policy prevents running scripts, open the script and run the reviewed commands individually instead of weakening organization-wide policy.

## macOS/Linux
```bash
git clone https://github.com/samadalam481470sa-cmd/MarketreaderPro.git
cd MarketreaderPro
export POSTGRES_PASSWORD="REPLACE_WITH_LONG_RANDOM_ALPHANUMERIC_SECRET"
sh scripts/start-unix.sh
```

## Dashboard
Open http://localhost:3000. On first launch, data depends on external source reachability. The saved Morning Intelligence feed is loaded from PostgreSQL. Reload after the first ingestion job.

The startup scripts run database migrations, ingest one briefing immediately, and start a worker targeting 7 AM America/Chicago. This only continues if the computer or cloud Docker host stays powered and available.

## Diagnose
```bash
docker compose ps
docker compose logs web
docker compose logs intelligence-worker
docker compose run --rm web node scripts/intelligence.js
```

## Download ZIP instead of Git
Open the [repository](https://github.com/samadalam481470sa-cmd/MarketreaderPro), choose **Code > Download ZIP**, extract it and run the script from the extracted project folder.

No real-money trading, broad newspaper licensing, auto-publication, bank deposits, or all-politician surveillance is enabled. See docs/INTELLIGENCE.md.
