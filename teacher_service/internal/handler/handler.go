package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/teacher-service/internal/db"
	"github.com/school-crm/teacher-service/internal/service"
)

type Handler struct {
	teachers *service.TeacherService
	salaries *service.SalaryService
	db       *db.DB
}

func New(teachers *service.TeacherService, salaries *service.SalaryService, database *db.DB) *Handler {
	return &Handler{teachers: teachers, salaries: salaries, db: database}
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
// of this function MUST also call requireBranchAccess (or the resource's
// own scoped fetch, e.g. GetByIDScoped, which checks branch match) before
// using the resolved value.
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
	allowed, err := h.teachers.HasBranchAccess(c.Request.Context(),
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

// canDelete reports whether role may delete a teacher/salary record —
// matches frontend_school_crm's DEFAULT_PERMISSIONS (only admin/branch_admin
// get canDeleteTeachers/canDeleteSalaries:true). Nothing server-side
// enforced this before; any role with branch access could call DELETE
// directly regardless of what the frontend hides.
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

// requireViewSalariesPermission enforces permissions.can_view_salaries — the
// frontend already hides salary data/nav for roles without it, but nothing
// server-side checked before this, so a manager/accountant with
// can_view_salaries:false could still read every teacher's salary by calling
// this endpoint directly. Admin-like roles bypass (same set as canDelete
// above): an admin's own permissions row already has this true by
// construction (see auth_service's CompleteRegistration), and a
// developer/super_admin operator may have no row in this tenant's
// permissions table at all.
func (h *Handler) requireViewSalariesPermission(c *gin.Context) bool {
	role := c.GetHeader("X-User-Role")
	if canDelete(role) {
		return true
	}
	userID := c.GetHeader("X-User-ID")
	var allowed bool
	if userID == "" || h.db == nil {
		allowed = false
	} else if err := h.db.Conn().QueryRowContext(c.Request.Context(),
		`SELECT can_view_salaries FROM permissions WHERE user_id = $1`, userID,
	).Scan(&allowed); err != nil {
		allowed = false // no permissions row, or query error → deny by default
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return false
	}
	return true
}

func (h *Handler) Register(r *gin.RouterGroup) {
	// Teachers
	r.GET("/teachers", h.ListTeachers)
	r.POST("/teachers", h.CreateTeacher)
	r.GET("/teachers/:id", h.GetTeacher)
	r.PUT("/teachers/:id", h.UpdateTeacher)
	r.DELETE("/teachers/:id", h.DeleteTeacher)

	// Salaries
	r.GET("/salaries", h.ListSalaries)
	r.POST("/salaries", h.CreateSalary)
	r.PUT("/salaries/:id", h.UpdateSalary)
	r.DELETE("/salaries/:id", h.DeleteSalary)
	r.GET("/salaries/teacher/:teacherId", h.TeacherSalaryHistory)
}

// ── Teachers ──────────────────────────────────────────────────────────────────

func (h *Handler) ListTeachers(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	teachers, err := h.teachers.GetAll(c.Request.Context(), branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": teachers})
}

func (h *Handler) CreateTeacher(c *gin.Context) {
	var req service.CreateTeacherRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !h.requireBranchAccess(c, req.BranchID) {
		return
	}
	t, err := h.teachers.Create(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.teachers.Audit(c.Request.Context(), req.BranchID, c.GetHeader("X-User-ID"), "create", "teacher", t.ID, "Teacher created: "+t.FullName)
	c.JSON(http.StatusCreated, t)
}

func (h *Handler) GetTeacher(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	t, err := h.teachers.GetByIDScoped(c.Request.Context(), c.Param("id"), branchID)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "teacher not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, t)
}

func (h *Handler) UpdateTeacher(c *gin.Context) {
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
	t, err := h.teachers.Update(c.Request.Context(), c.Param("id"), branchID, body)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "teacher not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.teachers.Audit(c.Request.Context(), t.BranchID, c.GetHeader("X-User-ID"), "update", "teacher", t.ID, "Teacher updated: "+t.FullName)
	c.JSON(http.StatusOK, t)
}

func (h *Handler) DeleteTeacher(c *gin.Context) {
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
	id := c.Param("id")
	t, _ := h.teachers.GetByIDScoped(c.Request.Context(), id, branchID)
	if err := h.teachers.Delete(c.Request.Context(), id, branchID); err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "teacher not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if t != nil {
		h.teachers.Audit(c.Request.Context(), t.BranchID, c.GetHeader("X-User-ID"), "delete", "teacher", id, "Teacher deleted: "+t.FullName)
	}
	c.JSON(http.StatusOK, gin.H{"message": "teacher deleted"})
}

// ── Salaries ──────────────────────────────────────────────────────────────────

func (h *Handler) ListSalaries(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	if !h.requireViewSalariesPermission(c) {
		return
	}
	year, _ := strconv.Atoi(c.Query("year"))
	salaries, err := h.salaries.GetByBranch(c.Request.Context(), branchID, c.Query("month"), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": salaries})
}

func (h *Handler) CreateSalary(c *gin.Context) {
	var req service.CreateSalaryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !h.requireBranchAccess(c, req.BranchID) {
		return
	}
	sal, err := h.salaries.Create(c.Request.Context(), &req, c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.teachers.Audit(c.Request.Context(), req.BranchID, c.GetHeader("X-User-ID"), "create", "salary", sal.ID, "Salary created for teacher "+sal.TeacherID)
	c.JSON(http.StatusCreated, sal)
}

func (h *Handler) UpdateSalary(c *gin.Context) {
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
	sal, err := h.salaries.Update(c.Request.Context(), c.Param("id"), branchID, body)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "salary not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sal)
}

func (h *Handler) DeleteSalary(c *gin.Context) {
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
	if err := h.salaries.Delete(c.Request.Context(), c.Param("id"), branchID); err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "salary not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "salary deleted"})
}

func (h *Handler) TeacherSalaryHistory(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	if !h.requireViewSalariesPermission(c) {
		return
	}
	salaries, err := h.salaries.GetByTeacher(c.Request.Context(), c.Param("teacherId"), branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": salaries})
}
