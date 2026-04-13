# Settings API Guide

## Overview

Settings are now stored in the `branches` table. The `/api/settings` endpoint provides access to branch settings including monthly payment, currency, name, and timestamps.

---

## Endpoints

### GET /api/settings

Get branch settings for the authenticated user's branch.

**Authentication:** Required (JWT Token)

**Response (200 OK):**
```json
{
  "name": "Main Branch",
  "monthlyPayment": 1000000.00,
  "currency": "UZS",
  "updatedDate": "2025-12-11T16:10:00Z",
  "createdDate": "2025-12-01T10:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - User has no assigned branch
- `404 Not Found` - Branch not found
- `500 Internal Server Error` - Server error

**Example:**
```bash
curl -X GET http://localhost:8080/api/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### PUT /api/settings

Update branch settings for the authenticated user's branch.

**Authentication:** Required (JWT Token)

**Request Body:**
```json
{
  "monthlyPayment": 1200000,
  "currency": "USD",
  "name": "Main Branch - Updated"
}
```

**Response (200 OK):**
```json
{
  "name": "Main Branch - Updated",
  "monthlyPayment": 1200000.00,
  "currency": "USD",
  "updatedDate": "2025-12-11T16:15:00Z",
  "createdDate": "2025-12-01T10:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid JSON or user has no assigned branch
- `404 Not Found` - Branch not found
- `500 Internal Server Error` - Server error

**Example:**
```bash
curl -X PUT http://localhost:8080/api/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "monthlyPayment": 1200000,
    "currency": "USD"
  }'
```

---

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Branch name |
| `monthlyPayment` | float64 | Monthly payment amount in the specified currency |
| `currency` | string | Currency code (e.g., 'UZS', 'USD') |
| `updatedDate` | string | ISO 8601 timestamp of last update |
| `createdDate` | string | ISO 8601 timestamp of creation |

---

## Updatable Fields

You can update the following fields:

- `name` - Branch name
- `monthlyPayment` - Monthly payment amount
- `currency` - Currency code
- `address` - Branch address
- `phone` - Branch phone number

**Note:** `createdDate` is immutable and cannot be updated.

---

## Database Schema

Settings are stored in the `branches` table:

```sql
CREATE TABLE branches (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500),
    phone VARCHAR(20),
    monthly_payment DECIMAL(15,2),
    currency VARCHAR(10),
    admin_id UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    created_date TIMESTAMP,
    updated_date TIMESTAMP
);
```

---

## Migration from Old Settings Table

Previously, settings were stored in a separate `settings` table. All settings data is now:
- Stored in the `branches` table
- Accessed via the `branches` table
- Only includes: `name`, `monthly_payment`, `currency`, `created_date`, `updated_date`

Other fields like `language`, `school_name`, `school_logo`, etc. have been removed per requirements.

---

## Examples

### Example 1: Get Settings
```bash
curl -X GET http://localhost:8080/api/settings \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Response:
```json
{
  "name": "Main Branch",
  "monthlyPayment": 500000,
  "currency": "UZS",
  "updatedDate": "2025-12-11T16:10:00Z",
  "createdDate": "2025-12-01T10:00:00Z"
}
```

### Example 2: Update Monthly Payment and Currency
```bash
curl -X PUT http://localhost:8080/api/settings \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "monthlyPayment": 600000,
    "currency": "USD"
  }'
```

Response:
```json
{
  "name": "Main Branch",
  "monthlyPayment": 600000,
  "currency": "USD",
  "updatedDate": "2025-12-11T16:15:30Z",
  "createdDate": "2025-12-01T10:00:00Z"
}
```

### Example 3: Update Branch Name
```bash
curl -X PUT http://localhost:8080/api/settings \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Downtown Campus"
  }'
```

---

## Notes

- All requests require authentication via JWT token
- The user's branch is determined from their JWT token
- Timestamps are in ISO 8601 format with UTC timezone
- `monthlyPayment` is stored as a decimal with 2 decimal places
- `currency` is typically a 3-character code (ISO 4217)
