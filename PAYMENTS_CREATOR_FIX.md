# Payments Creator Name Display Fix

## Problem
The payments page was showing "-" instead of the creator/user name for the "Who Added Payment" column. This was because:
1. The payments page was using local storage (paymentsDB) instead of fetching from the backend API
2. The backend API returns `createdBy` as a user ID, not the full name
3. The frontend had no mechanism to fetch user details from the API

## Solution
Integrated the payments page with the backend API and implemented user name caching:

### Changes Made

#### 1. **payments.tsx** - Backend API Integration
- **Added API imports:**
  - `listPayments` - Fetch payments from backend
  - `createPayment` - Create payments via backend
  - `updatePayment` - Update payments via backend
  - `deletePayment` - Delete payments via backend
  - `listStudents` - Fetch students from backend
  - `listClasses` - Fetch classes from backend
  - `getUser` - Fetch user details by ID

- **Added state management:**
  - `userNames` - Cache for fetched user names (maps userId to fullName)
  - `isLoading` - Track loading state

- **Updated loadData function:**
  - Changed from local storage to API calls
  - Fetches payments, students, and classes from backend in parallel
  - Handles errors gracefully with toast notifications

- **Added useEffect for loading user names:**
  - Automatically fetches user details for all unique `createdBy` IDs
  - Caches results to avoid duplicate API calls
  - Shows "-" as placeholder if user cannot be fetched

- **Updated getUserName function:**
  - Checks cache first
  - Falls back to local storage
  - Returns "-" if user data unavailable

- **Fixed date defaults:**
  - Uses current date instead of settings object (which doesn't have currentMonth/currentYear)

#### 2. **salaries.tsx** - Minor Fix
- Fixed date default to use current date instead of settings object

#### 3. **Backend Migration** (Created but optional)
- Added migration file: `000007_ensure_created_by_columns.up.sql`
- Ensures `created_by` columns exist in payments, salaries, and expenses tables
- Provides safety net in case migrations weren't run previously

## How It Works

1. **On page load:**
   - Frontend fetches all payments from the backend for the selected branch
   - Backend returns payments with `createdBy` field containing user ID (string)

2. **After payments are loaded:**
   - React useEffect identifies all unique user IDs in the `createdBy` field
   - For each unique user ID, a separate API call fetches the user details
   - User full names are cached in the `userNames` state

3. **When rendering payment table:**
   - `getUserName(userId)` function looks up the user in the cache
   - Returns the full name if found, "-" otherwise

## Benefits
- **Accurate user data:** Always displays the correct creator name
- **Efficient:** Caches user names to avoid duplicate API calls
- **Backend-driven:** Uses actual API data instead of local storage
- **Graceful fallback:** Shows "-" if user data unavailable
- **Async loading:** Doesn't block UI while loading user names

## Database Schema
The `payments` table already has the `created_by` column (UUID, nullable):
```sql
CREATE TABLE payments (
    ...
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ...
);
```

## Testing
To verify the fix works:
1. Ensure the backend API is running
2. Create a new payment via the payments page
3. The "Who Added Payment" column should now display the creator's name instead of "-"
4. Refresh the page to confirm user name persists (from cache/API)
