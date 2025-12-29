package handlers

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

func RegisterUserRoutes(router *gin.RouterGroup, userService *service.UserService) {
	users := router.Group("/users")
	users.GET("", listUsers(userService))
	users.POST("", createUser(userService))
	users.GET("/:id", getUser(userService))
	users.PUT("/:id", updateUser(userService))
	users.DELETE("/:id", deleteUser(userService))
	users.PUT("/:id/permissions", updateUserPermissions(userService))
}

func listUsers(userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		var users interface{}
		var err error
		
		if branchID != "" {
			// Get managers for a specific branch
			users, err = userService.GetManagersByBranch(c.Request.Context(), branchID)
		} else {
			// Get all users
			users, err = userService.GetAll(c.Request.Context())
		}
		
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, users)
	}
}

func createUser(userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		// Only admin can create users
		currentUser, err := userService.GetByID(c.Request.Context(), userID)
		if err != nil || currentUser.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var req struct {
			service.RegisterRequest
			BranchID *string `json:"branchId"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, err := userService.Register(c.Request.Context(), &req.RegisterRequest)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Create permissions record for the new user
		permissionService := service.NewPermissionService(userService.GetDB())
		_, err = permissionService.CreateForUser(c.Request.Context(), user.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create permissions"})
			return
		}

		// Managers must be assigned to a branch
		if user.Role == "manager" && req.BranchID == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branch_id is required for managers"})
			return
		}

		// Associate manager with branch using branch_managers table
		if req.BranchID != nil && user.Role == "manager" {
			// Add to branch_managers junction table
			_, err = userService.AddBranchManager(c.Request.Context(), *req.BranchID, user.ID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		c.JSON(http.StatusCreated, user)
	}
}

func getUser(userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		user, err := userService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, user)
	}
}

func updateUser(userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		// Only allow users to update their own profile or admin
		currentUser, err := userService.GetByID(c.Request.Context(), userID)
		if err != nil || (currentUser.Role != "admin" && currentUser.ID != id) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, err := userService.Update(c.Request.Context(), id, updates)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, user)
	}
}

func deleteUser(userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		// Only admin can delete users
		currentUser, err := userService.GetByID(c.Request.Context(), userID)
		if err != nil || currentUser.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		if err := userService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "user deleted"})
	}
}

func updateUserPermissions(userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		// Only admin can update user permissions
		currentUser, err := userService.GetByID(c.Request.Context(), userID)
		if err != nil || currentUser.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Convert camelCase keys to snake_case for database columns
		convertedUpdates := convertPermissionKeys(updates)

		permissionService := service.NewPermissionService(userService.GetDB())
		permissions, err := permissionService.Update(c.Request.Context(), id, convertedUpdates)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, permissions)
	}
}

// convertPermissionKeys converts camelCase permission keys to snake_case for database columns
func convertPermissionKeys(updates map[string]interface{}) map[string]interface{} {
	converted := make(map[string]interface{})
	camelCaseToSnakeCase := regexp.MustCompile(`([a-z])([A-Z])`)

	for key, value := range updates {
		// Convert camelCase to snake_case
		// Example: canDeleteTeachers -> can_delete_teachers
		snakeKey := camelCaseToSnakeCase.ReplaceAllString(key, `${1}_${2}`)
		snakeKey = strings.ToLower(snakeKey)
		converted[snakeKey] = value
	}

	return converted
}
