# Settings & Branch Integration

## Overview
Settings are now properly integrated with branches. Each branch automatically gets its own settings when created, and the system uses JWT authentication to automatically route settings requests to the correct branch.

## Database Schema
- **settings table** now has `branch_id` foreign key
- **UNIQUE constraint** on `branch_id` ensures one settings record per branch
- Settings are automatically deleted when a branch is deleted (CASCADE)

## Backend Changes

### 1. Database Migration
- Settings table includes `branch_id` column (required, foreign key to branches)
- Index created on `branch_id` for fast lookups
- Constraints ensure one settings per branch

### 2. JWT Authentication
- **CustomClaims struct** added to middleware:
  ```go
  type CustomClaims struct {
    UserID   string
    BranchID string
    jwt.RegisteredClaims
  }
  ```
- JWT tokens now include both `user_id` and `branch_id`
- Token is automatically generated during login/register with user's branch info

### 3. Branch Service
- **`BranchService.Create()`** - Automatically creates default settings for new branch
- **`BranchService.GetSettings(branchID)`** - Retrieves settings for a branch
- **`BranchService.UpdateSettings(branchID, updates)`** - Updates settings for a branch
- **`BranchService.createDefaultSettings()`** - Internal helper for creating default settings

### 4. Settings Service
- **`GetByBranch(branchID)`** - Get settings by branch ID
- **`UpdateByBranch(branchID, updates)`** - Update settings by branch ID

### 5. API Endpoints

#### Settings Endpoints (Auto-detects branch from JWT)
```
GET    /api/settings              # Get authenticated user's branch settings
PUT    /api/settings              # Update authenticated user's branch settings
GET    /api/settings?branchId=xxx # Get specific branch settings (override)
PUT    /api/settings?branchId=xxx # Update specific branch settings (override)
```

#### Branch Settings Endpoints (Explicit)
```
GET    /api/branches/:id/settings  # Get branch settings
PUT    /api/branches/:id/settings  # Update branch settings
```

## Frontend Changes

### 1. Settings API Functions
```typescript
// Get settings (uses JWT to auto-detect branch)
getSettings(): Promise<Settings>
getSettings(branchId): Promise<Settings>  // Override with specific branch

// Update settings (uses JWT to auto-detect branch)
updateSettings(updates): Promise<Settings>
updateSettings(updates, branchId): Promise<Settings>  // Override

// Alternative endpoints via branches
getBranchSettings(branchId): Promise<Settings>
updateBranchSettings(branchId, updates): Promise<Settings>
```

### 2. LanguageContext
- Simplified to call `getSettings()` without passing branchId
- Backend automatically extracts branch from JWT
- Still works in offline mode with defaults

### 3. Type Updates
- **Settings interface** now includes `branchId: string`
- Language type is properly typed as `"uz-cyrl" | "uz-latn" | "en"`

## Workflow

### Creating a Branch
1. Admin calls `POST /api/branches` with branch details
2. Backend:
   - Creates branch record
   - Automatically creates default settings for branch
   - Returns branch data
3. Default settings:
   - DefaultMonthlyPayment: 500000
   - DefaultTeacherSalary: 3000000
   - Currency: UZS
   - Language: uz-cyrl
   - SchoolName: School CRM

### User Login
1. User submits login credentials
2. Backend authenticates and creates JWT with:
   - `user_id`: User's ID
   - `branch_id`: User's assigned branch
3. Frontend stores JWT (already doing this)

### Accessing Settings
1. Frontend calls `getSettings()` without parameters
2. Backend:
   - Extracts `branch_id` from JWT
   - Queries settings for that branch
   - Returns settings data
3. If no JWT or branch: returns 400/401 error

### Updating Settings
1. Frontend calls `updateSettings({ language: "uz-latn" })`
2. Backend:
   - Extracts `branch_id` from JWT
   - Updates settings for that branch
   - Returns updated settings

## Error Handling

| Scenario | Status | Message |
|----------|--------|---------|
| No JWT token | 401 | "user not authenticated" |
| User not assigned to branch | 400 | "user has no assigned branch" |
| Branch settings not found | 500 | "settings not found for branch" |
| Invalid request data | 400 | Validation error |

## Benefits

✅ **Multi-branch support** - Each branch has independent settings
✅ **Automatic routing** - No need to manually pass branchId
✅ **Security** - Branch ID comes from JWT, can't be spoofed
✅ **Consistency** - Settings always created with new branch
✅ **Backward compatible** - Old branchId query param still works
✅ **Simplified frontend** - No need to track branchId in context

## Example Usage

### Frontend
```typescript
import { getSettings, updateSettings } from '@/lib/api';

// Get current user's branch settings (from JWT)
const settings = await getSettings();

// Update language
await updateSettings({ language: 'uz-latn' });

// Or access specific branch
const branchSettings = await getBranchSettings('branch-uuid');
await updateBranchSettings('branch-uuid', { currency: 'UZS' });
```

### Backend
```go
// Create branch with auto-created settings
branch, err := branchService.Create(ctx, &CreateBranchRequest{
  Name: "Main Branch",
  // ...
})
// Settings automatically created

// Get branch settings
settings, err := branchService.GetSettings(ctx, branchID)

// Update branch settings
settings, err := branchService.UpdateSettings(ctx, branchID, updates)
```

## Testing

### 1. Create a branch
```bash
curl -X POST http://localhost:8080/api/branches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Main Branch",
    "address": "123 Main St",
    "phone": "123456789",
    "monthlyPayment": 5000
  }'
```

### 2. Get branch settings
```bash
curl http://localhost:8080/api/branches/<branch-id>/settings \
  -H "Authorization: Bearer <token>"
```

### 3. Update branch settings
```bash
curl -X PUT http://localhost:8080/api/branches/<branch-id>/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "currency": "UZS",
    "language": "uz-cyrl"
  }'
```

### 4. Get authenticated user's settings
```bash
curl http://localhost:8080/api/settings \
  -H "Authorization: Bearer <token>"
```

## Migration Notes

If you have existing settings data:
1. Settings table is dropped and recreated during migration
2. Existing settings data will be lost
3. For production, create a proper data migration script
4. Associate settings with a default branch before moving forward
