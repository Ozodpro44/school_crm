package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

// RegisterAssignmentRoutes mounts assignment endpoints.
//
//	GET    /assignments?branchId=&classId=         — list assignments
//	POST   /assignments                            — create
//	DELETE /assignments/:id                        — delete
//	GET    /assignments/:id/submissions            — list submissions for an assignment
//	PUT    /assignments/submissions/:subId         — grade / mark submitted
//	GET    /assignments/student/:studentId/progress — student progress report
func RegisterAssignmentRoutes(router *gin.RouterGroup, svc *service.AssignmentService, userService *service.UserService) {
	g := router.Group("/assignments")
	g.GET("", middleware.PermissionChecker(userService, "canViewStudents"), listAssignments(svc))
	g.POST("", middleware.PermissionChecker(userService, "canEditStudents"), createAssignment(svc))
	g.DELETE("/:id", middleware.PermissionChecker(userService, "canEditStudents"), deleteAssignment(svc))
	g.GET("/:id/submissions", middleware.PermissionChecker(userService, "canViewStudents"), getSubmissions(svc))
	g.PUT("/submissions/:subId", middleware.PermissionChecker(userService, "canEditStudents"), updateSubmission(svc))
	g.GET("/student/:studentId/progress", middleware.PermissionChecker(userService, "canViewStudents"), studentProgress(svc))
}

func listAssignments(svc *service.AssignmentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			branchID = c.GetHeader("X-Branch-ID")
		}
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}
		classID := c.Query("classId")
		assignments, err := svc.ListByBranch(c.Request.Context(), branchID, classID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, assignments)
	}
}

func createAssignment(svc *service.AssignmentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var req models.CreateAssignmentRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		a, err := svc.Create(c.Request.Context(), &req, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, a)
	}
}

func deleteAssignment(svc *service.AssignmentService) gin.HandlerFunc {
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

func getSubmissions(svc *service.AssignmentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		subs, err := svc.GetSubmissions(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, subs)
	}
}

func updateSubmission(svc *service.AssignmentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		subID := c.Param("subId")
		var req models.UpdateSubmissionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		sub, err := svc.UpdateSubmission(c.Request.Context(), subID, &req, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, sub)
	}
}

func studentProgress(svc *service.AssignmentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		studentID := c.Param("studentId")
		branchID := c.Query("branchId")
		if branchID == "" {
			branchID = c.GetHeader("X-Branch-ID")
		}
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}
		subs, err := svc.GetStudentProgress(c.Request.Context(), studentID, branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, subs)
	}
}
