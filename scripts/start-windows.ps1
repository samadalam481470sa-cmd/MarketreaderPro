# MarketreaderPro local intelligence quick start (PowerShell 7 / Windows PowerShell)
$ErrorActionPreference = "Stop"
if (-not $env:POSTGRES_PASSWORD) {
  throw "Set a unique POSTGRES_PASSWORD in PowerShell first. Example: `$env:POSTGRES_PASSWORD='your-long-unique-secret'"
}
docker info | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Docker Desktop must be running." }
docker compose up -d --build postgres web
if ($LASTEXITCODE -ne 0) { throw "Cannot start PostgreSQL and the web app." }
docker compose --profile tools run --rm migrate
if ($LASTEXITCODE -ne 0) { throw "Database migration failed." }
docker compose run --rm web node scripts/intelligence.js
if ($LASTEXITCODE -ne 0) { Write-Warning "One or more external intelligence sources were unavailable. Check the dashboard source warnings." }
docker compose --profile intelligence up -d intelligence-worker
if ($LASTEXITCODE -ne 0) { throw "Cannot start the morning research worker." }
Write-Host "MarketreaderPro ready: http://localhost:3000"
Write-Host "Daily intelligence worker: 7:00 AM America/Chicago (while Docker host is running)."
