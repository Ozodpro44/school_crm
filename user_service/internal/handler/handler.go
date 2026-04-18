package handler

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/user-service/internal/service"
)

type Handler struct {
	users       *service.UserService
	branches    *service.BranchService
	permissions *service.PermissionService
	db          *sql.DB
}

func New(
	users *service.UserService,
	branches *service.BranchService,
	permissions *service.PermissionService,
	rawDB *sql.DB,
) *Handler {
	return &Handler{users: users, branches: branches, permissions: permissions, db: rawDB}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	// Users
	r.GET("/users", h.ListUsers)
	r.GET("/users/:id", h.GetUser)
	r.PUT("/users/:id", h.UpdateUser)
	r.DELETE("/users/:id", h.DeleteUser)

	// Branches
	r.GET("/branches", h.ListBranches)
	r.POST("/branches", h.CreateBranch)
	r.GET("/branches/:id", h.GetBranch)
	r.PUT("/branches/:id", h.UpdateBranch)
	r.DELETE("/branches/:id", h.DeleteBranch)

	// Permissions
	r.GET("/permissions/:userId", h.GetPermissions)
	r.PUT("/permissions/:userId", h.UpdatePermissions)

	// Settings (thin wrapper around branches)
	r.GET("/settings", h.GetSettings)
	r.PUT("/settings", h.UpdateSettings)

	// Audit logs
	r.GET("/audit-logs", h.ListAuditLogs)
}

// ── Users ─────────────────────────────────────────────────────────────────────

