# Migration Setup Guide

## Overview

Database migrations are now managed by **golang-migrate** using SQL files. The old programmatic migration system in Go has been removed.

## Files Changed

1. **Consolidated migrations:**
   - Removed 13 separate migration files
   - Created single `migrations/000001_init_all_tables.up.sql` and `.down.sql`
   - Removed unused migration code from `internal/db/migrations.go`

2. **Updated db.go:**
   - `RunMigrations()` now returns nil immediately (deprecated)
   - Application expects migrations to be run separately via CLI

## How to Run Migrations

### Using Make commands (recommended)

```bash
# Install golang-migrate tool
make install-migrate

# Run all pending migrations
make migrate-up

# Rollback migrations
make migrate-down

# Check migration status
make migrate-status

# Create a new migration
make migrate-create
```

### Using migrate CLI directly

```bash
# Apply migrations
migrate -path migrations -database "postgres://user:pass@localhost/dbname?sslmode=disable" up

# Rollback
migrate -path migrations -database "postgres://user:pass@localhost/dbname?sslmode=disable" down
```

### Complete Setup

```bash
# One-time setup
make docker-up        # Start PostgreSQL
make db-create        # Create database
make migrate-up       # Run migrations
make run              # Start application
```

## Migration File Structure

- **Location:** `backend_school_crm/migrations/`
- **Format:** `{version}_{name}.{direction}.sql`
  - `version`: Sequential number (000001, 000002, etc.)
  - `name`: Description of changes
  - `direction`: `up` (apply) or `down` (rollback)

## Creating New Migrations

```bash
cd backend_school_crm

# Create a new migration pair
make migrate-create

# Or manually:
# - Create: migrations/000002_add_column_x.up.sql
# - Create: migrations/000002_add_column_x.down.sql
```

## Important Notes

1. **No automatic migrations:** The application no longer calls `RunMigrations()` - migrations must be run separately
2. **Idempotent SQL:** All migration statements use `IF NOT EXISTS` or similar to prevent errors on re-runs
3. **Version tracking:** golang-migrate maintains a `schema_migrations` table to track applied versions
4. **Deployment:** Ensure migrations are run before application startup in production

## Troubleshooting

### Check migration status
```bash
make migrate-status
```

### Force a migration version (if needed)
```bash
make migrate-force
```

### Verify database connection
```bash
make print-db-url
```

## See Also

- [golang-migrate Documentation](https://github.com/golang-migrate/migrate)
- Makefile migration targets: `make help-migrate`
