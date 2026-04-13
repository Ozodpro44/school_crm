package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

// RegisterAttendanceRoutes mounts all /attendance endpoints.
// All routes require auth + active subscription (caller provides the group).
//
//	POST /attendance                       — bulk save (upsert) for a class+date
//	GET  /attendance?classId=&date=        — fetch records for a class on a date
//	GET  /attendance/summary?classId=&year=&month= — monthly stats per student
//	GET  /attendance/alerts?branchId=      — students with 3+ consecutive absences
func RegisterAttendanceRoutes(router *gin.RouterGroup, svc *service.AttendanceService, userService *service.UserService) {
	g := router.Group("/attendance")
	g.POST("", middleware.PermissionChecker(userService, "canCreatePayments"), saveAttendance(svc))
	g.GET("", middleware.PermissionChecker(userService, "canViewStudents"), getAttendance(svc))
	g.GET("/summary", middleware.PermissionChecker(userService, "canViewStudents"), getMonthSummary(svc))
	g.GET("/alerts", middleware.PermissionChecker(userService, "canViewStudents"), getAbsenceAlerts(svc))
}

func saveAttendance(svc *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var req models.BulkAttendanceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		records, err := svc.Save(c.Request.Context(), &req, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if records == nil {
			records = []models.Attendance{}
		}
		c.JSON(http.StatusOK, gin.H{"records": records, "saved": len(records)})
	}
}

func getAttendance(svc *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		classID := c.Query("classId")
		date := c.Query("date")

		if classID == "" || date == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "classId and date are required"})
			return
		}

		records, err := svc.GetByClassAndDate(c.Request.Context(), classID, date)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if records == nil {
			records = []models.Attendance{}
		}
		c.JSON(http.StatusOK, records)
	}
}

func getMonthSummary(svc *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		classID := c.Query("classId")
		if classID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "classId required"})
			return
		}

		now := time.Now()
		year := now.Year()
		month := int(now.Month())

		if y := c.Query("year"); y != "" {
			if v, err := strconv.Atoi(y); err == nil {
				year = v
			}
		}
		if m := c.Query("month"); m != "" {
			if v, err := strconv.Atoi(m); err == nil {
				month = v
			}
		}

		summaries, err := svc.GetStudentMonthSummary(c.Request.Context(), classID, year, month)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if summaries == nil {
			summaries = []models.AttendanceStudentSummary{}
		}
		c.JSON(http.StatusOK, summaries)
	}
}

func getAbsenceAlerts(svc *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		alerts, err := svc.GetConsecutiveAbsences(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if alerts == nil {
			alerts = []models.AttendanceStudentSummary{}
		}
		c.JSON(http.StatusOK, alerts)
	}
}
