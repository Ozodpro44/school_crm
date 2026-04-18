package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/finance-service/internal/service"
)

type Handler struct {
	expenses *service.ExpenseService
	budgets  *service.BudgetService
}

func New(expenses *service.ExpenseService, budgets *service.BudgetService) *Handler {
	return &Handler{expenses: expenses, budgets: budgets}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	r.GET("/expenses", h.ListExpenses)
	r.POST("/expenses", h.CreateExpense)
	r.GET("/expenses/:id", h.GetExpense)
	r.PUT("/expenses/:id", h.UpdateExpense)
	r.DELETE("/expenses/:id", h.DeleteExpense)
	r.GET("/expenses/summary", h.ExpenseSummary)

	r.GET("/expense-budgets", h.ListBudgets)
	r.PUT("/expense-budgets", h.UpsertBudget)
	r.DELETE("/expense-budgets", h.DeleteBudget)
}

func (h *Handler) ListExpenses(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	page, _ := strconv.Atoi(c.Query("page"))
	limit, _ := strconv.Atoi(c.Query("limit"))
	resp, err := h.expenses.List(c.Request.Context(), service.ListFilter{
		BranchID:      branchID,
		Search:        c.Query("search"),
		Category:      c.Query("category"),
		PaymentMethod: c.Query("paymentMethod"),
		Month:         c.Query("month"),
		Year:          c.Query("year"),
		Page:          page,
		Limit:         limit,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) CreateExpense(c *gin.Context) {
	var body struct {
		Title         string    `json:"title"         binding:"required"`
		Description   string    `json:"description"`
		Amount        float64   `json:"amount"        binding:"required,gt=0"`
		Category      string    `json:"category"      binding:"required"`
		PaymentMethod string    `json:"paymentMethod" binding:"required"`
		Date          time.Time `json:"date"          binding:"required"`
		BranchID      string    `json:"branchId"      binding:"required"`
		Notes         *string   `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	createdBy := c.GetHeader("X-User-ID")
	e, err := h.expenses.Create(c.Request.Context(), &service.Expense{
		Title:         body.Title,
		Description:   body.Description,
		Amount:        body.Amount,
		Category:      body.Category,
		PaymentMethod: body.PaymentMethod,
		Date:          body.Date,
		BranchID:      body.BranchID,
		Notes:         body.Notes,
		CreatedBy:     &createdBy,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, e)
}

func (h *Handler) GetExpense(c *gin.Context) {
	e, err := h.expenses.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "expense not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, e)
}

func (h *Handler) UpdateExpense(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	e, err := h.expenses.Update(c.Request.Context(), c.Param("id"), body)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "expense not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, e)
}

func (h *Handler) DeleteExpense(c *gin.Context) {
	if err := h.expenses.Delete(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "expense deleted"})
}

func (h *Handler) ExpenseSummary(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	summary, err := h.expenses.Summary(c.Request.Context(), branchID, c.Query("month"), c.Query("year"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, summary)
}

// ── Budget handlers ────────────────────────────────────────────────────────────

func (h *Handler) ListBudgets(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	now := time.Now()
	month := c.DefaultQuery("month", now.Format("01"))
	yearStr := c.DefaultQuery("year", strconv.Itoa(now.Year()))
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year"})
		return
	}
	items, err := h.budgets.GetByBranch(c.Request.Context(), branchID, month, year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) UpsertBudget(c *gin.Context) {
	var req service.UpsertBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	entry, err := h.budgets.Upsert(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, entry)
}

func (h *Handler) DeleteBudget(c *gin.Context) {
	branchID := c.Query("branchId")
	category := c.Query("category")
	month := c.Query("month")
	yearStr := c.Query("year")
	if branchID == "" || category == "" || month == "" || yearStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId, category, month, year required"})
		return
	}
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year"})
		return
	}
	if err := h.budgets.Delete(c.Request.Context(), branchID, category, month, year); err != nil {
		if err.Error() == "budget not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "budget deleted"})
}
