#!/usr/bin/env sh
set -eu
: "${POSTGRES_PASSWORD:?Set a strong POSTGRES_PASSWORD environment variable before running}"
docker info >/dev/null
docker compose up -d --build postgres web
docker compose --profile tools run --rm migrate
if ! docker compose run --rm web node scripts/intelligence.js; then
  echo "Warning: one or more sources unavailable; check dashboard warnings" >&2
fi
docker compose --profile intelligence up -d intelligence-worker
printf 'MarketreaderPro ready: http://localhost:3000\n'
printf 'Daily worker runs at 7:00 AM America/Chicago while host is awake.\n'
