package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

// RegisterPaymentTypePublicRoutes registers the public read-only endpoint.
// No auth required so the school billing UI can load active types.
func RegisterPaymentTypePublicRoutes(router *gin.RouterGroup, svc *service.PaymentTypeService) {
	router.GET("/payment-types", func(c *gin.Context) {
		pts, err := svc.GetActive(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, pts)
	})
}

// RegisterPaymentTypeDevRoutes registers full CRUD under DevAuthMiddleware.
func RegisterPaymentTypeDevRoutes(router *gin.RouterGroup, svc *service.PaymentTypeService) {
	g := router.Group("/dev/payment-types")

	// GET /dev/payment-types — all types including inactive
	g.GET("", func(c *gin.Context) {
		pts, err := svc.GetAll(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, pts)
	})

	// POST /dev/payment-types — create
	g.POST("", func(c *gin.Context) {
		var req models.CreatePaymentTypeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		pt, err := svc.Create(c.Request.Context(), &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, pt)
	})

	// PATCH /dev/payment-types/:id — partial update
	g.PATCH("/:id", func(c *gin.Context) {
		id := c.Param("id")
		var req models.UpdatePaymentTypeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		pt, err := svc.Update(c.Request.Context(), id, &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if pt == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "payment type not found"})
			return
		}
		c.JSON(http.StatusOK, pt)
	})

	// POST /dev/payment-types/:id/toggle — flip active flag
	g.POST("/:id/toggle", func(c *gin.Context) {
		id := c.Param("id")
		pt, err := svc.ToggleActive(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if pt == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "payment type not found"})
			return
		}
		c.JSON(http.StatusOK, pt)
	})

	// DELETE /dev/payment-types/:id — only non-system types
	g.DELETE("/:id", func(c *gin.Context) {
		id := c.Param("id")
		if err := svc.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "payment type deleted"})
	})
}
