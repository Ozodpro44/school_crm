# Complete Settings Flow - From Request to Response

## Request Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ CLIENT REQUEST                                                      │
│ GET /api/settings                                                   │
│ Headers: Authorization: Bearer JWT_TOKEN                            │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ MIDDLEWARE - Auth                                                   │
│ - Extract JWT token                                                 │
│ - Verify signature                                                  │
│ - Extract user_id and branch_id                                     │
│ - Set c.Set("branch_id", branchID)                                 │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ROUTE HANDLER                                                       │
│ handlers/settings.go:getSettings()                                  │
│                                                                      │
│ 1. Get branch_id from context: branchID := c.Get("branch_id")       │
│ 2. Check if exists: if !exists { return 400 }                       │
│ 3. Log: [SETTINGS HANDLER] GET /settings called for branch X        │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SERVICE LAYER                                                       │
│ service/branch_service.go:GetByID(branchID)                         │
│                                                                      │
│ Builds SQL query:                                                   │
│   SELECT id, name, address, phone, monthly_payment, currency,       │
│          admin_id, created_at, updated_at, created_date, updated_date │
│   FROM branches                                                      │
│   WHERE id = $1                                                      │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ DATABASE QUERY                                                      │
│ PostgreSQL                                                          │
│                                                                      │
│ branches table:                                                      │
│ - id: "abc123"                                                      │
│ - name: "Main Branch"                                               │
│ - address: "123 Main St"                                            │
│ - phone: "555-1234"                                                 │
│ - monthly_payment: 500000                                           │
│ - currency: "UZS"                                                   │
│ - admin_id: "user123"                                               │
│ - created_at: 2025-12-01T10:00:00Z                                  │
│ - updated_at: 2025-12-11T16:10:00Z                                  │
│ - created_date: 2025-12-01T10:00:00Z                                │
│ - updated_date: 2025-12-11T16:10:00Z                                │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ MODEL MAPPING                                                       │
│ service/branch_service.go:GetByID() returns:                        │
│                                                                      │
│ models.Branch{                                                      │
│   ID: "abc123",                                                     │
│   Name: "Main Branch",                                              │
│   Address: "123 Main St",                                           │
│   Phone: "555-1234",                                                │
│   MonthlyPayment: 500000.0,                                         │
│   Currency: "UZS",                                                  │
│   AdminID: ptr("user123"),                                          │
│   CreatedAt: time.Time(2025-12-01T10:00:00Z),                       │
│   UpdatedAt: time.Time(2025-12-11T16:10:00Z),                       │
│   CreatedDate: time.Time(2025-12-01T10:00:00Z),                     │
│   UpdatedDate: time.Time(2025-12-11T16:10:00Z),                     │
│ }                                                                    │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ RESPONSE BUILDER                                                    │
│ handlers/settings.go:getSettings()                                  │
│                                                                      │
│ Build SettingsResponse:                                             │
│   response := SettingsResponse{                                     │
│     Name:           branch.Name,           // "Main Branch"         │
│     MonthlyPayment: branch.MonthlyPayment, // 500000                │
│     Currency:       branch.Currency,       // "UZS"                 │
│     UpdatedDate:    Format(branch.UpdatedDate),   // ISO 8601        │
│     CreatedDate:    Format(branch.CreatedDate),   // ISO 8601        │
│   }                                                                  │
│                                                                      │
│ Timestamp formatting:                                               │
│   branch.UpdatedDate.Format("2006-01-02T15:04:05Z07:00")            │
│   → "2025-12-11T16:10:00Z"                                          │
│                                                                      │
│   branch.CreatedDate.Format("2006-01-02T15:04:05Z07:00")            │
│   → "2025-12-01T10:00:00Z"                                          │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ JSON ENCODING                                                       │
│ c.JSON(http.StatusOK, response)                                     │
│                                                                      │
│ JSON tags applied:                                                  │
│   Name → "name"                                                     │
│   MonthlyPayment → "monthlyPayment"                                 │
│   Currency → "currency"                                             │
│   UpdatedDate → "updatedDate"                                       │
│   CreatedDate → "createdDate"                                       │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ HTTP RESPONSE                                                       │
│ Status: 200 OK                                                      │
│ Content-Type: application/json                                      │
│                                                                      │
│ Body:                                                               │
│ {                                                                   │
│   "name": "Main Branch",                                            │
│   "monthlyPayment": 500000,                                         │
│   "currency": "UZS",                                                │
│   "updatedDate": "2025-12-11T16:10:00Z",                            │
│   "createdDate": "2025-12-01T10:00:00Z"                             │
│ }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Error Flow Examples

