# Postman Collection: Password Reset API

## Import Instructions

Copy the JSON below and import into Postman:
1. Click "Import" in Postman
2. Select "Paste Raw Text"
3. Paste the collection JSON
4. Click Import

## Postman Collection JSON

```json
{
  "info": {
    "name": "School CRM - Password Reset",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Forgot Password (Request OTP)",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"admin@example.com\"\n}"
        },
        "url": {
          "raw": "http://localhost:8080/api/auth/forgot-password",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8080",
          "path": ["api", "auth", "forgot-password"]
        }
      },
      "response": []
    },
    {
      "name": "2. Verify OTP",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"admin@example.com\",\n  \"otp\": \"123456\"\n}"
        },
        "url": {
          "raw": "http://localhost:8080/api/auth/verify-otp",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8080",
          "path": ["api", "auth", "verify-otp"]
        }
      },
      "response": []
    },
    {
      "name": "3. Resend OTP",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"admin@example.com\"\n}"
        },
        "url": {
          "raw": "http://localhost:8080/api/auth/resend-otp",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8080",
          "path": ["api", "auth", "resend-otp"]
        }
      },
      "response": []
    },
    {
      "name": "4. Reset Password",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"admin@example.com\",\n  \"resetToken\": \"550e8400-e29b-41d4-a716-446655440000\",\n  \"newPassword\": \"newPassword123\"\n}"
        },
        "url": {
          "raw": "http://localhost:8080/api/auth/reset-password",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8080",
          "path": ["api", "auth", "reset-password"]
        }
      },
      "response": []
    }
  ]
}
```

## Manual Testing Steps

### Step 1: Request OTP
**POST** `http://localhost:8080/api/auth/forgot-password`

Headers:
```
Content-Type: application/json
```

Body:
```json
{
  "email": "admin@example.com"
}
```

Expected Response (200):
```json
{
  "message": "OTP sent to your email",
  "email": "admin@example.com"
}
```

**Action**: Check your email inbox for the OTP code

---

### Step 2: Verify OTP
**POST** `http://localhost:8080/api/auth/verify-otp`

Headers:
```
Content-Type: application/json
```

Body:
```json
{
  "email": "admin@example.com",
  "otp": "YOUR_OTP_FROM_EMAIL"
}
```

Expected Response (200):
```json
{
  "message": "OTP verified successfully",
  "resetToken": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@example.com"
}
```

**Save the resetToken** - You'll need it for the next step

---

### Step 3: Reset Password
**POST** `http://localhost:8080/api/auth/reset-password`

Headers:
```
Content-Type: application/json
```

Body:
```json
{
  "email": "admin@example.com",
  "resetToken": "RESET_TOKEN_FROM_STEP_2",
  "newPassword": "YourNewPassword123"
}
```

Expected Response (200):
```json
{
  "message": "Password reset successfully. Please login with your new password."
}
```

**Action**: You can now login with your new password

---

### Step 4 (Optional): Resend OTP
If you didn't receive the OTP or it expired

**POST** `http://localhost:8080/api/auth/resend-otp`

Headers:
```
Content-Type: application/json
```

Body:
```json
{
  "email": "admin@example.com"
}
```

Expected Response (200):
```json
{
  "message": "OTP resent to your email"
}
```

---

## Error Responses

### Invalid Email
```json
{
  "error": "user not found"
}
```

### Invalid OTP
```json
{
  "error": "invalid OTP"
}
```

### Expired OTP
```json
{
  "error": "OTP expired or invalid"
}
```

### Invalid/Expired Reset Token
```json
{
  "error": "reset token expired or invalid"
}
```

### Weak Password
```json
{
  "error": "password is required and must be at least 6 characters"
}
```

### Missing Required Fields
```json
{
  "error": "Key: 'Email' Error:Field validation for 'Email' failed on the 'email' tag"
}
```

---

## Testing Scenarios

### Scenario 1: Happy Path
1. ✓ Request OTP → Receive email
2. ✓ Enter OTP from email → Get reset token
3. ✓ Use reset token to change password
4. ✓ Login with new password

### Scenario 2: Resend OTP
1. ✓ Request OTP
2. ✓ Wait for 11 minutes (OTP expires)
3. ✓ Use resend-otp endpoint
4. ✓ Verify new OTP from email

### Scenario 3: Wrong OTP
1. ✓ Request OTP
2. ✗ Enter wrong OTP code
3. ✓ Get error response
4. ✓ Resend OTP and retry

### Scenario 4: Invalid Email
1. ✗ Enter non-existent email
2. ✓ Get "user not found" error
3. ✓ Use correct email and retry

---

## cURL Commands

### Request OTP
```bash
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'
```

### Verify OTP
```bash
curl -X POST http://localhost:8080/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","otp":"123456"}'
```

### Resend OTP
```bash
curl -X POST http://localhost:8080/api/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'
```

### Reset Password
```bash
curl -X POST http://localhost:8080/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","resetToken":"token-here","newPassword":"newpass123"}'
```

---

## JavaScript/TypeScript Example

```typescript
// Type definitions
interface ForgotPasswordResponse {
  message: string;
  email: string;
}

interface VerifyOTPResponse {
  message: string;
  resetToken: string;
  email: string;
}

interface ResetPasswordResponse {
  message: string;
}

// API Functions
async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const res = await fetch('http://localhost:8080/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function verifyOTP(email: string, otp: string): Promise<VerifyOTPResponse> {
  const res = await fetch('http://localhost:8080/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function resetPassword(
  email: string,
  resetToken: string,
  newPassword: string
): Promise<ResetPasswordResponse> {
  const res = await fetch('http://localhost:8080/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, resetToken, newPassword })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function resendOTP(email: string): Promise<{ message: string }> {
  const res = await fetch('http://localhost:8080/api/auth/resend-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Usage example
async function handlePasswordReset() {
  try {
    // Step 1: User enters email
    const email = prompt('Enter your email:');
    if (!email) return;

    console.log('Sending OTP...');
    const forgotRes = await forgotPassword(email);
    console.log(forgotRes.message);

    // Step 2: User enters OTP from email
    const otp = prompt('Enter OTP from your email:');
    if (!otp) return;

    console.log('Verifying OTP...');
    const verifyRes = await verifyOTP(email, otp);
    console.log(verifyRes.message);
    const resetToken = verifyRes.resetToken;

    // Step 3: User enters new password
    const newPassword = prompt('Enter new password:');
    if (!newPassword || newPassword.length < 6) {
      console.error('Password must be at least 6 characters');
      return;
    }

    console.log('Resetting password...');
    const resetRes = await resetPassword(email, resetToken, newPassword);
    console.log(resetRes.message);
    
    alert('Password reset successfully! Please login with your new password.');
  } catch (error) {
    console.error('Error:', error);
    alert('An error occurred: ' + error.message);
  }
}
```

---

## Notes

- **OTP Validity**: 10 minutes from request time
- **Reset Token Validity**: 1 hour from OTP verification
- **OTP Format**: 6 digits (e.g., "123456")
- **Password Requirements**: Minimum 6 characters
- **Email Required**: Real email needed to receive OTP
- **One-time Use**: OTP is deleted after verification

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "Redis service not configured" | Ensure Redis is running and REDIS_URL is set |
| "failed to send OTP email" | Check SMTP credentials and provider settings |
| "OTP expired or invalid" | Resend OTP and retry within 10 minutes |
| "reset token expired or invalid" | Restart process from Step 1 |
| Cannot connect to localhost:8080 | Ensure backend server is running |
