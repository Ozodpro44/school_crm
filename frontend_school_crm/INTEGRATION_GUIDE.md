# Frontend-Backend Integration Guide

## Complete API Integration

The frontend is now fully integrated with the Golang backend with proper TypeScript types, error handling, and all 40+ endpoints.

## Updated Files

### `src/lib/api.ts` - Complete API Client

All functions are now properly typed and ready to use:

```typescript
import {
  login,
  logout,
  listStudents,
  createPayment,
  getPaymentSummary,
  listTeachers,
  // ... all other functions
} from "@/lib/api";
```

## Data Types Available

All data types are fully typed with TypeScript interfaces:

```typescript
// User Types
User
LoginRequest
LoginResponse

// Student Types
Student
CreateStudentRequest

// Payment Types
Payment
CreatePaymentRequest
UpdatePaymentRequest
PaymentSummary

// Class Types
Class
CreateClassRequest

// Branch Types
Branch
CreateBranchRequest

// Teacher Types
Teacher
CreateTeacherRequest

// Salary Types
Salary
CreateSalaryRequest
UpdateSalaryRequest

// Expense Types
Expense
CreateExpenseRequest

// Income Types (NEW)
Income
CreateIncomeRequest

// Settings Types (NEW)
Settings
UpdateSettingsRequest
```

## Authentication

### Login & Registration

```typescript
import {
  login,
  register,
  logout,
  isAuthenticated,
  getCurrentUser,
} from "@/lib/api";

// Login
const response = await login({
  email: "user@example.com",
  password: "password123",
});

// User data stored automatically
console.log(response.user);
console.log(response.token);

// Check authentication
if (isAuthenticated()) {
  const user = getCurrentUser();
  console.log("Welcome", user?.fullName);
}

// Logout
logout();
```

## Examples by Feature

### Students Management

```typescript
import { listStudents, createStudent, updateStudent, deleteStudent } from "@/lib/api";

// List all students in a branch
const students = await listStudents("branch-id");

// Create new student
const newStudent = await createStudent({
  fullName: "Ahmed Ali",
  classId: "class-uuid",
  phone: "998901234567",
  parentPhone: "998909876543",
  monthlyPayment: 100000,
  status: "active",
  branchId: "branch-uuid",
  enrollmentDate: new Date().toISOString(),
});

// Update student
const updated = await updateStudent("student-id", {
  monthlyPayment: 120000,
  status: "active",
});

// Delete student
await deleteStudent("student-id");
```

### Payment Management

```typescript
import {
  createPayment,
  listPayments,
  updatePayment,
  deletePayment,
  getPaymentSummary,
} from "@/lib/api";

// Create payment
const payment = await createPayment({
  studentId: "student-uuid",
  amount: 100000,
  month: "01",
  year: 2024,
  paymentMethod: "cash",
  status: "paid",
  invoiceNumber: "INV-123",
  branchId: "branch-uuid",
});

// List payments with filters
const payments = await listPayments({
  branchId: "branch-id",
  studentId: "student-id",
  month: "01",
  year: 2024,
});

// Get summary
const summary = await getPaymentSummary("branch-id");
console.log(summary);
// {
//   totalPaid: 5000000,
//   totalUnpaid: 2000000,
//   totalPartial: 500000,
//   byMethod: {
//     card: 2000000,
//     cash: 2500000,
//     bank: 500000
//   }
// }

// Update payment
await updatePayment("payment-id", {
  status: "paid",
  paymentMethod: "card",
});

// Delete payment
await deletePayment("payment-id");
```

### Class Management

```typescript
import { listClasses, createClass, updateClass, deleteClass } from "@/lib/api";

// List classes
const classes = await listClasses("branch-id");

// Create class
const newClass = await createClass({
  name: "Class 1A",
  teacherId: "teacher-uuid",
  branchId: "branch-uuid",
});

// Update class
await updateClass("class-id", {
  name: "Class 1B",
  teacherId: "new-teacher-id",
});

// Delete class
await deleteClass("class-id");
```

### Branch Management

