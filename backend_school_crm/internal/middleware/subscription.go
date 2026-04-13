// Package middleware — subscription gating.
// SubscriptionGate blocks CRM API access for users whose subscription is
// inactive (expired, cancelled, pending_payment, etc.).
//
// Only the school owner (admin role) holds a subscription.
// Every other role — branch_admin, manager, accountant, teacher — inherits
// the school owner's subscription via the branch they belong to
// (branches.admin_id → school owner).
//
// The check is intentionally lightweight: a single COUNT query per request.
// Heavy plans-limit enforcement (max students, max classes, etc.) is done
// inside the relevant service layer when creating resources.
package middleware

import (
	"context"
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

		// Only the school owner (admin) holds a subscription.
		// All other roles must resolve to their school owner via the branch chain.
		ownerID := userID
		if user.Role != models.RoleAdmin {
			adminID, err := resolveSchoolOwnerID(c.Request.Context(), userSvc, user)
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

// resolveSchoolOwnerID returns the admin (school owner) user_id for the given
// user. It uses GetOwnerIDForUser which covers both users.branch_id (teachers,
// staff) and branch_managers (managers, branch_admins) in a single query.
func resolveSchoolOwnerID(ctx context.Context, userSvc *service.UserService, user *models.User) (string, error) {
	return userSvc.GetOwnerIDForUser(ctx, user.ID)
}
