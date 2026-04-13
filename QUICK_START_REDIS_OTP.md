# Quick Start: Redis OTP & Password Reset

## 1-Minute Setup

### Environment Variables
Add to `.env`:
```env
REDIS_URL=redis://localhost:6379/0
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@schoolcrm.com
```

### Start Redis
```bash
docker run -d -p 6379:6379 redis:latest
```

### Run Backend
```bash
cd backend_school_crm
go mod tidy
go run cmd/main.go
```

## API Flow

### 1. User Forgot Password
```
POST /api/auth/forgot-password
{
  "email": "admin@example.com"
}
```
→ OTP sent to email ✓

### 2. User Enters OTP
```
POST /api/auth/verify-otp
{
  "email": "admin@example.com",
  "otp": "123456"
}
```
→ Returns `resetToken` ✓

### 3. User Sets New Password
```
POST /api/auth/reset-password
{
  "email": "admin@example.com",
  "resetToken": "returned-token",
  "newPassword": "newpass123"
}
```
→ Password reset complete ✓

## File Changes

### Created Files
- `internal/utils/redis.go` - Redis operations
- `internal/utils/email.go` - Email sending
- `REDIS_OTP_PASSWORD_RESET.md` - Full documentation

### Modified Files
- `go.mod` - Added redis dependency
- `internal/config/config.go` - Added Redis/SMTP config
- `internal/service/user_service.go` - Added password reset methods
- `internal/handlers/auth.go` - Added API handlers
- `cmd/main.go` - Initialize Redis and email
- `.env.example` - Added environment variables

## Key Features

✓ 6-digit OTP generation
✓ Redis storage (10-min expiration)
✓ Email delivery via SMTP
✓ Password reset token (1-hour expiration)
✓ Bcrypt password hashing
✓ Comprehensive logging
✓ Error handling

## Testing

```bash
# Request OTP
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'

# Verify OTP (replace with actual OTP from email)
curl -X POST http://localhost:8080/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","otp":"123456"}'

# Reset Password
curl -X POST http://localhost:8080/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","resetToken":"token-from-verify","newPassword":"newpass123"}'
```

## Gmail Setup (2 minutes)

1. Go to myaccount.google.com → Security
2. Enable 2-Step Verification
3. Create App Password (select "Mail" and "Windows Computer")
4. Use the 16-char password in `SMTP_PASS`

## Resend OTP Endpoint

If user didn't receive OTP:
```
POST /api/auth/resend-otp
{
  "email": "admin@example.com"
}
```

## Next Steps

- [ ] Set up Redis container
- [ ] Configure SMTP credentials
- [ ] Update .env file
- [ ] Run `go mod tidy`
- [ ] Test endpoints with Postman/curl
- [ ] Create frontend forms for password reset
- [ ] Add rate limiting (optional)
- [ ] Set up logging/monitoring

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Redis connection failed | Ensure `docker run -d -p 6379:6379 redis:latest` is running |
| Email not sending | Check SMTP credentials and enable "Less secure apps" if using Gmail |
| OTP expired | Use resend-otp endpoint within 10 minutes |
| Build errors | Run `go mod tidy` and `go mod download` |

## Logs to Monitor

```
[UserService.ForgotPasswordRequest] OTP sent successfully to user@example.com
[UserService.VerifyOTPRequest] OTP verified successfully for user@example.com
[UserService.ResetPasswordWithToken] Password reset successfully for user@example.com
[EmailSender] Email sent successfully to user@example.com
```

## Security Notes

- OTP valid for 10 minutes
- Reset token valid for 1 hour
- One-time use OTP (deleted after verification)
- Passwords hashed with bcrypt (10 rounds)
- Email required for identity verification
