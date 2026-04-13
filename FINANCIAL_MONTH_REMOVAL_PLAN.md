# Financial Month Removal Plan

## Overview
Complete removal of financial month functionality from both backend and frontend systems.

## Components to Remove

### Backend Components

#### 1. Database
- `financial_months` table
- Foreign key constraints on:
  - `payments.financial_month_id`
  - `salaries.financial_month_id`
  - `expenses.financial_month_id`
- Columns from related tables:
  - `payments.financial_month_id`
  - `salaries.financial_month_id`
  - `expenses.financial_month_id`

#### 2. Models
- `FinancialMonth` struct and related types
- Payment status constants related to financial months
- File: `backend_school_crm/internal/models/models.go`

#### 3. Services
- `FinancialMonthService` (entire service)
- File: `backend_school_crm/internal/service/financial_month_service.go`

#### 4. Handlers
- Financial month endpoints and handlers
- File: `backend_school_crm/internal/handlers/` (look for financial_month.go)

#### 5. Migrations
- Migration files that create/modify financial month schema
- Files in: `backend_school_crm/migrations/`

#### 6. API Routes
- All financial month related routes from router/main

### Frontend Components

#### 1. API Wrapper
- File: `frontend_school_crm/src/lib/financial-month-api.ts`

#### 2. Hooks
- File: `frontend_school_crm/src/hooks/use-financial-month.ts`

#### 3. UI Components
- `src/components/CloseMonthButton.tsx`
- `src/components/financial-month-status.tsx`

#### 4. Context/State
- `src/context/` - Look for any financial month context

#### 5. Pages
- Dashboard/homepage - Remove financial month status display
- Settings - Remove financial month configuration
- Any page showing closed month warnings

#### 6. Types
- `src/types/index.ts` - Remove FinancialMonth type

#### 7. Dependencies
- Remove any financial month related utility functions
- Remove from storage if applicable

## Removal Steps

### Phase 1: Backend Database (Migration)

1. Create new migration file:
   - Drop foreign key constraints
   - Drop `financial_month_id` columns
   - Drop `financial_months` table

2. Update schema initialization if auto-creating tables

### Phase 2: Backend Code

1. Delete `financial_month_service.go`
2. Delete financial month handler file
3. Remove FinancialMonth model from models
4. Remove financial month routes from main.go
5. Remove financial month dependency injection from handlers

### Phase 3: Frontend - Delete Files

1. Delete `src/lib/financial-month-api.ts`
2. Delete `src/hooks/use-financial-month.ts`
3. Delete `src/components/CloseMonthButton.tsx`
4. Delete `src/components/financial-month-status.tsx`

### Phase 4: Frontend - Remove from Pages

1. **Dashboard/Index page:**
   - Remove financial month status display
   - Remove close month button

2. **Settings page:**
   - Remove financial month configuration
   - Remove closed month warnings

3. **Any other pages:**
   - Remove imports of financial month components
   - Remove financial month checks/guards
   - Remove closed month validation

### Phase 5: Frontend - Clean Up

1. Remove from Context (if exists)
2. Remove from Types (`src/types/index.ts`)
3. Remove from utils/helpers
4. Remove from translations (i18n)
5. Remove documentation files related to financial months

## Documentation Files to Delete

- `FINANCIAL_MONTH_SYSTEM.md`
- `FINANCIAL_MONTH_DATA_FLOW.md`
- `FINANCIAL_MONTH_IMPLEMENTATION_COMPLETE.md`
- `QUICK_REFERENCE_FINANCIAL_MONTH.md`
- `FINANCIAL_MONTH_INDEX.md`
- `FINANCIAL_MONTH_IMPLEMENTATION.md`
- `BRANCH_FINANCIAL_MONTH_IMPLEMENTATION.md`
- `CLOSE_MONTH_*.md` (all close month related docs)
- `FINANCIAL_MONTH_*.md` (all financial month docs)

## Files to Modify

### Backend
- `backend_school_crm/internal/handlers/payment.go` - Remove FM-related filters
- `backend_school_crm/internal/handlers/salary.go` - Remove FM-related filters
- `backend_school_crm/internal/handlers/expense.go` - Remove FM-related filters
- `backend_school_crm/cmd/main.go` - Remove FM service registration
- `backend_school_crm/internal/models/models.go` - Remove FM types

### Frontend
- `src/pages/index.tsx` - Remove FM status
- `src/pages/settings.tsx` - Remove FM options
- `src/types/index.ts` - Remove FinancialMonth type
- `src/lib/storage.ts` - Remove FM related storage
- `src/lib/api.ts` - Remove FM API calls
- All pages using financial month imports

## Search Terms for Cleanup

Search for these patterns to find all FM references:

### Backend
```
- "financial_month"
- "FinancialMonth"
- "close_month"
- "CloseMonth"
- "CLOSED" (month status)
- "canFinishMonth"
- "canCloseMonth"
```

### Frontend
```
- "financial"
- "FinancialMonth"
- "closeMonth"
- "CloseMonthButton"
- "financial-month"
- "use-financial-month"
- "canFinishMonth"
```

## Risk Assessment

### Low Risk
- Removing FM-specific UI components
- Removing FM API wrapper

### Medium Risk
- Removing FM service from backend
- Removing FM database columns (requires migration)

### High Risk
- Removing FM constraints on tables if data exists
- Need to ensure no existing data references FM IDs

## Order of Execution

1. **Create and run database migration** (creates clean state)
2. **Remove backend service and models**
3. **Remove backend handlers and routes**
4. **Remove backend dependencies**
5. **Remove frontend files**
6. **Update frontend imports** (find and fix import errors)
7. **Remove translations**
8. **Delete documentation**

## Verification Steps

After removal:

1. **Backend**
   - [ ] Code compiles
   - [ ] No references to financial_month remain
   - [ ] No FM-related imports
   - [ ] No FM-related routes

2. **Frontend**
   - [ ] TypeScript compilation succeeds
   - [ ] No import errors
   - [ ] No FinancialMonth references
   - [ ] Dashboard loads without FM status
   - [ ] Settings page works without FM options

3. **Database**
   - [ ] Migration runs successfully
   - [ ] No FM columns in schema
   - [ ] No FM tables exist

## Alternative Approach (Less Destructive)

If you want to keep financial month data but just disable the functionality:

1. Keep database schema as-is
2. Remove FM endpoints from API
3. Remove FM UI components
4. Remove permission checks
5. Treat all months as "OPEN"

**Recommendation**: Full removal is cleaner for this case.

## Summary

- **Files to Delete**: ~10 files (backend + frontend)
- **Files to Modify**: ~10 files
- **Database Migration**: 1 (new)
- **Lines of Code Removed**: ~2000+
- **Complexity**: Medium-High
- **Time Estimate**: 2-3 hours

---

## Status
**Ready to Execute**: Yes, all FM references documented and located.
