# Settings Table Migration - Complete

## Changes Made

### Database Schema
1. **Updated `branches` table** with new columns:
   - `currency` VARCHAR(10) - Stores currency code (e.g., 'UZS')
   - `created_date` TIMESTAMP - Branch creation date
   - `updated_date` TIMESTAMP - Branch last update date
   - `monthly_payment` already existed, kept as is

2. **Removed `settings` table** - All settings data now stored in branches table

### Migrations
- **000001_init_tables.up.sql**: Removed settings table creation, added new columns to branches
- **000002_add_branch_id_to_settings.up.sql**: Marked as skipped (no longer needed)
- **000003_merge_settings_into_branches.up.sql**: New migration to handle the schema change

### Go Models
- **models.go**:
  - Removed `Settings` struct
  - Updated `Branch` struct with `Currency`, `CreatedDate`, and `UpdatedDate` fields

### Go Services & Handlers
- **settings_service.go**: Cleared (settings functionality moved to branch service)
- **settings.go**: Cleared (settings routes removed)
- **main.go**: 
  - Removed `settingsService` initialization
  - Removed `RegisterSettingsRoutes` call

## Data Mapping

**Old Settings Table Fields → Branch Table Fields:**
- `currency` → `currency`
- `monthly_payment` → `monthly_payment` (already existed)
- `updated_at` → `updated_date` (new)
- Removed: `default_monthly_payment`, `default_teacher_salary`, `language`, `school_name`, `school_logo`, `current_month`, `current_year`

## API Changes

**Settings endpoints are now removed:**
- `GET /api/settings` - Removed
- `PUT /api/settings` - Removed

**Use branch endpoints instead:**
- `GET /api/branches/{id}` - Get branch with settings
- `PUT /api/branches/{id}` - Update branch including currency and monthly_payment

## Migration Notes

The old settings table had multiple settings per system. The new approach stores settings at the branch level, which is more appropriate for a multi-branch school CRM:
- Each branch now has its own `currency` and `monthly_payment` settings
- Settings are tied directly to branches, simplifying queries and data consistency
