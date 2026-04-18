package server_test

import (
	"testing"
	"time"

	grpcserver "github.com/school-crm/backend/internal/grpc/server"
	"github.com/school-crm/backend/internal/models"
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

func TestBranchModelToProto(t *testing.T) {
	now := time.Now().UTC()
	adminID := "admin-1"
	b := models.Branch{
		ID:             "branch-1",
		Name:           "Main Branch",
		Address:        "123 Main St",
		Phone:          "+998901234567",
		MonthlyPayment: 750000,
		Currency:       "UZS",
		AdminID:        &adminID,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	proto := grpcserver.BranchModelToProtoExported(b)

	if proto.Id != b.ID {
		t.Errorf("expected ID %q, got %q", b.ID, proto.Id)
	}
	if proto.Name != b.Name {
		t.Errorf("expected Name %q, got %q", b.Name, proto.Name)
	}
	if proto.MonthlyPayment != b.MonthlyPayment {
		t.Errorf("expected MonthlyPayment %v, got %v", b.MonthlyPayment, proto.MonthlyPayment)
	}
	if proto.AdminId != adminID {
		t.Errorf("expected AdminId %q, got %q", adminID, proto.AdminId)
	}
	if proto.Currency != b.Currency {
		t.Errorf("expected Currency %q, got %q", b.Currency, proto.Currency)
	}
}

func TestBranchModelToProto_NilAdminID(t *testing.T) {
	now := time.Now().UTC()
	b := models.Branch{
		ID:        "branch-2",
		Name:      "Branch No Admin",
		AdminID:   nil,
		CreatedAt: now,
		UpdatedAt: now,
	}

	proto := grpcserver.BranchModelToProtoExported(b)

	if proto.AdminId != "" {
		t.Errorf("expected empty AdminId for nil pointer, got %q", proto.AdminId)
	}
}

func TestClassModelToProto(t *testing.T) {
	now := time.Now().UTC()
	teacherID := "teacher-1"
	c := models.Class{
		ID:        "class-1",
		Name:      "English A1",
		BranchID:  "branch-1",
		TeacherID: &teacherID,
		CreatedAt: now,
		UpdatedAt: now,
	}

	proto := grpcserver.ClassModelToProtoExported(c)

	if proto.Id != c.ID {
		t.Errorf("expected ID %q, got %q", c.ID, proto.Id)
	}
	if proto.Name != c.Name {
		t.Errorf("expected Name %q, got %q", c.Name, proto.Name)
	}
	if proto.BranchId != c.BranchID {
		t.Errorf("expected BranchId %q, got %q", c.BranchID, proto.BranchId)
	}
	if proto.TeacherId != teacherID {
		t.Errorf("expected TeacherId %q, got %q", teacherID, proto.TeacherId)
	}
}

func TestClassModelToProto_NilTeacherID(t *testing.T) {
	now := time.Now().UTC()
	c := models.Class{
		ID:        "class-2",
		Name:      "Maths B2",
		BranchID:  "branch-1",
		TeacherID: nil,
		CreatedAt: now,
		UpdatedAt: now,
	}

	proto := grpcserver.ClassModelToProtoExported(c)

	if proto.TeacherId != "" {
		t.Errorf("expected empty TeacherId for nil pointer, got %q", proto.TeacherId)
	}
}
