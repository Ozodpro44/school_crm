// Package jobs provides a persistent job queue backed by PostgreSQL.
// Jobs survive server restarts — on startup any pending/running jobs are
// recovered and re-enqueued automatically.
package jobs

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
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
	defaultWorkers  = 4
	jobTTL          = 24 * time.Hour
	cleanupInterval = time.Hour
)

// Queue is the central job dispatcher backed by PostgreSQL.
type Queue struct {
	db        *db.Database
	ch        chan string // sends job IDs to workers
	reportSvc *service.ReportService
	logger    *slog.Logger
}

// New creates a Queue, recovers any pending/running jobs from the DB,
// and starts worker goroutines.
func New(database *db.Database, reportSvc *service.ReportService, logger *slog.Logger) *Queue {
	q := &Queue{
		db:        database,
		ch:        make(chan string, 256),
		reportSvc: reportSvc,
		logger:    logger,
	}
	for i := 0; i < defaultWorkers; i++ {
		go q.worker()
	}
	go q.cleaner()
	q.recover()
	return q
}

// recover re-enqueues jobs that were pending or running when the server last stopped.
func (q *Queue) recover() {
	rows, err := q.db.GetConn().QueryContext(context.Background(),
		`UPDATE background_jobs
		    SET status = 'pending', started_at = NULL
		  WHERE status IN ('pending','running')
		RETURNING id`)
	if err != nil {
		q.logger.Error("job recovery failed", slog.String("error", err.Error()))
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			q.enqueue(id)
			count++
		}
	}
	if count > 0 {
		q.logger.Info("recovered jobs on startup", slog.Int("count", count))
	}
}

// Submit persists a new job to the DB and enqueues it for processing.
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

	_, err = q.db.GetConn().ExecContext(context.Background(),
		`INSERT INTO background_jobs (id, type, status, payload, created_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		job.ID, string(job.Type), string(job.Status), json.RawMessage(data), job.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	q.enqueue(job.ID)
	q.logger.Info("job submitted", slog.String("job_id", job.ID), slog.String("type", string(jobType)))
	return job, nil
}

func (q *Queue) enqueue(id string) {
	select {
	case q.ch <- id:
	default:
		// Buffer full — job stays in DB as 'pending'; recovery will re-enqueue on restart.
	}
}

// Get returns the job with the given ID from the DB.
func (q *Queue) Get(id string) (*Job, bool) {
	row := q.db.GetConn().QueryRowContext(context.Background(),
		`SELECT id, type, status, payload, result, error, created_at, started_at, done_at
		   FROM background_jobs WHERE id = $1`, id)

	job, err := scanJob(row)
	if err != nil {
		return nil, false
	}
	return job, true
}

// ── Worker ────────────────────────────────────────────────────────────────────

func (q *Queue) worker() {
	for id := range q.ch {
		q.process(id)
	}
}

func (q *Queue) process(id string) {
	now := time.Now().UTC()
	_, err := q.db.GetConn().ExecContext(context.Background(),
		`UPDATE background_jobs SET status = 'running', started_at = $1 WHERE id = $2`,
		now, id)
	if err != nil {
		q.logger.Error("failed to mark job running", slog.String("job_id", id), slog.String("error", err.Error()))
		return
	}

	job, ok := q.Get(id)
	if !ok {
		return
	}

	q.logger.Info("job started", slog.String("job_id", id), slog.String("type", string(job.Type)))

	ctx, cancel := context.WithTimeout(context.Background(), db.BulkImportTimeout)
	defer cancel()

	result, execErr := q.execute(ctx, job)

	done := time.Now().UTC()
	if execErr != nil {
		_, _ = q.db.GetConn().ExecContext(context.Background(),
			`UPDATE background_jobs SET status = 'failed', error = $1, done_at = $2 WHERE id = $3`,
			execErr.Error(), done, id)
		q.logger.Error("job failed",
			slog.String("job_id", id),
			slog.String("type", string(job.Type)),
			slog.String("error", execErr.Error()),
		)
		return
	}

	resultJSON, _ := json.Marshal(result)
	_, _ = q.db.GetConn().ExecContext(context.Background(),
		`UPDATE background_jobs SET status = 'done', result = $1, done_at = $2 WHERE id = $3`,
		json.RawMessage(resultJSON), done, id)
	q.logger.Info("job done",
		slog.String("job_id", id),
		slog.String("type", string(job.Type)),
		slog.Duration("duration", done.Sub(now)),
	)
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
		res, err := q.db.GetConn().ExecContext(context.Background(),
			`DELETE FROM background_jobs WHERE status IN ('done','failed') AND done_at < $1`,
			cutoff)
		if err == nil {
			if n, _ := res.RowsAffected(); n > 0 {
				q.logger.Info("cleaned old jobs", slog.Int64("count", n))
			}
		}
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func scanJob(row *sql.Row) (*Job, error) {
	var j Job
	var errStr sql.NullString
	var startedAt, doneAt sql.NullTime
	var resultJSON []byte

	err := row.Scan(
		&j.ID, &j.Type, &j.Status, &j.Payload,
		&resultJSON, &errStr,
		&j.CreatedAt, &startedAt, &doneAt,
	)
	if err != nil {
		return nil, err
	}
	if len(resultJSON) > 0 {
		j.Result = json.RawMessage(resultJSON)
	}
	if errStr.Valid {
		j.Error = errStr.String
	}
	if startedAt.Valid {
		j.StartedAt = &startedAt.Time
	}
	if doneAt.Valid {
		j.DoneAt = &doneAt.Time
	}
	return &j, nil
}
