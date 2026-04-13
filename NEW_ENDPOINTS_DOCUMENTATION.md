# New API Endpoints Documentation

## Developer Endpoints

These endpoints are for development and administrative purposes. They don't require authentication.

---

### Seed Subscription Plans

**Endpoint**: `POST /api/dev/seed-subscription-plans`

**Description**: Creates default subscription plans in the database if they don't already exist.

**Purpose**: Initializes the subscription system with three tier options (Starter, Professional, Enterprise)

**Authentication**: None required

**Request**:
```
POST http://localhost:8080/api/dev/seed-subscription-plans
```

**Response (Success - 200 OK)**:
```json
{
  "message": "Subscription plans seeded successfully",
  "plans_created": 3
}
```

**Response (If table doesn't exist - 500 Internal Server Error)**:
```json
{
  "error": "Failed to seed subscription plans",
  "details": "pq: relation \"subscription_plans\" does not exist"
}
```

**Example with cURL**:
```bash
curl -X POST http://localhost:8080/api/dev/seed-subscription-plans
```

**Example with JavaScript/Fetch**:
```javascript
fetch('http://localhost:8080/api/dev/seed-subscription-plans', {
  method: 'POST'
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

**Example with Python**:
```python
import requests

response = requests.post('http://localhost:8080/api/dev/seed-subscription-plans')
print(response.json())
```

**Default Plans Created**:

1. **Starter Plan**
   - Price: $29.99/month
   - Max Branches: 1
   - Max Students: 100
   - Max Classes: 5
   - Features: Basic

2. **Professional Plan**
   - Price: $79.99/month
   - Max Branches: 3
   - Max Students: 500
   - Max Classes: 20
   - Features: Analytics, Priority Support

3. **Enterprise Plan**
   - Price: $199.99/month
   - Max Branches: 10
   - Max Students: 5000
   - Max Classes: 100
   - Features: Full Analytics, API Access, Priority Support

---

## Existing Endpoints (Enhanced)

### Get Subscription Plans

**Endpoint**: `GET /api/subscriptions/plans`

**Description**: Retrieves all active subscription plans

**Enhancement**: Now returns helpful error message if table doesn't exist

**Authentication**: None required (Public endpoint)

**Response (Success - 200 OK)**:
```json
[
  {
    "id": "uuid",
    "name": "Starter",
    "description": "Perfect for small schools starting their digital journey",
    "price": 29.99,
    "billingPeriod": "monthly",
    "maxBranches": 1,
    "maxStudents": 100,
    "maxClasses": 5,
    "features": {
      "analytics": false,
      "api_access": false,
      "priority_support": false
    },
    "status": "active",
    "createdAt": "2026-01-20T00:00:00Z",
    "updatedAt": "2026-01-20T00:00:00Z"
  },
  ...
]
```

**Response (If table not initialized - 500 Internal Server Error)**:
```json
{
  "error": "Subscription plans table not initialized. Please run migrations or seed the database.",
  "details": "POST /api/dev/seed-subscription-plans"
}
```

**Note**: Error message now includes helpful guidance about the seeding endpoint.

---

## Database Recovery Steps

If subscription plans table doesn't exist:

### Step 1: Try Seeding (Fastest)
```bash
curl -X POST http://localhost:8080/api/dev/seed-subscription-plans
```

### Step 2: If Step 1 Fails, Check Table Exists
```sql
SELECT EXISTS(
  SELECT FROM information_schema.tables 
  WHERE table_name = 'subscription_plans'
);
```

### Step 3: Run Migrations Manually
```bash
cd backend_school_crm
# Restart the app - migrations run on startup
go run ./cmd/main.go
```

### Step 4: If Still Missing, Create Table Manually
```sql
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(20,2) NOT NULL,
    billing_period VARCHAR(50) NOT NULL DEFAULT 'monthly',
    max_branches INTEGER,
    max_students INTEGER,
    max_classes INTEGER,
    features JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Then seed the data
INSERT INTO subscription_plans (name, description, price, billing_period, max_branches, max_students, max_classes, features, status)
VALUES
    ('Starter', 'Perfect for small schools starting their digital journey', 29.99, 'monthly', 1, 100, 5, '{"analytics": false, "api_access": false, "priority_support": false}', 'active'),
    ('Professional', 'Designed for growing schools with multiple classes', 79.99, 'monthly', 3, 500, 20, '{"analytics": true, "api_access": false, "priority_support": true}', 'active'),
    ('Enterprise', 'Complete solution for large educational institutions', 199.99, 'monthly', 10, 5000, 100, '{"analytics": true, "api_access": true, "priority_support": true}', 'active');
```

---

## Related Endpoints

### Permission Middleware Changes

All protected endpoints now properly handle missing users:

**Before**:
- Status: 403 Forbidden
- Message: "user not found"
- Issue: Frontend couldn't distinguish between "invalid token" and "no permission"

**After**:
- Status: 401 Unauthorized
- Message: "user not found - please log in again"
- Behavior: Frontend automatically clears token and redirects to login

This improves the user experience when a user's account is deleted while they're still logged in.

---

## Testing Checklist

- [ ] Call `POST /api/dev/seed-subscription-plans` 
- [ ] Verify response shows `plans_created: 3`
- [ ] Call `GET /api/subscriptions/plans`
- [ ] Verify 3 plans are returned
- [ ] Check subscriptions page loads plans correctly
- [ ] Verify all plan details display properly
- [ ] Test with missing user token
- [ ] Verify auto-logout and redirect to login

