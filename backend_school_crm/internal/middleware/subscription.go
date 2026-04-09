// Package middleware — subscription gating.
// SubscriptionGate blocks CRM API access for users whose subscription is
// inactive (expired, cancelled, pending_payment, etc.).
//
// Admins and branch_admins are checked against their own subscription.
// Other roles (manager, accountant, teacher) inherit the admin's subscription
// for the branch they belong to.
//
// The check is intentionally lightweight: a single COUNT query per request.
// Heavy plans-limit enforcement (max students, max classes, etc.) is done
// inside the relevant service layer when creating resources.
package middleware

import (
	"context"
	"database/sql"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

// SubscriptionGate returns a middleware that enforces subscription validity.
// userService is used to resolve the user's role and branch admin chain.
// subscriptionService performs the lightweight active-check query.
func SubscriptionGate(userSvc *service.UserService, subSvc *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		user, err := userSvc.GetByID(c.Request.Context(), userID)
		if err != nil || user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			c.Abort()
			return
		}

		// Global admin is always allowed (platform operator).
		if user.Role == models.RoleAdmin {
			c.Next()
			return
		}

		// Determine which user_id to check the subscription against.
		// For branch staff: use the branch admin's user_id.
		ownerID := userID
		if user.Role != models.RoleBranchAdmin {
			adminID, err := resolveBranchAdminID(c.Request.Context(), userSvc, user)
			if err == nil && adminID != "" {
				ownerID = adminID
			}
		}

		active, err := subSvc.IsUserSubscriptionActive(c.Request.Context(), ownerID)
		if err != nil {
			// On DB error, fail open with a warning rather than blocking all users.
			log.Printf("[SubscriptionGate] Error checking subscription for user %s: %v — allowing request", ownerID, err)
			c.Next()
			return
		}

		if !active {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error":  "subscription_required",
				"detail": "No active subscription. Please subscribe or renew your plan to continue.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// resolveBranchAdminID walks from the user's branch to the branch admin user_id.
func resolveBranchAdminID(ctx context.Context, userSvc *service.UserService, user *models.User) (string, error) {
	if user.BranchID == nil {
		return "", nil
	}
	adminID, err := userSvc.GetBranchAdminID(ctx, *user.BranchID)
	if err == sql.ErrNoRows || adminID == "" {
		return "", nil
	}
	return adminID, err
}