```typescript
import {
  listBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from "@/lib/api";

// List all branches
const branches = await listBranches();

// Create branch
const newBranch = await createBranch({
  name: "Main Branch",
  address: "123 Main Street, City",
  phone: "998901234567",
  monthlyPayment: 1000000,
  adminId: "admin-uuid",
});

// Update branch
await updateBranch("branch-id", {
  name: "Main Branch Updated",
  phone: "998909876543",
});

// Delete branch
await deleteBranch("branch-id");
```

### Teacher Management

```typescript
import {
  listTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
} from "@/lib/api";

// List teachers
const teachers = await listTeachers("branch-id");

// Create teacher
const newTeacher = await createTeacher({
  fullName: "Dr. Smith",
  subjects: ["Mathematics", "Physics"],
  monthlySalary: 500000,
  phone: "998901234567",
  email: "smith@example.com",
  branchId: "branch-uuid",
  joinedDate: new Date().toISOString(),
});

// Update teacher
await updateTeacher("teacher-id", {
  monthlySalary: 550000,
  subjects: ["Mathematics", "Physics", "Chemistry"],
});

// Delete teacher
await deleteTeacher("teacher-id");
```

### Salary Management

```typescript
import {
  createSalary,
  listSalaries,
  updateSalary,
  deleteSalary,
} from "@/lib/api";

// Create salary record
const salary = await createSalary({
  teacherId: "teacher-uuid",
  amount: 500000,
  month: "01",
  year: 2024,
  paymentMethod: "bank",
  status: "paid",
  branchId: "branch-uuid",
});

// List salaries
const salaries = await listSalaries("branch-id");

// Update salary
await updateSalary("salary-id", {
  status: "paid",
  paymentMethod: "bank",
});

// Delete salary
await deleteSalary("salary-id");
```

### Expense Management

```typescript
import { createExpense, listExpenses, deleteExpense } from "@/lib/api";

// Create expense
const expense = await createExpense({
  title: "Office Supplies",
  description: "Purchased printer ink and paper",
  amount: 50000,
  category: "supplies",
  paymentMethod: "cash",
  date: new Date().toISOString(),
  branchId: "branch-uuid",
  notes: "Bulk purchase",
});

// List expenses
const expenses = await listExpenses("branch-id");

// Delete expense
await deleteExpense("expense-id");
```

### Income Management (NEW)

```typescript
import { createIncome, listIncomes, deleteIncome } from "@/lib/api";

// Create income
const income = await createIncome({
  source: "Student Payments",
  amount: 5000000,
  date: new Date().toISOString(),
  description: "Monthly student payments",
  branchId: "branch-uuid",
});

// List incomes
const incomes = await listIncomes("branch-id");

// Delete income
await deleteIncome("income-id");
```

### Settings Management (NEW)

```typescript
import { getSettings, updateSettings } from "@/lib/api";

// Get settings
const settings = await getSettings();
console.log(settings.schoolName);
console.log(settings.currency);

// Update settings
const updated = await updateSettings({
  schoolName: "New School Name",
  currency: "USD",
  language: "en",
  defaultMonthlyPayment: 150000,
  defaultTeacherSalary: 600000,
});
```

### User Management

```typescript
import { listUsers, getUser, updateUser, deleteUser } from "@/lib/api";

// List all users
const users = await listUsers();

// Get user details
const user = await getUser("user-id");

// Update user
await updateUser("user-id", {
  fullName: "John Doe Updated",
  role: "manager",
});

// Delete user
await deleteUser("user-id");
```

## React Component Example

### Using in a React Component

```typescript
import { useState, useEffect } from "react";
import { listStudents, createPayment } from "@/lib/api";
import type { Student } from "@/lib/api";

export default function PaymentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await listStudents("branch-id-here");
      setStudents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async (studentId: string) => {
    try {
      const payment = await createPayment({
        studentId,
        amount: 100000,
        month: "01",
        year: 2024,
        paymentMethod: "cash",
        status: "paid",
        invoiceNumber: "INV-001",
        branchId: "branch-id-here",
      });
      console.log("Payment created:", payment);
      // Refresh data
      loadStudents();
    } catch (err) {
      console.error("Failed to create payment:", err);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Students</h1>
      {students.map((student) => (
        <div key={student.id}>
          <h2>{student.fullName}</h2>
          <p>Monthly Payment: {student.monthlyPayment}</p>
          <button onClick={() => handleCreatePayment(student.id)}>
            Create Payment
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Error Handling

The API client throws errors on failed requests. Always use try-catch:

```typescript
try {
  const student = await createStudent({
    fullName: "John",
    classId: "class-id",
    phone: "998901234567",
    parentPhone: "998909876543",
    monthlyPayment: 100000,
    status: "active",
    branchId: "branch-id",
  });
} catch (error) {
  if (error instanceof Error) {
    console.error("API Error:", error.message);
    // Handle error - show user feedback
  }
}
```

## Environment Configuration

Create `.env.local` in `frontend_school_crm/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

