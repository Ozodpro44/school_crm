# Backend Developer Endpoints

New API endpoints have been added to support the developer dashboard.

## Location
- File: `/backend_school_crm/internal/handlers/developer.go`
- Registered in: `/backend_school_crm/cmd/main.go`

## Endpoints

All developer endpoints are protected routes (require JWT authentication).

### 1. Get Database Schema
```
GET /api/dev/schema
```

Returns the complete database schema including all tables and columns.

**Response:**
```json
{
  "tables": [
    {
      "name": "users",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "nullable": false,
          "default": ""
        },
        {
          "name": "email",
          "type": "character varying",
          "nullable": false
        }
      ]
    }
  ],
  "count": 12,
  "version": "1.0.0"
}
```

**Usage in Frontend:**
- Database Explorer tool uses this to display schema
- Shows all tables, columns, types, and constraints

---

### 2. Get Database Migrations
```
GET /api/dev/migrations
```

Returns the list of applied database migrations.

**Response:**
```json
{
  "migrations": [
    {
      "version": 13,
      "dirty": false,
      "time": "2026-01-09T10:30:45Z"
    },
    {
      "version": 12,
      "dirty": false,
      "time": "2026-01-08T15:20:10Z"
    }
  ],
  "count": 13
}
```

**Usage in Frontend:**
- Database Explorer shows migration history
- Displays migration version and status

---

### 3. Get API Documentation
```
GET /api/dev/api-docs
```

Returns documentation for all API endpoints.

**Response:**
```json
{
  "version": "1.0.0",
  "endpoints": [
    {
      "method": "POST",
      "path": "/api/auth/login",
      "description": "User login",
      "public": true,
      "params": {
        "email": "user email",
        "password": "user password"
      }
    },
    {
      "method": "GET",
      "path": "/api/users",
      "description": "List all users",
      "public": false
    }
  ],
  "count": 20
}
```

**Usage in Frontend:**
- API Documentation tool displays all endpoints
- Shows method, path, description, and public/protected status

---

### 4. Generate Test Data
```
POST /api/dev/generate-test-data
```

Generates test data for development and testing purposes.

**Authorization:** Admin only

**Request:**
```json
{}
```

**Response:**
```json
{
  "students": 12,
  "teachers": 8,
  "classes": 5,
  "payments": 35,
  "message": "Test data generated successfully for development",
  "status": "completed"
}
```

**What Gets Generated:**
- Test student records
- Test teacher accounts
- Test classes
- Test payment records

**Usage in Frontend:**
- Test Data Generator tool calls this endpoint
- Creates dummy data for testing

---

## Implementation Details

### Database Schema Queries

The schema endpoint queries the PostgreSQL information schema:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
```

For columns:
```sql
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = $1
AND table_schema = 'public'
```

### Migrations Query

Queries the `schema_migrations` table:

```sql
SELECT version, dirty, tstamp
FROM schema_migrations
ORDER BY version DESC
LIMIT 20
```

### Test Data Generation

- Creates 12 test students
- Creates 8 test teachers
- Creates 5 test classes
- Creates 35 test payment records
- All tied to the authenticated user's branch

---

## Security Considerations

- All endpoints require valid JWT token
- Test data generation is admin-only
- Schema and docs available to authenticated users only
- No sensitive data exposed in schemas
- Operations are scoped to user's branch

---

## Frontend Integration

### Database Explorer
- Fetches schema on component mount
- Displays tables with columns and types
- Shows migration history
- Refresh button to reload

### API Documentation
- Fetches docs on component mount
- Displays all endpoints with details
- Public/protected indicators
- Parameter information

### Test Data Generator
- Admin only (checked on frontend)
- Calls generate endpoint
- Displays statistics of created data
- Error handling

---

## File Changes

### New Files
- `internal/handlers/developer.go` - All developer endpoints

### Modified Files
- `cmd/main.go` - Registered developer routes

### Updated Frontend
- `app/tools/db-explorer/page.tsx` - Fetches real schema
- `app/tools/api-docs/page.tsx` - Fetches real docs
- `app/tools/test-data/page.tsx` - Calls generate endpoint

---

## Testing

Test the endpoints with curl:

```bash
# Get schema
curl -X GET http://localhost:8080/api/dev/schema \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get migrations
curl -X GET http://localhost:8080/api/dev/migrations \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get API docs
curl -X GET http://localhost:8080/api/dev/api-docs \
  -H "Authorization: Bearer YOUR_TOKEN"

# Generate test data (admin only)
curl -X POST http://localhost:8080/api/dev/generate-test-data \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Future Enhancements

Possible additions:
- Performance metrics endpoint
- Query execution history
- Database statistics
- Table growth tracking
- Backup/restore management
- Configuration export/import
- Log viewer endpoint
- Audit trail viewer

---

## Status

✅ All endpoints implemented and working
✅ Frontend integrated
✅ Admin authorization working
✅ Error handling in place
✅ Documentation complete
