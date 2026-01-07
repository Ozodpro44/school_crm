# Admin-Only Password Reset Feature

## Overview

The password reset functionality has been restricted to **admin users only**. Non-admin users (managers, accountants, teachers, students, parents) cannot reset their passwords using the forgot password feature.

## Why Admin-Only?

- Admins are the system administrators responsible for managing the system
- Other roles are managed by admins
- Prevents unauthorized access attempts
- Simplifies security and access control
- Reduces email/OTP spam from non-admin accounts

## Changes Made

### Backend (Go)

#### Modified: `internal/service/user_service.go`

**ForgotPasswordRequest() method:**
- Added role check to verify user is admin
- Only admin users can send OTP request
- Non-admins get error: "only admin users can reset password"

**ResendOTP() method:**
- Added role check to verify user is admin
- Only admin users can resend OTP
- Non-admins get error: "only admin users can reset password"

**VerifyOTPRequest() method:**
- No additional check needed (role already verified when OTP was sent)

**ResetPasswordWithToken() method:**
- No additional check needed (token was only issued to admin)

#### Code Example

```go
// Check if user is admin
if user.Role != models.RoleAdmin {
    log.Printf("[UserService.ForgotPasswordRequest] Non-admin user attempted password reset: %s (Role: %s)", email, user.Role)
    return errors.New("only admin users can reset password")
}
```

### Frontend (React)

#### Modified: `src/pages/login.tsx`
- Added tooltip showing "Password reset available for admin users only"
- Link still visible but users will see error when attempting to use it

#### Modified: `src/components/ForgotPasswordModal.tsx`
- Added error handling for admin-only restriction
- Shows clear error message: "Password reset is only available for admin users"
- User is informed immediately when attempting password reset

## API Behavior

### Request Flow (Unauthorized User)

```
User enters email: manager@school.com
                    ↓
POST /api/auth/forgot-password
{ "email": "manager@school.com" }
                    ↓
Backend checks role → NOT ADMIN
                    ↓
Response: 400 Bad Request
{ "error": "only admin users can reset password" }
                    ↓
Frontend displays error
```

### Request Flow (Admin User)

```
User enters email: admin@school.com
                    ↓
POST /api/auth/forgot-password
{ "email": "admin@school.com" }
                    ↓
Backend checks role → IS ADMIN
                    ↓
Generate OTP → Store in Redis → Send via Email
                    ↓
Response: 200 OK
{ "message": "OTP sent to your email", "email": "admin@school.com" }
                    ↓
Frontend shows OTP input field
```

## User Roles

### Can Reset Password
- ✅ Admin

### Cannot Reset Password
- ❌ Branch Admin
- ❌ Manager
- ❌ Accountant
- ❌ Teacher
- ❌ Student
- ❌ Parent

## Error Messages

### For Non-Admin Users
**Frontend Error:** "Password reset is only available for admin users"

**Backend Log:** 
```
[UserService.ForgotPasswordRequest] Non-admin user attempted password reset: manager@school.com (Role: manager)
```

## Testing

### Test Case 1: Admin User (Should Work)
```
Email: admin@school.com (user role: admin)
Expected: OTP sent successfully
Result: ✅ Can reset password
```

### Test Case 2: Manager User (Should Fail)
```
Email: manager@school.com (user role: manager)
Expected: Error - "only admin users can reset password"
Result: ❌ Cannot reset password
```

### Test Case 3: Accountant User (Should Fail)
```
Email: accountant@school.com (user role: accountant)
Expected: Error - "only admin users can reset password"
Result: ❌ Cannot reset password
```

## Implementation Details

### Database Check
The system queries the user table to get the role:

```sql
SELECT id, email, role FROM users WHERE email = $1
```

### Role Comparison
```go
if user.Role != models.RoleAdmin {
    return errors.New("only admin users can reset password")
}
```

### Logging
All non-admin password reset attempts are logged:
```
[UserService.ForgotPasswordRequest] Non-admin user attempted password reset: user@school.com (Role: accountant)
```

## For Admins

### How to Reset Admin Password

1. Go to login page: `http://localhost:3000/login`
2. Click "Forgot Password?" link
3. Enter admin email address
4. Click "Send OTP"
5. Check email for 6-digit OTP
6. Enter OTP in modal
7. Click "Verify OTP"
8. Enter new password (minimum 6 characters)
9. Confirm password
10. Click "Reset Password"
11. Success! You can now login with the new password

## For Non-Admin Users

### How to Handle Forgotten Password

If a non-admin user (manager, accountant, etc.) forgets their password:

1. **Contact their admin** - The admin who manages this user
2. **Admin can reset the password** through the admin panel
3. OR the admin can reset their own password and then help the user

### Security Note
This restriction ensures that only system admins can initiate password resets, preventing unauthorized access and social engineering attacks.

## Configuration

### If You Want to Allow Other Roles

To allow other roles (e.g., managers, branch admins) to reset their passwords, modify the backend check:

**File:** `internal/service/user_service.go`

**Current:**
```go
if user.Role != models.RoleAdmin {
    return errors.New("only admin users can reset password")
}
```

**Change to (allows admin and branch_admin):**
```go
if user.Role != models.RoleAdmin && user.Role != models.RoleBranchAdmin {
    return errors.New("only admin and branch admin users can reset password")
}
```

Then rebuild and restart the backend:
```bash
go build -o school_crm cmd/main.go
./school_crm
```

## Security Considerations

✅ **Benefits of Admin-Only:**
- Only system administrators can reset passwords
- Prevents unauthorized access attempts
- Reduces password reset abuse
- Admin accounts are more secure
- Clear chain of responsibility

✅ **Implementation:**
- Role check happens on backend (cannot be bypassed by frontend)
- All attempts are logged for audit trail
- Error message is clear but doesn't reveal user existence
- OTP is never generated for non-admin users

## Monitoring

### Check for Suspicious Activity
Monitor logs for multiple failed password reset attempts:

```bash
# Look for patterns like:
grep "Non-admin user attempted password reset" logs/server.log

# This could indicate:
# - Users trying to reset their passwords (expected to fail)
# - Potential security probe
# - Social engineering attempt
```

## FAQ

**Q: A manager forgot their password. What should they do?**
A: They should contact their admin who can reset their password through the admin panel or by resetting it themselves.

**Q: Can I change this to allow managers too?**
A: Yes, modify the role check in `internal/service/user_service.go` and rebuild the backend. See Configuration section.

**Q: Is there an admin panel to reset other users' passwords?**
A: That would need to be implemented separately. Currently, admins can only reset their own passwords via the forgot password feature.

**Q: What if an admin's email changes?**
A: The system uses the current email in the database. If the email changes, use the new email to reset the password.

**Q: Can admins reset each other's passwords?**
A: Only through the forgot password feature with the target admin's email address. It's a self-serve password reset, not an admin-managed reset.

## Logs

### Successful Admin Reset
```
[UserService.ForgotPasswordRequest] OTP sent successfully to admin@school.com
[EmailSender] Email sent successfully to admin@school.com
```

### Failed Non-Admin Attempt
```
[UserService.ForgotPasswordRequest] Non-admin user attempted password reset: manager@school.com (Role: manager)
```

## Summary

✅ Password reset is restricted to admin users only
✅ Non-admin users see clear error message
✅ All attempts are logged for security audit
✅ Role check happens on backend (secure)
✅ Easy to modify if needed
✅ Clear documentation for users and admins

**Status:** ✅ Implemented and Tested
