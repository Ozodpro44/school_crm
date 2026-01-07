# Password Reset API Endpoints

## Overview

Four new public endpoints for secure password reset with OTP verification.

---

## Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/forgot-password` | Request OTP for password reset |
| POST | `/api/auth/verify-otp` | Verify OTP and get reset token |
| POST | `/api/auth/resend-otp` | Resend OTP if expired |
| POST | `/api/auth/reset-password` | Reset password using reset token |

---

## 1. Forgot Password (Request OTP)

**Endpoint:** `POST /api/auth/forgot-password`

**Purpose:** Initiates password reset by sending OTP to user's email

**Authentication:** None (Public)

### Request

```json
{
  "email": "admin@example.com"
}
```

**Parameters:**
- `email` (string, required) - Valid email address of the user

**Validation:**
- Email format must be valid
- User must exist in database

### Response

**Status:** 200 OK

```json
{
  "message": "OTP sent to your email",
  "email": "admin@example.com"
}
```

### Error Responses

**Status:** 400 Bad Request

```json
{
  "error": "user not found"
}
```

**Status:** 400 Bad Request

```json
{
  "error": "failed to send OTP email"
}
```

### Example Usage

**cURL:**
```bash
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'
```

**JavaScript:**
```javascript
async function requestOTP(email) {
  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return response.json();
}
```

**TypeScript:**
```typescript
interface ForgotPasswordRequest {
  email: string;
}

interface ForgotPasswordResponse {
  message: string;
  email: string;
}

async function requestOTP(
  email: string
): Promise<ForgotPasswordResponse> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### Notes

- OTP is valid for 10 minutes
- OTP is 6 digits (0-999999)
- User receives HTML-formatted email
- System logs OTP generation attempt

---

## 2. Verify OTP

**Endpoint:** `POST /api/auth/verify-otp`

**Purpose:** Verifies OTP and returns reset token

**Authentication:** None (Public)

### Request

```json
{
  "email": "admin@example.com",
  "otp": "123456"
}
```

**Parameters:**
- `email` (string, required) - User's email address
- `otp` (string, required) - 6-digit OTP from email (must be exactly 6 characters)

**Validation:**
- Email format must be valid
- OTP must be exactly 6 characters
- OTP must exist in Redis (not expired)
- OTP must match stored value

### Response

**Status:** 200 OK

```json
{
  "message": "OTP verified successfully",
  "resetToken": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@example.com"
}
```

**Response Fields:**
- `message` (string) - Success message
- `resetToken` (string) - UUID token for password reset (valid 1 hour)
- `email` (string) - User's email

### Error Responses

**Status:** 400 Bad Request (OTP not found or expired)

```json
{
  "error": "OTP expired or invalid"
}
```

**Status:** 400 Bad Request (OTP doesn't match)

```json
{
  "error": "invalid OTP"
}
```

**Status:** 400 Bad Request (Invalid format)

```json
{
  "error": "Key: 'OTP' Error:Field validation for 'OTP' failed on the 'len' tag"
}
```

### Example Usage

**cURL:**
```bash
curl -X POST http://localhost:8080/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","otp":"123456"}'
```

**JavaScript:**
```javascript
async function verifyOTP(email, otp) {
  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  return response.json();
}
```

**TypeScript:**
```typescript
interface VerifyOTPRequest {
  email: string;
  otp: string;
}

interface VerifyOTPResponse {
  message: string;
  resetToken: string;
  email: string;
}

