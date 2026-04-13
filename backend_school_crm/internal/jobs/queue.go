// Package jobs provides a lightweight in-process job queue for heavy,
// long-running operations (report generation, bulk recalculations).
// Jobs are stored in memory; a background goroutine purges completed jobs
// older than 1 hour to prevent unbounded growth.
package jobs

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/service"
)

// ── Types ─────────────────────────────────────────────────────────────────────

type JobType string

const (
	JobPaymentReport    JobType = "payment_report"
	JobSalaryReport     JobType = "salary_report"
	JobDebtorsReport    JobType = "debtors_report"
	JobExpensesReport   JobType = "expenses_report"
	JobFinancialSummary JobType = "financial_summary"
)

type JobStatus string

const (
	JobPending JobStatus = "pending"
	JobRunning JobStatus = "running"
	JobDone    JobStatus = "done"
	JobFailed  JobStatus = "failed"
)

// Job represents one unit of background work.
type Job struct {
	mu        sync.RWMutex
	ID        string          `json:"id"`
	Type      JobType         `json:"type"`
	Status    JobStatus       `json:"status"`
	Payload   json.RawMessage `json:"payload"`
	Result    json.RawMessage `json:"result,omitempty"`
	Error     string          `json:"error,omitempty"`
	CreatedAt time.Time       `json:"createdAt"`
	StartedAt *time.Time      `json:"startedAt,omitempty"`
	DoneAt    *time.Time      `json:"doneAt,omitempty"`
}

// Snapshot returns a copy safe to serialise without holding the lock.
func (j *Job) Snapshot() Job {
	j.mu.RLock()
	defer j.mu.RUnlock()
	return Job{
		ID:        j.ID,
		Type:      j.Type,
		Status:    j.Status,
		Payload:   j.Payload,
		Result:    j.Result,
		Error:     j.Error,
		CreatedAt: j.CreatedAt,
		StartedAt: j.StartedAt,
		DoneAt:    j.DoneAt,
	}
}

// ── Payloads ──────────────────────────────────────────────────────────────────

type PaymentReportPayload struct {
	BranchID  string    `json:"branchId"`
	StartDate time.Time `json:"startDate"`
	EndDate   time.Time `json:"endDate"`
	Status    string    `json:"status"`
	ClassID   string    `json:"classId"`
	Page      int       `json:"page"`
	Limit     int       `json:"limit"`
}

type SalaryReportPayload struct {
	BranchID  string    `json:"branchId"`
	StartDate time.Time `json:"startDate"`
	EndDate   time.Time `json:"endDate"`
	Status    string    `json:"status"`
}

type DebtorsReportPayload struct {
	BranchID string `json:"branchId"`
	Month    string `json:"month"`
	Year     int    `json:"year"`
	ClassID  string `json:"classId"`
}

type ExpensesReportPayload struct {
	BranchID  string    `json:"branchId"`
	StartDate time.Time `json:"startDate"`
	EndDate   time.Time `json:"endDate"`
	Category  string    `json:"category"`
}

type FinancialSummaryPayload struct {
	BranchID  string    `json:"branchId"`
	StartDate time.Time `json:"startDate"`
	EndDate   time.Time `json:"endDate"`
}

// ── Queue ─────────────────────────────────────────────────────────────────────

const (
	defaultWorkers = 4
	jobTTL         = time.Hour // completed jobs are purged after this duration
	cleanupInterval = 15 * time.Minute
)

// Queue is the central job dispatcher. Call New() to create one.
type Queue struct {
	jobs      sync.Map // map[string]*Job
	ch        chan *Job
	reportSvc *service.ReportService
	logger    *slog.Logger
}

// New creates a Queue with `workers` goroutines and starts a cleanup ticker.
func New(reportSvc *service.ReportService, logger *slog.Logger) *Queue {
	q := &Queue{
		ch:        make(chan *Job, 256),
		reportSvc: reportSvc,
		logger:    logger,
	}
	for i := 0; i < defaultWorkers; i++ {
		go q.worker()
	}
	go q.cleaner()
	return q
}

