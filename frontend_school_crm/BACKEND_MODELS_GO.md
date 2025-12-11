# Golang Backend Models

## Types and Constants

```go
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
    PaymentCard PaymentMethod = "card"
    PaymentCash PaymentMethod = "cash"
    PaymentBank PaymentMethod = "bank"
)

type StudentStatus string

const (
    StudentActive    StudentStatus = "active"
    StudentLeft      StudentStatus = "left"
    StudentSuspended StudentStatus = "suspended"
)

type PaymentStatus string

const (
    PaymentPaid    PaymentStatus = "paid"
    PaymentUnpaid  PaymentStatus = "unpaid"
    PaymentPartial PaymentStatus = "partial"
)

type Language string

const (
    LangUzCyrl Language = "uz-cyrl"
    LangUzLatn Language = "uz-latn"
    LangEnglish Language = "en"
)
```

## User Models

```go
package models

type Permission struct {
    ID                 string `db:"id" json:"id"`
    CanViewStudents    bool   `db:"can_view_students" json:"canViewStudents"`
    CanEditStudents    bool   `db:"can_edit_students" json:"canEditStudents"`
    CanDeleteStudents  bool   `db:"can_delete_students" json:"canDeleteStudents"`
    CanViewTeachers    bool   `db:"can_view_teachers" json:"canViewTeachers"`
    CanEditTeachers    bool   `db:"can_edit_teachers" json:"canEditTeachers"`
    CanDeleteTeachers  bool   `db:"can_delete_teachers" json:"canDeleteTeachers"`
    CanViewClasses     bool   `db:"can_view_classes" json:"canViewClasses"`
    CanEditClasses     bool   `db:"can_edit_classes" json:"canEditClasses"`
    CanDeleteClasses   bool   `db:"can_delete_classes" json:"canDeleteClasses"`
    CanViewPayments    bool   `db:"can_view_payments" json:"canViewPayments"`
    CanEditPayments    bool   `db:"can_edit_payments" json:"canEditPayments"`
    CanViewSalaries    bool   `db:"can_view_salaries" json:"canViewSalaries"`
    CanEditSalaries    bool   `db:"can_edit_salaries" json:"canEditSalaries"`
    CanViewExpenses    bool   `db:"can_view_expenses" json:"canViewExpenses"`
    CanEditExpenses    bool   `db:"can_edit_expenses" json:"canEditExpenses"`
    CanDeleteExpenses  bool   `db:"can_delete_expenses" json:"canDeleteExpenses"`
    CanViewReports     bool   `db:"can_view_reports" json:"canViewReports"`
    CanViewSettings    bool   `db:"can_view_settings" json:"canViewSettings"`
    CanEditSettings    bool   `db:"can_edit_settings" json:"canEditSettings"`
}

type User struct {
    ID          string      `db:"id" json:"id"`
    Email       string      `db:"email" json:"email" validate:"required,email"`
    Password    string      `db:"password" json:"-"`
    Role        UserRole    `db:"role" json:"role"`
    FullName    string      `db:"full_name" json:"fullName" validate:"required"`
    BranchID    *string     `db:"branch_id" json:"branchId"`
    Permissions *Permission `db:"-" json:"permissions,omitempty"`
    CreatedAt   time.Time   `db:"created_at" json:"createdAt"`
    UpdatedAt   time.Time   `db:"updated_at" json:"updatedAt"`
}

// Request/Response DTOs
type LoginRequest struct {
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required,min=6"`
}

type LoginResponse struct {
    Token string `json:"token"`
    User  User   `json:"user"`
}

type CreateUserRequest struct {
    Email    string    `json:"email" validate:"required,email"`
    Password string    `json:"password" validate:"required,min=6"`
    FullName string    `json:"fullName" validate:"required"`
    Role     UserRole  `json:"role" validate:"required"`
    BranchID *string   `json:"branchId"`
}

type UpdateUserRequest struct {
    Email    *string   `json:"email"`
    FullName *string   `json:"fullName"`
    Role     *UserRole `json:"role"`
    BranchID *string   `json:"branchId"`
}
```

## Branch Models

```go
package models

