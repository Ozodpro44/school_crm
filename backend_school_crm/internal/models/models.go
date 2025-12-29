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
	PaymentStatusPartial PaymentStatus = "partial"
)

type StudentStatus string

const (
	StudentStatusActive    StudentStatus = "active"
	StudentStatusLeft      StudentStatus = "left"
	StudentStatusSuspended StudentStatus = "suspended"
)

type User struct {
	ID          string      `json:"id" db:"id"`
	Email       string      `json:"email" db:"email"`
	Password    string      `json:"-" db:"password"`
	Role        UserRole    `json:"role" db:"role"`
	FullName    string      `json:"fullName" db:"full_name"`
	BranchID    *string     `json:"branchId" db:"branch_id"` // Primary branch (for backwards compatibility)
	BranchIDs   []string    `json:"branchIds" db:"-"`        // All managed branches
	Permissions *Permission `json:"permissions" db:"-"`      // User permissions
	CreatedAt   time.Time   `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time   `json:"updatedAt" db:"updated_at"`
}

// BranchManager represents the relationship between a branch and a manager
type BranchManager struct {
	ID        string    `json:"id" db:"id"`
	BranchID  string    `json:"branchId" db:"branch_id"`
	ManagerID string    `json:"managerId" db:"manager_id"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
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
	ID                 string         `json:"id" db:"id"`
	StudentID          string         `json:"studentId" db:"student_id"`
	Amount             float64        `json:"amount" db:"amount"`
	Month              string         `json:"month" db:"month"`
	Year               int            `json:"year" db:"year"`
	PaymentMethod      PaymentMethod  `json:"paymentMethod" db:"payment_method"`
	Status             PaymentStatus  `json:"status" db:"status"`
	InvoiceNumber      string         `json:"invoiceNumber" db:"invoice_number"`
	Notes              *string        `json:"notes" db:"notes"`
	PaidDate           *time.Time     `json:"paidDate" db:"paid_date"`
	BranchID           string         `json:"branchId" db:"branch_id"`
	CreatedBy          *string        `json:"createdBy" db:"created_by"`
	CreatedByName      *string        `json:"createdByName" db:"-"`
	CreatedAt          time.Time      `json:"createdAt" db:"created_at"`
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
	ID                      string      `json:"id" db:"id"`
	Name                    string      `json:"name" db:"name"`
	Address                 string      `json:"address" db:"address"`
	Phone                   string      `json:"phone" db:"phone"`
	MonthlyPayment          float64     `json:"monthlyPayment" db:"monthly_payment"`
	Currency                string      `json:"currency" db:"currency"`
	AdminID                 *string     `json:"adminId" db:"admin_id"`
	CreatedAt               time.Time   `json:"createdAt" db:"created_at"`
	UpdatedAt               time.Time   `json:"updatedAt" db:"updated_at"`
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
	ID               string        `json:"id" db:"id"`
	TeacherID        string        `json:"teacherId" db:"teacher_id"`
	Amount           float64       `json:"amount" db:"amount"`
	Month            string        `json:"month" db:"month"`
	Year             int           `json:"year" db:"year"`
	PaymentMethod    PaymentMethod `json:"paymentMethod" db:"payment_method"`
	Status           PaymentStatus `json:"status" db:"status"`
	Notes            *string       `json:"notes" db:"notes"`
	PaidDate         *time.Time    `json:"paidDate" db:"paid_date"`
	BranchID         string        `json:"branchId" db:"branch_id"`
	CreatedBy        *string       `json:"createdBy" db:"created_by"`
	CreatedAt        time.Time     `json:"createdAt" db:"created_at"`
}

type Expense struct {
	ID               string        `json:"id" db:"id"`
	Title            string        `json:"title" db:"title"`
	Description      string        `json:"description" db:"description"`
	Amount           float64       `json:"amount" db:"amount"`
	Category         string        `json:"category" db:"category"`
	PaymentMethod    PaymentMethod `json:"paymentMethod" db:"payment_method"`
	Date             time.Time     `json:"date" db:"date"`
	BranchID         string        `json:"branchId" db:"branch_id"`
	CreatedBy        string        `json:"createdBy" db:"created_by"`
	Notes            *string       `json:"notes" db:"notes"`
	CreatedAt        time.Time     `json:"createdAt" db:"created_at"`
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
	ID                   string `json:"id" db:"id"`
	UserID               string `json:"userId" db:"user_id"`
	CanViewStudents      bool   `json:"canViewStudents" db:"can_view_students"`
	CanCreateStudents    bool   `json:"canCreateStudents" db:"can_create_students"`
	CanEditStudents      bool   `json:"canEditStudents" db:"can_edit_students"`
	CanDeleteStudents    bool   `json:"canDeleteStudents" db:"can_delete_students"`
	CanViewTeachers      bool   `json:"canViewTeachers" db:"can_view_teachers"`
	CanCreateTeachers    bool   `json:"canCreateTeachers" db:"can_create_teachers"`
	CanEditTeachers      bool   `json:"canEditTeachers" db:"can_edit_teachers"`
	CanDeleteTeachers    bool   `json:"canDeleteTeachers" db:"can_delete_teachers"`
	CanViewClasses       bool   `json:"canViewClasses" db:"can_view_classes"`
	CanCreateClasses     bool   `json:"canCreateClasses" db:"can_create_classes"`
	CanEditClasses       bool   `json:"canEditClasses" db:"can_edit_classes"`
	CanDeleteClasses     bool   `json:"canDeleteClasses" db:"can_delete_classes"`
	CanViewPayments      bool   `json:"canViewPayments" db:"can_view_payments"`
	CanCreatePayments    bool   `json:"canCreatePayments" db:"can_create_payments"`
	CanEditPayments      bool   `json:"canEditPayments" db:"can_edit_payments"`
	CanViewSalaries      bool   `json:"canViewSalaries" db:"can_view_salaries"`
	CanCreateSalaries    bool   `json:"canCreateSalaries" db:"can_create_salaries"`
	CanEditSalaries      bool   `json:"canEditSalaries" db:"can_edit_salaries"`
	CanViewExpenses      bool   `json:"canViewExpenses" db:"can_view_expenses"`
	CanCreateExpenses    bool   `json:"canCreateExpenses" db:"can_create_expenses"`
	CanEditExpenses      bool   `json:"canEditExpenses" db:"can_edit_expenses"`
	CanDeleteExpenses    bool   `json:"canDeleteExpenses" db:"can_delete_expenses"`
	CanViewReports       bool   `json:"canViewReports" db:"can_view_reports"`
	CanViewSettings      bool   `json:"canViewSettings" db:"can_view_settings"`
	CanEditSettings      bool   `json:"canEditSettings" db:"can_edit_settings"`
}
