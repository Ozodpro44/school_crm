# Postman API Token Guide

## How to Get a Token

### 1. Login to Get Token

**Request:**
```
POST http://localhost:8080/api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (Example):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@example.com",
    "fullName": "Admin User",
    "role": "admin",
    "branchId": "550e8400-e29b-41d4-a716-446655440001"
  }
}
```

Copy the `token` value.

---

## How to Use Token in Postman

### Method 1: Add Authorization Header Manually

**1. Create a new request**

**2. Go to the "Headers" tab**

**3. Add this header:**

| Key | Value |
|-----|-------|
| Authorization | Bearer YOUR_TOKEN_HERE |

**Example:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**4. Make your request:**
```
GET http://localhost:8080/api/payments?branchId=550e8400-e29b-41d4-a716-446655440001
```

---

### Method 2: Use Postman Authorization Tab (Recommended)

**1. Click the "Authorization" tab (not Headers)**

**2. Select "Bearer Token" from the Type dropdown**

**3. Paste your token in the "Token" field:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

Postman will automatically add the "Authorization: Bearer" header for you.

---

## How to Use Environment Variables (Best Practice)

Instead of hardcoding tokens, use Postman variables:

### 1. Create an Environment
- Click "Environments" in the left sidebar
- Click "Create New"
- Name it "School CRM"

### 2. Add Variables
Add these variables:

| Variable | Initial Value | Current Value |
|----------|---------------|---------------|
| `base_url` | `http://localhost:8080/api` | `http://localhost:8080/api` |
| `token` | `your_token_here` | (leave empty for now) |
| `branch_id` | `your_branch_id` | (leave empty for now) |

### 3. Set Up Login Request
```
POST {{base_url}}/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123"
}
```

**After response:**
- Click the "Tests" tab
- Add this script to auto-save the token:

```javascript
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    pm.environment.set("token", jsonData.token);
    pm.environment.set("branch_id", jsonData.user.branchId);
}
```

### 4. Use Variables in Requests

**Authorization Tab:**
- Type: Bearer Token
- Token: `{{token}}`

**Query Parameters:**
- branchId: `{{branch_id}}`

**Full URL Example:**
```
GET {{base_url}}/payments?branchId={{branch_id}}
```

---

## Example API Calls

### 1. Get Payments
```
GET http://localhost:8080/api/payments?branchId=550e8400-e29b-41d4-a716-446655440001

Headers:
Authorization: Bearer YOUR_TOKEN_HERE
```

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "studentId": "550e8400-e29b-41d4-a716-446655440002",
    "amount": 100.00,
    "month": "12",
    "year": 2025,
    "paymentMethod": "cash",
    "status": "paid",
    "invoiceNumber": "INV-001",
    "paidDate": "2025-12-10T10:30:00Z",
    "branchId": "550e8400-e29b-41d4-a716-446655440001",
    "createdBy": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2025-12-10T10:00:00Z"
  }
]
```

### 2. Get User Details (to see creator name)
```
GET http://localhost:8080/api/users/550e8400-e29b-41d4-a716-446655440000

Headers:
Authorization: Bearer YOUR_TOKEN_HERE
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@example.com",
  "fullName": "Admin User",
  "role": "admin",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-12-14T10:00:00Z"
}
```

### 3. Create Payment
```
POST http://localhost:8080/api/payments

Headers:
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "studentId": "550e8400-e29b-41d4-a716-446655440002",
  "amount": 150.50,
  "month": "12",
  "year": 2025,
  "paymentMethod": "card",
  "status": "paid",
  "invoiceNumber": "INV-NEW-001",
  "branchId": "550e8400-e29b-41d4-a716-446655440001",
  "paidDate": "2025-12-14T10:00:00Z"
}
```

---

## Token Format Explained

Your API uses **JWT (JSON Web Token)** with Bearer scheme:

```
Authorization: Bearer <JWT_TOKEN>
```

Structure:
- **Scheme:** `Bearer`
- **Space:** Single space between Bearer and token
- **Token:** The JWT token string

---

## Optional Headers

You can also add the branch ID header:

```
Authorization: Bearer YOUR_TOKEN_HERE
X-Branch-ID: 550e8400-e29b-41d4-a716-446655440001
```

---

## Troubleshooting

### "unauthorized" error
- Check token is valid (not expired)
- Verify token format: `Bearer <token>`
- Make sure space exists between `Bearer` and token

### "invalid authorization header format" error
- Missing space between `Bearer` and token
- Wrong header name (should be `Authorization`, not `Auth` or `Token`)

### Token expired
- Get a new token by logging in again
- Update the environment variable or header

---

## Quick Reference - Steps to Get Started

1. **Login and get token:**
   ```
   POST http://localhost:8080/api/login
   Body: { "email": "...", "password": "..." }
   ```

2. **Copy token from response**

3. **In your next request:**
   - Authorization tab → Bearer Token
   - Paste token
   - Make request

4. **See payments with creator names:**
   ```
   GET http://localhost:8080/api/payments?branchId=YOUR_BRANCH_ID
   ```
