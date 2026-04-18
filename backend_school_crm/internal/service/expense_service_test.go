package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/testhelpers"
)

// newExpenseReq returns a minimal CreateExpenseRequest for the given branchID.
// Passing nil as branchSvc skips the financial-month lock guard inside Create.
func newExpenseReq(branchID string) *service.CreateExpenseRequest {
	return &service.CreateExpenseRequest{
		Title:         "Office Supplies",
		Amount:        150000,
		Category:      "supplies",
		PaymentMethod: "cash",
		Date:          time.Now().UTC(),
		BranchID:      branchID,
	}
}

func TestExpenseService_CreateAndGet(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	// Pass nil as branchSvc to ExpenseService to bypass financial month guard.
	svc := service.NewExpenseService(database, nil)

	branchID := createTestBranch(t, branchSvc)
	req := newExpenseReq(branchID)

	expense, err := svc.Create(ctx, req, "test-user")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if expense.ID == "" {
		t.Error("created expense should have non-empty ID")
	}
	if expense.Title != req.Title {
		t.Errorf("Title = %q, want %q", expense.Title, req.Title)
	}
	if expense.Amount != req.Amount {
		t.Errorf("Amount = %f, want %f", expense.Amount, req.Amount)
	}
	if expense.BranchID != branchID {
		t.Errorf("BranchID = %q, want %q", expense.BranchID, branchID)
	}

	got, err := svc.GetByID(ctx, expense.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.ID != expense.ID {
		t.Errorf("GetByID ID = %q, want %q", got.ID, expense.ID)
	}
	if got.Title != expense.Title {
		t.Errorf("GetByID Title = %q, want %q", got.Title, expense.Title)
	}
}

func TestExpenseService_GetByID_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	svc := service.NewExpenseService(database, nil)
	_, err := svc.GetByID(context.Background(), "00000000-0000-0000-0000-000000000000")
	if err == nil {
		t.Error("expected error for non-existent expense ID")
	}
}

func TestExpenseService_GetByBranchID(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	svc := service.NewExpenseService(database, nil)

	branchID := createTestBranch(t, branchSvc)

	for _, title := range []string{"Rent", "Electricity", "Internet"} {
		req := newExpenseReq(branchID)
		req.Title = title
		if _, err := svc.Create(ctx, req, "test-user"); err != nil {
			t.Fatalf("Create(%q): %v", title, err)
		}
	}

	expenses, err := svc.GetByBranchID(ctx, branchID)
	if err != nil {
		t.Fatalf("GetByBranchID: %v", err)
	}
	if len(expenses) != 3 {
		t.Errorf("GetByBranchID returned %d expenses, want 3", len(expenses))
	}
}

func TestExpenseService_Update(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	svc := service.NewExpenseService(database, nil)

	branchID := createTestBranch(t, branchSvc)
	expense, err := svc.Create(ctx, newExpenseReq(branchID), "test-user")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	newTitle := "Updated Title"
	newAmount := 200000.0
	updated, err := svc.Update(ctx, expense.ID, &service.UpdateExpenseRequest{
		Title:  &newTitle,
		Amount: &newAmount,
	}, true)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.Title != newTitle {
		t.Errorf("Title after update = %q, want %q", updated.Title, newTitle)
	}
	if updated.Amount != newAmount {
		t.Errorf("Amount after update = %f, want %f", updated.Amount, newAmount)
	}
}

func TestExpenseService_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	branchSvc := service.NewBranchService(database, nil)
	svc := service.NewExpenseService(database, nil)

	branchID := createTestBranch(t, branchSvc)
	expense, err := svc.Create(ctx, newExpenseReq(branchID), "test-user")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if err := svc.Delete(ctx, expense.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	_, err = svc.GetByID(ctx, expense.ID)
	if err == nil {
		t.Error("expected error after deleting expense")
	}
}
