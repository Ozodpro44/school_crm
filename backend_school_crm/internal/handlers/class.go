package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

func RegisterClassRoutes(router *gin.RouterGroup, classService *service.ClassService) {
	classes := router.Group("/classes")
	classes.POST("", createClass(classService))
	classes.GET("/:id", getClass(classService))
	classes.GET("", listClasses(classService))
	classes.PUT("/:id", updateClass(classService))
	classes.DELETE("/:id", deleteClass(classService))
}

func createClass(classService *service.ClassService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req service.CreateClassRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		class, err := classService.Create(c.Request.Context(), &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, class)
	}
}

func getClass(classService *service.ClassService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		class, err := classService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, class)
	}
}

func listClasses(classService *service.ClassService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		classes, err := classService.GetByBranchID(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, classes)
	}
}

func updateClass(classService *service.ClassService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		class, err := classService.Update(c.Request.Context(), id, updates)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, class)
	}
}

func deleteClass(classService *service.ClassService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := classService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "class deleted"})
	}
}
