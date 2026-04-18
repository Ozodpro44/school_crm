package service_test

import (
	"context"
	"testing"

	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/testhelpers"
)

func newBranchSvc(t *testing.T) (*service.BranchService, func()) {
	t.Helper()
	database, cleanup := testhelpers.NewTestDB(t)
	return service.NewBranchService(database, nil), cleanup
}

func TestBranchService_CreateAndGet(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	svc, cleanup := newBranchSvc(t)
	defer cleanup()

	ctx := context.Background()
	req := &service.CreateBranchRequest{
		Name:           "Main Branch",
		Address:        "123 Main St",
		Phone:          "+998901234567",
		MonthlyPayment: 500000,
	}

	branch, err := svc.Create(ctx, req)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if branch.ID == "" {
		t.Error("created branch should have non-empty ID")
	}
	if branch.Name != req.Name {
		t.Errorf("Name = %q, want %q", branch.Name, req.Name)
	}
	if branch.MonthlyPayment != req.MonthlyPayment {
		t.Errorf("MonthlyPayment = %f, want %f", branch.MonthlyPayment, req.MonthlyPayment)
	}
	if branch.Currency != "UZS" {
		t.Errorf("Currency = %q, want %q", branch.Currency, "UZS")
	}

	// GetByID should return the same branch
	got, err := svc.GetByID(ctx, branch.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.ID != branch.ID {
		t.Errorf("GetByID ID = %q, want %q", got.ID, branch.ID)
	}
	if got.Name != branch.Name {
		t.Errorf("GetByID Name = %q, want %q", got.Name, branch.Name)
	}
}

func TestBranchService_GetByID_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	svc, cleanup := newBranchSvc(t)
	defer cleanup()

	_, err := svc.GetByID(context.Background(), "00000000-0000-0000-0000-000000000000")
	if err == nil {
		t.Error("expected error for non-existent branch ID")
	}
}

func TestBranchService_GetAll(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	svc, cleanup := newBranchSvc(t)
	defer cleanup()

	ctx := context.Background()

	// Create two branches
	for _, name := range []string{"Alpha Branch", "Beta Branch"} {
		_, err := svc.Create(ctx, &service.CreateBranchRequest{
			Name:           name,
			Address:        "Test Address",
			Phone:          "+998901234567",
			MonthlyPayment: 400000,
		})
		if err != nil {
			t.Fatalf("Create(%q): %v", name, err)
		}
	}

	branches, err := svc.GetAll(ctx)
	if err != nil {
		t.Fatalf("GetAll: %v", err)
	}
	if len(branches) < 2 {
		t.Errorf("GetAll returned %d branches, want at least 2", len(branches))
	}
}

func TestBranchService_Update(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	svc, cleanup := newBranchSvc(t)
	defer cleanup()

	ctx := context.Background()
	branch, err := svc.Create(ctx, &service.CreateBranchRequest{
		Name:           "Before Update",
		Address:        "Old Address",
		Phone:          "+998901234567",
		MonthlyPayment: 300000,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	updated, err := svc.Update(ctx, branch.ID, map[string]interface{}{
		"name":    "After Update",
		"address": "New Address",
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.Name != "After Update" {
		t.Errorf("Name after update = %q, want %q", updated.Name, "After Update")
	}
	if updated.Address != "New Address" {
		t.Errorf("Address after update = %q, want %q", updated.Address, "New Address")
	}
}

func TestBranchService_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	svc, cleanup := newBranchSvc(t)
	defer cleanup()

	ctx := context.Background()
	branch, err := svc.Create(ctx, &service.CreateBranchRequest{
		Name:           "To Delete",
		Address:        "Somewhere",
		Phone:          "+998901234567",
		MonthlyPayment: 200000,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if err := svc.Delete(ctx, branch.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	_, err = svc.GetByID(ctx, branch.ID)
	if err == nil {
		t.Error("expected error after deleting branch")
	}
}

func TestBranchService_GetCurrentMonth(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	svc, cleanup := newBranchSvc(t)
	defer cleanup()

	ctx := context.Background()
	branch, err := svc.Create(ctx, &service.CreateBranchRequest{
		Name:           "Month Test Branch",
		Address:        "Somewhere",
		Phone:          "+998901234567",
		MonthlyPayment: 250000,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	monthStr, year, err := svc.GetCurrentMonth(ctx, branch.ID)
	if err != nil {
		t.Fatalf("GetCurrentMonth: %v", err)
	}
	if len(monthStr) != 2 {
		t.Errorf("monthStr = %q, want 2-digit month", monthStr)
	}
	if year < 2024 {
		t.Errorf("year = %d, looks wrong", year)
	}
}
