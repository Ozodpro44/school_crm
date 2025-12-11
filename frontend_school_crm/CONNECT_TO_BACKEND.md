# How to Connect Frontend Pages to Backend API

## Overview

The API client (`src/lib/api.ts`) is ready with all 49 endpoints. Now update the page components to use the backend instead of local storage.

## Quick Pattern

### Before (Using Local Storage)
```typescript
import { studentsDB } from "@/lib/storage";

const students = studentsDB.getAll();
```

### After (Using API)
```typescript
import { listStudents } from "@/lib/api";
import type { Student } from "@/lib/api";

const [students, setStudents] = useState<Student[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  loadStudents();
}, []);

const loadStudents = async () => {
  try {
    const user = getCurrentUser();
    const data = await listStudents(user?.branchId || "");
    setStudents(data);
  } catch (error) {
    console.error("Failed to load students:", error);
    toast({
      title: "Error",
      description: "Failed to load students",
      variant: "destructive"
    });
  }
};
```

## Page-by-Page Updates

### 1. Students Page (`src/pages/students.tsx`)

**Import:**
```typescript
import {
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  listClasses,
} from "@/lib/api";
import type { Student } from "@/lib/api";
```

**Load Data:**
```typescript
const [students, setStudents] = useState<Student[]>([]);

useEffect(() => {
  const user = getCurrentUser();
  if (!user?.branchId) return;
  
  listStudents(user.branchId)
    .then(setStudents)
    .catch(err => console.error(err));
}, []);
```

**Create Student:**
```typescript
const handleCreateStudent = async (formData: any) => {
  try {
    const user = getCurrentUser();
    const student = await createStudent({
      ...formData,
      branchId: user?.branchId || "",
    });
    setStudents([...students, student]);
  } catch (error) {
    console.error("Failed to create student:", error);
  }
};
```

**Update Student:**
```typescript
const handleUpdateStudent = async (id: string, updates: any) => {
  try {
    const updated = await updateStudent(id, updates);
    setStudents(students.map(s => s.id === id ? updated : s));
  } catch (error) {
    console.error("Failed to update student:", error);
  }
};
```

**Delete Student:**
```typescript
const handleDeleteStudent = async (id: string) => {
  try {
    await deleteStudent(id);
    setStudents(students.filter(s => s.id !== id));
  } catch (error) {
    console.error("Failed to delete student:", error);
  }
};
```

### 2. Payments Page (`src/pages/payments.tsx`)

**Import:**
```typescript
import {
  listPayments,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentSummary,
  listStudents,
} from "@/lib/api";
import type { Payment } from "@/lib/api";
```

**Load Data:**
```typescript
const [payments, setPayments] = useState<Payment[]>([]);
const [summary, setSummary] = useState<any>(null);

useEffect(() => {
  const user = getCurrentUser();
  if (!user?.branchId) return;
  
  Promise.all([
    listPayments({ branchId: user.branchId }),
    getPaymentSummary(user.branchId),
  ])
  .then(([paymentsData, summaryData]) => {
    setPayments(paymentsData);
    setSummary(summaryData);
  })
  .catch(err => console.error(err));
}, []);
```

**Create Payment:**
```typescript
const handleCreatePayment = async (formData: any) => {
  try {
    const user = getCurrentUser();
    const payment = await createPayment({
      ...formData,
      branchId: user?.branchId || "",
    });
    setPayments([...payments, payment]);
  } catch (error) {
    console.error("Failed to create payment:", error);
  }
};
```

### 3. Classes Page (`src/pages/classes.tsx`)

**Import:**
```typescript
import {
  listClasses,
  createClass,
  updateClass,
  deleteClass,
  listTeachers,
} from "@/lib/api";
import type { Class } from "@/lib/api";
```

**Load Data:**
```typescript
const [classes, setClasses] = useState<Class[]>([]);
const [teachers, setTeachers] = useState<any[]>([]);

useEffect(() => {
  const user = getCurrentUser();
  if (!user?.branchId) return;
  
  Promise.all([
    listClasses(user.branchId),
    listTeachers(user.branchId),
  ])
  .then(([classesData, teachersData]) => {
    setClasses(classesData);
    setTeachers(teachersData);
  })
  .catch(err => console.error(err));
}, []);
```

### 4. Teachers Page (`src/pages/teachers.tsx`)

**Import:**
```typescript
import {
  listTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
} from "@/lib/api";
import type { Teacher } from "@/lib/api";
```

**Load Data:**
```typescript
const [teachers, setTeachers] = useState<Teacher[]>([]);

useEffect(() => {
  const user = getCurrentUser();
  if (!user?.branchId) return;
  
  listTeachers(user.branchId)
    .then(setTeachers)
    .catch(err => console.error(err));
}, []);
```