### Example 1: Missing Authentication
```
GET /api/settings
(No Authorization header)
                    ↓
         AuthMiddleware
                    ↓
    Invalid/Missing JWT Token
                    ↓
         Return 401 Unauthorized
```

### Example 2: No Branch Assigned
```
GET /api/settings
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
(JWT token valid but user.branch_id is null)
                    ↓
    AuthMiddleware → c.Set("branch_id", "")
                    ↓
  SettingsHandler checks branch_id
                    ↓
    branch_id is empty → return 400
    "user has no assigned branch"
```

### Example 3: Branch Not Found
```
GET /api/settings
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
(JWT token valid, user.branch_id = "nonexistent-id")
                    ↓
    SettingsHandler gets branch_id
                    ↓
    BranchService.GetByID("nonexistent-id")
                    ↓
    Query: SELECT * FROM branches WHERE id = 'nonexistent-id'
                    ↓
    No rows returned → sql.ErrNoRows
                    ↓
    Return 404 "branch not found"
```

---

## Update Flow

### PUT /api/settings Request
```
PUT /api/settings
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "monthlyPayment": 600000,
  "currency": "USD"
}
                    ↓
    SettingsHandler.updateSettings()
                    ↓
    Get branch_id from context
                    ↓
    Parse JSON body into map[string]interface{}
                    ↓
    BranchService.Update(branchID, updates)
                    ↓
    Build dynamic UPDATE query:
    UPDATE branches SET 
      monthly_payment = $1,
      currency = $2
    WHERE id = $3
                    ↓
    Execute query with values:
      [600000, "USD", branchID]
                    ↓
    BranchService.GetByID() to fetch updated record
                    ↓
    Build SettingsResponse with updated values
                    ↓
PUT /api/settings Response
200 OK

{
  "name": "Main Branch",
  "monthlyPayment": 600000,
  "currency": "USD",
  "updatedDate": "2025-12-11T16:15:30Z",
  "createdDate": "2025-12-01T10:00:00Z"
}
```

---

## Code Flow Summary

### Handler Entry Point
```
handlers/settings.go::getSettings()
    ↓
    Extract branch_id from context
    ↓
    Call branchService.GetByID(branchID)
    ↓
    Create SettingsResponse
    ↓
    Format timestamps
    ↓
    Return JSON response
```

### Service Layer
```
service/branch_service.go::GetByID()
    ↓
    Build SQL SELECT query
    ↓
    Execute query against branches table
    ↓
    Scan result rows into Branch struct
    ↓
    Return Branch model
```

### Data Transformation
```
Database Row (PostgreSQL)
    ↓
Branch Model (Go struct)
    ↓
SettingsResponse struct
    ↓
JSON response to client
```

---

## Key Points

1. **Branch ID Source**: JWT token (set by AuthMiddleware)
2. **Data Source**: Single `branches` table
3. **Response Fields**: 5 fields extracted from 1 table
4. **Timestamps**: ISO 8601 format (UTC)
5. **Authentication**: Required on all endpoints
6. **Validation**: Branch existence check on GET
7. **Updates**: Flexible field updates via map
8. **Error Handling**: Proper HTTP status codes
9. **Logging**: Comprehensive at each stage
10. **Performance**: Direct table access, no joins

---

## Files Involved in Complete Flow

### Request Processing
1. `cmd/main.go` - Server setup, route registration
2. `internal/middleware/auth.go` - JWT validation
3. `internal/handlers/settings.go` - Endpoint handlers
4. `internal/service/branch_service.go` - Data access
5. `internal/models/models.go` - Data structures

### Database
1. `migrations/000001_init_tables.up.sql` - Schema definition
2. PostgreSQL - Actual data storage

### Response Generation
1. `internal/handlers/settings.go` - SettingsResponse struct
2. Go json package - JSON encoding

---

## Performance Characteristics

- **GET /api/settings**: 1 SELECT query
- **PUT /api/settings**: 1 UPDATE query + 1 SELECT query
- **No joins needed**: Direct column access
- **Indexed column**: id (primary key)
- **Response time**: < 100ms typical

---

## Summary

The settings endpoint provides a clean, efficient interface to access branch settings stored directly in the `branches` table. The flow is:

1. Client authenticates with JWT token
2. Handler extracts branch_id from token
3. Service fetches branch row from database
4. Handler transforms data to SettingsResponse
5. Response returned as JSON with 5 required fields

No settings table, no joins, no complex logic—just simple, direct data access.
