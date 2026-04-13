package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/utils"
)

func Login(userService *service.UserService, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req service.LoginRequest
		
		// Log incoming request
		log.Printf("[LOGIN] Incoming request from %s", c.ClientIP())
		
		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("[LOGIN ERROR] Failed to parse JSON: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		log.Printf("[LOGIN] Attempting login for email: %s", req.Email)

		user, err := userService.Login(c.Request.Context(), req.Email, req.Password)
		if err != nil {
			log.Printf("[LOGIN ERROR] Authentication failed for %s: %v", req.Email, err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		log.Printf("[LOGIN SUCCESS] User %s (ID: %s) logged in successfully", req.Email, user.ID)

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, &middleware.CustomClaims{
			UserID: user.ID,
			RegisteredClaims: jwt.RegisteredClaims{
				Subject:   user.ID,
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
			},
		})

		tokenString, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			log.Printf("[LOGIN ERROR] Failed to generate token for %s: %v", req.Email, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
			return
		}

		log.Printf("[LOGIN] JWT token generated for user %s", req.Email)

		c.JSON(http.StatusOK, gin.H{
			"token": tokenString,
			"user":  user,
		})
	}
}

func Register(userService *service.UserService, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req service.RegisterRequest
		
		log.Printf("[REGISTER] Incoming registration request from %s", c.ClientIP())
		
		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("[REGISTER ERROR] Failed to parse JSON: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Public registration is restricted to school-owner (admin) accounts only.
		// All other roles (branch_admin, manager, teacher, etc.) must be created
		// by an authenticated admin through the user-management endpoints.
		if req.Role != "admin" {
			log.Printf("[REGISTER DENIED] Non-admin role attempted via public endpoint: %s (%s)", req.Email, req.Role)
			c.JSON(http.StatusForbidden, gin.H{"error": "only admin accounts may register through this endpoint"})
			return
		}

		log.Printf("[REGISTER] Attempting to register user: %s (Role: %s)", req.Email, req.Role)

		user, err := userService.Register(c.Request.Context(), &req)
		if err != nil {
			log.Printf("[REGISTER ERROR] Registration failed for %s: %v", req.Email, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		log.Printf("[REGISTER SUCCESS] User %s (ID: %s) registered successfully", req.Email, user.ID)

		// Generate JWT token for the newly registered user
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, &middleware.CustomClaims{
			UserID: user.ID,
			RegisteredClaims: jwt.RegisteredClaims{
				Subject:   user.ID,
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
			},
		})

		tokenString, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			log.Printf("[REGISTER ERROR] Failed to generate token for %s: %v", req.Email, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
			return
		}

		log.Printf("[REGISTER] JWT token generated for user %s", req.Email)

		c.JSON(http.StatusCreated, gin.H{
			"token": tokenString,
			"user":  user,
		})
	}
}

// ForgotPassword initiates password reset by sending OTP
func ForgotPassword(userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email string `json:"email" binding:"required,email"`
		}

		log.Printf("[ForgotPassword] Password reset request from %s", c.ClientIP())

		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("[ForgotPassword ERROR] Failed to parse JSON: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		log.Printf("[ForgotPassword] Processing password reset for: %s", req.Email)

		if err := userService.ForgotPasswordRequest(c.Request.Context(), req.Email); err != nil {
			log.Printf("[ForgotPassword ERROR] Failed to process request: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		log.Printf("[ForgotPassword SUCCESS] OTP sent to %s", req.Email)
		c.JSON(http.StatusOK, gin.H{
			"message": "OTP sent to your email",
			"email":   req.Email,
		})
	}
}

// VerifyOTP verifies the OTP and returns reset token
func VerifyOTP(userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email string `json:"email" binding:"required,email"`
			OTP   string `json:"otp" binding:"required,len=6"`
		}

		log.Printf("[VerifyOTP] Verification request from %s", c.ClientIP())

		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("[VerifyOTP ERROR] Failed to parse JSON: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		log.Printf("[VerifyOTP] Verifying OTP for: %s", req.Email)

		resetToken, err := userService.VerifyOTPRequest(c.Request.Context(), req.Email, req.OTP)
		if err != nil {
			log.Printf("[VerifyOTP ERROR] Verification failed: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		log.Printf("[VerifyOTP SUCCESS] OTP verified for %s", req.Email)
		c.JSON(http.StatusOK, gin.H{
			"message":     "OTP verified successfully",
			"resetToken":  resetToken,
			"email":       req.Email,
		})
	}
}

// ResendOTP resends OTP to the user's email
func ResendOTP(userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email string `json:"email" binding:"required,email"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := userService.ResendOTP(c.Request.Context(), req.Email); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "OTP resent to your email",
		})
	}
}

// ResetPassword resets the password using reset token
func ResetPassword(userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email       string `json:"email" binding:"required,email"`
			ResetToken  string `json:"resetToken" binding:"required"`
			NewPassword string `json:"newPassword" binding:"required,min=6"`
		}

		log.Printf("[ResetPassword] Password reset request from %s", c.ClientIP())

		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("[ResetPassword ERROR] Failed to parse JSON: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if !utils.IsValidEmail(req.Email) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid email format"})
			return
		}

		log.Printf("[ResetPassword] Processing password reset for: %s", req.Email)

		if err := userService.ResetPasswordWithToken(c.Request.Context(), req.Email, req.ResetToken, req.NewPassword); err != nil {
			log.Printf("[ResetPassword ERROR] Password reset failed: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		log.Printf("[ResetPassword SUCCESS] Password reset for %s", req.Email)
		c.JSON(http.StatusOK, gin.H{
			"message": "Password reset successfully. Please login with your new password.",
		})
	}
}