type Branch struct {
    ID             string    `db:"id" json:"id"`
    Name           string    `db:"name" json:"name" validate:"required"`
    Address        string    `db:"address" json:"address" validate:"required"`
    Phone          string    `db:"phone" json:"phone" validate:"required"`
    MonthlyPayment float64   `db:"monthly_payment" json:"monthlyPayment"`
    AdminID        *string   `db:"admin_id" json:"adminId"`
    ManagerIDs     []string  `db:"-" json:"managerIds"`
    CreatedAt      time.Time `db:"created_at" json:"createdAt"`
    UpdatedAt      time.Time `db:"updated_at" json:"updatedAt"`
}

type CreateBranchRequest struct {
    Name           string   `json:"name" validate:"required"`
    Address        string   `json:"address" validate:"required"`
    Phone          string   `json:"phone" validate:"required"`
    MonthlyPayment float64  `json:"monthlyPayment"`
    AdminID        *string  `json:"adminId"`
}

type UpdateBranchRequest struct {
    Name           *string   `json:"name"`
    Address        *string   `json:"address"`
    Phone          *string   `json:"phone"`
    MonthlyPayment *float64  `json:"monthlyPayment"`
    AdminID        *string   `json:"adminId"`
}
```

## Student Models

```go
package models

type Student struct {
    ID              string        `db:"id" json:"id"`
    FullName        string        `db:"full_name" json:"fullName" validate:"required"`
    ClassID         string        `db:"class_id" json:"classId" validate:"required"`
    Phone           string        `db:"phone" json:"phone"`
    ParentPhone     string        `db:"parent_phone" json:"parentPhone"`
    MonthlyPayment  float64       `db:"monthly_payment" json:"monthlyPayment"`
    Status          StudentStatus `db:"status" json:"status"`
    BranchID        string        `db:"branch_id" json:"branchId"`
    EnrollmentDate  *time.Time    `db:"enrollment_date" json:"enrollmentDate"`
    LeftDate        *time.Time    `db:"left_date" json:"leftDate"`
    ClassSignedDate *time.Time    `db:"class_signed_date" json:"classSignedDate"`
    ClassConfirmed  bool          `db:"class_confirmed" json:"classConfirmed"`
    CreatedAt       time.Time     `db:"created_at" json:"createdAt"`
    UpdatedAt       time.Time     `db:"updated_at" json:"updatedAt"`
}

type CreateStudentRequest struct {
    FullName       string    `json:"fullName" validate:"required"`
    ClassID        string    `json:"classId" validate:"required"`
    Phone          string    `json:"phone"`
    ParentPhone    string    `json:"parentPhone"`
    MonthlyPayment float64   `json:"monthlyPayment"`
    Status         StudentStatus `json:"status"`
    BranchID       string    `json:"branchId" validate:"required"`
    EnrollmentDate *time.Time `json:"enrollmentDate"`
}

type UpdateStudentRequest struct {
    FullName       *string        `json:"fullName"`
    ClassID        *string        `json:"classId"`
    Phone          *string        `json:"phone"`
    ParentPhone    *string        `json:"parentPhone"`
    MonthlyPayment *float64       `json:"monthlyPayment"`
    Status         *StudentStatus `json:"status"`
}
```

## Teacher Models

```go
package models

type Teacher struct {
    ID             string    `db:"id" json:"id"`
    FullName       string    `db:"full_name" json:"fullName" validate:"required"`
    Subjects       []string  `db:"-" json:"subjects"`
    MonthlySalary  float64   `db:"monthly_salary" json:"monthlySalary"`
    Phone          string    `db:"phone" json:"phone"`
    Email          string    `db:"email" json:"email" validate:"email"`
    AssignedClasses []string `db:"-" json:"assignedClasses"`
    BranchID       string    `db:"branch_id" json:"branchId"`
    JoinedDate     *time.Time `db:"joined_date" json:"joinedDate"`
    CreatedAt      time.Time `db:"created_at" json:"createdAt"`
    UpdatedAt      time.Time `db:"updated_at" json:"updatedAt"`
}

type CreateTeacherRequest struct {
    FullName        string    `json:"fullName" validate:"required"`
    Subjects        []string  `json:"subjects"`
    MonthlySalary   float64   `json:"monthlySalary"`
    Phone           string    `json:"phone"`
    Email           string    `json:"email" validate:"email"`
    AssignedClasses []string  `json:"assignedClasses"`
    BranchID        string    `json:"branchId" validate:"required"`
    JoinedDate      *time.Time `json:"joinedDate"`
}