### 5. Salaries Page (`src/pages/salaries.tsx`)

**Import:**
```typescript
import {
  listSalaries,
  createSalary,
  updateSalary,
  deleteSalary,
  listTeachers,
} from "@/lib/api";
import type { Salary, Teacher } from "@/lib/api";
```

**Load Data:**
```typescript
const [salaries, setSalaries] = useState<Salary[]>([]);
const [teachers, setTeachers] = useState<Teacher[]>([]);

useEffect(() => {
  const user = getCurrentUser();
  if (!user?.branchId) return;
  
  Promise.all([
    listSalaries(user.branchId),
    listTeachers(user.branchId),
  ])
  .then(([salariesData, teachersData]) => {
    setSalaries(salariesData);
    setTeachers(teachersData);
  })
  .catch(err => console.error(err));
}, []);
```

### 6. Expenses Page (`src/pages/expenses.tsx`)

**Import:**
```typescript
import {
  listExpenses,
  createExpense,
  deleteExpense,
} from "@/lib/api";
import type { Expense } from "@/lib/api";
```

**Load Data:**
```typescript
const [expenses, setExpenses] = useState<Expense[]>([]);

useEffect(() => {
  const user = getCurrentUser();
  if (!user?.branchId) return;
  
  listExpenses(user.branchId)
    .then(setExpenses)
    .catch(err => console.error(err));
}, []);
```

### 7. Branches Page (`src/pages/branches.tsx`)

**Import:**
```typescript
import {
  listBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from "@/lib/api";
import type { Branch } from "@/lib/api";
```

**Load Data:**
```typescript
const [branches, setBranches] = useState<Branch[]>([]);

useEffect(() => {
  listBranches()
    .then(setBranches)
    .catch(err => console.error(err));
}, []);
```

### 8. Settings Page (`src/pages/settings.tsx`)

**Import:**
```typescript
import {
  getSettings,
  updateSettings,
} from "@/lib/api";
import type { Settings } from "@/lib/api";
```

**Load Data:**
```typescript
const [settings, setSettings] = useState<Settings | null>(null);

useEffect(() => {
  getSettings()
    .then(setSettings)
    .catch(err => console.error(err));
}, []);

const handleUpdateSettings = async (updates: any) => {
  try {
    const updated = await updateSettings(updates);
    setSettings(updated);
  } catch (error) {
    console.error("Failed to update settings:", error);
  }
};
```

## Error Handling Template

```typescript
const handleAction = async () => {
  try {
    setLoading(true);
    // API call
    const result = await apiFunction(...);
    // Update state
    setData(result);
    // Show success
    toast({
      title: "Success",
      description: "Operation completed",
    });
  } catch (error) {
    console.error("Error:", error);
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Operation failed",
      variant: "destructive"
    });
  } finally {
    setLoading(false);
  }
};
```

## Loading States

```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listStudents(branchId);
      setData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  };
  load();
}, [branchId]);

if (loading) return <Skeleton />;
if (error) return <div>Error: {error}</div>;
```

## Tips

1. **Always get current user's branchId:**
   ```typescript
   const user = getCurrentUser();
   const branchId = user?.branchId || "";
   ```

2. **Handle loading states:**
   ```typescript
   const [loading, setLoading] = useState(true);
   // ...
   if (loading) return <LoadingSpinner />;
   ```

3. **Use try-catch for all API calls:**
   ```typescript
   try {
     const data = await apiFunction(...);
   } catch (error) {
     console.error(error);
     // Show error to user
   }
   ```

4. **Refresh after mutations:**
   ```typescript
   await deleteStudent(id);
   const updated = await listStudents(branchId);
   setStudents(updated);
   ```

5. **Type safety:**
   ```typescript
   import type { Student, Payment } from "@/lib/api";
   
   const [data, setData] = useState<Student[]>([]);
   ```

## Testing

After updating a page:

1. Start backend: `make run`
2. Start frontend: `npm run dev`
3. Login: `admin@example.com` / `password123`
4. Navigate to the page
5. Test create/read/update/delete operations
6. Check browser console for errors
7. Check backend logs for API errors

## Pages to Update

- [ ] `src/pages/students.tsx`
- [ ] `src/pages/payments.tsx`
- [ ] `src/pages/classes.tsx`
- [ ] `src/pages/teachers.tsx`
- [ ] `src/pages/salaries.tsx`
- [ ] `src/pages/expenses.tsx`
- [ ] `src/pages/branches.tsx`
- [ ] `src/pages/settings.tsx`

Once all pages are updated, the frontend will be fully connected to the backend!