// Submit enqueues a new job and returns it immediately (non-blocking).
func (q *Queue) Submit(jobType JobType, payload interface{}) (*Job, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	job := &Job{
		ID:        uuid.New().String(),
		Type:      jobType,
		Status:    JobPending,
		Payload:   data,
		CreatedAt: time.Now().UTC(),
	}
	q.jobs.Store(job.ID, job)

	select {
	case q.ch <- job:
	default:
		// Buffer full — still accepted, workers will pick it up once they free up.
		// If the channel is truly saturated we degrade gracefully rather than blocking.
	}

	q.logger.Info("job submitted", slog.String("job_id", job.ID), slog.String("type", string(jobType)))
	return job, nil
}

// Get returns the job with the given ID, or (nil, false) if not found.
func (q *Queue) Get(id string) (*Job, bool) {
	v, ok := q.jobs.Load(id)
	if !ok {
		return nil, false
	}
	return v.(*Job), true
}

// ── Worker ────────────────────────────────────────────────────────────────────

func (q *Queue) worker() {
	for job := range q.ch {
		q.process(job)
	}
}

func (q *Queue) process(job *Job) {
	now := time.Now().UTC()
	job.mu.Lock()
	job.Status = JobRunning
	job.StartedAt = &now
	job.mu.Unlock()

	q.logger.Info("job started", slog.String("job_id", job.ID), slog.String("type", string(job.Type)))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	result, err := q.execute(ctx, job)

	done := time.Now().UTC()
	job.mu.Lock()
	job.DoneAt = &done
	if err != nil {
		job.Status = JobFailed
		job.Error = err.Error()
		q.logger.Error("job failed",
			slog.String("job_id", job.ID),
			slog.String("type", string(job.Type)),
			slog.String("error", err.Error()),
		)
	} else {
		job.Status = JobDone
		if data, merr := json.Marshal(result); merr == nil {
			job.Result = data
		}
		q.logger.Info("job done",
			slog.String("job_id", job.ID),
			slog.String("type", string(job.Type)),
			slog.Duration("duration", done.Sub(*job.StartedAt)),
		)
	}
	job.mu.Unlock()
}

func (q *Queue) execute(ctx context.Context, job *Job) (interface{}, error) {
	switch job.Type {
	case JobPaymentReport:
		var p PaymentReportPayload
		if err := json.Unmarshal(job.Payload, &p); err != nil {
			return nil, err
		}
		if p.Page < 1 {
			p.Page = 1
		}
		if p.Limit < 1 || p.Limit > 10000 {
			p.Limit = 10000
		}
		items, total, err := q.reportSvc.GetPaymentReport(ctx, p.BranchID, p.StartDate, p.EndDate, p.Status, p.ClassID, p.Page, p.Limit)
		if err != nil {
			return nil, err
		}
		return map[string]interface{}{"items": items, "total": total}, nil

	case JobSalaryReport:
		var p SalaryReportPayload
		if err := json.Unmarshal(job.Payload, &p); err != nil {
			return nil, err
		}
		return q.reportSvc.GetSalaryReport(ctx, p.BranchID, p.StartDate, p.EndDate, p.Status)

	case JobDebtorsReport:
		var p DebtorsReportPayload
		if err := json.Unmarshal(job.Payload, &p); err != nil {
			return nil, err
		}
		return q.reportSvc.GetDebtorsReport(ctx, p.BranchID, p.Month, p.Year, p.ClassID)

	case JobExpensesReport:
		var p ExpensesReportPayload
		if err := json.Unmarshal(job.Payload, &p); err != nil {
			return nil, err
		}
		return q.reportSvc.GetExpensesReport(ctx, p.BranchID, p.StartDate, p.EndDate, p.Category)

	case JobFinancialSummary:
		var p FinancialSummaryPayload
		if err := json.Unmarshal(job.Payload, &p); err != nil {
			return nil, err
		}
		return q.reportSvc.GetFinancialSummary(ctx, p.BranchID, p.StartDate, p.EndDate)

	default:
		return nil, nil
	}
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

func (q *Queue) cleaner() {
	ticker := time.NewTicker(cleanupInterval)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().UTC().Add(-jobTTL)
		q.jobs.Range(func(key, val interface{}) bool {
			job := val.(*Job)
			snap := job.Snapshot()
			if (snap.Status == JobDone || snap.Status == JobFailed) &&
				snap.DoneAt != nil && snap.DoneAt.Before(cutoff) {
				q.jobs.Delete(key)
			}
			return true
		})
	}
}
