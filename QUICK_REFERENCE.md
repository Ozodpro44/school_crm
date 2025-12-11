# Quick Reference - API Cheat Sheet

## Import

```typescript
import {
  // Auth
  login, register, logout, isAuthenticated, getCurrentUser,
  
  // Students
  listStudents, createStudent, getStudent, updateStudent, deleteStudent,
  
  // Payments
  listPayments, createPayment, getPayment, updatePayment, deletePayment, getPaymentSummary,
  
  // Classes
  listClasses, createClass, getClass, updateClass, deleteClass,
  
  // Teachers
  listTeachers, createTeacher, getTeacher, updateTeacher, deleteTeacher,
  
  // Branches
  listBranches, createBranch, getBranch, updateBranch, deleteBranch,
  
  // Salaries
  listSalaries, createSalary, getSalary, updateSalary, deleteSalary,
  
  // Expenses
  listExpenses, createExpense, getExpense, deleteExpense,
  
  // Income
  listIncomes, createIncome, getIncome, deleteIncome,
  
  // Settings
  getSettings, updateSettings,
  
  // Utilities
  healthCheck,
} from "@/lib/api";
import type {
  Student, Payment, Teacher, Salary, Expense, Income,
  CreateStudentRequest, CreatePaymentRequest, // ... etc
} from "@/lib/api";
```

## Authentication

```typescript
// LOGIN
await login({ email, password })
// Returns: { token, user }

// LOGOUT
logout()

// CHECK
if (isAuthenticated()) { ... }

// GET USER
const user = getCurrentUser()
```

## Students

```typescript
// LIST
const students = await listStudents(branchId)

// CREATE
const s = await createStudent({
  fullName: "Name",
  classId: "id",
  phone: "123",
  parentPhone: "123",
  monthlyPayment: 100000,
  status: "active",
  branchId: "id",
})

// GET
const s = await getStudent(id)

// UPDATE
await updateStudent(id, { monthlyPayment: 120000 })

// DELETE
await deleteStudent(id)
```

## Payments

```typescript
// CREATE
const p = await createPayment({
  studentId: "id",
  amount: 100000,
  month: "01",
  year: 2024,
  paymentMethod: "cash",
  status: "paid",
  invoiceNumber: "INV-123",
  branchId: "id",
})

// LIST
const payments = await listPayments({
  branchId: "id",
  studentId: "id", // optional
  month: "01", // optional
  year: 2024, // optional
})

// GET
const p = await getPayment(id)

// UPDATE
await updatePayment(id, { status: "paid" })

// SUMMARY
const s = await getPaymentSummary(branchId)
// { totalPaid, totalUnpaid, totalPartial, byMethod }

// DELETE
await deletePayment(id)
```

## Classes

```typescript
// LIST
const classes = await listClasses(branchId)

// CREATE
const c = await createClass({
  name: "Class 1A",
  teacherId: "id",
  branchId: "id",
})

// GET
const c = await getClass(id)

// UPDATE
await updateClass(id, { name: "New Name" })

// DELETE
await deleteClass(id)
```

## Teachers

```typescript
// LIST
const teachers = await listTeachers(branchId)

// CREATE
const t = await createTeacher({
  fullName: "Name",
  subjects: ["Math", "Physics"],
  monthlySalary: 500000,
  phone: "123",
  email: "email@example.com",
  branchId: "id",
})

// GET
const t = await getTeacher(id)

// UPDATE
await updateTeacher(id, { monthlySalary: 600000 })

// DELETE
await deleteTeacher(id)
```

## Branches

```typescript
// LIST
const branches = await listBranches()

// CREATE
const b = await createBranch({
  name: "Main",
  address: "123 St",
  phone: "123",
  monthlyPayment: 1000000,
  adminId: "id",
})

// GET
const b = await getBranch(id)

// UPDATE
await updateBranch(id, { name: "New Name" })

// DELETE
await deleteBranch(id)
```

## Salaries

```typescript
// LIST
const salaries = await listSalaries(branchId)

// CREATE
const s = await createSalary({
  teacherId: "id",
  amount: 500000,
  month: "01",
  year: 2024,
  paymentMethod: "bank",
  status: "paid",
  branchId: "id",
})

// GET
const s = await getSalary(id)

// UPDATE
await updateSalary(id, { status: "paid" })

// DELETE
await deleteSalary(id)
```

## Expenses

```typescript
// LIST
const expenses = await listExpenses(branchId)

// CREATE
const e = await createExpense({
  title: "Supplies",
  description: "...",
  amount: 50000,
  category: "supplies",
  paymentMethod: "cash",
  date: "2024-01-15T00:00:00Z",
  branchId: "id",
})

// GET
const e = await getExpense(id)

// DELETE
await deleteExpense(id)
```

## Income

```typescript
// LIST
const incomes = await listIncomes(branchId)

// CREATE
const i = await createIncome({
  source: "Payments",
  amount: 5000000,
  date: "2024-01-31T00:00:00Z",
  description: "...",
  branchId: "id",
})

// GET
const i = await getIncome(id)

// DELETE
await deleteIncome(id)
```

## Settings

```typescript
// GET
const s = await getSettings()

// UPDATE
await updateSettings({
  schoolName: "New Name",
  currency: "USD",
})
```

## Error Handling

```typescript
try {
  const data = await functionName(...)
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message)
  }
}
```

## React Component Pattern

```typescript
import { useState, useEffect } from "react"
import { listStudents } from "@/lib/api"
import type { Student } from "@/lib/api"

export default function Page() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const data = await listStudents("branch-id")
      setStudents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      {students.map(s => (
        <div key={s.id}>{s.fullName}</div>
      ))}
    </div>
  )
}
```

## Environment Setup

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

## Status Constants

**Student Status:** `"active"` | `"left"` | `"suspended"`

**Payment Status:** `"paid"` | `"unpaid"` | `"partial"`

**Payment Method:** `"cash"` | `"card"` | `"bank"`

**User Role:** `"admin"` | `"branch_admin"` | `"manager"` | `"accountant"` | `"teacher"` | `"student"` | `"parent"`

## Endpoint Count

| Category | Count |
|----------|-------|
| Auth | 3 |
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

## Quick Start

```bash
# Setup
cd frontend_school_crm
cp .env.example .env.local
npm install

# Run
npm run dev  # http://localhost:3000

# Backend
cd ../backend_school_crm
go run cmd/main.go  # http://localhost:8080
```

## Test Credentials

```
Email: admin@example.com
Password: password123
```

## Debugging

```typescript
// Check if connected
import { healthCheck } from "@/lib/api"
const h = await healthCheck()
console.log(h)  // { status: "healthy" }

// Check auth
import { isAuthenticated, getCurrentUser } from "@/lib/api"
console.log(isAuthenticated())
console.log(getCurrentUser())
```

---

Keep this handy! 🚀
