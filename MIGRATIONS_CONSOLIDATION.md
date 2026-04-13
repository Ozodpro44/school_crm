# Migrations Consolidation Summary

## Changes Made

### Removed Duplicate Migrations
All 13 separate migration files have been consolidated into a single migration:

**Old migrations deleted:**
- 000001_init_tables.up/down.sql
- 000002_add_branch_id_to_settings.up/down.sql
- 000003_merge_settings_into_branches.up/down.sql
- 000004_add_branch_id_to_users.up/down.sql
- 000005_create_branch_managers_table.up/down.sql
- 000006_remove_branch_id_from_users.up/down.sql
- 000007_ensure_created_by_columns.up/down.sql
- 000008_add_create_permissions.up/down.sql
- 000009_add_current_month_to_branches.up/down.sql
- 000011_populate_financial_months.up/down.sql
- 000012_remove_current_month_year_from_branches.up/down.sql
- 000013_increase_decimal_precision.up/down.sql

### New Migration
**Created:** `000001_init_all_tables.up/down.sql`

This single migration includes:
- All table definitions in correct dependency order
- All columns (including those added in subsequent migrations)
- All indexes for performance
- All constraints and foreign keys
- Initial financial_months population

### Removed Code
**Cleaned up:** `internal/db/migrations.go`
- Removed ~400 lines of duplicate migration code
- Now contains only a comment indicating SQL migrations are used

## Benefits

1. **Simpler maintenance** - One migration file instead of 13
2. **Clear schema** - All tables defined together with correct structure
3. **No redundant operations** - Removed intermediate steps like:
   - Adding then removing columns (branch_id from users)
   - Adding then removing columns (current_month/year from branches)
   - Deprecated/skipped migrations
4. **Reduced complexity** - No conditional ALTER TABLE logic scattered across files

## Notes

- The migration numbering starts at 000001 (new standard for consolidated schema)
- All tables are created with IF NOT EXISTS to support idempotent migrations
- Financial months are automatically populated for existing branches
- DECIMAL precision is set to (20,2) throughout for monetary values
