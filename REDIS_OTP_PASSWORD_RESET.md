# Redis OTP and Password Reset Implementation

## Overview
This document outlines the implementation of Redis-based OTP storage and admin password reset functionality for the School CRM system.

## Features

### 1. OTP (One-Time Password) Generation and Storage
- 6-digit random OTP generation
- Storage in Redis with 10-minute expiration
- Email delivery via SMTP

### 2. Password Reset Flow
- Admin can request password reset
- OTP sent to registered email
- OTP verification returns reset token
- Password update using reset token
- Reset token expires after 1 hour

### 3. Email Notifications
- HTML formatted emails
- OTP notification emails
- Password reset confirmation emails

## Installation

### 1. Update Dependencies

Run:
```bash
go mod tidy
```

This will add:
- `github.com/redis/go-redis/v9` - Redis client

### 2. Set Up Redis

#### Using Docker:
```bash
docker run -d -p 6379:6379 redis:latest
```

#### Or install Redis locally:
```bash
# Ubuntu/Debian
sudo apt-get install redis-server
redis-server

# macOS
brew install redis
redis-server
```

### 3. Environment Variables

Add to `.env` file:

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# SMTP Configuration for Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@schoolcrm.com
```

#### Gmail Setup:
1. Enable 2FA on your Gmail account
2. Create an App Password (16-character password)
3. Use this password in SMTP_PASS

#### Other SMTP Providers:
- **SendGrid**: Use `apikey` as username and API key as password
- **Mailgun**: SMTP host: `smtp.mailgun.org`, port: `587`
- **AWS SES**: Use Access Key ID and Secret Access Key

## API Endpoints

### 1. Forgot Password (Request OTP)
**POST** `/api/auth/forgot-password`

Request:
```json
{
  "email": "admin@example.com"
}
```

Response (200 OK):
```json
{
  "message": "OTP sent to your email",
  "email": "admin@example.com"
}
```

### 2. Verify OTP
**POST** `/api/auth/verify-otp`

Request:
```json
{
  "email": "admin@example.com",
  "otp": "123456"
}
```

Response (200 OK):
```json
{
  "message": "OTP verified successfully",
  "resetToken": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@example.com"
}
```

### 3. Resend OTP
**POST** `/api/auth/resend-otp`

Request:
```json
{
  "email": "admin@example.com"
}
```

Response (200 OK):
```json
{
  "message": "OTP resent to your email"
}
```

### 4. Reset Password
**POST** `/api/auth/reset-password`

Request:
```json
{
  "email": "admin@example.com",
  "resetToken": "550e8400-e29b-41d4-a716-446655440000",
  "newPassword": "newPassword123"
}
```

Response (200 OK):
```json
{
  "message": "Password reset successfully. Please login with your new password."
}
```

## Client-Side Implementation Example (TypeScript)

```typescript
// Step 1: Request OTP
async function forgotPassword(email: string) {
  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return response.json();
}

// Step 2: Verify OTP
async function verifyOTP(email: string, otp: string) {
  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  return response.json();
}

// Step 3: Reset Password
async function resetPassword(
  email: string,
  resetToken: string,
  newPassword: string
) {
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

// Usage Flow
async function handlePasswordReset() {
  // Step 1: User enters email
  const email = 'admin@example.com';
  await forgotPassword(email);
  
  // Step 2: User enters OTP from email
  const otp = '123456';
  const { resetToken } = await verifyOTP(email, otp);
  
  // Step 3: User enters new password
  const newPassword = 'newPassword123';
  await resetPassword(email, resetToken, newPassword);
}
```

## File Structure

```
internal/
├── utils/
│   ├── redis.go          # Redis client and OTP operations
│   └── email.go          # Email sender implementation
├── service/
│   └── user_service.go   # Password reset methods
├── handlers/
│   └── auth.go           # API endpoint handlers
└── config/
    └── config.go         # Configuration struct
```

## Implementation Details

### Redis Key Structure
- **OTP Storage**: `otp:{email}` (10-minute TTL)
- **Reset Token**: `reset:{email}` (1-hour TTL)

### Password Hashing
- Uses bcrypt with default cost (10 rounds)
- Passwords are hashed before storage
- Previous password is hashed for comparison

### Error Handling
All errors return appropriate HTTP status codes:
- `400 Bad Request` - Invalid input or expired credentials
- `401 Unauthorized` - Invalid OTP or token
- `500 Internal Server Error` - Server issues

## Security Features

1. **OTP Expiration**: 10 minutes (prevents brute force)
2. **Reset Token Expiration**: 1 hour (allows time for reset)
3. **One-time Use**: OTP deleted after verification
4. **Email Verification**: Confirms user identity
5. **Password Hashing**: Bcrypt with salt
6. **SMTP Authentication**: Secure email delivery

## Testing

### Manual Testing with cURL

```bash
# 1. Request OTP
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'

# 2. Verify OTP (check email for OTP)
curl -X POST http://localhost:8080/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","otp":"123456"}'

# 3. Reset Password
curl -X POST http://localhost:8080/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin@example.com",
    "resetToken":"550e8400-e29b-41d4-a716-446655440000",
    "newPassword":"newPassword123"
  }'
```

## Troubleshooting

### Redis Connection Issues
- Ensure Redis is running: `redis-cli ping`
- Check REDIS_URL format: `redis://host:port/db`
- Verify firewall allows port 6379

### Email Not Sending
- Check SMTP credentials in .env
- Verify SMTP_HOST and SMTP_PORT
- For Gmail, ensure 2FA is enabled and App Password is used
- Check email logs for detailed errors

### OTP Expired
- OTP expires after 10 minutes
- Use resend-otp endpoint for new OTP
- Check Redis for remaining TTL: `redis-cli ttl otp:email@example.com`

## Logs

The implementation includes comprehensive logging:
- `[UserService.ForgotPasswordRequest]` - Password reset requests
- `[UserService.VerifyOTPRequest]` - OTP verifications
- `[UserService.ResetPasswordWithToken]` - Password resets
- `[EmailSender]` - Email sending operations
- `[ForgotPassword]`, `[VerifyOTP]`, `[ResetPassword]` - API logs

## Future Enhancements

1. Rate limiting on OTP requests
2. Email verification for account creation
3. SMS-based OTP as alternative
4. Password reset confirmation email
5. Account recovery questions
6. Two-factor authentication (2FA)

## Dependencies

- `github.com/redis/go-redis/v9` - Redis client library
- `golang.org/x/crypto` - Password hashing (bcrypt)
- `github.com/google/uuid` - Reset token generation

## Conclusion

This implementation provides a secure, scalable password reset mechanism using industry-standard practices. The OTP approach ensures email verification while the token-based reset prevents unauthorized access.
