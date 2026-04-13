# Complete API Usage Examples

## Quick Reference - All 48 Endpoints

### 1. Authentication & User Management

```typescript
// LOGIN
import { login, logout, isAuthenticated, getCurrentUser } from "@/lib/api";

const user = await login({
  email: "admin@example.com",
  password: "password123",
});
// Returns: { token, user: { id, email, fullName, role, branchId } }

// LOGOUT
logout();

// CHECK AUTH
if (isAuthenticated()) {
  const currentUser = getCurrentUser();
}

// LIST ALL USERS
const users = await listUsers();

// GET SPECIFIC USER
const user = await getUser("user-id");

// UPDATE USER
await updateUser("user-id", {
  fullName: "New Name",
  role: "manager",
});

// DELETE USER
await deleteUser("user-id");
```

### 2. Student Management

```typescript
import {
  createStudent,
  getStudent,
  listStudents,
  updateStudent,
  deleteStudent,
} from "@/lib/api";

// CREATE STUDENT
const student = await createStudent({
  fullName: "Ahmed Ali",
  classId: "class-uuid",
  phone: "998901234567",
  parentPhone: "998909876543",
  monthlyPayment: 100000,
  status: "active", // or "left", "suspended"
  branchId: "branch-uuid",
  enrollmentDate: "2024-01-15T00:00:00Z",
});

// GET SINGLE STUDENT
const student = await getStudent("student-id");

// LIST ALL STUDENTS IN BRANCH
const students = await listStudents("branch-id");

// UPDATE STUDENT
await updateStudent("student-id", {
  monthlyPayment: 120000,
  status: "suspended",
});

// DELETE STUDENT
await deleteStudent("student-id");
```

### 3. Payment Management

```typescript
import {
  createPayment,
  getPayment,
  listPayments,
  updatePayment,
  deletePayment,
  getPaymentSummary,
} from "@/lib/api";

// CREATE PAYMENT
const payment = await createPayment({
  studentId: "student-uuid",
  amount: 100000,
  month: "01",
  year: 2024,
  paymentMethod: "cash", // or "card", "bank"
  status: "paid", // or "unpaid", "partial"
  invoiceNumber: "INV-12345",
  notes: "Payment received in cash",
  paidDate: "2024-01-15T00:00:00Z",
  branchId: "branch-uuid",
});

// GET SINGLE PAYMENT
const payment = await getPayment("payment-id");

// LIST PAYMENTS (with filters)
const payments = await listPayments({
  branchId: "branch-id",
  studentId: "student-id", // optional
  month: "01", // optional
  year: 2024, // optional
});

// UPDATE PAYMENT
await updatePayment("payment-id", {
  status: "paid",
  paymentMethod: "card",
  amount: 120000,
});

// DELETE PAYMENT
await deletePayment("payment-id");

// GET PAYMENT SUMMARY
const summary = await getPaymentSummary("branch-id");
// Returns:
// {
//   totalPaid: 5000000,
//   totalUnpaid: 2000000,
//   totalPartial: 500000,
//   byMethod: {
//     cash: 2500000,
//     card: 2000000,
//     bank: 500000
//   }
// }
```

### 4. Class Management

```typescript
import {
  createClass,
  getClass,
  listClasses,
  updateClass,
  deleteClass,
} from "@/lib/api";

// CREATE CLASS
const classData = await createClass({
  name: "Class 1A",
  teacherId: "teacher-uuid",
  branchId: "branch-uuid",
});

// GET SINGLE CLASS
const classData = await getClass("class-id");

// LIST CLASSES IN BRANCH
const classes = await listClasses("branch-id");

// UPDATE CLASS
await updateClass("class-id", {
  name: "Class 1B",
  teacherId: "new-teacher-id",
});

// DELETE CLASS
await deleteClass("class-id");
```

### 5. Branch Management

```typescript
import {
  createBranch,
  getBranch,
  listBranches,
  updateBranch,
  deleteBranch,
} from "@/lib/api";

// CREATE BRANCH
const branch = await createBranch({
  name: "Main Branch",
  address: "123 Main Street, City",
  phone: "998901234567",
  monthlyPayment: 1000000,
  adminId: "admin-uuid",
});

// GET SINGLE BRANCH
const branch = await getBranch("branch-id");

// LIST ALL BRANCHES
const branches = await listBranches();

// UPDATE BRANCH
await updateBranch("branch-id", {
  name: "Main Branch Updated",
  phone: "998909876543",
});

// DELETE BRANCH
await deleteBranch("branch-id");
```

