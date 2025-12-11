package models

import "time"

type UserRole string

const (
	RoleAdmin       UserRole = "admin"
	RoleBranchAdmin UserRole = "branch_admin"
	RoleManager     UserRole = "manager"
	RoleAccountant  UserRole = "accountant"
	RoleTeacher     UserRole = "teacher"
	RoleStudent     UserRole = "student"
	RoleParent      UserRole = "parent"
)

type PaymentMethod string

const (
	PaymentMethodCard PaymentMethod = "card"
	PaymentMethodCash PaymentMethod = "cash"
	PaymentMethodBank PaymentMethod = "bank"
)

type PaymentStatus string

const (
	PaymentStatusPaid    PaymentStatus = "paid"
	PaymentStatusUnpaid  PaymentStatus = "unpaid"
	PaymentStatusPartial PaymentStatus = "partial"
)

type StudentStatus string

const (
	StudentStatusActive    StudentStatus = "active"
	StudentStatusLeft      StudentStatus = "left"
	StudentStatusSuspended StudentStatus = "suspended"
)

type User struct {
	ID        string    `json:"id" db:"id"`
	Email     string    `json:"email" db:"email"`
	Password  string    `json:"-" db:"password"`
	Role      UserRole  `json:"role" db:"role"`
	FullName  string    `json:"fullName" db:"full_name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

type Student struct {
	ID                string        `json:"id" db:"id"`
	FullName          string        `json:"fullName" db:"full_name"`
	ClassID           string        `json:"classId" db:"class_id"`
	Phone             string        `json:"phone" db:"phone"`
	ParentPhone       string        `json:"parentPhone" db:"parent_phone"`
	MonthlyPayment    float64       `json:"monthlyPayment" db:"monthly_payment"`
	Status            StudentStatus `json:"status" db:"status"`
	BranchID          string        `json:"branchId" db:"branch_id"`
	EnrollmentDate    *time.Time    `json:"enrollmentDate" db:"enrollment_date"`
	LeftDate          *time.Time    `json:"leftDate" db:"left_date"`
	ClassSignedDate   *time.Time    `json:"classSignedDate" db:"class_signed_date"`
	ClassConfirmed    bool          `json:"classConfirmed" db:"class_confirmed"`
	CreatedAt         time.Time     `json:"createdAt" db:"created_at"`
	UpdatedAt         time.Time     `json:"updatedAt" db:"updated_at"`
}

type Payment struct {
	ID            string         `json:"id" db:"id"`
	StudentID     string         `json:"studentId" db:"student_id"`
	Amount        float64        `json:"amount" db:"amount"`
	Month         string         `json:"month" db:"month"`
	Year          int            `json:"year" db:"year"`
	PaymentMethod PaymentMethod  `json:"paymentMethod" db:"payment_method"`
	Status        PaymentStatus  `json:"status" db:"status"`
	InvoiceNumber string         `json:"invoiceNumber" db:"invoice_number"`
	Notes         *string        `json:"notes" db:"notes"`
	PaidDate      *time.Time     `json:"paidDate" db:"paid_date"`
	BranchID      string         `json:"branchId" db:"branch_id"`
	CreatedBy     *string        `json:"createdBy" db:"created_by"`
	CreatedAt     time.Time      `json:"createdAt" db:"created_at"`
}

type Class struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	TeacherID *string   `json:"teacherId" db:"teacher_id"`
	StudentID []string  `json:"studentIds" db:"-"`
	BranchID  string    `json:"branchId" db:"branch_id"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

type Branch struct {
	ID             string    `json:"id" db:"id"`
	Name           string    `json:"name" db:"name"`
	Address        string    `json:"address" db:"address"`
	Phone          string    `json:"phone" db:"phone"`
	MonthlyPayment float64   `json:"monthlyPayment" db:"monthly_payment"`
	Currency       string    `json:"currency" db:"currency"`
	AdminID        *string   `json:"adminId" db:"admin_id"`
	CreatedAt      time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time `json:"updatedAt" db:"updated_at"`
	CreatedDate    time.Time `json:"createdDate" db:"created_date"`
	UpdatedDate    time.Time `json:"updatedDate" db:"updated_date"`
}

type Teacher struct {
	ID              string    `json:"id" db:"id"`
	FullName        string    `json:"fullName" db:"full_name"`
	Subjects        []string  `json:"subjects" db:"-"`
	MonthlySalary   float64   `json:"monthlySalary" db:"monthly_salary"`
	Phone           string    `json:"phone" db:"phone"`
	Email           string    `json:"email" db:"email"`
	AssignedClasses []string  `json:"assignedClasses" db:"-"`
	BranchID        string    `json:"branchId" db:"branch_id"`
	JoinedDate      *time.Time `json:"joinedDate" db:"joined_date"`
	CreatedAt       time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time `json:"updatedAt" db:"updated_at"`
}

type Salary struct {
	ID            string        `json:"id" db:"id"`
	TeacherID     string        `json:"teacherId" db:"teacher_id"`
	Amount        float64       `json:"amount" db:"amount"`
	Month         string        `json:"month" db:"month"`
	Year          int           `json:"year" db:"year"`
	PaymentMethod PaymentMethod `json:"paymentMethod" db:"payment_method"`
	Status        PaymentStatus `json:"status" db:"status"`
	Notes         *string       `json:"notes" db:"notes"`
	PaidDate      *time.Time    `json:"paidDate" db:"paid_date"`
	BranchID      string        `json:"branchId" db:"branch_id"`
	CreatedBy     *string       `json:"createdBy" db:"created_by"`
	CreatedAt     time.Time     `json:"createdAt" db:"created_at"`
}

type Expense struct {
	ID            string        `json:"id" db:"id"`
	Title         string        `json:"title" db:"title"`
	Description   string        `json:"description" db:"description"`
	Amount        float64       `json:"amount" db:"amount"`
	Category      string        `json:"category" db:"category"`
	PaymentMethod PaymentMethod `json:"paymentMethod" db:"payment_method"`
	Date          time.Time     `json:"date" db:"date"`
	BranchID      string        `json:"branchId" db:"branch_id"`
	CreatedBy     string        `json:"createdBy" db:"created_by"`
	Notes         *string       `json:"notes" db:"notes"`
	CreatedAt     time.Time     `json:"createdAt" db:"created_at"`
}

type Income struct {
	ID          string    `json:"id" db:"id"`
	Source      string    `json:"source" db:"source"`
	Amount      float64   `json:"amount" db:"amount"`
	Date        time.Time `json:"date" db:"date"`
	Description *string   `json:"description" db:"description"`
	BranchID    string    `json:"branchId" db:"branch_id"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
}

type Permission struct {
	ID                string `db:"id"`
	UserID            string `db:"user_id"`
	CanViewStudents   bool   `db:"can_view_students"`
	CanEditStudents   bool   `db:"can_edit_students"`
	CanDeleteStudents bool   `db:"can_delete_students"`
	CanViewTeachers   bool   `db:"can_view_teachers"`
	CanEditTeachers   bool   `db:"can_edit_teachers"`
	CanDeleteTeachers bool   `db:"can_delete_teachers"`
	CanViewClasses    bool   `db:"can_view_classes"`
	CanEditClasses    bool   `db:"can_edit_classes"`
	CanDeleteClasses  bool   `db:"can_delete_classes"`
	CanViewPayments   bool   `db:"can_view_payments"`
	CanEditPayments   bool   `db:"can_edit_payments"`
	CanViewSalaries   bool   `db:"can_view_salaries"`
	CanEditSalaries   bool   `db:"can_edit_salaries"`
	CanViewExpenses   bool   `db:"can_view_expenses"`
	CanEditExpenses   bool   `db:"can_edit_expenses"`
	CanDeleteExpenses bool   `db:"can_delete_expenses"`
	CanViewReports    bool   `db:"can_view_reports"`
	CanFinishMonth    bool   `db:"can_finish_month"`
	CanViewSettings   bool   `db:"can_view_settings"`
	CanEditSettings   bool   `db:"can_edit_settings"`
}
