# Railway Deployment Guide

## Services to create

| Service name  | Dockerfile        | Purpose              |
|---------------|-------------------|----------------------|
| `rest-api`    | `Dockerfile`      | HTTP REST API        |
| `grpc-server` | `Dockerfile.grpc` | gRPC microservice    |
| `postgres`    | Railway managed   | PostgreSQL database  |

---

## Step-by-step

### 1. Create a Railway project
Go to [railway.app](https://railway.app) → **New Project**

### 2. Add PostgreSQL
Click **Add Service** → **Database** → **PostgreSQL**
Railway auto-sets `DATABASE_URL` — share it at project level.

### 3. Add REST API service
- **Add Service** → **GitHub Repo** → select this repo
- Root directory: `backend_school_crm`
- Railway auto-detects `Dockerfile`
- Service name: `rest-api`

### 4. Add gRPC service
- **Add Service** → **GitHub Repo** → select this repo again
- Root directory: `backend_school_crm`
- Go to service **Settings** → **Build** → Dockerfile path: `Dockerfile.grpc`
- Service name: `grpc-server`

### 5. Set environment variables

**Project-level shared variables** (inherited by all services):
```
DATABASE_URL        = (auto-set by Railway Postgres)
JWT_SECRET          = your-strong-secret
LOGS_TOKEN          = your-logs-token
```

**`rest-api` service variables**:
```
GRPC_ADDRESS        = grpc-server.railway.internal:9090
RESEND_API_KEY      = re_...
CLICK_MERCHANT_ID   = (optional)
CLICK_SERVICE_ID    = (optional)
CLICK_SECRET_KEY    = (optional)
TELEGRAM_BOT_TOKEN  = (optional)
```

**`grpc-server` service variables**:
```
GRPC_PORT           = 9090
```
> Note: Railway injects `PORT` automatically. The gRPC binary reads `PORT` first,
> then `GRPC_PORT`, then defaults to `9090`.

### 6. Enable private networking
In Railway dashboard → your project → **Settings** → enable **Private Networking**.
This allows `rest-api` to reach `grpc-server` via:
```
grpc-server.railway.internal:9090
```

### 7. Set public domain
- `rest-api`: Railway assigns `https://rest-api-xxxx.up.railway.app`
- `grpc-server`: no public domain needed (private only)

---

## Health check
REST API exposes:
```
GET /health
GET /api/health
```
Railway uses `/health` for the healthcheck (configured in `railway.toml`).

---

## Local dev
```bash
cp .env.example .env
# fill in DATABASE_URL, JWT_SECRET, etc.
go run ./cmd/main.go          # REST API on :8080
go run ./cmd/grpc/main.go     # gRPC on :9090
```

---

## Database Backup Strategy

### 1. Railway managed backups (primary)

Railway PostgreSQL includes automatic daily backups retained for **7 days** on the Hobby plan
and **30 days** on Pro.

Enable / verify in the Railway dashboard:
1. Open the **PostgreSQL** service → **Backups** tab.
2. Confirm **Automatic Backups** is toggled **on**.
3. Note the retention window and set a calendar reminder to review it quarterly.

To restore from a Railway backup:
1. Go to **Backups** tab → choose a point-in-time snapshot.
2. Click **Restore** — Railway spins up a new database instance from that snapshot.
3. Update `DATABASE_URL` in all services to point at the restored instance.
4. Redeploy `rest-api` and `grpc-server`.

---

### 2. Off-site pg_dump backup (secondary)

Run this script from any machine that can reach the Railway Postgres public URL.
Schedule it with cron (e.g. daily at 02:00).

```bash
#!/usr/bin/env bash
# backup.sh — off-site pg_dump for School CRM
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-$HOME/crm-backups}"
BACKUP_FILE="$BACKUP_DIR/schoolcrm_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Dumping database..."
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
echo "Backup written to $BACKUP_FILE"

# Optional: upload to S3-compatible storage
# aws s3 cp "$BACKUP_FILE" "s3://your-bucket/crm-backups/"

# Prune local backups older than 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
echo "Old backups pruned."
```

Add to crontab (`crontab -e`):
```
0 2 * * * DATABASE_URL="your-railway-postgres-url" BACKUP_DIR="/var/backups/crm" /path/to/backup.sh >> /var/log/crm-backup.log 2>&1
```

---

### 3. Restore from pg_dump

```bash
# Decompress and restore into a target database
gunzip -c schoolcrm_20260101_020000.sql.gz | psql "$TARGET_DATABASE_URL"
```

> **Warning:** This overwrites all data in the target database.
> Always restore into a fresh database first and verify before switching traffic.

Steps:
1. Create a new Railway PostgreSQL service (or a local Postgres instance).
2. Run the restore command above with the new service's connection string.
3. Smoke-test: confirm student/payment counts match expectations.
4. If correct, update `DATABASE_URL` in Railway and redeploy.

---

### 4. Quarterly restore test

> Untested backups are not backups.

Every quarter:
1. Pick the most recent `pg_dump` file.
2. Restore into a **throwaway** local Postgres instance:
   ```bash
   docker run --rm -d --name crm-test-pg \
     -e POSTGRES_PASSWORD=test \
     -p 5433:5432 postgres:16-alpine

   gunzip -c latest-backup.sql.gz | \
     psql "postgres://postgres:test@localhost:5433/postgres"
   ```
3. Spot-check row counts for `students`, `payments`, `branches`.
4. Destroy the test container: `docker rm -f crm-test-pg`.
5. Log the test result and date in your team notes.
