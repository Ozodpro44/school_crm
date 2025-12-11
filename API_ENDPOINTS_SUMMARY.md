# API Endpoints Summary

## Settings Endpoints (NEW - From Branches Table)

### GET /api/settings
Get branch settings for authenticated user

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
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

**Status Codes:**
- 200 OK - Settings retrieved
- 400 Bad Request - No branch assigned to user
- 404 Not Found - Branch not found
- 500 Internal Server Error - Server error

---

### PUT /api/settings
Update branch settings for authenticated user

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "monthlyPayment": 600000,
  "currency": "USD",
  "name": "Main Branch"
}
```

**Response:**
```json
{
  "name": "Main Branch",
  "monthlyPayment": 600000,
  "currency": "USD",
  "updatedDate": "2025-12-11T16:15:30Z",
  "createdDate": "2025-12-01T10:00:00Z"
}
```

**Status Codes:**
- 200 OK - Settings updated
- 400 Bad Request - Invalid JSON or no branch assigned
- 500 Internal Server Error - Server error

---

## Branch Endpoints (ALTERNATIVE)

You can also manage settings via branch endpoints:

### GET /api/branches/:id
Get full branch details including settings

**Response Includes:**
```json
{
  "id": "uuid",
  "name": "Main Branch",
  "address": "123 Main St",
  "phone": "555-1234",
  "monthlyPayment": 500000,
  "currency": "UZS",
  "createdAt": "2025-12-01T10:00:00Z",
  "updatedAt": "2025-12-11T16:10:00Z",
  "createdDate": "2025-12-01T10:00:00Z",
  "updatedDate": "2025-12-11T16:10:00Z"
}
```

### PUT /api/branches/:id
Update branch details including settings

**Request:**
```json
{
  "monthlyPayment": 600000,
  "currency": "USD",
  "name": "Main Branch"
}
```

---

## Field Mapping

### Settings Response Fields
| Field | Type | Source Field | Description |
|-------|------|--------------|-------------|
| name | string | branches.name | Branch name |
| monthlyPayment | float64 | branches.monthly_payment | Monthly payment amount |
| currency | string | branches.currency | Currency code |
| updatedDate | string | branches.updated_date | Last update timestamp (ISO 8601) |
| createdDate | string | branches.created_date | Creation timestamp (ISO 8601) |

---

## Key Differences

### Settings vs Branch Endpoints

**Use `/api/settings` when:**
- You only need settings information
- You want a cleaner, focused endpoint
- You want only specific fields (name, monthly_payment, currency, dates)
- You're building a settings UI

**Use `/api/branches/:id` when:**
- You need full branch information
- You want address, phone, and other branch details
- You need to update multiple branch attributes at once

---

## Example Usage

### JavaScript/TypeScript

```typescript
// Get settings
const response = await fetch('http://localhost:8080/api/settings', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  }
});
const settings = await response.json();
console.log(settings.currency); // "UZS"
console.log(settings.monthlyPayment); // 500000

// Update settings
const updateResponse = await fetch('http://localhost:8080/api/settings', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    monthlyPayment: 600000,
    currency: 'USD'
  })
});
const updatedSettings = await updatedResponse.json();
```

### cURL

```bash
# Get settings
curl -X GET http://localhost:8080/api/settings \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Update settings
curl -X PUT http://localhost:8080/api/settings \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "monthlyPayment": 600000,
    "currency": "USD"
  }'
```

---

## Database Structure

Settings are stored in the `branches` table:

```sql
branches table:
├── id (UUID)
├── name (VARCHAR) ─────────→ SettingsResponse.name
├── address (VARCHAR)
├── phone (VARCHAR)
├── monthly_payment (DECIMAL) → SettingsResponse.monthlyPayment
├── currency (VARCHAR) ────────→ SettingsResponse.currency
├── admin_id (UUID)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
├── created_date (TIMESTAMP) ─→ SettingsResponse.createdDate
└── updated_date (TIMESTAMP) ─→ SettingsResponse.updatedDate
```

---

## Migration History

### Before
- Settings stored in separate `settings` table
- Separate endpoints for settings
- Complex query logic

### After
- Settings stored in `branches` table
- Simplified endpoints
- Direct mapping from branch fields
- One table, one source of truth

---

## Notes

1. **Authentication Required**: All settings endpoints require valid JWT token
2. **Branch Association**: User's branch is determined from JWT token
3. **Immutable Fields**: `createdDate` cannot be modified
4. **Timezone**: All timestamps are in UTC (ISO 8601 format)
5. **Decimal Precision**: `monthlyPayment` supports 2 decimal places
