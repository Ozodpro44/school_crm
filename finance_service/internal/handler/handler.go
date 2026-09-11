package handler

import (
	"errors"
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

// requestBranchID resolves which branch a request targets: an explicit
// branchId query param wins (a manager/admin who legitimately administers
// several branches picks among them client-side — branch switching in the
// frontend does not reissue a JWT, so the token's own branch_id stays fixed
// to the user's home branch and can't be used to infer which branch they
// currently mean). Falls back to X-Branch-ID, the frontend's currently-
// selected-branch header — NOT X-User-Branch-ID, which is the JWT's own
// fixed home-branch claim and is often empty for admin/developer accounts
// with no single home branch (using it here previously produced a spurious
// "branchId is required" for exactly those accounts).
//
// Resolving a branch here is NOT an authorization decision — every caller
// of this function MUST also call requireBranchAccess before using the
// resolved value.
func requestBranchID(c *gin.Context) string {
	if v := c.Query("branchId"); v != "" {
		return v
	}
	return c.GetHeader("X-Branch-ID")
}

// requireBranchAccess checks that the caller (identified by the
// JWT-verified X-User-ID/X-User-Role headers) is authorized for branchID —
// granted if it's their own branch, they're linked to it via
// branch_managers, they're its admin, or their role is developer/
// super_admin. Writes a response and returns false if not authorized.
func (h *Handler) requireBranchAccess(c *gin.Context, branchID string) bool {
	allowed, err := h.expenses.HasBranchAccess(c.Request.Context(),
		c.GetHeader("X-User-ID"), c.GetHeader("X-User-Role"), branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return false
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized for this branch"})
		return false
	}
	return true
}

// canDelete reports whether role may delete an expense — matches
// frontend_school_crm's DEFAULT_PERMISSIONS (only admin/branch_admin get
// canDeleteExpenses:true). Nothing server-side enforced this before; any
// role with branch access could call DELETE directly.
func canDelete(role string) bool {
	switch role {
	case "admin", "branch_admin", "developer", "super_admin":
		return true
	default:
		return false
	}
}

func (h *Handler) requireDeletePermission(c *gin.Context) bool {
	if !canDelete(c.GetHeader("X-User-Role")) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized to delete this resource"})
		return false
	}
	return true
}

func (h *Handler) Register(r *gin.RouterGroup) {
	r.GET("/expenses", h.ListExpenses)
	r.POST("/expenses", h.CreateExpense)
	// Static sub-paths must come before /:id
	r.GET("/expenses/consolidated/data", h.ConsolidatedData)
	r.GET("/expenses/summary", h.ExpenseSummary)
	r.GET("/expenses/:id", h.GetExpense)
	r.PUT("/expenses/:id", h.UpdateExpense)
	r.DELETE("/expenses/:id", h.DeleteExpense)

	r.GET("/expense-budgets", h.ListBudgets)
	r.PUT("/expense-budgets", h.UpsertBudget)
	r.DELETE("/expense-budgets", h.DeleteBudget)
}

func (h *Handler) ConsolidatedData(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	resp, err := h.expenses.ConsolidatedData(
		c.Request.Context(),
		branchID,
		c.Query("month"),
		c.Query("year"),
		c.Query("search"),
		c.Query("category"),
		c.Query("paymentMethod"),
		c.DefaultQuery("page", "1"),
		c.DefaultQuery("limit", "10"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) ListExpenses(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
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
	if !h.requireBranchAccess(c, body.BranchID) {
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
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	e, err := h.expenses.GetByIDScoped(c.Request.Context(), c.Param("id"), branchID)
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
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	e, err := h.expenses.Update(c.Request.Context(), c.Param("id"), branchID, body)
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
	if !h.requireDeletePermission(c) {
		return
	}
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	if err := h.expenses.Delete(c.Request.Context(), c.Param("id"), branchID); err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "expense not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "expense deleted"})
}

func (h *Handler) ExpenseSummary(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
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
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
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
	if !h.requireBranchAccess(c, req.BranchID) {
		return
	}
	entry, err := h.budgets.Upsert(c.Request.Context(), &req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidInput) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
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
	if !h.requireBranchAccess(c, branchID) {
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
