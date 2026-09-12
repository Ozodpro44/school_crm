package service

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/school-crm/auth-service/internal/db"
	"github.com/school-crm/auth-service/internal/platformsettings"
	"github.com/school-crm/auth-service/internal/utils"
	"golang.org/x/crypto/bcrypt"
)

var ErrNotFound = errors.New("user not found")

// ── Models ─────────────────────────────────────────────────────────────────────

type User struct {
	ID               string    `json:"id"`
	Email            string    `json:"email"`
	FullName         string    `json:"fullName"`
	Role             string    `json:"role"`
	BranchID         string    `json:"branchId,omitempty"`
	OrganizationName string    `json:"organizationName,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
}

// ── Requests ──────────────────────────────────────────────────────────────────

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RegisterRequest struct {
	Email      string `json:"email"      binding:"required,email"`
	Password   string `json:"password"   binding:"required,min=6"`
	FullName   string `json:"fullName"   binding:"required"`
	Role       string `json:"role"       binding:"required"`
	SchoolName string `json:"schoolName"`
}

// ── Service ───────────────────────────────────────────────────────────────────

type AuthService struct {
	db          *db.DB
	redis       *redis.Client
	settings    *platformsettings.Store
	emailSender *utils.EmailSender
}

func New(database *db.DB, redisClient *redis.Client, settings *platformsettings.Store, emailSender *utils.EmailSender) *AuthService {
	return &AuthService{db: database, redis: redisClient, settings: settings, emailSender: emailSender}
}

// loginLockoutWindow bounds how long a failed-attempt count survives — long
// enough to actually deter brute-forcing, short enough that a locked-out
// legitimate user isn't stuck for hours.
const loginLockoutWindow = 15 * time.Minute

// ErrAccountLocked is returned when the platform-wide "Max Failed Login
// Attempts" threshold (internal/platformsettings) has been exceeded.
var ErrAccountLocked = errors.New("too many failed login attempts — try again later")

func loginAttemptsKey(email string) string { return "auth:login-attempts:" + email }

// maxLoginAttempts reads the current platform-wide threshold; <= 0 means the
// lockout is effectively disabled (defensive — the UI shouldn't produce 0).
func (s *AuthService) maxLoginAttempts() int {
	if s.settings == nil {
		return int(platformsettings.Defaults.MaxLoginAttempts)
	}
	return int(s.settings.Get().MaxLoginAttempts)
}

// JWTExpiryHours reads the platform-wide token lifetime; <= 0 falls back to
// the default (24h) rather than minting a token that's already expired.
func (s *AuthService) JWTExpiryHours() int {
	hours := int(platformsettings.Defaults.JWTExpiryHours)
	if s.settings != nil {
		if h := int(s.settings.Get().JWTExpiryHours); h > 0 {
			hours = h
		}
	}
	return hours
}

// Login verifies credentials and returns the user. Enforces the
// platform-wide failed-login lockout (internal/platformsettings) — checked
// before the bcrypt compare so a locked-out account fails fast, and
// incremented on any failure (including "no such user") so lockout
// behavior itself doesn't leak which emails are registered.
func (s *AuthService) Login(ctx context.Context, email, password string) (*User, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	maxAttempts := s.maxLoginAttempts()
	attemptsKey := loginAttemptsKey(email)
	if maxAttempts > 0 {
		attempts, _ := s.redis.Get(ctx, attemptsKey).Int()
		if attempts >= maxAttempts {
			return nil, ErrAccountLocked
		}
	}

	recordFailure := func() {
		if maxAttempts <= 0 {
			return
		}
		pipe := s.redis.Pipeline()
		pipe.Incr(ctx, attemptsKey)
		pipe.Expire(ctx, attemptsKey, loginLockoutWindow)
		_, _ = pipe.Exec(ctx)
	}

	var user User
	var passwordHash string
	var branchID, orgName sql.NullString
	var emailVerified bool
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT id, email, password_hash, role, full_name, branch_id, organization_name, email_verified, created_at FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &passwordHash, &user.Role, &user.FullName, &branchID, &orgName, &emailVerified, &user.CreatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		recordFailure()
		return nil, errors.New("invalid credentials")
	}
	if err != nil {
		return nil, err
	}
	if branchID.Valid {
		user.BranchID = branchID.String
	}
	if orgName.Valid {
		user.OrganizationName = orgName.String
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		recordFailure()
		return nil, errors.New("invalid credentials")
	}

	// Only reveal "unverified" to someone who already proved they know the
	// password — checking this before the password comparison would let
	// anyone probe whether a given email is a registered-but-unverified
	// account without knowing its password. An unverified account has no
	// subscription/permissions yet (Register only creates the row and emails
	// the OTP), so logging in normally would otherwise hand back a token for
	// an account that can't actually do anything, with no indication why.
	if !emailVerified {
		return nil, errors.New("please verify your email before signing in — check your inbox for the confirmation code")
	}

	if maxAttempts > 0 {
		_ = s.redis.Del(ctx, attemptsKey).Err()
	}

	// Stamp last_login_at (best-effort)
	_, _ = s.db.Conn().ExecContext(ctx,
		`UPDATE users SET last_login_at = NOW() WHERE id = $1`, user.ID)

	return &user, nil
}

// ── Login MFA (email OTP) ────────────────────────────────────────────────────
//
// Gated by the platform-wide "Require MFA" setting. Separate Redis
// namespace from the password-reset OTP (otpKey) since the two flows are
// independent and shouldn't share a TTL/attempt budget.

func loginOTPKey(email string) string { return "auth:login-otp:" + email }

// MFARequired reports whether a successful password check must be followed
// by an OTP step before a token is issued.
func (s *AuthService) MFARequired() bool {
	if s.settings == nil {
		return platformsettings.Defaults.RequireMFA
	}
	return s.settings.Get().RequireMFA
}

// EmailConfigured reports whether SendLoginOTPEmail can actually deliver —
// used to fail closed with a clear error rather than silently skipping MFA
// when an operator enables it without configuring Resend.
func (s *AuthService) EmailConfigured() bool {
	return s.emailSender != nil
}

// CreateLoginOTP generates and stores a 10-minute login OTP, returning it so
// the caller can email it.
func (s *AuthService) CreateLoginOTP(ctx context.Context, email string) (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("generate login otp: %w", err)
	}
	otp := fmt.Sprintf("%06d", n.Int64())
	if err := s.redis.Set(ctx, loginOTPKey(email), otp, 10*time.Minute).Err(); err != nil {
		return "", fmt.Errorf("store login otp: %w", err)
	}
	return otp, nil
}

// SendLoginOTPEmail emails a previously-created login OTP.
func (s *AuthService) SendLoginOTPEmail(email, otp string) error {
	if s.emailSender == nil {
		return errors.New("email sender not configured")
	}
	return s.emailSender.SendLoginOTPEmail(email, otp)
}

// VerifyLoginOTP checks the OTP and, on success, returns the user record so
// the caller can create a session and issue the real token — mirrors Login's
// user-fetch but skips the password check (already done in the first step).
func (s *AuthService) VerifyLoginOTP(ctx context.Context, email, otp string) (*User, error) {
	stored, err := s.redis.Get(ctx, loginOTPKey(email)).Result()
	if err != nil || subtle.ConstantTimeCompare([]byte(stored), []byte(otp)) != 1 {
		return nil, errors.New("invalid or expired code")
	}
	_ = s.redis.Del(ctx, loginOTPKey(email)).Err()

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var user User
	var branchID, orgName sql.NullString
	err = s.db.Conn().QueryRowContext(ctx,
		`SELECT id, email, role, full_name, branch_id, organization_name, created_at FROM users WHERE email = $1`, email,
	).Scan(&user.ID, &user.Email, &user.Role, &user.FullName, &branchID, &orgName, &user.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if branchID.Valid {
		user.BranchID = branchID.String
	}
	if orgName.Valid {
		user.OrganizationName = orgName.String
	}
	return &user, nil
}

// ── Registration (email-verified, two-step) ─────────────────────────────────
//
// Register used to create the user, a branch, AND grant a trial subscription
// + permissions row + financial month, all in one shot, with a token handed
// back immediately — no proof the email address was real. That full
// bootstrap was cut down during the microservices split to just
// "insert user + insert branch": the comment above this function used to
// claim the subscription/permissions/financial-month steps had "moved" to
// payment_service/user_service/finance_service, but none of those services
// ever actually gained the equivalent logic — so every real registration
// silently produced an admin with NO subscription and NO permissions row,
// while register.tsx's success screen told them a 30-day trial had started.
//
// This restores the full bootstrap (subscription + permissions), gates it
// behind confirming the email address actually belongs to the registrant,
// and no longer auto-creates a branch with placeholder data — the frontend
// sends the admin through a mandatory "create your first branch" step (with
// real name/address/phone) right after verifying, via user_service's normal
// branch-creation endpoint, which by then has a trial subscription to check
// its branch limit against.
//
// All the tables involved (subscriptions, subscription_plans, permissions,
// branches) live in the SAME Postgres instance this service already
// connects to — confirmed by checking DATABASE_URL wiring across services —
// so this reaches them directly rather than inventing an inter-service call
// for tables nothing else yet exposes an API for.

func registrationOTPKey(email string) string          { return "auth:register-otp:" + email }
func registrationOTPCooldownKey(email string) string  { return "auth:register-otp-cooldown:" + email }
func registrationOTPAttemptsKey(email string) string  { return "auth:register-otp-attempts:" + email }

// freeTrialDays is the length of the trial subscription granted once a new
// admin confirms their email. Single source of truth — register.tsx's
// success copy is driven by this same number via the API response, not a
// hardcoded string on the frontend.
const freeTrialDays = 30

// Register validates the signup request and, if the email isn't already a
// verified account, creates (or reuses, if a previous attempt never got
// verified) an unverified user row and emails a 6-digit confirmation code.
// No token is issued — nothing meaningful exists yet (no subscription, no
// branch) until CompleteRegistration succeeds.
func (s *AuthService) Register(ctx context.Context, req *RegisterRequest) (email string, err error) {
	if req.Role != "admin" {
		return "", errors.New("only admin accounts may register through this endpoint")
	}

	claimed, err := s.redis.SetNX(ctx, registrationOTPCooldownKey(req.Email), "1", otpResendCooldown).Result()
	if err != nil {
		return "", fmt.Errorf("check resend cooldown: %w", err)
	}
	if !claimed {
		return "", errors.New("please wait before requesting another code")
	}

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}

	var existingID string
	var alreadyVerified bool
	scanErr := s.db.Conn().QueryRowContext(ctx,
		`SELECT id, email_verified FROM users WHERE email = $1`, req.Email,
	).Scan(&existingID, &alreadyVerified)

	switch {
	case scanErr == nil && alreadyVerified:
		return "", errors.New("an account with this email already exists")
	case scanErr == nil && !alreadyVerified:
		// A previous attempt never confirmed its OTP — treat this as a resend
		// rather than failing on the email's UNIQUE constraint, and refresh
		// the password/name/org in case they mistyped something the first time.
		_, err = s.db.Conn().ExecContext(ctx,
			`UPDATE users SET password_hash = $1, full_name = $2, organization_name = $3, updated_at = $4 WHERE id = $5`,
			string(hash), req.FullName, req.SchoolName, time.Now().UTC(), existingID,
		)
		if err != nil {
			return "", fmt.Errorf("update pending registration: %w", err)
		}
	case errors.Is(scanErr, sql.ErrNoRows):
		id := uuid.New().String()
		now := time.Now().UTC()
		_, err = s.db.Conn().ExecContext(ctx,
			`INSERT INTO users (id, email, password_hash, role, full_name, organization_name, email_verified, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, false, $7, $7)`,
			id, req.Email, string(hash), req.Role, req.FullName, req.SchoolName, now,
		)
		if err != nil {
			return "", fmt.Errorf("insert user: %w", err)
		}
	default:
		return "", fmt.Errorf("check existing user: %w", scanErr)
	}

	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("generate registration otp: %w", err)
	}
	otp := fmt.Sprintf("%06d", n.Int64())
	if err := s.redis.Set(ctx, registrationOTPKey(req.Email), otp, 10*time.Minute).Err(); err != nil {
		return "", fmt.Errorf("store registration otp: %w", err)
	}

	if s.emailSender == nil {
		return "", errors.New("email delivery is not configured")
	}
	if err := s.emailSender.SendRegistrationOTPEmail(req.Email, otp); err != nil {
		return "", fmt.Errorf("send registration otp: %w", err)
	}

	return req.Email, nil
}

// CompleteRegistration verifies the OTP sent by Register and, on success,
// activates the account: marks the email verified, grants the free-trial
// subscription, and creates the permissions row a fresh admin needs (mirrors
// backend_school_crm's original UserService.Register bootstrap, minus the
// branch/financial-month steps — those happen in the frontend's mandatory
// first-branch onboarding step after this returns).
func (s *AuthService) CompleteRegistration(ctx context.Context, email, otp string) (*User, error) {
	attemptsKey := registrationOTPAttemptsKey(email)
	attempts, _ := s.redis.Incr(ctx, attemptsKey).Result()
	if attempts == 1 {
		_ = s.redis.Expire(ctx, attemptsKey, otpLockoutWindow).Err()
	}
	if attempts > maxOTPAttempts {
		_ = s.redis.Del(ctx, registrationOTPKey(email)).Err()
		return nil, errors.New("too many attempts — request a new code")
	}

	stored, err := s.redis.Get(ctx, registrationOTPKey(email)).Result()
	if err != nil || subtle.ConstantTimeCompare([]byte(stored), []byte(otp)) != 1 {
		return nil, errors.New("invalid or expired code")
	}
	// Deletion is deferred until the transaction below actually commits (not
	// here, right after the compare) — a transient DB error would otherwise
	// burn an OTP the caller entered correctly, forcing them through the
	// resend cooldown for a new code despite having done nothing wrong.

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	tx, err := s.db.Conn().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback() // no-op after Commit

	var id, fullName, role string
	var orgName sql.NullString
	var branchID sql.NullString
	var alreadyVerified bool
	var createdAt time.Time
	err = tx.QueryRowContext(ctx,
		`SELECT id, full_name, role, organization_name, branch_id, email_verified, created_at
		 FROM users WHERE email = $1 FOR UPDATE`, email,
	).Scan(&id, &fullName, &role, &orgName, &branchID, &alreadyVerified, &createdAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("no pending registration for this email")
	}
	if err != nil {
		return nil, fmt.Errorf("fetch pending registration: %w", err)
	}

	// Re-verifying an already-activated account (e.g. a stale browser tab
	// that still has an old OTP page open) must not grant a second trial.
	if alreadyVerified {
		if err := tx.Commit(); err != nil {
			return nil, fmt.Errorf("commit: %w", err)
		}
		_ = s.redis.Del(ctx, registrationOTPKey(email))
		_ = s.redis.Del(ctx, attemptsKey)
		u := &User{ID: id, Email: email, FullName: fullName, Role: role, CreatedAt: createdAt}
		if orgName.Valid {
			u.OrganizationName = orgName.String
		}
		if branchID.Valid {
			u.BranchID = branchID.String
		}
		return u, nil
	}

	now := time.Now().UTC()
	_, err = tx.ExecContext(ctx,
		// email_verified_at/trial_used_at are timestamptz but updated_at is a
		// bare timestamp — reusing one placeholder across both types made
		// lib/pq's extended-protocol type inference ambiguous ("inconsistent
		// types deduced for parameter $1"), so each gets its own.
		`UPDATE users SET email_verified = true, email_verified_at = $1, trial_used_at = $2, updated_at = $3 WHERE id = $4`,
		now, now, now, id,
	)
	if err != nil {
		return nil, fmt.Errorf("mark email verified: %w", err)
	}

	trialPlanID, err := s.getOrCreateFreeTrialPlanID(ctx, tx)
	if err != nil {
		return nil, err
	}

	endDate := now.AddDate(0, 0, freeTrialDays)
	_, err = tx.ExecContext(ctx,
		`INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date, renewal_date, auto_renew, payment_method, notes)
		 VALUES ($1, $2, 'trial', $3, $4, $4, false, 'free_trial', 'Auto-granted on email verification')`,
		id, trialPlanID, now, endDate,
	)
	if err != nil {
		return nil, fmt.Errorf("grant trial subscription: %w", err)
	}

	// Column list mirrors backend_school_crm's original UserService.Register
	// bootstrap (Step 5) and user_service's PermissionService, so the schema
	// stays in sync across all three copies of this INSERT.
	_, err = tx.ExecContext(ctx,
		`INSERT INTO permissions (
		     id, user_id,
		     can_view_students, can_edit_students, can_delete_students,
		     can_view_teachers, can_edit_teachers, can_delete_teachers,
		     can_view_classes,  can_edit_classes,  can_delete_classes,
		     can_view_payments, can_edit_payments,
		     can_view_salaries, can_edit_salaries,
		     can_view_expenses, can_edit_expenses, can_delete_expenses,
		     can_view_reports,  can_view_settings, can_edit_settings
		 ) VALUES (
		     $1, $2,
		     true, true, true,
		     true, true, true,
		     true, true, true,
		     true, true,
		     true, true,
		     true, true, true,
		     true, true, true
		 )
		 ON CONFLICT (user_id) DO NOTHING`,
		uuid.New().String(), id,
	)
	if err != nil {
		return nil, fmt.Errorf("init permissions: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	_ = s.redis.Del(ctx, registrationOTPKey(email))
	_ = s.redis.Del(ctx, attemptsKey)

	u := &User{ID: id, Email: email, FullName: fullName, Role: role, CreatedAt: createdAt}
	if orgName.Valid {
		u.OrganizationName = orgName.String
	}
	return u, nil
}

// getOrCreateFreeTrialPlanID mirrors backend_school_crm's
// SubscriptionService.GetOrCreateFreeTrial — resolving the shared "Free
// Trial" plan row (creating it once, idempotently, if this is a brand new
// database) rather than requiring subscription_plans to be seeded manually
// before anyone can register.
func (s *AuthService) getOrCreateFreeTrialPlanID(ctx context.Context, tx *sql.Tx) (string, error) {
	var id string
	err := tx.QueryRowContext(ctx,
		`SELECT id FROM subscription_plans WHERE name = 'Free Trial' AND status = 'active' LIMIT 1`,
	).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", fmt.Errorf("fetch free trial plan: %w", err)
	}
	err = tx.QueryRowContext(ctx,
		`INSERT INTO subscription_plans (id, name, description, price, billing_period, max_branches, max_students, max_classes, features, status, created_at, updated_at)
		 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		 RETURNING id`,
		"Free Trial", fmt.Sprintf("%d-day free trial for new users", freeTrialDays), 0, "yearly", 100, 10000, 1000, `{}`, "active",
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create free trial plan: %w", err)
	}
	return id, nil
}

// GetByID returns a user by ID (password fields omitted).
func (s *AuthService) GetByID(ctx context.Context, id string) (*User, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var u User
	var branchID, orgName sql.NullString
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT id, email, role, full_name, branch_id, organization_name, created_at FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.Role, &u.FullName, &branchID, &orgName, &u.CreatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if branchID.Valid {
		u.BranchID = branchID.String
	}
	if orgName.Valid {
		u.OrganizationName = orgName.String
	}
	return &u, nil
}

const otpResendCooldown = 60 * time.Second

// ForgotPassword generates and stores a 6-digit OTP, returning it so the caller
// can send it via email. Enforces a cooldown between requests for the same
// email — without one, ForgotPassword/ResendOTP can be called in a tight
// loop to flood the target's inbox (email bombing).
func (s *AuthService) ForgotPassword(ctx context.Context, email string) (otp string, err error) {
	// SetNX succeeds only if the cooldown key doesn't already exist, so this
	// doubles as an atomic "claim the cooldown slot" — no separate
	// check-then-set race between concurrent requests for the same email.
	claimed, err := s.redis.SetNX(ctx, otpCooldownKey(email), "1", otpResendCooldown).Result()
	if err != nil {
		return "", fmt.Errorf("check resend cooldown: %w", err)
	}
	if !claimed {
		return "", errors.New("please wait before requesting another OTP")
	}

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	// Verify user exists
	var id string
	err = s.db.Conn().QueryRowContext(ctx,
		`SELECT id FROM users WHERE email = $1`, email,
	).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		// Return generic message to avoid email enumeration
		return "", errors.New("if that email exists you will receive an OTP")
	}
	if err != nil {
		return "", err
	}

	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("generate otp: %w", err)
	}
	otp = fmt.Sprintf("%06d", n.Int64())
	key := otpKey(email)
	if err := s.redis.Set(ctx, key, otp, 10*time.Minute).Err(); err != nil {
		return "", fmt.Errorf("store otp: %w", err)
	}
	return otp, nil
}

const (
	maxOTPAttempts   = 5
	otpLockoutWindow = 10 * time.Minute // matches the OTP's own TTL
)

// VerifyOTP checks the OTP and returns a short-lived reset token on success.
// A 6-digit OTP is a 1-in-1,000,000 guess — without a per-email attempt
// limit, an attacker can brute-force it well within its 10-minute TTL
// (especially since gateway-level rate limiting is IP-keyed and doesn't by
// itself stop a distributed attempt). After maxOTPAttempts wrong guesses the
// OTP is invalidated outright, forcing a fresh ForgotPassword request.
func (s *AuthService) VerifyOTP(ctx context.Context, email, otp string) (resetToken string, err error) {
	attemptsKey := otpAttemptsKey(email)

	attempts, _ := s.redis.Incr(ctx, attemptsKey).Result()
	if attempts == 1 {
		_ = s.redis.Expire(ctx, attemptsKey, otpLockoutWindow).Err()
	}
	if attempts > maxOTPAttempts {
		_ = s.redis.Del(ctx, otpKey(email)).Err()
		return "", errors.New("too many attempts — request a new OTP")
	}

	stored, err := s.redis.Get(ctx, otpKey(email)).Result()
	if err != nil || subtle.ConstantTimeCompare([]byte(stored), []byte(otp)) != 1 {
		return "", errors.New("invalid or expired OTP")
	}
	_ = s.redis.Del(ctx, otpKey(email))
	_ = s.redis.Del(ctx, attemptsKey)

	resetToken = uuid.New().String()
	if err := s.redis.Set(ctx, resetKey(email), resetToken, 15*time.Minute).Err(); err != nil {
		return "", fmt.Errorf("store reset token: %w", err)
	}
	return resetToken, nil
}

// ResendOTP generates a fresh OTP (replaces any existing one).
func (s *AuthService) ResendOTP(ctx context.Context, email string) (otp string, err error) {
	return s.ForgotPassword(ctx, email)
}

// ResetPassword validates the reset token and updates the password.
func (s *AuthService) ResetPassword(ctx context.Context, email, resetToken, newPassword string) error {
	stored, err := s.redis.Get(ctx, resetKey(email)).Result()
	if err != nil || subtle.ConstantTimeCompare([]byte(stored), []byte(resetToken)) != 1 {
		return errors.New("invalid or expired reset token")
	}
	_ = s.redis.Del(ctx, resetKey(email))

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	_, err = s.db.Conn().ExecContext(ctx,
		`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2`,
		string(hash), email,
	)
	return err
}

// BlacklistToken marks an access token as revoked in Redis (for logout).
func (s *AuthService) BlacklistToken(ctx context.Context, token string, ttl time.Duration) error {
	return s.redis.Set(ctx, blacklistKey(token), "1", ttl).Err()
}

// IsTokenBlacklisted returns true if the token has been revoked.
func (s *AuthService) IsTokenBlacklisted(ctx context.Context, token string) bool {
	res, err := s.redis.Exists(ctx, blacklistKey(token)).Result()
	return err == nil && res > 0
}

// ── Sessions ─────────────────────────────────────────────────────────────────
//
// Every login/register inserts a user_sessions row and embeds its ID in the
// JWT as the "sid" claim, so a user can later see their logged-in devices and
// sign one out remotely. Revocation is a two-part write: the row is marked
// revoked (the durable record ListSessions reads from) and a Redis flag is
// set so api_gateway's hot-path JWTAuth check doesn't need a DB round-trip
// per request — mirrors the existing token-blacklist pattern exactly.

// sessionRevokedTTL exceeds the 24h access-token lifetime so the Redis flag
// can't expire while a token minted against the revoked session is still
// otherwise valid.
const sessionRevokedTTL = 25 * time.Hour

var ErrSessionNotFound = errors.New("session not found")

type Session struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	IPAddress string    `json:"ipAddress"`
	UserAgent string    `json:"userAgent"`
	CreatedAt time.Time `json:"createdAt"`
}

// CreateSession records a new login and returns the session ID to embed in
// that login's JWT as the "sid" claim.
func (s *AuthService) CreateSession(ctx context.Context, userID, ip, userAgent string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var id string
	err := s.db.Conn().QueryRowContext(ctx,
		`INSERT INTO user_sessions (user_id, ip_address, user_agent) VALUES ($1, $2, $3) RETURNING id`,
		userID, ip, userAgent,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create session: %w", err)
	}
	return id, nil
}

// ListSessions returns a user's active (non-revoked) sessions, newest first.
func (s *AuthService) ListSessions(ctx context.Context, userID string) ([]Session, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	rows, err := s.db.Conn().QueryContext(ctx,
		`SELECT id, user_id, COALESCE(ip_address, ''), COALESCE(user_agent, ''), created_at
		 FROM user_sessions WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list sessions: %w", err)
	}
	defer rows.Close()

	sessions := []Session{}
	for rows.Next() {
		var sess Session
		if err := rows.Scan(&sess.ID, &sess.UserID, &sess.IPAddress, &sess.UserAgent, &sess.CreatedAt); err != nil {
			continue
		}
		sessions = append(sessions, sess)
	}
	return sessions, rows.Err()
}

// RevokeSession signs one device out: marks the session row revoked (scoped
// to the caller's own userID, so one user can never revoke another's
// session) and sets the fast Redis flag JWTAuth checks on every request.
func (s *AuthService) RevokeSession(ctx context.Context, userID, sessionID string) error {
	qctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	res, err := s.db.Conn().ExecContext(qctx,
		`UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
		sessionID, userID,
	)
	if err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrSessionNotFound
	}

	if err := s.redis.Set(ctx, sessionRevokedKey(sessionID), "1", sessionRevokedTTL).Err(); err != nil {
		return fmt.Errorf("flag session revoked: %w", err)
	}
	return nil
}

// ── Key helpers ───────────────────────────────────────────────────────────────

func otpKey(email string) string                { return "auth:otp:" + email }
func resetKey(email string) string              { return "auth:reset:" + email }
func blacklistKey(token string) string          { return "auth:blacklist:" + token }
func otpAttemptsKey(email string) string        { return "auth:otp-attempts:" + email }
func otpCooldownKey(email string) string        { return "auth:otp-cooldown:" + email }
func sessionRevokedKey(sessionID string) string { return "auth:session:revoked:" + sessionID }
