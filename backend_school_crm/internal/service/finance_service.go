package service

import (
	"context"
	"strings"
)

// FinanceService consolidates all business logic that computes student payment
// status and remaining balances. Handlers that previously contained this
// calculation logic now delegate to a single FinanceService method.
type FinanceService struct {
	branches *BranchService
	payments *PaymentService
	students *StudentService
	classes  *ClassService
}

func NewFinanceService(branches *BranchService, payments *PaymentService, students *StudentService, classes *ClassService) *FinanceService {
	return &FinanceService{branches: branches, payments: payments, students: students, classes: classes}
}

// StudentWithPayment is the DTO used by the "search students for payment modal" view.
type StudentWithPayment struct {
	ID             string  `json:"id"`
	FullName       string  `json:"fullName"`
	Phone          string  `json:"phone"`
	ClassID        string  `json:"classId"`
	ClassName      string  `json:"className"`
	MonthlyPayment float64 `json:"monthlyPayment"`
	PaidAmount     float64 `json:"paidAmount"`
	PaymentStatus  string  `json:"paymentStatus"` // "paid" | "partial" | "none"
	BranchID       string  `json:"branchId"`
}

// SearchStudentsWithPayments returns active students matching search with their
// payment summary for the requested month/year. Moved from handlers/student.go.
func (f *FinanceService) SearchStudentsWithPayments(ctx context.Context, branchID, search, month string, year int) ([]StudentWithPayment, error) {
	students, err := f.students.SearchByBranchID(ctx, branchID, search)
	if err != nil {
		return nil, err
	}

	result := make([]StudentWithPayment, 0, len(students))
	for _, student := range students {
		className := ""
		if student.ClassID != "" {
			if classData, err := f.classes.GetByID(ctx, student.ClassID); err == nil && classData != nil {
				className = classData.Name
			}
		}

		paidAmount := 0.0
		if month != "" && year > 0 {
			payments, err := f.payments.GetByStudentAndPeriod(ctx, student.ID, month, year)
			if err == nil {
				for _, p := range payments {
					paidAmount += p.Amount
				}
			}
		}

		paymentStatus := "none"
		if paidAmount > 0 {
			if paidAmount >= student.MonthlyPayment {
				paymentStatus = "paid"
			} else {
				paymentStatus = "partial"
			}
		}

		result = append(result, StudentWithPayment{
			ID:             student.ID,
			FullName:       student.FullName,
			Phone:          student.Phone,
			ClassID:        student.ClassID,
			ClassName:      className,
			MonthlyPayment: student.MonthlyPayment,
			PaidAmount:     paidAmount,
			PaymentStatus:  paymentStatus,
			BranchID:       student.BranchID,
		})
	}
	return result, nil
}

// StudentPaymentStatus is the rich DTO used by the "students with payment status" view.
type StudentPaymentStatus struct {
	ID             string  `json:"id"`
	FullName       string  `json:"fullName"`
	ClassID        string  `json:"classId"`
	Phone          string  `json:"phone"`
	MonthlyPayment float64 `json:"monthlyPayment"`
	StudentStatus  string  `json:"status"`       // active | left | suspended
	AmountPaid     float64 `json:"amountPaid"`
	PaymentStatus  string  `json:"paymentStatus"` // paid | partial | not_paid
	Remaining      float64 `json:"remaining"`
	BranchID       string  `json:"branchId"`
}

// SearchStudentsWithPaymentStatus returns all branch students enriched with their
// payment status for the branch's current financial month. Filters are applied
// in-memory so the caller does not need to know the current month.
// Moved from handlers/payment.go.
func (f *FinanceService) SearchStudentsWithPaymentStatus(ctx context.Context, branchID, search, classID, studentStatus, paymentStatus string) ([]StudentPaymentStatus, error) {
	currentMonth, currentYear, err := f.branches.GetCurrentMonth(ctx, branchID)
	if err != nil {
		return nil, err
	}

	students, _, err := f.students.GetByBranchID(ctx, branchID, 1, 10000)
	if err != nil {
		return nil, err
	}

	result := make([]StudentPaymentStatus, 0, len(students))
	for _, student := range students {
		payments, err := f.payments.GetByStudentIDAndPeriod(ctx, student.ID, currentMonth, currentYear)
		if err != nil {
			continue
		}

		totalPaid := 0.0
		for _, p := range payments {
			totalPaid += p.Amount
		}

		paymentStatusStr := "not_paid"
		remaining := student.MonthlyPayment - totalPaid
		if totalPaid >= student.MonthlyPayment {
			paymentStatusStr = "paid"
			remaining = 0
		} else if totalPaid > 0 {
			paymentStatusStr = "partial"
		}

		sp := StudentPaymentStatus{
			ID:             student.ID,
			FullName:       student.FullName,
			ClassID:        student.ClassID,
			Phone:          student.Phone,
			MonthlyPayment: student.MonthlyPayment,
			StudentStatus:  string(student.Status),
			AmountPaid:     totalPaid,
			PaymentStatus:  paymentStatusStr,
			Remaining:      remaining,
			BranchID:       student.BranchID,
		}

		if search != "" {
			sl := strings.ToLower(search)
			if !strings.Contains(strings.ToLower(sp.FullName), sl) &&
				!strings.Contains(strings.ToLower(sp.Phone), sl) {
				continue
			}
		}
		if classID != "" && sp.ClassID != classID {
			continue
		}
		if studentStatus != "" && sp.StudentStatus != studentStatus {
			continue
		}
		if paymentStatus != "" && sp.PaymentStatus != paymentStatus {
			continue
		}

		result = append(result, sp)
	}
	return result, nil
}

// StudentCurrentPaymentStatus is the DTO for the single-student payment status endpoint.
type StudentCurrentPaymentStatus struct {
	Status string  `json:"status"` // "not_paid" | "partial"
	Amount float64 `json:"amount"`
}

// GetStudentCurrentPaymentStatus returns the payment status for a student in the
// branch's current financial month. Moved from handlers/payment.go.
func (f *FinanceService) GetStudentCurrentPaymentStatus(ctx context.Context, studentID, branchID string) (*StudentCurrentPaymentStatus, error) {
	currentMonth, currentYear, err := f.branches.GetCurrentMonth(ctx, branchID)
	if err != nil {
		return nil, err
	}

	payments, err := f.payments.GetByStudentIDAndPeriod(ctx, studentID, currentMonth, currentYear)
	if err != nil {
		return nil, err
	}

	totalPaid := 0.0
	for _, p := range payments {
		totalPaid += p.Amount
	}

	status := "not_paid"
	if totalPaid > 0 {
		status = "partial"
	}

	return &StudentCurrentPaymentStatus{Status: status, Amount: totalPaid}, nil
}
