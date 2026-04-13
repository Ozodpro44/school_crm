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
