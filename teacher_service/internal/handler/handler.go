package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/teacher-service/internal/service"
)

type Handler struct {
	teachers *service.TeacherService
	salaries *service.SalaryService
}

func New(teachers *service.TeacherService, salaries *service.SalaryService) *Handler {
	return &Handler{teachers: teachers, salaries: salaries}
}

// requestBranchID resolves which branch a request targets: an explicit
// branchId query param wins (a manager/admin who legitimately administers
// several branches picks among them client-side — branch switching in the
// frontend does not reissue a JWT, so the token's own branch_id stays fixed
// to the user's home branch and can't be used to infer which branch they
// currently mean). Falls back to X-User-Branch-ID, set by api_gateway's
// JWTAuth middleware (and this service's own, see middleware.JWTAuth), when
// no explicit choice is given.
//
// Resolving a branch here is NOT an authorization decision — every caller
// of this function MUST also call requireBranchAccess (or the resource's
// own scoped fetch, e.g. GetByIDScoped, which checks branch match) before
// using the resolved value.
func requestBranchID(c *gin.Context) string {
	if v := c.Query("branchId"); v != "" {
		return v
	}
	return c.GetHeader("X-User-Branch-ID")
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
	salaries, err := h.salaries.GetByTeacher(c.Request.Context(), c.Param("teacherId"), branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": salaries})
}
