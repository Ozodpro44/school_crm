-- Accounts created by an admin (managers, teachers, accountants, ...) were
-- inserted without email_verified, which defaults to false (000029), so
-- auth_service refused to let them sign in ("please verify your email").
-- Only self-registered owners (role 'admin') go through the signup OTP; every
-- other role is created by an admin who vouches for the address.
UPDATE users
SET email_verified = true,
    email_verified_at = COALESCE(email_verified_at, created_at)
WHERE email_verified = false
  AND role <> 'admin'
  AND deleted_at IS NULL;