func (h *Handler) ListUsers(c *gin.Context) {
	users, err := h.users.GetAll(c.Request.Context(), c.Query("branchId"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": users})
}

func (h *Handler) GetUser(c *gin.Context) {
	u, err := h.users.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *Handler) UpdateUser(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	u, err := h.users.Update(c.Request.Context(), c.Param("id"), body)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *Handler) DeleteUser(c *gin.Context) {
	if err := h.users.Delete(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "user deleted"})
}

// ── Branches ──────────────────────────────────────────────────────────────────

func (h *Handler) ListBranches(c *gin.Context) {
	adminID := c.Query("adminId")
	var (
		branches []service.Branch
		err      error
	)
	if adminID != "" {
		branches, err = h.branches.GetByAdminID(c.Request.Context(), adminID)
	} else {
		branches, err = h.branches.GetAll(c.Request.Context())
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": branches})
}

func (h *Handler) CreateBranch(c *gin.Context) {
	var body struct {
		Name           string  `json:"name"           binding:"required"`
		Address        string  `json:"address"        binding:"required"`
		Phone          string  `json:"phone"          binding:"required"`
		MonthlyPayment float64 `json:"monthlyPayment" binding:"required,gt=0"`
		AdminID        *string `json:"adminId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	b, err := h.branches.Create(c.Request.Context(), body.Name, body.Address, body.Phone, body.MonthlyPayment, body.AdminID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, b)
}

func (h *Handler) GetBranch(c *gin.Context) {
	b, err := h.branches.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, b)
}

func (h *Handler) UpdateBranch(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	b, err := h.branches.Update(c.Request.Context(), c.Param("id"), body)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, b)
}

func (h *Handler) DeleteBranch(c *gin.Context) {
	if err := h.branches.Delete(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "branch deleted"})
}

// ── Permissions ───────────────────────────────────────────────────────────────

func (h *Handler) GetPermissions(c *gin.Context) {
	p, err := h.permissions.GetByUserID(c.Request.Context(), c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no permissions found"})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) UpdatePermissions(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p, err := h.permissions.Upsert(c.Request.Context(), c.Param("userId"), body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

// ── Settings (branch-level config) ────────────────────────────────────────────

type settingsResponse struct {
	Name           string `json:"name"`
	MonthlyPayment float64 `json:"monthlyPayment"`
	Currency       string `json:"currency"`
	UpdatedDate    string `json:"updatedDate"`
	CreatedDate    string `json:"createdDate"`
}

func (h *Handler) GetSettings(c *gin.Context) {
	branchIDStr := c.Query("branchId")
	if branchIDStr == "" {
		branchIDStr = c.GetHeader("X-Branch-ID")
	}
	if branchIDStr == "" {
		if v, ok := c.Get("branch_id"); ok {
			branchIDStr, _ = v.(string)
		}
	}
	// No branchId at app init (admin hasn't selected a branch yet) — return
	// a default response so the frontend initializes without an error toast.
	if branchIDStr == "" {
		c.JSON(http.StatusOK, settingsResponse{Currency: "UZS"})
		return
	}
	b, err := h.branches.GetByID(c.Request.Context(), branchIDStr)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settingsResponse{
		Name:           b.Name,
		MonthlyPayment: b.MonthlyPayment,
		Currency:       b.Currency,
		UpdatedDate:    b.UpdatedAt.Format("2006-01-02 15:04:05"),
		CreatedDate:    b.CreatedAt.Format("2006-01-02 15:04:05"),
	})
}

func (h *Handler) UpdateSettings(c *gin.Context) {
	branchIDStr := c.Query("branchId")
	if branchIDStr == "" {
		if v, ok := c.Get("branch_id"); ok {
			branchIDStr, _ = v.(string)
		}
	}
	if branchIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	b, err := h.branches.Update(c.Request.Context(), branchIDStr, updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settingsResponse{
		Name:           b.Name,
		MonthlyPayment: b.MonthlyPayment,
		Currency:       b.Currency,
		UpdatedDate:    b.UpdatedAt.Format("2006-01-02 15:04:05"),
		CreatedDate:    b.CreatedAt.Format("2006-01-02 15:04:05"),
	})
}

// ── Audit logs ────────────────────────────────────────────────────────────────

type auditLogEntry struct {
	ID          string    `json:"id"`
	BranchID    *string   `json:"branchId"`
	UserID      *string   `json:"userId"`
	UserName    string    `json:"userName"`
	Action      string    `json:"action"`
	Resource    string    `json:"resource"`
	ResourceID  *string   `json:"resourceId"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (h *Handler) ListAuditLogs(c *gin.Context) {
	branchID := c.GetHeader("X-Branch-ID")
	if branchID == "" {
		branchID = c.Query("branchId")
	}
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "X-Branch-ID header or branchId query required"})
		return
	}

	resource := c.Query("resource")
	userID := c.Query("userId")
	from := c.Query("from")
	to := c.Query("to")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "25"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}
	offset := (page - 1) * limit

	where := " WHERE al.branch_id = $1 "
	args := []interface{}{branchID}
	idx := 2

	if resource != "" {
		where += " AND al.resource = $" + strconv.Itoa(idx)
		args = append(args, resource)
		idx++
	}
	if userID != "" {
		where += " AND al.user_id = $" + strconv.Itoa(idx)
		args = append(args, userID)
		idx++
	}
	if from != "" {
		where += " AND al.created_at >= $" + strconv.Itoa(idx)
		args = append(args, from)
		idx++
	}
	if to != "" {
		where += " AND al.created_at <= $" + strconv.Itoa(idx)
		args = append(args, to+"T23:59:59Z")
		idx++
	}

	var total int
	if err := h.db.QueryRowContext(c.Request.Context(), "SELECT COUNT(*) FROM audit_logs al"+where, args...).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	dataArgs := append([]interface{}{}, args...)
	dataArgs = append(dataArgs, limit, offset)

	rows, err := h.db.QueryContext(c.Request.Context(), `
		SELECT al.id,
		       al.branch_id::text,
		       al.user_id::text,
		       COALESCE(u.full_name, ''),
		       al.action,
		       al.resource,
		       al.resource_id::text,
		       al.description,
		       al.created_at
		FROM audit_logs al
		LEFT JOIN users u ON u.id = al.user_id
		`+where+`
		ORDER BY al.created_at DESC
		LIMIT $`+strconv.Itoa(idx)+` OFFSET $`+strconv.Itoa(idx+1),
		dataArgs...,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	entries := []auditLogEntry{}
	for rows.Next() {
		var e auditLogEntry
		var bid, uid, rid *string
		if err := rows.Scan(&e.ID, &bid, &uid, &e.UserName,
			&e.Action, &e.Resource, &rid, &e.Description, &e.CreatedAt); err != nil {
			continue
		}
		e.BranchID = bid
		e.UserID = uid
		e.ResourceID = rid
		entries = append(entries, e)
	}
	c.JSON(http.StatusOK, gin.H{
		"data":       entries,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": (total + limit - 1) / limit,
	})
}
