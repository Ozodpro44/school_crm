package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

// RegisterScheduleRoutes mounts schedule endpoints.
//
//	GET    /schedule?branchId=&classId=  — list slots
//	POST   /schedule                     — upsert slot
//	DELETE /schedule/:id                 — delete slot
func RegisterScheduleRoutes(router *gin.RouterGroup, svc *service.ScheduleService, userService *service.UserService) {
	g := router.Group("/schedule")
	g.GET("", middleware.PermissionChecker(userService, "canViewClasses"), listSchedule(svc))
	g.POST("", middleware.PermissionChecker(userService, "canEditClasses"), upsertSchedule(svc))
	g.DELETE("/:id", middleware.PermissionChecker(userService, "canEditClasses"), deleteSchedule(svc))
}

func listSchedule(svc *service.ScheduleService) gin.HandlerFunc {
	return func(c *gin.Context) {
		classID := c.Query("classId")
		branchID := c.Query("branchId")
		if branchID == "" {
			branchID = c.GetHeader("X-Branch-ID")
		}

		var (
			slots []models.ScheduleSlot
			err   error
		)
		if classID != "" {
			slots, err = svc.GetByClass(c.Request.Context(), classID)
		} else if branchID != "" {
			slots, err = svc.GetByBranch(c.Request.Context(), branchID)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId or classId required"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, slots)
	}
}

func upsertSchedule(svc *service.ScheduleService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.UpsertScheduleSlotRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		slot, err := svc.Upsert(c.Request.Context(), &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, slot)
	}
}

func deleteSchedule(svc *service.ScheduleService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		branchID := c.Query("branchId")
		if branchID == "" {
			branchID = c.GetHeader("X-Branch-ID")
		}
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}
		if err := svc.Delete(c.Request.Context(), id, branchID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
