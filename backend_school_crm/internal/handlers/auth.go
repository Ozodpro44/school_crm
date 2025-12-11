package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
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
