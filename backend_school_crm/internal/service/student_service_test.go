package service_test

import (
	"context"
	"testing"

	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/testhelpers"
)

func TestStudentService_CreateAndGet(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	subSvc := service.NewSubscriptionService(database)
	svc := service.NewStudentService(database, subSvc)

	// Create a student (no branch subscription check when branchID is empty).
	req := &service.CreateStudentRequest{
		FullName:       "Test Student",
		MonthlyPayment: 500000,
		Status:         "active",
		BranchID:       "",
	}

	student, err := svc.Create(ctx, req)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if student.ID == "" {
		t.Error("created student should have non-empty ID")
	}
	if student.FullName != req.FullName {
		t.Errorf("FullName = %q, want %q", student.FullName, req.FullName)
	}

	// GetByID should return the same student.
	got, err := svc.GetByID(ctx, student.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.ID != student.ID {
		t.Errorf("GetByID returned wrong ID: %q, want %q", got.ID, student.ID)
	}
	if got.FullName != student.FullName {
		t.Errorf("GetByID FullName = %q, want %q", got.FullName, student.FullName)
	}
}

func TestStudentService_GetByID_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	svc := service.NewStudentService(database, nil)

	_, err := svc.GetByID(ctx, "00000000-0000-0000-0000-000000000000")
	if err == nil {
		t.Error("expected error for non-existent student ID")
	}
}

func TestStudentService_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	svc := service.NewStudentService(database, nil)

	// Create then delete.
	req := &service.CreateStudentRequest{
		FullName:       "To Be Deleted",
		MonthlyPayment: 100000,
		Status:         "active",
		BranchID:       "",
	}
	student, err := svc.Create(ctx, req)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if err := svc.Delete(ctx, student.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	// Should no longer be found.
	_, err = svc.GetByID(ctx, student.ID)
	if err == nil {
		t.Error("expected error after deleting student")
	}
}

func TestStudentService_Update(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	svc := service.NewStudentService(database, nil)

	req := &service.CreateStudentRequest{
		FullName:       "Original Name",
		MonthlyPayment: 300000,
		Status:         "active",
		BranchID:       "",
	}
	student, err := svc.Create(ctx, req)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	updated, err := svc.Update(ctx, student.ID, map[string]interface{}{
		"full_name": "Updated Name",
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.FullName != "Updated Name" {
		t.Errorf("FullName after update = %q, want %q", updated.FullName, "Updated Name")
	}
}
