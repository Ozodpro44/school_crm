package handler

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/student-service/internal/service"
)

type Handler struct {
	students    *service.StudentService
	classes     *service.ClassService
	attendance  *service.AttendanceService
	schedule    *service.ScheduleService
	assignments *service.AssignmentService
	notes       *service.StudentNotesService
}

func New(
	students *service.StudentService,
	classes *service.ClassService,
	attendance *service.AttendanceService,
	schedule *service.ScheduleService,
	assignments *service.AssignmentService,
	notes *service.StudentNotesService,
) *Handler {
	return &Handler{
		students:    students,
		classes:     classes,
		attendance:  attendance,
		schedule:    schedule,
		assignments: assignments,
		notes:       notes,
	}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	// Students — static sub-paths must be registered before :id wildcard
	r.GET("/students/consolidated/data", h.ConsolidatedData)
	r.GET("/students/search/with-payments", h.SearchWithPayments)
	r.GET("/students", h.ListStudents)
	r.POST("/students", h.CreateStudent)
	r.GET("/students/:id", h.GetStudent)
	r.PUT("/students/:id", h.UpdateStudent)
	r.DELETE("/students/:id", h.DeleteStudent)

	// Student notes & contact log (sub-resources under /students/:id)
	r.GET("/students/:id/notes", h.ListNotes)
	r.POST("/students/:id/notes", h.AddNote)
	r.DELETE("/students/:id/notes/:noteId", h.DeleteNote)
	r.GET("/students/:id/contact-log", h.ListContactLog)
	r.POST("/students/:id/contact-log", h.AddContactLog)
	r.DELETE("/students/:id/contact-log/:logId", h.DeleteContactLog)
	r.GET("/students/:id/attendance", h.GetStudentAttendanceByID)

	// Classes
	r.GET("/classes", h.ListClasses)
	r.POST("/classes", h.CreateClass)
	r.GET("/classes/:id", h.GetClass)
	r.PUT("/classes/:id", h.UpdateClass)
	r.DELETE("/classes/:id", h.DeleteClass)

	// Attendance — static sub-paths before :id wildcard
	r.GET("/attendance/summary", h.GetAttendanceSummary)
	r.GET("/attendance/alerts", h.GetAbsenceAlerts)
	r.GET("/attendance/student/:studentId", h.GetStudentAttendance)
	r.GET("/attendance", h.GetAttendance)
	r.POST("/attendance", h.SaveAttendance)
	r.POST("/attendance/bulk", h.SaveAttendance)

	// Schedule
	r.GET("/schedule", h.ListSchedule)
	r.POST("/schedule", h.UpsertSchedule)
	r.DELETE("/schedule/:id", h.DeleteSchedule)

	// Assignments
	r.GET("/assignments", h.ListAssignments)
	r.POST("/assignments", h.CreateAssignment)
	r.DELETE("/assignments/:id", h.DeleteAssignment)
	r.GET("/assignments/:id/submissions", h.GetSubmissions)
	r.PUT("/assignments/submissions/:subId", h.UpdateSubmission)
	r.GET("/assignments/student/:studentId/progress", h.StudentProgress)
}

// ── Students ──────────────────────────────────────────────────────────────────