### 6. Teacher Management

```typescript
import {
  createTeacher,
  getTeacher,
  listTeachers,
  updateTeacher,
  deleteTeacher,
} from "@/lib/api";

// CREATE TEACHER
const teacher = await createTeacher({
  fullName: "Dr. Smith",
  subjects: ["Mathematics", "Physics"],
  monthlySalary: 500000,
  phone: "998901234567",
  email: "smith@example.com",
  branchId: "branch-uuid",
  joinedDate: "2024-01-01T00:00:00Z",
});

// GET SINGLE TEACHER
const teacher = await getTeacher("teacher-id");

// LIST TEACHERS IN BRANCH
const teachers = await listTeachers("branch-id");

// UPDATE TEACHER
await updateTeacher("teacher-id", {
  monthlySalary: 550000,
  subjects: ["Mathematics", "Physics", "Chemistry"],
});

// DELETE TEACHER
await deleteTeacher("teacher-id");
```

### 7. Salary Management

```typescript
import {
  createSalary,
  getSalary,
  listSalaries,
  updateSalary,
  deleteSalary,
} from "@/lib/api";

// CREATE SALARY RECORD
const salary = await createSalary({
  teacherId: "teacher-uuid",
  amount: 500000,
  month: "01",
  year: 2024,
  paymentMethod: "bank", // or "cash", "card"
  status: "paid", // or "unpaid", "partial"
  notes: "January salary payment",
  paidDate: "2024-01-31T00:00:00Z",
  branchId: "branch-uuid",
});

// GET SINGLE SALARY
const salary = await getSalary("salary-id");

// LIST SALARIES IN BRANCH
const salaries = await listSalaries("branch-id");

// UPDATE SALARY
await updateSalary("salary-id", {
  status: "paid",
  paymentMethod: "bank",
});

// DELETE SALARY
await deleteSalary("salary-id");
```

### 8. Expense Management

```typescript
import { createExpense, getExpense, listExpenses, deleteExpense } from "@/lib/api";

// CREATE EXPENSE
const expense = await createExpense({
  title: "Office Supplies",
  description: "Purchased printer ink and paper",
  amount: 50000,
  category: "supplies", // or "utilities", "maintenance", etc.
  paymentMethod: "cash", // or "card", "bank"
  date: "2024-01-15T00:00:00Z",
  branchId: "branch-uuid",
  notes: "Bulk purchase for office",
});

// GET SINGLE EXPENSE
const expense = await getExpense("expense-id");

// LIST EXPENSES IN BRANCH
const expenses = await listExpenses("branch-id");

// DELETE EXPENSE
await deleteExpense("expense-id");
```

### 9. Income Management

```typescript
import { createIncome, getIncome, listIncomes, deleteIncome } from "@/lib/api";

// CREATE INCOME RECORD
const income = await createIncome({
  source: "Student Payments", // or "Donations", "Grants", etc.
  amount: 5000000,
  date: "2024-01-31T00:00:00Z",
  description: "Monthly student payments collected",
  branchId: "branch-uuid",
});

// GET SINGLE INCOME
const income = await getIncome("income-id");

// LIST INCOMES IN BRANCH
const incomes = await listIncomes("branch-id");

// DELETE INCOME
await deleteIncome("income-id");
```

### 10. Settings Management

```typescript
import { getSettings, updateSettings } from "@/lib/api";

// GET SETTINGS
const settings = await getSettings();
// Returns:
// {
//   id: "uuid",
//   defaultMonthlyPayment: 100000,
//   defaultTeacherSalary: 500000,
//   currency: "UZS",
//   language: "en",
//   schoolName: "School Name",
//   schoolLogo: "url",
//   currentMonth: "01",
//   currentYear: 2024,
//   updatedAt: "2024-01-01T00:00:00Z"
// }

// UPDATE SETTINGS
const updated = await updateSettings({
  schoolName: "New School Name",
  currency: "USD",
  language: "ru",
  defaultMonthlyPayment: 150000,
  defaultTeacherSalary: 600000,
});
```

### 11. Health Check

```typescript
import { healthCheck } from "@/lib/api";

const health = await healthCheck();
// Returns: { status: "healthy" } or { status: "error" }
```

## Complete React Page Example

