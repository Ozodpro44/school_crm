# Settings Updated Date Fix

## Problem
When updating branch settings, the `updated_at` and `updated_date` timestamps were not being updated. The timestamps remained the same as the original creation time.

## Root Cause
The `BranchService.Update()` method in the backend was not automatically setting the timestamp fields when updating records. It only updated the fields that the client explicitly sent in the request.

### Before (Broken)
```go
func (s *BranchService) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.Branch, error) {
    updates = utils.ConvertKeysToSnakeCase(updates)
    // ... builds SQL query from updates map ...
    // ❌ No timestamp fields added
    _, err := s.db.GetConn().ExecContext(ctx, query, args...)
    return s.GetByID(ctx, id)
}
```

## Solution
Automatically set the `updated_at` and `updated_date` timestamps whenever an update occurs, regardless of what fields the client sends.

### After (Fixed)
```go
func (s *BranchService) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.Branch, error) {
    updates = utils.ConvertKeysToSnakeCase(updates)
    
    // Always update the timestamp fields
    now := time.Now()
    updates["updated_at"] = now
    updates["updated_date"] = now
    // ✅ Timestamps are automatically set
    
    query := `UPDATE branches SET `
    args := []interface{}{}
    // ... builds SQL query from updates map ...
    _, err := s.db.GetConn().ExecContext(ctx, query, args...)
    return s.GetByID(ctx, id)
}
```

## File Modified
`/backend_school_crm/internal/service/branch_service.go`

## Changes
- Added automatic timestamp update in the `Update()` method
- Both `updated_at` and `updated_date` fields are set to current time
- Timestamps are set regardless of what fields the client sends
- Uses `time.Now()` to get the current time in UTC

## How It Works

1. When a settings update request comes in:
   ```
   PUT /api/settings
   {
     "name": "Branch A",
     "monthlyPayment": 50000
   }
   ```

2. The `updateSettings` handler calls `branchService.Update()`

3. The service automatically adds:
   ```go
   updates["updated_at"] = now
   updates["updated_date"] = now
   ```

4. The SQL query includes both the client-provided fields AND the timestamp fields:
   ```sql
   UPDATE branches 
   SET name = $1, monthly_payment = $2, updated_at = $3, updated_date = $4
   WHERE id = $5
   ```

5. The response includes the updated timestamp:
   ```json
   {
     "name": "Branch A",
     "monthlyPayment": 50000,
     "updatedDate": "2025-01-28T15:30:45Z",
     "createdDate": "2025-01-15T10:20:00Z"
   }
   ```

## Testing
After applying this fix:

1. Open the Settings page
2. Change any setting (name, payment amount, etc.)
3. Save the changes
4. Check the updated date - it should show the current time
5. Make another change after a few minutes
6. Verify the updated date changes again

## Before vs After
| Scenario | Before | After |
|----------|--------|-------|
| Update settings | `updated_at` unchanged | `updated_at` updates to current time |
| Check update history | Shows original creation time | Shows correct update time |
| Audit trail | Broken - can't track updates | Works - tracks all changes |

## Related Fields
Both timestamp fields are updated together:
- `updated_at` - UTC timestamp
- `updated_date` - UTC timestamp (duplicate field for compatibility)

In the future, these could be consolidated to use just one field.
