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
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
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
	t, err := h.teachers.Create(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.teachers.Audit(c.Request.Context(), req.BranchID, c.GetHeader("X-User-ID"), "create", "teacher", t.ID, "Teacher created: "+t.FullName)
	c.JSON(http.StatusCreated, t)
}

func (h *Handler) GetTeacher(c *gin.Context) {
	t, err := h.teachers.GetByID(c.Request.Context(), c.Param("id"))
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
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	t, err := h.teachers.Update(c.Request.Context(), c.Param("id"), body)
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
	id := c.Param("id")
	t, _ := h.teachers.GetByID(c.Request.Context(), id)
	if err := h.teachers.Delete(c.Request.Context(), id); err != nil {
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
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
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
	sal, err := h.salaries.Create(c.Request.Context(), &req, c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.teachers.Audit(c.Request.Context(), req.BranchID, c.GetHeader("X-User-ID"), "create", "salary", sal.ID, "Salary created for teacher "+sal.TeacherID)
	c.JSON(http.StatusCreated, sal)
}

func (h *Handler) UpdateSalary(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sal, err := h.salaries.Update(c.Request.Context(), c.Param("id"), body)
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
	if err := h.salaries.Delete(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "salary deleted"})
}

func (h *Handler) TeacherSalaryHistory(c *gin.Context) {
	salaries, err := h.salaries.GetByTeacher(c.Request.Context(), c.Param("teacherId"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": salaries})
}
