package server_test

import (
	"testing"
	"time"

	"github.com/school-crm/backend/internal/models"
	grpcserver "github.com/school-crm/backend/internal/grpc/server"
)

func TestStudentModelToProto(t *testing.T) {
	now := time.Now().UTC()
	st := models.Student{
		ID:             "student-1",
		FullName:       "Alice Smith",
		ClassID:        "class-1",
		Phone:          "+998901234567",
		ParentPhone:    "+998901234568",
		MonthlyPayment: 500000,
		Status:         models.StudentStatusActive,
		BranchID:       "branch-1",
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	proto := grpcserver.StudentModelToProtoExported(st)

	if proto.Id != st.ID {
		t.Errorf("expected ID %q, got %q", st.ID, proto.Id)
	}
	if proto.FullName != st.FullName {
		t.Errorf("expected FullName %q, got %q", st.FullName, proto.FullName)
	}
	if proto.MonthlyPayment != st.MonthlyPayment {
		t.Errorf("expected MonthlyPayment %v, got %v", st.MonthlyPayment, proto.MonthlyPayment)
	}
	if proto.Status != string(st.Status) {
		t.Errorf("expected Status %q, got %q", st.Status, proto.Status)
	}
}

func TestPaymentModelToProto(t *testing.T) {
	now := time.Now().UTC()
	notes := "test notes"
	createdBy := "user-1"
	p := models.Payment{
		ID:            "payment-1",
		StudentID:     "student-1",
		Amount:        500000,
		Month:         "January",
		Year:          2025,
		PaymentMethod: models.PaymentMethodCash,
		Status:        models.PaymentStatusPaid,
		InvoiceNumber: "INV-001",
		Notes:         &notes,
		BranchID:      "branch-1",
		CreatedBy:     &createdBy,
		CreatedAt:     now,
	}

	proto := grpcserver.PaymentModelToProtoExported(p)

	if proto.Id != p.ID {
		t.Errorf("expected ID %q, got %q", p.ID, proto.Id)
	}
	if proto.Amount != p.Amount {
		t.Errorf("expected Amount %v, got %v", p.Amount, proto.Amount)
	}
	if proto.Notes != notes {
		t.Errorf("expected Notes %q, got %q", notes, proto.Notes)
	}
	if proto.CreatedBy != createdBy {
		t.Errorf("expected CreatedBy %q, got %q", createdBy, proto.CreatedBy)
	}
}
