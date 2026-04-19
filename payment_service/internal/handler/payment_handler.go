package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/payment-service/internal/service"
)

type PaymentHandler struct {
	svc *service.PaymentService
}

func NewPaymentHandler(svc *service.PaymentService) *PaymentHandler {
	return &PaymentHandler{svc: svc}
}

func (h *PaymentHandler) Register(r *gin.RouterGroup) {
	r.GET("/payments", h.List)
	r.POST("/payments", h.Create)
	// Static sub-paths must be registered before /:id wildcard
	r.POST("/payments/bulk", h.BulkCreate)
	r.GET("/payments/summary", h.Summary)
	r.GET("/payments/consolidated/data", h.ConsolidatedData)
	r.GET("/payments/search/students", h.SearchStudents)
	r.GET("/payments/student/:studentId/history", h.StudentHistory)
	r.GET("/payments/:id", h.GetByID)
	r.PUT("/payments/:id", h.Update)
	r.DELETE("/payments/:id", h.Delete)

	// Subscription endpoints (read-only; write path remains in monolith during P3)
	r.GET("/subscriptions", h.ListSubscriptions)
}

// List godoc
// GET /api/v1/payments?branchId=&month=&year=&status=&paymentMethod=&classId=&search=&page=&limit=&cursor=
func (h *PaymentHandler) List(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}

	resp, err := h.svc.List(c.Request.Context(), service.ListFilter{
		BranchID:      branchID,
		Month:         c.Query("month"),
		Year:          c.Query("year"),
		Status:        c.Query("status"),
		PaymentMethod: c.Query("paymentMethod"),
		ClassID:       c.Query("classId"),
		Search:        c.Query("search"),
		Page:          c.Query("page"),
		Limit:         c.Query("limit"),
		Cursor:        c.Query("cursor"),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// Create godoc
// POST /api/v1/payments
// Header: X-User-ID: <uuid>
func (h *PaymentHandler) Create(c *gin.Context) {
	var req service.CreatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdBy := c.GetHeader("X-User-ID")
	payment, err := h.svc.Create(c.Request.Context(), &req, createdBy)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.svc.Audit(c.Request.Context(), req.BranchID, createdBy, "create", "payment", payment.ID,
		"Payment created: "+payment.InvoiceNumber)
	c.JSON(http.StatusCreated, payment)
}

// GetByID godoc
// GET /api/v1/payments/:id
func (h *PaymentHandler) GetByID(c *gin.Context) {
	payment, err := h.svc.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, payment)
}

// Update godoc
// PUT /api/v1/payments/:id
func (h *PaymentHandler) Update(c *gin.Context) {
	var req service.UpdatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	payment, err := h.svc.Update(c.Request.Context(), c.Param("id"), &req)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.svc.Audit(c.Request.Context(), payment.BranchID, c.GetHeader("X-User-ID"), "update", "payment", payment.ID,
		"Payment updated: "+payment.InvoiceNumber)
	c.JSON(http.StatusOK, payment)
}

// Delete godoc
// DELETE /api/v1/payments/:id
func (h *PaymentHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	p, _ := h.svc.GetByID(c.Request.Context(), id)
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if p != nil {
		h.svc.Audit(c.Request.Context(), p.BranchID, c.GetHeader("X-User-ID"), "delete", "payment", id,
			"Payment deleted: "+p.InvoiceNumber)
	}
	c.JSON(http.StatusOK, gin.H{"message": "payment deleted"})
}

// BulkCreate godoc
// POST /api/v1/payments/bulk
// Body: { "defaultMethod": "cash", "entries": [...] }
func (h *PaymentHandler) BulkCreate(c *gin.Context) {
	var body struct {
		BranchID      string             `json:"branchId"      binding:"required"`
		DefaultMethod string             `json:"defaultMethod" binding:"required"`
		Entries       []service.BulkEntry `json:"entries"       binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdBy := c.GetHeader("X-User-ID")
	results := h.svc.BulkCreate(c.Request.Context(), body.BranchID, body.DefaultMethod, body.Entries, createdBy)
	c.JSON(http.StatusOK, gin.H{"results": results})
}

// Summary godoc
// GET /api/v1/payments/summary?branchId=&month=&year=
func (h *PaymentHandler) Summary(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	yearInt, _ := strconv.Atoi(c.Query("year"))

	summary, err := h.svc.Summary(c.Request.Context(), branchID, c.Query("month"), yearInt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, summary)
}

// StudentHistory godoc
// GET /api/v1/payments/student/:studentId/history
func (h *PaymentHandler) StudentHistory(c *gin.Context) {
	payments, err := h.svc.StudentHistory(c.Request.Context(), c.Param("studentId"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": payments})
}

// ConsolidatedData godoc
// GET /api/v1/payments/consolidated/data?branchId=&month=&year=&page=&limit=&search=&status=&paymentMethod=&classId=
func (h *PaymentHandler) ConsolidatedData(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	resp, err := h.svc.ConsolidatedData(
		c.Request.Context(),
		branchID,
		c.Query("month"),
		c.Query("year"),
		c.DefaultQuery("page", "1"),
		c.DefaultQuery("limit", "10"),
		c.Query("cursor"),
		c.Query("search"),
		c.Query("status"),
		c.Query("paymentMethod"),
		c.Query("classId"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// SearchStudents godoc
// GET /api/v1/payments/search/students?branchId=&search=&classId=&status=&paymentStatus=&limit=&offset=
func (h *PaymentHandler) SearchStudents(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "200"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.SearchStudents(c.Request.Context(), service.SearchStudentsFilter{
		BranchID:      branchID,
		Search:        c.Query("search"),
		ClassID:       c.Query("classId"),
		StudentStatus: c.Query("status"),
		PaymentStatus: c.Query("paymentStatus"),
		Limit:         limit,
		Offset:        offset,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// ListSubscriptions godoc
// GET /api/v1/subscriptions?branchId=&status=&page=&limit=
// P3 read-only proxy — queries the shared DB directly.
func (h *PaymentHandler) ListSubscriptions(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}

	subs, err := h.svc.ListSubscriptions(c.Request.Context(), branchID, c.Query("status"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": subs})
}
