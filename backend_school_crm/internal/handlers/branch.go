package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

func RegisterBranchRoutes(router *gin.RouterGroup, branchService *service.BranchService, userService *service.UserService) {
	branches := router.Group("/branches")
	branches.POST("", createBranch(branchService))
	branches.GET("/:id", getBranch(branchService))
	branches.GET("", listBranches(branchService))
	branches.PUT("/:id", updateBranch(branchService))
	branches.DELETE("/:id", deleteBranch(branchService))

}

func createBranch(branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req service.CreateBranchRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		branch, err := branchService.Create(c.Request.Context(), &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, branch)
	}
}

func getBranch(branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		branch, err := branchService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, branch)
	}
}

func listBranches(branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branches, err := branchService.GetAll(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, branches)
	}
}

func updateBranch(branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		branch, err := branchService.Update(c.Request.Context(), id, updates)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, branch)
	}
}

func deleteBranch(branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := branchService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "branch deleted"})
	}
}


