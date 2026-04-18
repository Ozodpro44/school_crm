package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math/rand"
	"strconv"
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
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT id, email, password_hash, role, full_name, created_at FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &passwordHash, &user.Role, &user.FullName, &user.CreatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("invalid credentials")
	}
	if err != nil {
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Stamp last_login_at (best-effort)
	_, _ = s.db.Conn().ExecContext(ctx,
		`UPDATE users SET last_login_at = NOW() WHERE id = $1`, user.ID)

	return &user, nil
}

// Register creates a new admin user. Non-admin registration is blocked.
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

	id := uuid.New().String()
	now := time.Now().UTC()

	_, err = s.db.Conn().ExecContext(ctx,
		`INSERT INTO users (id, email, password_hash, role, full_name, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		id, req.Email, string(hash), req.Role, req.FullName, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("insert user: %w", err)
	}

	return &User{ID: id, Email: req.Email, FullName: req.FullName, Role: req.Role, CreatedAt: now}, nil
}

// GetByID returns a user by ID (password fields omitted).
func (s *AuthService) GetByID(ctx context.Context, id string) (*User, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var u User
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT id, email, role, full_name, created_at FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.Role, &u.FullName, &u.CreatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("user not found")
	}
	return &u, err
}

// ForgotPassword generates and stores a 6-digit OTP, returning it so the caller
// can send it via email.
func (s *AuthService) ForgotPassword(ctx context.Context, email string) (otp string, err error) {
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

	otp = fmt.Sprintf("%06d", rand.Intn(1_000_000))
	key := otpKey(email)
	if err := s.redis.Set(ctx, key, otp, 10*time.Minute).Err(); err != nil {
		return "", fmt.Errorf("store otp: %w", err)
	}
	return otp, nil
}

// VerifyOTP checks the OTP and returns a short-lived reset token on success.
func (s *AuthService) VerifyOTP(ctx context.Context, email, otp string) (resetToken string, err error) {
	stored, err := s.redis.Get(ctx, otpKey(email)).Result()
	if err != nil || stored != otp {
		return "", errors.New("invalid or expired OTP")
	}
	_ = s.redis.Del(ctx, otpKey(email))

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
	if err != nil || stored != resetToken {
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

func otpKey(email string) string       { return "auth:otp:" + email }
func resetKey(email string) string     { return "auth:reset:" + email }
func blacklistKey(token string) string { return "auth:blacklist:" + token }

// numberPad left-pads n with zeros to width digits (used only to silence unused import).
var _ = strconv.Itoa
