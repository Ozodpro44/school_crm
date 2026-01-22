# Railway Logging Cleanup Plan

## TO REMOVE

- **Route endpoint**: `GET /api/logs/railway` (line 164 in cmd/main.go)
- **Handler function**: `GetRailwayLogsHandler()` (lines 248-289 in logs.go)
- **Helper function**: `fetchRailwayLogs()` (lines 291-375 in logs.go)
- **Helper function**: `makeRailwayRequest()` (lines 466-509 in logs.go)
- **Type definition**: `RailwayLogPayload` (lines 33-39 in logs.go)
- **Environment variables**: `RAILWAY_API_KEY`, `RAILWAY_PROJECT_ID` (not used elsewhere)
- **All DEBUG fmt.Printf calls** in logs.go (lines 277-278, 301, 304, 308, 325, 485, 490, 495, 502)
- **Comment**: "Railway" references in log.go line 24 and line 378 (about Railway platform)
- **Comment**: RailwayLogPayload documentation (line 33)

## TO KEEP

- `POST /api/logs/ingest` endpoint (line 168) - token-based log ingestion
- `IngestLogsHandler()` function (lines 379-464) - custom logging integration
- `Log` struct definition (lines 19-31) - core log model
- All internal log functions: `InitLogs()`, `AddLog()`, `AddLogWithDetails()`, `addLogWithDetails()`, `addLogFull()`
- `GetLogsHandler()` and `ClearLogsHandler()` - log retrieval/management
- Business logic in branch_service.go fmt.Printf calls (lines 62, 69) - replace with sendLog or silent handling
- Development routes logging in developer.go (line 504) - replace with sendLog
- Redis connection log in utils/redis.go (line 33) - replace with sendLog or remove

## BEFORE/AFTER EXAMPLES

### Example 1: Remove Railway endpoint and debug logs

**Before (cmd/main.go:164):**
```go
router.GET("/api/logs/railway", handlers.GetRailwayLogsHandler)
```

**After:**
```go
// Removed - use token-based ingestion only
```

---

### Example 2: Remove debug fmt.Printf from Railway function

**Before (logs.go:277-278):**
```go
fmt.Printf("DEBUG: Using API Key: %s (length: %d)\n", apiKey[:20]+"...", len(apiKey))
fmt.Printf("DEBUG: Using Project ID: %s\n", projectID)
```

**After:**
```go
// Removed - Railway API no longer used
```

---

### Example 3: Replace fmt.Printf in business logic with sendLog or silent handling

**Before (branch_service.go:62):**
```go
fmt.Printf("Warning: failed to create initial financial month for branch %s: %v\n", branchID, err)
```

**After (silent handling):**
```go
// Log silent error or call sendLog if critical
// log.Println("Warning: failed to create initial financial month")
```

---

### Example 4: Update RailwayLogPayload usage in IngestLogsHandler

**Current (logs.go:458):**
```go
addLogFull(payload.Service, level, "railway", payload.Message, "", "", requestID, userID)
```

**Keep (logs.go:458) - no change needed:**
```go
// Service field is still valid - it's about the originating service, not Railway
```

---

## SUMMARY

**Files to modify:**
1. `cmd/main.go` - remove line 164
2. `internal/handlers/logs.go` - remove functions and debug logs, update comments
3. `internal/service/branch_service.go` - replace fmt.Printf with logging or silent handling
4. `internal/handlers/developer.go` - replace log.Println with sendLog or remove

**No new code needed** - the POST /api/logs/ingest endpoint already handles all custom logging.

**Result:** Backend will only use token-based log ingestion (POST /api/logs/ingest). No Railway dependencies remain.