For production:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

## Features

✅ **Complete TypeScript Support** - All types from backend models
✅ **Full CRUD Operations** - Create, Read, Update, Delete for all resources
✅ **Authentication** - Login, register, logout with token management
✅ **Error Handling** - Proper error messages and status codes
✅ **Timeout Support** - 10 second timeout (configurable)
✅ **Authorization** - Automatic JWT token attachment
✅ **Response Parsing** - Automatic JSON parsing

## All Available Endpoints

### Authentication (3)
- `login(request)` - POST /auth/login
- `register(request)` - POST /auth/register
- `logout()` - Clear token

### Users (4)
- `listUsers()` - GET /users
- `getUser(id)` - GET /users/{id}
- `updateUser(id, updates)` - PUT /users/{id}
- `deleteUser(id)` - DELETE /users/{id}

### Students (5)
- `createStudent(request)` - POST /students
- `getStudent(id)` - GET /students/{id}
- `listStudents(branchId)` - GET /students?branchId=
- `updateStudent(id, updates)` - PUT /students/{id}
- `deleteStudent(id)` - DELETE /students/{id}

### Payments (6)
- `createPayment(request)` - POST /payments
- `getPayment(id)` - GET /payments/{id}
- `listPayments(filters)` - GET /payments?...
- `updatePayment(id, updates)` - PUT /payments/{id}
- `deletePayment(id)` - DELETE /payments/{id}
- `getPaymentSummary(branchId)` - GET /payments/branch/{branchId}/summary

### Classes (5)
- `createClass(request)` - POST /classes
- `getClass(id)` - GET /classes/{id}
- `listClasses(branchId)` - GET /classes?branchId=
- `updateClass(id, updates)` - PUT /classes/{id}
- `deleteClass(id)` - DELETE /classes/{id}

### Branches (5)
- `createBranch(request)` - POST /branches
- `getBranch(id)` - GET /branches/{id}
- `listBranches()` - GET /branches
- `updateBranch(id, updates)` - PUT /branches/{id}
- `deleteBranch(id)` - DELETE /branches/{id}

### Teachers (5)
- `createTeacher(request)` - POST /teachers
- `getTeacher(id)` - GET /teachers/{id}
- `listTeachers(branchId)` - GET /teachers?branchId=
- `updateTeacher(id, updates)` - PUT /teachers/{id}
- `deleteTeacher(id)` - DELETE /teachers/{id}

### Salaries (5)
- `createSalary(request)` - POST /salaries
- `getSalary(id)` - GET /salaries/{id}
- `listSalaries(branchId)` - GET /salaries?branchId=
- `updateSalary(id, updates)` - PUT /salaries/{id}
- `deleteSalary(id)` - DELETE /salaries/{id}

### Expenses (4)
- `createExpense(request)` - POST /expenses
- `getExpense(id)` - GET /expenses/{id}
- `listExpenses(branchId)` - GET /expenses?branchId=
- `deleteExpense(id)` - DELETE /expenses/{id}

### Income (4) - NEW
- `createIncome(request)` - POST /incomes
- `getIncome(id)` - GET /incomes/{id}
- `listIncomes(branchId)` - GET /incomes?branchId=
- `deleteIncome(id)` - DELETE /incomes/{id}

### Settings (2) - NEW
- `getSettings()` - GET /settings
- `updateSettings(updates)` - PUT /settings

### Utilities (1)
- `healthCheck()` - GET /health

**Total: 48 API endpoints**

## Next Steps

1. Update your page components to use these functions
2. Replace hardcoded data with API calls
3. Add proper error handling in all components
4. Test with the backend running
5. Deploy to production

See individual page files for implementation examples.
