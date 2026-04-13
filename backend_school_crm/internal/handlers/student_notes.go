package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

// RegisterStudentNotesRoutes mounts notes, contact log, and per-student attendance.
//
//	GET  /students/:id/notes
//	POST /students/:id/notes
//	DELETE /students/:id/notes/:noteId
//	GET  /students/:id/contact-log
//	POST /students/:id/contact-log
//	DELETE /students/:id/contact-log/:logId
//	GET  /students/:id/attendance?year=&month=
func RegisterStudentNotesRoutes(
	router *gin.RouterGroup,
	notesSvc *service.StudentNotesService,
	attendanceSvc *service.AttendanceService,
	userService *service.UserService,
) {
	g := router.Group("/students/:id")

	g.GET("/notes", middleware.PermissionChecker(userService, "canViewStudents"), listNotes(notesSvc))
	g.POST("/notes", middleware.PermissionChecker(userService, "canEditStudents"), addNote(notesSvc, userService))
	g.DELETE("/notes/:noteId", middleware.PermissionChecker(userService, "canEditStudents"), deleteNote(notesSvc))

	g.GET("/contact-log", middleware.PermissionChecker(userService, "canViewStudents"), listContactLog(notesSvc))
	g.POST("/contact-log", middleware.PermissionChecker(userService, "canEditStudents"), addContactLog(notesSvc, userService))
	g.DELETE("/contact-log/:logId", middleware.PermissionChecker(userService, "canEditStudents"), deleteContactLog(notesSvc))

	g.GET("/attendance", middleware.PermissionChecker(userService, "canViewStudents"), getStudentAttendance(attendanceSvc))
}

func listNotes(svc *service.StudentNotesService) gin.HandlerFunc {
	return func(c *gin.Context) {
		studentID := c.Param("id")
		branchID := c.GetHeader("X-Branch-ID")
		if branchID == "" {
			branchID = c.Query("branchId")
		}
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		notes, err := svc.ListNotes(c.Request.Context(), branchID, studentID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, notes)
	}
}

func addNote(svc *service.StudentNotesService, userSvc *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		studentID := c.Param("id")
		branchID := c.GetHeader("X-Branch-ID")
		if branchID == "" {
			branchID = c.Query("branchId")
		}
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var req models.CreateStudentNoteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, _ := userSvc.GetByID(c.Request.Context(), userID)
		createdByName := ""
		if user != nil {
			createdByName = user.FullName
		}

		note, err := svc.AddNote(c.Request.Context(), branchID, studentID, req.Content, userID, createdByName)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, note)
	}
}

func deleteNote(svc *service.StudentNotesService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.GetHeader("X-Branch-ID")
		if branchID == "" {
			branchID = c.Query("branchId")
		}
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		noteID := c.Param("noteId")
		if err := svc.DeleteNote(c.Request.Context(), branchID, noteID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func listContactLog(svc *service.StudentNotesService) gin.HandlerFunc {
	return func(c *gin.Context) {
		studentID := c.Param("id")
		branchID := c.GetHeader("X-Branch-ID")
		if branchID == "" {
			branchID = c.Query("branchId")
		}
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		entries, err := svc.ListContactLog(c.Request.Context(), branchID, studentID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, entries)
	}
}

func addContactLog(svc *service.StudentNotesService, userSvc *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		studentID := c.Param("id")
		branchID := c.GetHeader("X-Branch-ID")
		if branchID == "" {
			branchID = c.Query("branchId")
		}
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var req models.CreateContactLogRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, _ := userSvc.GetByID(c.Request.Context(), userID)
		createdByName := ""
		if user != nil {
			createdByName = user.FullName
		}

		entry, err := svc.AddContactLog(c.Request.Context(), branchID, studentID, &req, userID, createdByName)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, entry)
	}
}

func deleteContactLog(svc *service.StudentNotesService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.GetHeader("X-Branch-ID")
		if branchID == "" {
			branchID = c.Query("branchId")
		}
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		logID := c.Param("logId")
		if err := svc.DeleteContactLog(c.Request.Context(), branchID, logID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func getStudentAttendance(svc *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		studentID := c.Param("id")

		var year, month int
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

		records, err := svc.GetByStudent(c.Request.Context(), studentID, year, month)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, records)
	}
}
