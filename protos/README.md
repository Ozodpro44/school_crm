# school-crm/protos

Shared Protocol Buffer definitions for all School CRM microservices.

## Structure

```
protos/
├── common/v1/         shared types: PageRequest, PageResponse, BranchContext
├── auth/v1/           AuthService — ValidateToken, Login, Logout
├── user/v1/           UserService — GetUser, GetBranch, CheckPermission
├── student/v1/        StudentService — ListStudents, GetStudent
├── payment/v1/        PaymentService — ListPayments, GetPayment
├── teacher/v1/        TeacherService — ListTeachers, GetTeacher
├── finance/v1/        FinanceService — GetFinancialSummary, ListExpenses
└── notification/v1/   NotificationService — SendNotification, MarkRead
```

## Code generation

Install [buf](https://buf.build/docs/installation), then:

```sh
buf dep update          # fetch googleapis dependency
buf generate            # generates Go code into gen/go/
```

Generated code lands in `gen/go/` — do not edit by hand.

## Usage in services

Each service imports this module:

```go
import authv1 "github.com/school-crm/protos/auth/v1"
import commonv1 "github.com/school-crm/protos/common/v1"
```

Add to `go.mod`:

```
require github.com/school-crm/protos v0.1.0
```
