package service_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/testhelpers"
)

// createTestTeacher is a helper that inserts a minimal teacher and returns its ID.
func createTestTeacher(t *testing.T, teacherSvc *service.TeacherService, branchID string) string {
	t.Helper()
	req := &service.CreateTeacherRequest{
		FullName:      "Salary Test Teacher",
		MonthlySalary: 3000000,
		Phone:         "+998901234567",
		Email:         fmt.Sprintf("salary-teacher-%d@example.com", time.Now().UnixNano()),
		BranchID:      branchID,
	}
	teacher, err := teacherSvc.Create(context.Background(), req)
	if err != nil {
		t.Fatalf("createTestTeacher: %v", err)
	}
	return teacher.ID
}

func TestSalaryService_CreateAndGet(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	teacherSvc := service.NewTeacherService(database)
	// nil branchSvc skips the financial-month lock guard.
	svc := service.NewSalaryService(database, nil)

	branchID := createTestBranch(t, branchSvc)
	teacherID := createTestTeacher(t, teacherSvc, branchID)

	now := time.Now()
	req := &service.CreateSalaryRequest{
		TeacherID:     teacherID,
		Amount:        3000000,
		Month:         fmt.Sprintf("%02d", int(now.Month())),
		Year:          now.Year(),
		PaymentMethod: "cash",
		Status:        "paid",
		BranchID:      branchID,
	}

	salary, err := svc.Create(ctx, req, "test-user")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if salary.ID == "" {
		t.Error("created salary should have non-empty ID")
	}
	if salary.Amount != req.Amount {
		t.Errorf("Amount = %f, want %f", salary.Amount, req.Amount)
	}
	if salary.TeacherID != teacherID {
		t.Errorf("TeacherID = %q, want %q", salary.TeacherID, teacherID)
	}

	got, err := svc.GetByID(ctx, salary.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.ID != salary.ID {
		t.Errorf("GetByID ID = %q, want %q", got.ID, salary.ID)
	}
	if got.Amount != salary.Amount {
		t.Errorf("GetByID Amount = %f, want %f", got.Amount, salary.Amount)
	}
}

func TestSalaryService_GetByID_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	svc := service.NewSalaryService(database, nil)
	_, err := svc.GetByID(context.Background(), "00000000-0000-0000-0000-000000000000")
	if err == nil {
		t.Error("expected error for non-existent salary ID")
	}
}

func TestSalaryService_GetByBranchID(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	teacherSvc := service.NewTeacherService(database)
	svc := service.NewSalaryService(database, nil)

	branchID := createTestBranch(t, branchSvc)
	teacherID := createTestTeacher(t, teacherSvc, branchID)

	now := time.Now()
	for range [2]struct{}{} {
		req := &service.CreateSalaryRequest{
			TeacherID:     teacherID,
			Amount:        2500000,
			Month:         fmt.Sprintf("%02d", int(now.Month())),
			Year:          now.Year(),
			PaymentMethod: "transfer",
			Status:        "paid",
			BranchID:      branchID,
		}
		if _, err := svc.Create(ctx, req, "test-user"); err != nil {
			t.Fatalf("Create salary: %v", err)
		}
	}

	salaries, err := svc.GetByBranchID(ctx, branchID)
	if err != nil {
		t.Fatalf("GetByBranchID: %v", err)
	}
	if len(salaries) < 2 {
		t.Errorf("GetByBranchID returned %d salaries, want at least 2", len(salaries))
	}
}

func TestSalaryService_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	teacherSvc := service.NewTeacherService(database)
	svc := service.NewSalaryService(database, nil)

	branchID := createTestBranch(t, branchSvc)
	teacherID := createTestTeacher(t, teacherSvc, branchID)

	now := time.Now()
	salary, err := svc.Create(ctx, &service.CreateSalaryRequest{
		TeacherID:     teacherID,
		Amount:        1000000,
		Month:         fmt.Sprintf("%02d", int(now.Month())),
		Year:          now.Year(),
		PaymentMethod: "cash",
		Status:        "pending",
		BranchID:      branchID,
	}, "test-user")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if err := svc.Delete(ctx, salary.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	_, err = svc.GetByID(ctx, salary.ID)
	if err == nil {
		t.Error("expected error after deleting salary")
	}
}