func (h *Handler) ListStudents(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	classID := c.Query("classId")
	noClass := classID == "unassigned"
	if noClass {
		classID = ""
	}
	resp, err := h.students.List(c.Request.Context(), service.ListFilter{
		BranchID: branchID,
		Search:   c.Query("search"),
		Status:   c.Query("status"),
		ClassID:  classID,
		NoClass:  noClass,
		Page:     c.Query("page"),
		Limit:    c.Query("limit"),
		Cursor:   c.Query("cursor"),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) CreateStudent(c *gin.Context) {
	var body struct {
		FullName       string  `json:"fullName"       binding:"required"`
		Phone          string  `json:"phone"`
		ParentPhone    string  `json:"parentPhone"`
		ClassID        *string `json:"classId"`
		MonthlyPayment float64 `json:"monthlyPayment" binding:"required,gt=0"`
		Status         string  `json:"status"         binding:"required"`
		BranchID       string  `json:"branchId"       binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !h.requireBranchAccess(c, body.BranchID) {
		return
	}
	st, err := h.students.Create(c.Request.Context(), &service.Student{
		FullName:       body.FullName,
		Phone:          body.Phone,
		ParentPhone:    body.ParentPhone,
		ClassID:        body.ClassID,
		MonthlyPayment: body.MonthlyPayment,
		Status:         body.Status,
		BranchID:       body.BranchID,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.students.Audit(c.Request.Context(), body.BranchID, c.GetHeader("X-User-ID"), "create", "student", st.ID, "Student created: "+st.FullName)
	c.JSON(http.StatusCreated, st)
}

// requestBranchID resolves which branch a request targets: an explicit
// branchId query param wins (a manager/admin who legitimately administers
// several branches picks among them client-side — branch switching in the
// frontend does not reissue a JWT, so the token's own branch_id stays fixed
// to the user's home branch and can't be used to infer which branch they
// currently mean). Falls back to X-User-Branch-ID, set by api_gateway's
// JWTAuth middleware from the verified JWT, when no explicit choice is given.
//
// Resolving a branch here is NOT an authorization decision — every caller
// of this function MUST also call requireBranchAccess (or the resource's
// own scoped fetch, e.g. GetByIDScoped, which checks branch match) before
// using the resolved value. Trusting it on its own is exactly what the
// list endpoints in this file used to do — c.Query("branchId") straight
// into the DB filter — letting any authenticated caller of any role read
// another branch's data by editing the query string.
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
	allowed, err := h.students.HasBranchAccess(c.Request.Context(),
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

func (h *Handler) GetStudent(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	st, err := h.students.GetByIDScoped(c.Request.Context(), c.Param("id"), branchID)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "student not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, st)
}

func (h *Handler) UpdateStudent(c *gin.Context) {
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
	st, err := h.students.Update(c.Request.Context(), c.Param("id"), branchID, body)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "student not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.students.Audit(c.Request.Context(), st.BranchID, c.GetHeader("X-User-ID"), "update", "student", st.ID, "Student updated: "+st.FullName)
	c.JSON(http.StatusOK, st)
}

func (h *Handler) DeleteStudent(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	id := c.Param("id")
	st, _ := h.students.GetByIDScoped(c.Request.Context(), id, branchID)
	if err := h.students.Delete(c.Request.Context(), id, branchID); err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "student not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if st != nil {
		h.students.Audit(c.Request.Context(), st.BranchID, c.GetHeader("X-User-ID"), "delete", "student", id, "Student deleted: "+st.FullName)
	}
	c.JSON(http.StatusOK, gin.H{"message": "student deleted"})
}

// ── Classes ───────────────────────────────────────────────────────────────────

func (h *Handler) ListClasses(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	classes, err := h.classes.GetAll(c.Request.Context(), branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": classes})
}

func (h *Handler) CreateClass(c *gin.Context) {
	var body struct {
		Name      string  `json:"name"     binding:"required"`
		BranchID  string  `json:"branchId" binding:"required"`
		TeacherID *string `json:"teacherId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !h.requireBranchAccess(c, body.BranchID) {
		return
	}
	cl, err := h.classes.Create(c.Request.Context(), body.Name, body.BranchID, body.TeacherID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, cl)
}

func (h *Handler) GetClass(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	cl, err := h.classes.GetByIDScoped(c.Request.Context(), c.Param("id"), branchID)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "class not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cl)
}

func (h *Handler) UpdateClass(c *gin.Context) {
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
	cl, err := h.classes.Update(c.Request.Context(), c.Param("id"), branchID, body)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "class not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cl)
}

func (h *Handler) DeleteClass(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	if err := h.classes.Delete(c.Request.Context(), c.Param("id"), branchID); err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "class not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "class deleted"})
}

// ── Attendance ────────────────────────────────────────────────────────────────

// GetAttendance godoc
// GET /attendance?classId=&date=
func (h *Handler) GetAttendance(c *gin.Context) {
	classID := c.Query("classId")
	date := c.Query("date")
	if classID == "" || date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "classId and date are required"})
		return
	}
	records, err := h.attendance.GetByClassDate(c.Request.Context(), classID, date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if records == nil {
		records = []service.Attendance{}
	}
	c.JSON(http.StatusOK, records)
}

// SaveAttendance godoc
// POST /attendance  or  POST /attendance/bulk
func (h *Handler) SaveAttendance(c *gin.Context) {
	var req service.BulkAttendanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !h.requireBranchAccess(c, req.BranchID) {
		return
	}
	createdBy := c.GetHeader("X-User-ID")
	records, err := h.attendance.Save(c.Request.Context(), &req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"saved": len(records)})
}

// GetAttendanceSummary godoc
// GET /attendance/summary?classId=&year=&month=
func (h *Handler) GetAttendanceSummary(c *gin.Context) {
	classID := c.Query("classId")
	if classID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "classId is required"})
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
	var year, month int
	fmt.Sscanf(c.Query("year"), "%d", &year)
	fmt.Sscanf(c.Query("month"), "%d", &month)
	if year == 0 || month == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "year and month are required"})
		return
	}
	summary, err := h.attendance.GetMonthSummary(c.Request.Context(), classID, branchID, year, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if summary == nil {
		summary = []service.MonthSummary{}
	}
	c.JSON(http.StatusOK, summary)
}