```typescript
import { useState, useEffect } from "react";
import {
  listStudents,
  createPayment,
  updateStudent,
  getPaymentSummary,
  Student,
  Payment,
} from "@/lib/api";

interface Dashboard {
  students: Student[];
  paymentSummary: {
    totalPaid: number;
    totalUnpaid: number;
    totalPartial: number;
  };
  loading: boolean;
  error: string | null;
}

export default function DashboardPage() {
  const [state, setState] = useState<Dashboard>({
    students: [],
    paymentSummary: {
      totalPaid: 0,
      totalUnpaid: 0,
      totalPartial: 0,
    },
    loading: true,
    error: null,
  });

  const branchId = "branch-uuid"; // Get from user context

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [students, summary] = await Promise.all([
        listStudents(branchId),
        getPaymentSummary(branchId),
      ]);

      setState((prev) => ({
        ...prev,
        students,
        paymentSummary: {
          totalPaid: summary.totalPaid,
          totalUnpaid: summary.totalUnpaid,
          totalPartial: summary.totalPartial,
        },
        loading: false,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load data",
      }));
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
        invoiceNumber: `INV-${Date.now()}`,
        branchId,
      });

      console.log("Payment created:", payment);
      // Refresh dashboard
      loadDashboard();
    } catch (err) {
      alert(`Failed to create payment: ${err}`);
    }
  };

  if (state.loading) return <div className="p-4">Loading...</div>;
  if (state.error) return <div className="p-4 text-red-600">Error: {state.error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-green-100 p-4 rounded">
          <p className="text-sm text-gray-600">Total Paid</p>
          <p className="text-2xl font-bold">{state.paymentSummary.totalPaid}</p>
        </div>
        <div className="bg-red-100 p-4 rounded">
          <p className="text-sm text-gray-600">Total Unpaid</p>
          <p className="text-2xl font-bold">{state.paymentSummary.totalUnpaid}</p>
        </div>
        <div className="bg-yellow-100 p-4 rounded">
          <p className="text-sm text-gray-600">Total Partial</p>
          <p className="text-2xl font-bold">{state.paymentSummary.totalPartial}</p>
        </div>
      </div>

      {/* Students List */}
      <div className="bg-white rounded shadow">
        <h2 className="text-xl font-bold p-4 border-b">Students</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-left">Monthly Payment</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.students.map((student) => (
                <tr key={student.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{student.fullName}</td>
                  <td className="px-4 py-2">{student.phone}</td>
                  <td className="px-4 py-2">{student.monthlyPayment}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded text-sm font-semibold ${
                        student.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {student.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleCreatePayment(student.id)}
                      className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                    >
                      Record Payment
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

## Error Handling Best Practices

```typescript
// Always wrap API calls in try-catch
try {
  const student = await getStudent("student-id");
  // Handle success
} catch (error) {
  if (error instanceof Error) {
    // 401 Unauthorized - redirect to login
    if (error.message.includes("401")) {
      window.location.href = "/login";
    }

    // 404 Not Found - show not found message
    if (error.message.includes("404")) {
      console.log("Resource not found");
    }

    // Other errors
    console.error("API Error:", error.message);
  }
}
```

## Data Validation

```typescript
// Always validate input before API calls
function createStudentForm() {
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    classId: "",
    parentPhone: "",
    monthlyPayment: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!formData.fullName.trim()) {
      alert("Full name is required");
      return;
    }

    if (!formData.phone.trim()) {
      alert("Phone is required");
      return;
    }

    if (formData.monthlyPayment <= 0) {
      alert("Monthly payment must be greater than 0");
      return;
    }

    try {
      const student = await createStudent({
        ...formData,
        status: "active",
        branchId: "branch-id",
      });
      alert("Student created successfully!");
    } catch (err) {
      alert(`Failed: ${err}`);
    }
  };

  return <form onSubmit={handleSubmit}>{/* form fields */}</form>;
}
```

## Total API Endpoints Summary

| Category | Count |
|----------|-------|
| Authentication | 3 |
| Users | 4 |
| Students | 5 |
| Payments | 6 |
| Classes | 5 |
| Branches | 5 |
| Teachers | 5 |
| Salaries | 5 |
| Expenses | 4 |
| Income | 4 |
| Settings | 2 |
| Utilities | 1 |
| **Total** | **49** |

All endpoints are fully typed with TypeScript and ready to use in your React components.
