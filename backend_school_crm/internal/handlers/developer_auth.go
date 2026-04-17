package handlers

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

// DeveloperLogin handles developer authentication
// @Summary Developer Login
// @Description Authenticate a developer and return JWT token
// @Tags developer-auth
// @Accept json
// @Produce json
// @Param request body models.DeveloperLoginRequest true "Developer login credentials"
// @Success 200 {object} models.DeveloperLoginResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /dev/auth/login [post]
func DeveloperLogin(developerService *service.DeveloperService, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.DeveloperLoginRequest

		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("[DEV-LOGIN] Validation error: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
			return
		}

		log.Printf("[DEV-LOGIN] Login attempt for email: %s", req.Email)

		// Authenticate developer
		dev, err := developerService.AuthenticateDeveloper(c.Request.Context(), req.Email, req.Password)
		if err != nil {
			log.Printf("[DEV-LOGIN] Authentication failed: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
			return
		}

		// Generate JWT token
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"developer_id": dev.ID,
			"email":        dev.Email,
			"role":         dev.Role,
			"type":         "developer",
		})

		tokenString, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			log.Printf("[DEV-LOGIN] Token generation failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}

		log.Printf("[DEV-LOGIN] Successful login for: %s", dev.Email)

		c.JSON(http.StatusOK, models.DeveloperLoginResponse{
			ID:       dev.ID,
			Email:    dev.Email,
			FullName: dev.FullName,
			Role:     dev.Role,
			Token:    tokenString,
		})
	}
}

// DeveloperRegister handles developer registration
// @Summary Developer Registration
// @Description Register a new developer account
// @Tags developer-auth
// @Accept json
// @Produce json
// @Param request body models.DeveloperRegisterRequest true "Developer registration details"
// @Success 201 {object} models.DeveloperLoginResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /dev/auth/register [post]
func DeveloperRegister(developerService *service.DeveloperService, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.DeveloperRegisterRequest

		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("[DEV-REGISTER] Validation error: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
			return
		}

		log.Printf("[DEV-REGISTER] Registration attempt for email: %s", req.Email)

		// Create developer
		dev, err := developerService.CreateDeveloper(c.Request.Context(), req.Email, req.Password, req.FullName)
		if err != nil {
			log.Printf("[DEV-REGISTER] Registration failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register developer"})
			return
		}

		// Generate JWT token
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"developer_id": dev.ID,
			"email":        dev.Email,
			"role":         dev.Role,
			"type":         "developer",
		})

		tokenString, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			log.Printf("[DEV-REGISTER] Token generation failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}

		log.Printf("[DEV-REGISTER] Successful registration for: %s", dev.Email)

		c.JSON(http.StatusCreated, models.DeveloperLoginResponse{
			ID:       dev.ID,
			Email:    dev.Email,
			FullName: dev.FullName,
			Role:     dev.Role,
			Token:    tokenString,
		})
	}
}

// DeveloperMiddleware authenticates developer requests
func DeveloperMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing authorization header"})
			c.Abort()
			return
		}

		// Extract token from header
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Parse token
		token, err := jwt.ParseWithClaims(tokenString, &jwt.MapClaims{}, func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			log.Printf("[DEV-AUTH] Invalid token: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(*jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		// Check if it's a developer token
		if tokenType, exists := (*claims)["type"]; !exists || tokenType != "developer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Not a developer token"})
			c.Abort()
			return
		}

		// Set developer info in context
		if devID, exists := (*claims)["developer_id"]; exists {
			c.Set("developer_id", devID)
		}
		if email, exists := (*claims)["email"]; exists {
			c.Set("email", email)
		}
		if role, exists := (*claims)["role"]; exists {
			c.Set("role", role)
		}

		c.Next()
	}
}

// RegisterDeveloperAuthRoutes registers developer authentication routes
func RegisterDeveloperAuthRoutes(router gin.IRouter, developerService *service.DeveloperService, jwtSecret string) {
	log.Println("[ROUTES] Registering developer auth routes")
	router.POST("/api/v1/dev/auth/login", DeveloperLogin(developerService, jwtSecret))
	router.POST("/api/v1/dev/auth/register", DeveloperRegister(developerService, jwtSecret))
}
