package handlers

import (
	"log"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

// DEPRECATED (P4): Routed by api_gateway to user_service. Kept as fallback until P5.5.
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

		callerRole := c.GetString("role")

		// Only admin and branch_admin can create users
		if callerRole != "admin" && callerRole != "branch_admin" {
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

		// branch_admin may only create managers, not other admins or branch_admins
		if callerRole == "branch_admin" && req.Role != "manager" {
			c.JSON(http.StatusForbidden, gin.H{"error": "branch_admin can only create manager accounts"})
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

		// Associate manager with branch using branch_managers table
		if user.Role == "manager" {
			branchID := req.BranchID
			// If no branchId provided, auto-assign to the caller's own branch
			if branchID == nil {
				adminBranch, branchErr := userService.GetAdminBranch(c.Request.Context(), userID)
				if branchErr != nil || adminBranch == nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "could not determine branch"})
					return
				}
				branchID = &adminBranch.ID
			}
			_, err = userService.AddBranchManager(c.Request.Context(), *branchID, user.ID)
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
		if c.GetString("role") != "admin" && userID != id {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Non-admin users must provide current_password when changing their password
		if c.GetString("role") != "admin" {
			if _, hasNewPwd := updates["password"]; hasNewPwd {
				cp, hasCurrent := updates["current_password"]
				if !hasCurrent || cp == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": "current_password is required to change password"})
					return
				}
			}
		}

		log.Printf("[updateUser] Updating user %s with data: %+v", id, updates)

		user, err := userService.Update(c.Request.Context(), id, updates)
		if err != nil {
			log.Printf("[updateUser] Error updating user: %v", err)
			if err.Error() == "current password is incorrect" {
				c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		log.Printf("[updateUser] Successfully updated user %s", id)
		c.JSON(http.StatusOK, user)
	}
}

func deleteUser(userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if _, err := middleware.GetUserID(c); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		// Only admin can delete users
		if c.GetString("role") != "admin" {
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
		if _, err := middleware.GetUserID(c); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		// Only admin can update user permissions
		if c.GetString("role") != "admin" {
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
