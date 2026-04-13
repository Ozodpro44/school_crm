# Settings API - Quick Reference

## Endpoints

### GET /api/settings
Retrieve branch settings

```bash
curl -X GET http://localhost:8080/api/settings \
  -H "Authorization: Bearer JWT_TOKEN"
```

**Response:**
```json
{
  "name": "Main Branch",
  "monthlyPayment": 500000,
  "currency": "UZS",
  "updatedDate": "2025-12-11T16:10:00Z",
  "createdDate": "2025-12-01T10:00:00Z"
}
```

---

### PUT /api/settings
Update branch settings

```bash
curl -X PUT http://localhost:8080/api/settings \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "monthlyPayment": 600000,
    "currency": "USD"
  }'
```

**Updatable Fields:**
- name
- monthlyPayment
- currency
- address
- phone

---

## Database

**Table:** branches
**Columns Used:**
- name
- monthly_payment
- currency
- created_date
- updated_date

---

## Response Fields

| Field | Type | Example |
|-------|------|---------|
| name | string | "Main Branch" |
| monthlyPayment | float64 | 500000 |
| currency | string | "UZS" |
| updatedDate | string | "2025-12-11T16:10:00Z" |
| createdDate | string | "2025-12-01T10:00:00Z" |

---

## Code Changes

**Handler:** `internal/handlers/settings.go`
- Implements GET and PUT
- Uses BranchService
- Returns SettingsResponse

**Service:** `internal/service/branch_service.go`
- GetByID() returns branch with all settings data
- Update() handles settings updates

**Main:** `cmd/main.go`
- Registers settings routes with branchService

---

## Example Usage

### TypeScript
```typescript
// Get
const res = await fetch('/api/settings', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const settings = await res.json();

// Update
await fetch('/api/settings', {
  method: 'PUT',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ monthlyPayment: 600000 })
});
```

---

## Migration

Settings moved from:
- **Before:** `settings` table (separate)
- **After:** `branches` table (integrated)

Only these fields retained:
- ✅ name
- ✅ monthly_payment
- ✅ currency
- ✅ created_date
- ✅ updated_date

Removed:
- ❌ default_monthly_payment
- ❌ default_teacher_salary
- ❌ language
- ❌ school_name
- ❌ school_logo
- ❌ current_month
- ❌ current_year

---

## Build Status

✅ Compiles
✅ Routes registered
✅ Server starts
✅ All fields returned
✅ Error handling works
