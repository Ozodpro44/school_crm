package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

func RegisterPaymentRoutes(router *gin.RouterGroup, paymentService *service.PaymentService) {
	payments := router.Group("/payments")
	payments.POST("", createPayment(paymentService))
	payments.GET("/:id", getPayment(paymentService))
	payments.GET("", listPayments(paymentService))
	payments.PUT("/:id", updatePayment(paymentService))
	payments.DELETE("/:id", deletePayment(paymentService))
	payments.GET("/branch/:branchId/summary", getPaymentSummary(paymentService))
}

func createPayment(paymentService *service.PaymentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var req service.CreatePaymentRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payment, err := paymentService.Create(c.Request.Context(), &req, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, payment)
	}
}

func getPayment(paymentService *service.PaymentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		payment, err := paymentService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, payment)
	}
}

func listPayments(paymentService *service.PaymentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		studentID := c.Query("studentId")
		month := c.Query("month")
		year := c.Query("year")

		if branchID != "" {
			payments, err := paymentService.GetByBranchID(c.Request.Context(), branchID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, payments)
			return
		}

		if studentID != "" && month != "" && year != "" {
			var yearInt int
			if _, err := c.Cookie("year"); err == nil {
				// Parse year from query
			}
			payments, err := paymentService.GetByStudentIDAndPeriod(c.Request.Context(), studentID, month, yearInt)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, payments)
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId or (studentId, month, year) required"})
	}
}

func updatePayment(paymentService *service.PaymentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payment, err := paymentService.Update(c.Request.Context(), id, updates)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, payment)
	}
}

func deletePayment(paymentService *service.PaymentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := paymentService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "payment deleted"})
	}
}

func getPaymentSummary(paymentService *service.PaymentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Param("branchId")

		summary, err := paymentService.GetPaymentSummary(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, summary)
	}
}