// GetAbsenceAlerts godoc
// GET /attendance/alerts?branchId=
func (h *Handler) GetAbsenceAlerts(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	alerts, err := h.attendance.GetAbsenceAlerts(c.Request.Context(), branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if alerts == nil {
		alerts = []service.AbsenceAlert{}
	}
	c.JSON(http.StatusOK, alerts)
}

// GetStudentAttendance godoc
// GET /attendance/student/:studentId?month=&year=
func (h *Handler) GetStudentAttendance(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	var year int
	if y := c.Query("year"); y != "" {
		_, _ = fmt.Sscanf(y, "%d", &year)
	}
	records, err := h.attendance.GetByStudentMonth(c.Request.Context(),
		c.Param("studentId"), branchID, c.Query("month"), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": records})
}

// GetStudentAttendanceByID serves GET /students/:id/attendance?year=&month=
func (h *Handler) GetStudentAttendanceByID(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	var year int
	if y := c.Query("year"); y != "" {
		_, _ = fmt.Sscanf(y, "%d", &year)
	}
	records, err := h.attendance.GetByStudentMonth(c.Request.Context(),
		c.Param("id"), branchID, c.Query("month"), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, records)
}

// ── Schedule ──────────────────────────────────────────────────────────────────

func (h *Handler) ListSchedule(c *gin.Context) {
	classID := c.Query("classId")
	branchID := c.Query("branchId")
	if branchID == "" {
		branchID = c.GetHeader("X-Branch-ID")
	}
	if classID != "" {
		slots, err := h.schedule.GetByClass(c.Request.Context(), classID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, slots)
		return
	}
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId or classId required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	slots, err := h.schedule.GetByBranch(c.Request.Context(), branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, slots)
}

func (h *Handler) UpsertSchedule(c *gin.Context) {
	var req service.UpsertScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !h.requireBranchAccess(c, req.BranchID) {
		return
	}
	slot, err := h.schedule.Upsert(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, slot)
}

func (h *Handler) DeleteSchedule(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		branchID = c.GetHeader("X-Branch-ID")
	}
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	if err := h.schedule.Delete(c.Request.Context(), c.Param("id"), branchID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ── Assignments ───────────────────────────────────────────────────────────────

func (h *Handler) ListAssignments(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		branchID = c.GetHeader("X-Branch-ID")
	}
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	list, err := h.assignments.ListByBranch(c.Request.Context(), branchID, c.Query("classId"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) CreateAssignment(c *gin.Context) {
	var req service.CreateAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !h.requireBranchAccess(c, req.BranchID) {
		return
	}
	a, err := h.assignments.Create(c.Request.Context(), &req, c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, a)
}

func (h *Handler) DeleteAssignment(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		branchID = c.GetHeader("X-Branch-ID")
	}
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	if err := h.assignments.Delete(c.Request.Context(), c.Param("id"), branchID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) GetSubmissions(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	subs, err := h.assignments.GetSubmissions(c.Request.Context(), c.Param("id"), branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, subs)
}

func (h *Handler) UpdateSubmission(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	var req service.UpdateSubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sub, err := h.assignments.UpdateSubmission(c.Request.Context(),
		c.Param("subId"), branchID, &req, c.GetHeader("X-User-ID"))
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "submission not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sub)
}

func (h *Handler) StudentProgress(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		branchID = c.GetHeader("X-Branch-ID")
	}
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	subs, err := h.assignments.GetStudentProgress(c.Request.Context(), c.Param("studentId"), branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, subs)
}

// ── Consolidated & Search ─────────────────────────────────────────────────────

func (h *Handler) ConsolidatedData(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	result, err := h.students.ConsolidatedData(c.Request.Context(), service.ConsolidatedFilter{
		BranchID:      branchID,
		Page:          c.DefaultQuery("page", "1"),
		Limit:         c.DefaultQuery("limit", "10"),
		Cursor:        c.Query("cursor"),
		Search:        c.Query("search"),
		Status:        c.Query("status"),
		ClassID:       c.Query("classId"),
		PaymentStatus: c.Query("paymentStatus"),
		Month:         c.Query("month"),
		Year:          c.Query("year"),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) SearchWithPayments(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	year := 0
	if y := c.Query("year"); y != "" {
		_, _ = fmt.Sscanf(y, "%d", &year)
	}
	result, err := h.students.SearchWithPayments(
		c.Request.Context(),
		branchID,
		c.Query("search"),
		c.Query("month"),
		year,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search students"})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ── Student Notes ─────────────────────────────────────────────────────────────

func (h *Handler) ListNotes(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	notes, err := h.notes.ListNotes(c.Request.Context(), branchID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, notes)
}

func (h *Handler) AddNote(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	note, err := h.notes.AddNote(c.Request.Context(), branchID, c.Param("id"),
		req.Content, c.GetHeader("X-User-ID"), "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, note)
}

func (h *Handler) DeleteNote(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	if err := h.notes.DeleteNote(c.Request.Context(), branchID, c.Param("noteId")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) ListContactLog(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	entries, err := h.notes.ListContactLog(c.Request.Context(), branchID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, entries)
}

func (h *Handler) AddContactLog(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	var req service.CreateContactLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	entry, err := h.notes.AddContactLog(c.Request.Context(), branchID, c.Param("id"),
		&req, c.GetHeader("X-User-ID"), "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, entry)
}

func (h *Handler) DeleteContactLog(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	if err := h.notes.DeleteContactLog(c.Request.Context(), branchID, c.Param("logId")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
