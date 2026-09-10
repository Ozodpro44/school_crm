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
	"golang.org/x/crypto/bcrypt"
)

// ── Models ─────────────────────────────────────────────────────────────────────

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	FullName  string    `json:"fullName"`
	Role      string    `json:"role"`
	BranchID  string    `json:"branchId,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
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
	db    *db.DB
	redis *redis.Client
}

func New(database *db.DB, redisClient *redis.Client) *AuthService {
	return &AuthService{db: database, redis: redisClient}
}

// Login verifies credentials and returns the user.
func (s *AuthService) Login(ctx context.Context, email, password string) (*User, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var user User
	var passwordHash string
	var branchID sql.NullString
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT id, email, password_hash, role, full_name, branch_id, created_at FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &passwordHash, &user.Role, &user.FullName, &branchID, &user.CreatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("invalid credentials")
	}
	if err != nil {
		return nil, err
	}
	if branchID.Valid {
		user.BranchID = branchID.String
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Stamp last_login_at (best-effort)
	_, _ = s.db.Conn().ExecContext(ctx,
		`UPDATE users SET last_login_at = NOW() WHERE id = $1`, user.ID)

	return &user, nil
}

// Register creates a new admin (school-owner) user and their own branch in a
// single transaction. Non-admin registration is blocked — other roles are
// created by an authenticated admin through user-management endpoints.
//
// A branch is created here (not left for later) because every downstream
// service enforces tenant isolation via branch_id: an admin issued a token
// with an empty branch_id would bypass that scoping entirely. This mirrors
// the monolith's UserService.Register (backend_school_crm/internal/service/
// user_service.go), minus the subscription/permissions/financial-month
// bootstrapping steps — those now belong to payment_service/user_service/
// finance_service respectively and aren't wired up cross-service yet.
func (s *AuthService) Register(ctx context.Context, req *RegisterRequest) (*User, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	if req.Role != "admin" {
		return nil, errors.New("only admin accounts may register through this endpoint")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	tx, err := s.db.Conn().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback() // no-op after Commit

	id := uuid.New().String()
	now := time.Now().UTC()

	_, err = tx.ExecContext(ctx,
		`INSERT INTO users (id, email, password_hash, role, full_name, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		id, req.Email, string(hash), req.Role, req.FullName, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("insert user: %w", err)
	}

	branchID := uuid.New().String()
	branchName := req.SchoolName
	if branchName == "" {
		branchName = req.FullName + " Branch"
	}
	_, err = tx.ExecContext(ctx,
		`INSERT INTO branches (id, name, admin_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
		branchID, branchName, id, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("create branch: %w", err)
	}

	_, err = tx.ExecContext(ctx,
		`UPDATE users SET branch_id = $1, updated_at = $2 WHERE id = $3`,
		branchID, now, id,
	)
	if err != nil {
		return nil, fmt.Errorf("link branch to user: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &User{ID: id, Email: req.Email, FullName: req.FullName, Role: req.Role, BranchID: branchID, CreatedAt: now}, nil
}

// GetByID returns a user by ID (password fields omitted).
func (s *AuthService) GetByID(ctx context.Context, id string) (*User, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var u User
	var branchID sql.NullString
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT id, email, role, full_name, branch_id, created_at FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.Role, &u.FullName, &branchID, &u.CreatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("user not found")
	}
	if err != nil {
		return nil, err
	}
	if branchID.Valid {
		u.BranchID = branchID.String
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

// ── Key helpers ───────────────────────────────────────────────────────────────

func otpKey(email string) string         { return "auth:otp:" + email }
func resetKey(email string) string       { return "auth:reset:" + email }
func blacklistKey(token string) string   { return "auth:blacklist:" + token }
func otpAttemptsKey(email string) string { return "auth:otp-attempts:" + email }
func otpCooldownKey(email string) string { return "auth:otp-cooldown:" + email }
