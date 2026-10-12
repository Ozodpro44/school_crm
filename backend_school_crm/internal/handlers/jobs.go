package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/jobs"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

// RegisterJobRoutes mounts job submission and polling endpoints.
// POST /api/jobs        — submit a background job
// GET  /api/jobs/:id   — poll job status / fetch result
func RegisterJobRoutes(router *gin.RouterGroup, queue *jobs.Queue, userService *service.UserService) {
	router.POST("/jobs", submitJob(queue, userService))
	router.GET("/jobs/:id", getJob(queue, userService))
}

// submitJobRequest is the unified request body for all job types.
type submitJobRequest struct {
	Type      jobs.JobType `json:"type" binding:"required"`
	BranchID  string       `json:"branchId"`
	StartDate *time.Time   `json:"startDate"`
	EndDate   *time.Time   `json:"endDate"`
	Month     string       `json:"month"`
	Year      int          `json:"year"`
	Status    string       `json:"status"`
	ClassID   string       `json:"classId"`
	Category  string       `json:"category"`
	Page      int          `json:"page"`
	Limit     int          `json:"limit"`
}

func submitJob(queue *jobs.Queue, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req submitJobRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if !middleware.EnsureBranchAccess(c, userService, req.BranchID) {
			return
		}

		var (
			job *jobs.Job
			err error
		)

		switch req.Type {
		case jobs.JobPaymentReport:
			if req.StartDate == nil || req.EndDate == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "startDate and endDate are required for payment_report"})
				return
			}
			job, err = queue.Submit(req.Type, jobs.PaymentReportPayload{
				BranchID:  req.BranchID,
				StartDate: *req.StartDate,
				EndDate:   *req.EndDate,
				Status:    req.Status,
				ClassID:   req.ClassID,
				Page:      req.Page,
				Limit:     req.Limit,
			})

		case jobs.JobSalaryReport:
			if req.StartDate == nil || req.EndDate == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "startDate and endDate are required for salary_report"})
				return
			}
			job, err = queue.Submit(req.Type, jobs.SalaryReportPayload{
				BranchID:  req.BranchID,
				StartDate: *req.StartDate,
				EndDate:   *req.EndDate,
				Status:    req.Status,
			})

		case jobs.JobDebtorsReport:
			if req.Month == "" || req.Year == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "month and year are required for debtors_report"})
				return
			}
			job, err = queue.Submit(req.Type, jobs.DebtorsReportPayload{
				BranchID: req.BranchID,
				Month:    req.Month,
				Year:     req.Year,
				ClassID:  req.ClassID,
			})

		case jobs.JobExpensesReport:
			if req.StartDate == nil || req.EndDate == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "startDate and endDate are required for expenses_report"})
				return
			}
			job, err = queue.Submit(req.Type, jobs.ExpensesReportPayload{
				BranchID:  req.BranchID,
				StartDate: *req.StartDate,
				EndDate:   *req.EndDate,
				Category:  req.Category,
			})

		case jobs.JobFinancialSummary:
			if req.StartDate == nil || req.EndDate == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "startDate and endDate are required for financial_summary"})
				return
			}
			job, err = queue.Submit(req.Type, jobs.FinancialSummaryPayload{
				BranchID:  req.BranchID,
				StartDate: *req.StartDate,
				EndDate:   *req.EndDate,
			})

		default:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "unknown job type",
				"valid_types": []string{
					string(jobs.JobPaymentReport),
					string(jobs.JobSalaryReport),
					string(jobs.JobDebtorsReport),
					string(jobs.JobExpensesReport),
					string(jobs.JobFinancialSummary),
				},
			})
			return
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to submit job: " + err.Error()})
			return
		}

		c.JSON(http.StatusAccepted, gin.H{
			"job_id":     job.ID,
			"status":     job.Status,
			"created_at": job.CreatedAt,
		})
	}
}

func getJob(queue *jobs.Queue, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		job, ok := queue.Get(id)
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
			return
		}

		// Job results are branch financial data: only members of the branch
		// named in the job payload may poll them.
		var owner struct {
			BranchID string `json:"branchId"`
		}
		_ = json.Unmarshal(job.Payload, &owner)
		callerID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		allowed := false
		if owner.BranchID != "" {
			allowed, err = userService.BelongsToBranch(c.Request.Context(), callerID, owner.BranchID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error verifying branch access"})
				return
			}
		}
		if !allowed {
			c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
			return
		}

		resp := gin.H{
			"job_id":     job.ID,
			"type":       job.Type,
			"status":     job.Status,
			"created_at": job.CreatedAt,
			"started_at": job.StartedAt,
			"done_at":    job.DoneAt,
		}
		if job.Error != "" {
			resp["error"] = job.Error
		}
		if job.Status == jobs.JobDone && job.Result != nil {
			resp["result"] = job.Result
		}

		httpStatus := http.StatusOK
		if job.Status == jobs.JobPending || job.Status == jobs.JobRunning {
			httpStatus = http.StatusAccepted // 202 tells the client to keep polling
		}
		c.JSON(httpStatus, resp)
	}
}
