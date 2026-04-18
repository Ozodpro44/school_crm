package service_test

import (
	"context"
	"testing"

	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/testhelpers"
)

// createTestBranch is a helper that inserts a minimal branch and returns its ID.
func createTestBranch(t *testing.T, branchSvc *service.BranchService) string {
	t.Helper()
	branch, err := branchSvc.Create(context.Background(), &service.CreateBranchRequest{
		Name:           "Test Branch for Classes",
		Address:        "123 Test St",
		Phone:          "+998901234567",
		MonthlyPayment: 400000,
	})
	if err != nil {
		t.Fatalf("createTestBranch: %v", err)
	}
	return branch.ID
}

func TestClassService_CreateAndGet(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	svc := service.NewClassService(database)

	branchID := createTestBranch(t, branchSvc)

	req := &service.CreateClassRequest{
		Name:     "Mathematics",
		BranchID: branchID,
	}

	class, err := svc.Create(ctx, req)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if class.ID == "" {
		t.Error("created class should have non-empty ID")
	}
	if class.Name != req.Name {
		t.Errorf("Name = %q, want %q", class.Name, req.Name)
	}
	if class.BranchID != branchID {
		t.Errorf("BranchID = %q, want %q", class.BranchID, branchID)
	}

	got, err := svc.GetByID(ctx, class.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.ID != class.ID {
		t.Errorf("GetByID ID = %q, want %q", got.ID, class.ID)
	}
	if got.Name != class.Name {
		t.Errorf("GetByID Name = %q, want %q", got.Name, class.Name)
	}
}

func TestClassService_Create_DuplicateName(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	svc := service.NewClassService(database)

	branchID := createTestBranch(t, branchSvc)
	req := &service.CreateClassRequest{Name: "Physics", BranchID: branchID}

	if _, err := svc.Create(ctx, req); err != nil {
		t.Fatalf("first Create: %v", err)
	}

	_, err := svc.Create(ctx, req)
	if err == nil {
		t.Error("expected error creating duplicate class name in same branch")
	}
}

func TestClassService_GetByID_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	svc := service.NewClassService(database)
	_, err := svc.GetByID(context.Background(), "00000000-0000-0000-0000-000000000000")
	if err == nil {
		t.Error("expected error for non-existent class ID")
	}
}

func TestClassService_GetByBranchID(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	svc := service.NewClassService(database)

	branchID := createTestBranch(t, branchSvc)

	for _, name := range []string{"Chemistry", "Biology", "History"} {
		if _, err := svc.Create(ctx, &service.CreateClassRequest{Name: name, BranchID: branchID}); err != nil {
			t.Fatalf("Create(%q): %v", name, err)
		}
	}

	classes, err := svc.GetByBranchID(ctx, branchID)
	if err != nil {
		t.Fatalf("GetByBranchID: %v", err)
	}
	if len(classes) != 3 {
		t.Errorf("GetByBranchID returned %d classes, want 3", len(classes))
	}
}

func TestClassService_Update(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	svc := service.NewClassService(database)

	branchID := createTestBranch(t, branchSvc)
	class, err := svc.Create(ctx, &service.CreateClassRequest{Name: "Old Name", BranchID: branchID})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	updated, err := svc.Update(ctx, class.ID, map[string]interface{}{"name": "New Name"})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.Name != "New Name" {
		t.Errorf("Name after update = %q, want %q", updated.Name, "New Name")
	}
}

func TestClassService_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	svc := service.NewClassService(database)

	branchID := createTestBranch(t, branchSvc)
	class, err := svc.Create(ctx, &service.CreateClassRequest{Name: "To Delete", BranchID: branchID})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if err := svc.Delete(ctx, class.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	_, err = svc.GetByID(ctx, class.ID)
	if err == nil {
		t.Error("expected error after deleting class")
	}
}