type UpdateTeacherRequest struct {
    FullName        *string   `json:"fullName"`
    Subjects        []string  `json:"subjects"`
    MonthlySalary   *float64  `json:"monthlySalary"`
    Phone           *string   `json:"phone"`
    Email           *string   `json:"email"`
    AssignedClasses []string  `json:"assignedClasses"`
}
```

## Class Models

```go
package models

type Class struct {
    ID        string    `db:"id" json:"id"`
    Name      string    `db:"name" json:"name" validate:"required"`
    TeacherID *string   `db:"teacher_id" json:"teacherId"`
    StudentIds []string `db:"-" json:"studentIds"`
    BranchID  string    `db:"branch_id" json:"branchId"`
    CreatedAt time.Time `db:"created_at" json:"createdAt"`
    UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

type CreateClassRequest struct {
    Name      string  `json:"name" validate:"required"`
    TeacherID *string `json:"teacherId"`
    BranchID  string  `json:"branchId" validate:"required"`
}

type UpdateClassRequest struct {
    Name      *string `json:"name"`
    TeacherID *string `json:"teacherId"`
}
```

## Payment Models

```go
package models

type Payment struct {
    ID            string        `db:"id" json:"id"`
    StudentID     string        `db:"student_id" json:"studentId" validate:"required"`
    Amount        float64       `db:"amount" json:"amount" validate:"required,gt=0"`
    Month         string        `db:"month" json:"month" validate:"required"` // e.g., "January"
    Year          int           `db:"year" json:"year" validate:"required"`
    PaymentMethod PaymentMethod `db:"payment_method" json:"paymentMethod"`
    Status        PaymentStatus `db:"status" json:"status"`
    InvoiceNumber string        `db:"invoice_number" json:"invoiceNumber" validate:"required"`
    Notes         *string       `db:"notes" json:"notes"`
    PaidDate      *time.Time    `db:"paid_date" json:"paidDate"`
    BranchID      string        `db:"branch_id" json:"branchId"`
    CreatedAt     time.Time     `db:"created_at" json:"createdAt"`
}

type CreatePaymentRequest struct {
    StudentID     string        `json:"studentId" validate:"required"`
    Amount        float64       `json:"amount" validate:"required,gt=0"`
    Month         string        `json:"month" validate:"required"`
    Year          int           `json:"year" validate:"required"`
    PaymentMethod PaymentMethod `json:"paymentMethod"`
    Status        PaymentStatus `json:"status"`
    InvoiceNumber string        `json:"invoiceNumber" validate:"required"`
    Notes         *string       `json:"notes"`
    PaidDate      *time.Time    `json:"paidDate"`
}

type UpdatePaymentRequest struct {
    Amount        *float64       `json:"amount"`
    PaymentMethod *PaymentMethod `json:"paymentMethod"`
    Status        *PaymentStatus `json:"status"`
    Notes         *string        `json:"notes"`
    PaidDate      *time.Time     `json:"paidDate"`
}
```

## Salary Models

```go
package models

type Salary struct {
    ID            string        `db:"id" json:"id"`
    TeacherID     string        `db:"teacher_id" json:"teacherId" validate:"required"`
    Amount        float64       `db:"amount" json:"amount" validate:"required,gt=0"`
    Month         string        `db:"month" json:"month" validate:"required"`
    Year          int           `db:"year" json:"year" validate:"required"`
    PaymentMethod PaymentMethod `db:"payment_method" json:"paymentMethod"`
    Status        PaymentStatus `db:"status" json:"status"`
    Notes         *string       `db:"notes" json:"notes"`
    PaidDate      *time.Time    `db:"paid_date" json:"paidDate"`
    BranchID      string        `db:"branch_id" json:"branchId"`
    CreatedAt     time.Time     `db:"created_at" json:"createdAt"`
}

type CreateSalaryRequest struct {
    TeacherID     string        `json:"teacherId" validate:"required"`
    Amount        float64       `json:"amount" validate:"required,gt=0"`
    Month         string        `json:"month" validate:"required"`
    Year          int           `json:"year" validate:"required"`
    PaymentMethod PaymentMethod `json:"paymentMethod"`
    Status        PaymentStatus `json:"status"`
    Notes         *string       `json:"notes"`
    PaidDate      *time.Time    `json:"paidDate"`
}

type UpdateSalaryRequest struct {
    Amount        *float64       `json:"amount"`
    PaymentMethod *PaymentMethod `json:"paymentMethod"`
    Status        *PaymentStatus `json:"status"`
    Notes         *string        `json:"notes"`
    PaidDate      *time.Time     `json:"paidDate"`
}
```

## Expense Models

```go
package models

type Expense struct {
    ID            string        `db:"id" json:"id"`
    Title         string        `db:"title" json:"title" validate:"required"`
    Description   string        `db:"description" json:"description"`
    Amount        float64       `db:"amount" json:"amount" validate:"required,gt=0"`
    Category      string        `db:"category" json:"category"`
    PaymentMethod PaymentMethod `db:"payment_method" json:"paymentMethod"`
    Date          time.Time     `db:"date" json:"date"`
    BranchID      string        `db:"branch_id" json:"branchId"`
    CreatedBy     string        `db:"created_by" json:"createdBy"`
    Notes         *string       `db:"notes" json:"notes"`
    CreatedAt     time.Time     `db:"created_at" json:"createdAt"`
}

type CreateExpenseRequest struct {
    Title         string        `json:"title" validate:"required"`
    Description   string        `json:"description"`
    Amount        float64       `json:"amount" validate:"required,gt=0"`
    Category      string        `json:"category"`
    PaymentMethod PaymentMethod `json:"paymentMethod"`
    Date          time.Time     `json:"date"`
    Notes         *string       `json:"notes"`
}

type UpdateExpenseRequest struct {
    Title         *string        `json:"title"`
    Description   *string        `json:"description"`
    Amount        *float64       `json:"amount"`
    Category      *string        `json:"category"`
    PaymentMethod *PaymentMethod `json:"paymentMethod"`
    Date          *time.Time     `json:"date"`
    Notes         *string        `json:"notes"`
}
```

## Income Models

```go
package models

type Income struct {
    ID          string     `db:"id" json:"id"`
    Source      string     `db:"source" json:"source" validate:"required"`
    Amount      float64    `db:"amount" json:"amount" validate:"required,gt=0"`
    Date        time.Time  `db:"date" json:"date"`
    Description *string    `db:"description" json:"description"`
    BranchID    string     `db:"branch_id" json:"branchId"`
    CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
}

type CreateIncomeRequest struct {
    Source      string    `json:"source" validate:"required"`
    Amount      float64   `json:"amount" validate:"required,gt=0"`
    Date        time.Time `json:"date"`
    Description *string   `json:"description"`
}
```

## Settings Models

```go
package models

type Settings struct {
    ID                     string    `db:"id" json:"id"`
    DefaultMonthlyPayment  float64   `db:"default_monthly_payment" json:"defaultMonthlyPayment"`
    DefaultTeacherSalary   float64   `db:"default_teacher_salary" json:"defaultTeacherSalary"`
    Currency               string    `db:"currency" json:"currency"`
    Language               Language  `db:"language" json:"language"`
    SchoolName             string    `db:"school_name" json:"schoolName" validate:"required"`
    SchoolLogo             *string   `db:"school_logo" json:"schoolLogo"`
    UpdatedAt              time.Time `db:"updated_at" json:"updatedAt"`
}

type UpdateSettingsRequest struct {
    DefaultMonthlyPayment *float64   `json:"defaultMonthlyPayment"`
    DefaultTeacherSalary  *float64   `json:"defaultTeacherSalary"`
    Currency              *string    `json:"currency"`
    Language              *Language  `json:"language"`
    SchoolName            *string    `json:"schoolName"`
    SchoolLogo            *string    `json:"schoolLogo"`
}
```

## Common Response Models

```go
package models

type ErrorResponse struct {
    Error   string `json:"error"`
    Message string `json:"message"`
    Code    int    `json:"code"`
}

type SuccessResponse struct {
    Data    interface{} `json:"data"`
    Message string      `json:"message"`
    Code    int         `json:"code"`
}

type PaginatedResponse struct {
    Data       interface{} `json:"data"`
    Total      int         `json:"total"`
    Page       int         `json:"page"`
    PageSize   int         `json:"pageSize"`
    TotalPages int         `json:"totalPages"`
}

type DashboardStats struct {
    TotalStudents      int     `json:"totalStudents"`
    TotalTeachers      int     `json:"totalTeachers"`
    TotalClasses       int     `json:"totalClasses"`
    TotalIncome        float64 `json:"totalIncome"`
    TotalExpenses      float64 `json:"totalExpenses"`
    NetProfit          float64 `json:"netProfit"`
    PendingPayments    float64 `json:"pendingPayments"`
    PendingSalaries    float64 `json:"pendingSalaries"`
}
```
