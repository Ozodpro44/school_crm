package handler

import (
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
	r.POST("/auth/register", h.RegisterUser)
	r.POST("/auth/forgot-password", h.ForgotPassword)
	r.POST("/auth/verify-otp", h.VerifyOTP)
	r.POST("/auth/resend-otp", h.ResendOTP)
	r.POST("/auth/reset-password", h.ResetPassword)
	r.POST("/auth/logout", h.Logout)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req service.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.svc.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	tokenStr, err := h.issueToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": tokenStr, "user": user})
}

func (h *AuthHandler) RegisterUser(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.svc.Register(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "only admin accounts may register through this endpoint" {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	tokenStr, err := h.issueToken(user)
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

// ── helpers ───────────────────────────────────────────────────────────────────

func (h *AuthHandler) issueToken(user *service.User) (string, error) {
	claims := &middleware.CustomClaims{
		UserID:   user.ID,
		Role:     user.Role,
		BranchID: user.BranchID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString([]byte(h.jwtSecret))
}
