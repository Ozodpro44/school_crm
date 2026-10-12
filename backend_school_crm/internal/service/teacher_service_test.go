package service_test

import (
	"context"
	"testing"

	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/testhelpers"
)

// newTeacherReq returns a minimal CreateTeacherRequest for the given branchID.
func newTeacherReq(branchID string) *service.CreateTeacherRequest {
	return &service.CreateTeacherRequest{
		FullName:      "Test Teacher",
		MonthlySalary: 3000000,
		Phone:         "+998901234567",
		Email:         "teacher@example.com",
		BranchID:      branchID,
	}
}

func TestTeacherService_CreateAndGet(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	svc := service.NewTeacherService(database)

	branchID := createTestBranch(t, branchSvc)

	teacher, err := svc.Create(ctx, newTeacherReq(branchID))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if teacher.ID == "" {
		t.Error("created teacher should have non-empty ID")
	}
	if teacher.FullName != "Test Teacher" {
		t.Errorf("FullName = %q, want %q", teacher.FullName, "Test Teacher")
	}
	if teacher.BranchID != branchID {
		t.Errorf("BranchID = %q, want %q", teacher.BranchID, branchID)
	}

	got, err := svc.GetByID(ctx, teacher.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.ID != teacher.ID {
		t.Errorf("GetByID ID = %q, want %q", got.ID, teacher.ID)
	}
	if got.FullName != teacher.FullName {
		t.Errorf("GetByID FullName = %q, want %q", got.FullName, teacher.FullName)
	}
}

func TestTeacherService_GetByID_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	svc := service.NewTeacherService(database)
	_, err := svc.GetByID(context.Background(), "00000000-0000-0000-0000-000000000000")
	if err == nil {
		t.Error("expected error for non-existent teacher ID")
	}
}

func TestTeacherService_GetByBranchID(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	svc := service.NewTeacherService(database)

	branchID := createTestBranch(t, branchSvc)

	for i, email := range []string{"t1@example.com", "t2@example.com"} {
		req := newTeacherReq(branchID)
		req.Email = email
		req.FullName = "Teacher" + string(rune('A'+i))
		if _, err := svc.Create(ctx, req); err != nil {
			t.Fatalf("Create teacher %d: %v", i, err)
		}
	}

	teachers, err := svc.GetByBranchID(ctx, branchID)
	if err != nil {
		t.Fatalf("GetByBranchID: %v", err)
	}
	if len(teachers) != 2 {
		t.Errorf("GetByBranchID returned %d teachers, want 2", len(teachers))
	}
}

func TestTeacherService_Update(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	svc := service.NewTeacherService(database)

	branchID := createTestBranch(t, branchSvc)
	teacher, err := svc.Create(ctx, newTeacherReq(branchID))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	updated, err := svc.Update(ctx, teacher.ID, map[string]interface{}{
		"full_name": "Updated Teacher",
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.FullName != "Updated Teacher" {
		t.Errorf("FullName after update = %q, want %q", updated.FullName, "Updated Teacher")
	}
}

func TestTeacherService_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	svc := service.NewTeacherService(database)

	branchID := createTestBranch(t, branchSvc)
	teacher, err := svc.Create(ctx, newTeacherReq(branchID))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if err := svc.Delete(ctx, teacher.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	_, err = svc.GetByID(ctx, teacher.ID)
	if err == nil {
		t.Error("expected error after deleting teacher")
	}
}