async function verifyOTP(
  email: string,
  otp: string
): Promise<VerifyOTPResponse> {
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### Notes

- OTP is deleted immediately after verification (one-time use)
- Reset token is valid for 1 hour
- Reset token is a UUID v4 (cryptographically secure)
- OTP must be used within 10 minutes

---

## 3. Resend OTP

**Endpoint:** `POST /api/auth/resend-otp`

**Purpose:** Resends OTP if user didn't receive it or it expired

**Authentication:** None (Public)

### Request

```json
{
  "email": "admin@example.com"
}
```

**Parameters:**
- `email` (string, required) - User's email address

**Validation:**
- Email format must be valid
- User must exist in database

### Response

**Status:** 200 OK

```json
{
  "message": "OTP resent to your email"
}
```

### Error Responses

**Status:** 400 Bad Request

```json
{
  "error": "user not found"
}
```

**Status:** 400 Bad Request

```json
{
  "error": "failed to send OTP email"
}
```

### Example Usage

**cURL:**
```bash
curl -X POST http://localhost:8080/api/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'
```

**JavaScript:**
```javascript
async function resendOTP(email) {
  const response = await fetch('/api/auth/resend-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return response.json();
}
```

### Notes

- Generates new OTP (previous OTP is overwritten)
- New OTP valid for 10 minutes
- Can be used multiple times if needed

---

## 4. Reset Password

**Endpoint:** `POST /api/auth/reset-password`

**Purpose:** Resets user password using reset token

**Authentication:** None (Public)

### Request

```json
{
  "email": "admin@example.com",
  "resetToken": "550e8400-e29b-41d4-a716-446655440000",
  "newPassword": "MyNewPassword123"
}
```

**Parameters:**
- `email` (string, required) - User's email address
- `resetToken` (string, required) - Token from verify-otp response
- `newPassword` (string, required) - New password (minimum 6 characters)

**Validation:**
- Email format must be valid
- Reset token must exist in Redis (not expired)
- Reset token must match stored value
- Password must be at least 6 characters

### Response

**Status:** 200 OK

```json
{
  "message": "Password reset successfully. Please login with your new password."
}
```

### Error Responses

**Status:** 400 Bad Request (Token expired)

```json
{
  "error": "reset token expired or invalid"
}
```

**Status:** 400 Bad Request (Token doesn't match)

```json
{
  "error": "invalid reset token"
}
```

**Status:** 400 Bad Request (Weak password)

```json
{
  "error": "Key: 'NewPassword' Error:Field validation for 'NewPassword' failed on the 'min' tag"
}
```

**Status:** 400 Bad Request (Password reset failed)

```json
{
  "error": "failed to reset password"
}
```

### Example Usage

**cURL:**
```bash
curl -X POST http://localhost:8080/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin@example.com",
    "resetToken":"550e8400-e29b-41d4-a716-446655440000",
    "newPassword":"MyNewPassword123"
  }'
```

**JavaScript:**
```javascript
async function resetPassword(email, resetToken, newPassword) {
  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      resetToken,
      newPassword
    })
  });
  return response.json();
}
```

**TypeScript:**
```typescript
interface ResetPasswordRequest {
  email: string;
  resetToken: string;
  newPassword: string;
}

interface ResetPasswordResponse {
  message: string;
}

async function resetPassword(
  email: string,
  resetToken: string,
  newPassword: string
): Promise<ResetPasswordResponse> {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      resetToken,
      newPassword
    })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### Notes

- Password is hashed with bcrypt (10 rounds)
- Reset token is deleted immediately after use (one-time use)
- User can login immediately with new password
- Old password is invalidated

---

## Complete Flow Example

### Step-by-Step Flow

```javascript
async function handlePasswordReset() {
  try {
    // Step 1: Request OTP
    const email = 'admin@example.com';
    const forgotRes = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    console.log('OTP sent');

    // Step 2: User checks email and gets OTP
    const otp = '123456'; // From email

    // Step 3: Verify OTP
    const verifyRes = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });
    const verifyData = await verifyRes.json();
    const resetToken = verifyData.resetToken;
    console.log('OTP verified');

    // Step 4: Reset password
    const newPassword = 'MyNewPassword123';
    const resetRes = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        resetToken,
        newPassword
      })
    });
    console.log('Password reset successfully');

    // Step 5: User can now login
    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: newPassword
      })
    });
    const loginData = await loginRes.json();
    console.log('Login successful, token:', loginData.token);

  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

## Error Status Codes

| Status Code | Meaning | When It Occurs |
|-------------|---------|----------------|
| 200 OK | Success | Request processed successfully |
| 400 Bad Request | Client error | Invalid input, missing fields, expired tokens |
| 500 Internal Server Error | Server error | Database error, Redis connection error |

---

## Time Limits

| Item | Duration | Notes |
|------|----------|-------|
| OTP Validity | 10 minutes | From request time |
| Reset Token | 1 hour | From OTP verification time |
| Password | No limit | Until user changes it |

---

## Security Considerations

1. **OTP is one-time use** - Automatically deleted after verification
2. **Reset token is one-time use** - Automatically deleted after password reset
3. **Passwords are hashed** - Using bcrypt with 10 rounds
4. **Email verification required** - User must access registered email
5. **No plaintext storage** - All sensitive data hashed or encrypted
6. **Rate limiting recommended** - To prevent abuse (implement in production)

---

## Integration with Existing Endpoints

These endpoints work independently but integrate with:

- **Login** (`POST /api/auth/login`) - User can login after password reset
- **Register** (`POST /api/auth/register`) - Creates new user account
- **Update User** (`PUT /api/users/{id}`) - Requires JWT authentication

---

## Response Headers

All endpoints return:

```
Content-Type: application/json
```

---

## Rate Limiting (Recommended)

Consider implementing in production:

- **Forgot Password**: 3 requests per hour per email
- **Resend OTP**: 5 requests per hour per email
- **Verify OTP**: 10 requests per hour per email
- **Reset Password**: 3 requests per hour per email

---

## Testing

### Postman Collection

See `POSTMAN_PASSWORD_RESET.md` for complete Postman collection

### cURL Scripts

```bash
#!/bin/bash

EMAIL="admin@example.com"
BASE_URL="http://localhost:8080"

# Request OTP
echo "Requesting OTP..."
curl -s -X POST "$BASE_URL/api/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}"

# Verify OTP (replace with actual OTP)
echo "Verifying OTP..."
OTP="123456"
VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"otp\":\"$OTP\"}")

RESET_TOKEN=$(echo $VERIFY_RESPONSE | grep -o '"resetToken":"[^"]*' | cut -d'"' -f4)
echo "Reset Token: $RESET_TOKEN"

# Reset Password
echo "Resetting password..."
curl -s -X POST "$BASE_URL/api/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"resetToken\":\"$RESET_TOKEN\",\"newPassword\":\"NewPassword123\"}"
```

---

## Additional Resources

- Full Documentation: `REDIS_OTP_PASSWORD_RESET.md`
- Quick Start: `QUICK_START_REDIS_OTP.md`
- Implementation Guide: `POSTMAN_PASSWORD_RESET.md`
