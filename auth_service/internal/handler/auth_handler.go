package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/school-crm/auth-service/internal/middleware"
	"github.com/school-crm/auth-service/internal/service"
)

type AuthHandler struct {
	svc       *service.AuthService
	jwtSecret string
}

func NewAuthHandler(svc *service.AuthService, jwtSecret string) *AuthHandler {
	return &AuthHandler{svc: svc, jwtSecret: jwtSecret}
}

func (h *AuthHandler) Register(r *gin.RouterGroup) {
	r.POST("/auth/login", h.Login)
	r.POST("/auth/verify-login-otp", h.VerifyLoginOTP)
	r.POST("/auth/register", h.RegisterUser)
	r.POST("/auth/verify-registration-otp", h.VerifyRegistrationOTP)
	r.POST("/auth/forgot-password", h.ForgotPassword)
	r.POST("/auth/verify-otp", h.VerifyOTP)
	r.POST("/auth/resend-otp", h.ResendOTP)
	r.POST("/auth/reset-password", h.ResetPassword)
	r.POST("/auth/logout", h.Logout)
	r.GET("/auth/sessions", h.ListSessions)
	r.DELETE("/auth/sessions/:id", h.RevokeSession)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req service.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.svc.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		status := http.StatusUnauthorized
		if errors.Is(err, service.ErrAccountLocked) {
			status = http.StatusTooManyRequests
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	if h.svc.MFARequired() {
		if !h.svc.EmailConfigured() {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "MFA is enabled but email delivery is not configured"})
			return
		}
		otp, err := h.svc.CreateLoginOTP(c.Request.Context(), user.Email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start verification"})
			return
		}
		if err := h.svc.SendLoginOTPEmail(user.Email, otp); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send verification email"})
			return
		}
		c.JSON(http.StatusAccepted, gin.H{"mfaRequired": true, "email": user.Email})
		return
	}

	sessionID, err := h.svc.CreateSession(c.Request.Context(), user.ID, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session"})
		return
	}

	tokenStr, err := h.issueToken(user, sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": tokenStr, "user": user})
}

// VerifyLoginOTP completes a login that was paused for MFA by Login above.
func (h *AuthHandler) VerifyLoginOTP(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
		OTP   string `json:"otp"   binding:"required,len=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.svc.VerifyLoginOTP(c.Request.Context(), req.Email, req.OTP)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	sessionID, err := h.svc.CreateSession(c.Request.Context(), user.ID, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session"})
		return
	}

	tokenStr, err := h.issueToken(user, sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": tokenStr, "user": user})
}

// RegisterUser starts (or resumes, for an email that registered but never
// confirmed) a signup: it emails a 6-digit code and returns without a token
// — nothing usable exists yet, since VerifyRegistrationOTP is what actually
// creates the trial subscription and permissions row.
func (h *AuthHandler) RegisterUser(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	email, err := h.svc.Register(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		switch err.Error() {
		case "only admin accounts may register through this endpoint":
			status = http.StatusForbidden
		case "an account with this email already exists":
			status = http.StatusConflict
		case "please wait before requesting another code":
			status = http.StatusTooManyRequests
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{"emailVerificationRequired": true, "email": email})
}

// VerifyRegistrationOTP completes the signup started by RegisterUser: on a
// correct code it activates the account (trial + permissions) and, exactly
// like VerifyLoginOTP, immediately issues a real session and token.
func (h *AuthHandler) VerifyRegistrationOTP(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
		OTP   string `json:"otp"   binding:"required,len=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.svc.CompleteRegistration(c.Request.Context(), req.Email, req.OTP)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	sessionID, err := h.svc.CreateSession(c.Request.Context(), user.ID, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session"})
		return
	}

	tokenStr, err := h.issueToken(user, sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"token": tokenStr, "user": user})
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// OTP delivery is handled externally (email service); we just generate and store it.
	// In production the auth_service calls a notification_service event instead.
	_, err := h.svc.ForgotPassword(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "OTP sent to your email", "email": req.Email})
}

func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
		OTP   string `json:"otp"   binding:"required,len=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resetToken, err := h.svc.VerifyOTP(c.Request.Context(), req.Email, req.OTP)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "OTP verified successfully",
		"resetToken": resetToken,
		"email":      req.Email,
	})
}

func (h *AuthHandler) ResendOTP(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if _, err := h.svc.ResendOTP(c.Request.Context(), req.Email); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "OTP resent to your email"})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Email       string `json:"email"       binding:"required,email"`
		ResetToken  string `json:"resetToken"  binding:"required"`
		NewPassword string `json:"newPassword" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.ResetPassword(c.Request.Context(), req.Email, req.ResetToken, req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully. Please login with your new password."})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	// Best-effort token blacklist — if Redis fails we still return 200
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) > 7 {
		token := authHeader[7:]
		_ = h.svc.BlacklistToken(c.Request.Context(), token, 25*time.Hour)
	}
	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

// ListSessions returns the caller's own active sessions (devices). The
// caller's identity comes from X-User-ID, a trusted header api_gateway's
// JWTAuth sets after verifying the bearer token — the same convention every
// other microservice in this repo uses for identifying the caller.
func (h *AuthHandler) ListSessions(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	sessions, err := h.svc.ListSessions(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sessions)
}

// RevokeSession signs a single device out.
func (h *AuthHandler) RevokeSession(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	sessionID := c.Param("id")
	if err := h.svc.RevokeSession(c.Request.Context(), userID, sessionID); err != nil {
		if errors.Is(err, service.ErrSessionNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ── helpers ───────────────────────────────────────────────────────────────────

func (h *AuthHandler) issueToken(user *service.User, sessionID string) (string, error) {
	claims := &middleware.CustomClaims{
		UserID:    user.ID,
		Role:      user.Role,
		BranchID:  user.BranchID,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(h.svc.JWTExpiryHours()) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString([]byte(h.jwtSecret))
}
