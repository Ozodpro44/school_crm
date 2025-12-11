# School Management System API Specification

## Base URL
```
https://api.school.example.com/api/v1
```

## Authentication

All endpoints (except login) require JWT token in the Authorization header:
```
Authorization: Bearer {token}
```

---

## Authentication Endpoints

### 1. Login
**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "admin@school.com",
  "password": "admin123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-1",
    "email": "admin@school.com",
    "role": "admin",
    "fullName": "Admin User",
    "branchId": null,
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

**Error (401 Unauthorized):**
```json
{
  "error": "Unauthorized",
  "message": "Invalid email or password",
  "code": 401
}
```

### 2. Logout
**POST** `/auth/logout`

**Headers:** Authorization required

**Response (200 OK):**
```json
{
  "message": "Successfully logged out",
  "code": 200
}
```

### 3. Refresh Token
**POST** `/auth/refresh`

**Headers:** Authorization required

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "code": 200
}
```

---

## Users Endpoints

### 1. Create User
**POST** `/users`

**Headers:** Authorization required, Admin role

**Request Body:**
```json
{
  "email": "teacher@school.com",
  "password": "secure_password",
  "fullName": "John Teacher",
  "role": "teacher",
  "branchId": "branch-1"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "user-2",
    "email": "teacher@school.com",
    "role": "teacher",
    "fullName": "John Teacher",
    "branchId": "branch-1",
    "createdAt": "2025-01-01T12:00:00Z"
  },
  "message": "User created successfully",
  "code": 201
}
```

### 2. Get All Users
**GET** `/users`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 10)
- `role` (optional): Filter by role
- `branchId` (optional): Filter by branch

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "user-1",
      "email": "admin@school.com",
      "role": "admin",
      "fullName": "Admin User",
      "branchId": null,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10,
  "totalPages": 1
}
```

### 3. Get User by ID
**GET** `/users/{id}`

**Response (200 OK):**
```json
{
  "data": {
    "id": "user-1",
    "email": "admin@school.com",
    "role": "admin",
    "fullName": "Admin User",
    "permissions": {
      "canViewStudents": true,
      "canEditStudents": true,
      ...
    },
    "branchId": null,
    "createdAt": "2025-01-01T00:00:00Z"
  },
  "message": "User retrieved successfully",
  "code": 200
}
```

### 4. Update User
**PUT** `/users/{id}`

**Request Body:**
```json
{
  "fullName": "Updated Name",
  "role": "accountant"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "user-1",
    "email": "admin@school.com",
    "role": "accountant",
    "fullName": "Updated Name",
    "branchId": null,
    "updatedAt": "2025-01-02T00:00:00Z"
  },
  "message": "User updated successfully",
  "code": 200
}
```

### 5. Delete User
**DELETE** `/users/{id}`

**Response (200 OK):**
```json
{
  "message": "User deleted successfully",
  "code": 200
}
```

---

## Branches Endpoints

### 1. Create Branch
**POST** `/branches`

**Request Body:**
```json
{
  "name": "Main Branch",
  "address": "123 Main Street",
  "phone": "+998901234567",
  "monthlyPayment": 50000,
  "adminId": "user-1"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "branch-1",
    "name": "Main Branch",
    "address": "123 Main Street",
    "phone": "+998901234567",
    "monthlyPayment": 50000,
    "adminId": "user-1",
    "managerIds": [],
    "createdAt": "2025-01-01T00:00:00Z"
  },
  "message": "Branch created successfully",
  "code": 201
}
```

### 2. Get All Branches
**GET** `/branches`

**Query Parameters:**
- `page` (optional)
- `pageSize` (optional)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "branch-1",
      "name": "Main Branch",
      "address": "123 Main Street",
      "phone": "+998901234567",
      "monthlyPayment": 50000,
      "adminId": "user-1",
      "managerIds": []
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10,
  "totalPages": 1
}
```

### 3. Get Branch by ID
**GET** `/branches/{id}`

**Response (200 OK):**
```json
{
  "data": {
    "id": "branch-1",
    "name": "Main Branch",
    "address": "123 Main Street",
    "phone": "+998901234567",
    "monthlyPayment": 50000,
    "adminId": "user-1",
    "managerIds": []
  }
}
```

### 4. Update Branch
**PUT** `/branches/{id}`

**Request Body:**
```json
{
  "name": "Updated Branch Name",
  "phone": "+998909876543"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "branch-1",
    "name": "Updated Branch Name",
    "phone": "+998909876543",
    ...
  },
  "message": "Branch updated successfully",
  "code": 200
}
```

### 5. Delete Branch
**DELETE** `/branches/{id}`

**Response (200 OK):**
```json
{
  "message": "Branch deleted successfully",
  "code": 200
}
```

---

## Students Endpoints

### 1. Create Student
**POST** `/students`

**Request Body:**
```json
{
  "fullName": "Ahmed Ali",
  "classId": "class-1",
  "phone": "+998901111111",
  "parentPhone": "+998902222222",
  "monthlyPayment": 500000,
  "status": "active",
  "branchId": "branch-1"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "student-1",
    "fullName": "Ahmed Ali",
    "classId": "class-1",
    "phone": "+998901111111",
    "parentPhone": "+998902222222",
    "monthlyPayment": 500000,
    "status": "active",
    "branchId": "branch-1",
    "enrollmentDate": "2025-01-01T00:00:00Z",
    "createdAt": "2025-01-01T00:00:00Z"
  },
  "message": "Student created successfully",
  "code": 201
}
```

### 2. Get All Students
**GET** `/students`

**Query Parameters:**
- `page` (optional)
- `pageSize` (optional)
- `branchId` (optional)
- `classId` (optional)
- `status` (optional): "active", "left", "suspended"
- `search` (optional): Search by name or phone

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "student-1",
      "fullName": "Ahmed Ali",
      "classId": "class-1",
      "phone": "+998901111111",
      "monthlyPayment": 500000,
      "status": "active",
      "branchId": "branch-1"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10,
  "totalPages": 1
}
```

### 3. Get Student by ID
**GET** `/students/{id}`

**Response (200 OK):**
```json
{
  "data": {
    "id": "student-1",
    "fullName": "Ahmed Ali",
    "classId": "class-1",
    "phone": "+998901111111",
    "parentPhone": "+998902222222",
    "monthlyPayment": 500000,
    "status": "active",
    "branchId": "branch-1",
    "enrollmentDate": "2025-01-01T00:00:00Z",
    "classSignedDate": "2025-01-01T00:00:00Z",
    "classConfirmed": true,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
}
```

### 4. Update Student
**PUT** `/students/{id}`

**Request Body:**
```json
{
  "fullName": "Ahmed Mohammed Ali",
  "status": "suspended"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "student-1",
    "fullName": "Ahmed Mohammed Ali",
    "status": "suspended",
    ...
  },
  "message": "Student updated successfully",
  "code": 200
}
```

### 5. Delete Student
**DELETE** `/students/{id}`

**Response (200 OK):**
```json
{
  "message": "Student deleted successfully",
  "code": 200
}
```

### 6. Get Student Payments
**GET** `/students/{id}/payments`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "payment-1",
      "studentId": "student-1",
      "amount": 500000,
      "month": "January",
      "year": 2025,
      "paymentMethod": "cash",
      "status": "paid",
      "invoiceNumber": "INV-001",
      "paidDate": "2025-01-05T00:00:00Z"
    }
  ]
}
```

---

## Teachers Endpoints

### 1. Create Teacher
**POST** `/teachers`

**Request Body:**
```json
{
  "fullName": "Dr. Sarah Smith",
  "subjects": ["Mathematics", "Physics"],
  "monthlySalary": 3000000,
  "phone": "+998903333333",
  "email": "sarah@school.com",
  "assignedClasses": ["class-1", "class-2"],
  "branchId": "branch-1"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "teacher-1",
    "fullName": "Dr. Sarah Smith",
    "subjects": ["Mathematics", "Physics"],
    "monthlySalary": 3000000,
    "phone": "+998903333333",
    "email": "sarah@school.com",
    "assignedClasses": ["class-1", "class-2"],
    "branchId": "branch-1",
    "joinedDate": "2025-01-01T00:00:00Z",
    "createdAt": "2025-01-01T00:00:00Z"
  },
  "message": "Teacher created successfully",
  "code": 201
}
```

### 2. Get All Teachers
**GET** `/teachers`

**Query Parameters:**
- `page` (optional)
- `pageSize` (optional)
- `branchId` (optional)
- `subject` (optional): Filter by subject
- `search` (optional): Search by name or email

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "teacher-1",
      "fullName": "Dr. Sarah Smith",
      "subjects": ["Mathematics", "Physics"],
      "monthlySalary": 3000000,
      "phone": "+998903333333",
      "email": "sarah@school.com",
      "branchId": "branch-1"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10,
  "totalPages": 1
}
```

### 3. Get Teacher by ID
**GET** `/teachers/{id}`

**Response (200 OK):**
```json
{
  "data": {
    "id": "teacher-1",
    "fullName": "Dr. Sarah Smith",
    "subjects": ["Mathematics", "Physics"],
    "monthlySalary": 3000000,
    "phone": "+998903333333",
    "email": "sarah@school.com",
    "assignedClasses": ["class-1", "class-2"],
    "branchId": "branch-1",
    "joinedDate": "2025-01-01T00:00:00Z",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

### 4. Update Teacher
**PUT** `/teachers/{id}`

**Request Body:**
```json
{
  "monthlySalary": 3500000,
  "subjects": ["Mathematics", "Physics", "Chemistry"]
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "teacher-1",
    "fullName": "Dr. Sarah Smith",
    "monthlySalary": 3500000,
    "subjects": ["Mathematics", "Physics", "Chemistry"],
    ...
  },
  "message": "Teacher updated successfully",
  "code": 200
}
```

### 5. Delete Teacher
**DELETE** `/teachers/{id}`

**Response (200 OK):**
```json
{
  "message": "Teacher deleted successfully",
  "code": 200
}
```

### 6. Get Teacher Salaries
**GET** `/teachers/{id}/salaries`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "salary-1",
      "teacherId": "teacher-1",
      "amount": 3000000,
      "month": "January",
      "year": 2025,
      "paymentMethod": "bank",
      "status": "paid",
      "paidDate": "2025-01-05T00:00:00Z"
    }
  ]
}
```

---

## Classes Endpoints

### 1. Create Class
**POST** `/classes`

**Request Body:**
```json
{
  "name": "Grade 10 A",
  "teacherId": "teacher-1",
  "branchId": "branch-1"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "class-1",
    "name": "Grade 10 A",
    "teacherId": "teacher-1",
    "studentIds": [],
    "branchId": "branch-1",
    "createdAt": "2025-01-01T00:00:00Z"
  },
  "message": "Class created successfully",
  "code": 201
}
```

### 2. Get All Classes
**GET** `/classes`

**Query Parameters:**
- `page` (optional)
- `branchId` (optional)
- `teacherId` (optional)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "class-1",
      "name": "Grade 10 A",
      "teacherId": "teacher-1",
      "studentIds": ["student-1", "student-2"],
      "branchId": "branch-1"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10,
  "totalPages": 1
}
```

### 3. Get Class by ID
**GET** `/classes/{id}`

**Response (200 OK):**
```json
{
  "data": {
    "id": "class-1",
    "name": "Grade 10 A",
    "teacherId": "teacher-1",
    "studentIds": ["student-1", "student-2"],
    "branchId": "branch-1",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
}
```

### 4. Update Class
**PUT** `/classes/{id}`

**Request Body:**
```json
{
  "name": "Grade 10 A (Honors)",
  "teacherId": "teacher-2"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "class-1",
    "name": "Grade 10 A (Honors)",
    "teacherId": "teacher-2",
    ...
  },
  "message": "Class updated successfully",
  "code": 200
}
```

### 5. Delete Class
**DELETE** `/classes/{id}`

**Response (200 OK):**
```json
{
  "message": "Class deleted successfully",
  "code": 200
}
```

---

## Payments Endpoints

### 1. Create Payment
**POST** `/payments`

**Request Body:**
```json
{
  "studentId": "student-1",
  "amount": 500000,
  "month": "January",
  "year": 2025,
  "paymentMethod": "cash",
  "status": "paid",
  "invoiceNumber": "INV-001"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "payment-1",
    "studentId": "student-1",
    "amount": 500000,
    "month": "January",
    "year": 2025,
    "paymentMethod": "cash",
    "status": "paid",
    "invoiceNumber": "INV-001",
    "paidDate": "2025-01-01T12:00:00Z",
    "branchId": "branch-1",
    "createdAt": "2025-01-01T12:00:00Z"
  },
  "message": "Payment created successfully",
  "code": 201
}
```

### 2. Get All Payments
**GET** `/payments`

**Query Parameters:**
- `page` (optional)
- `pageSize` (optional)
- `branchId` (optional)
- `studentId` (optional)
- `status` (optional): "paid", "unpaid", "partial"
- `month` (optional)
- `year` (optional)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "payment-1",
      "studentId": "student-1",
      "amount": 500000,
      "month": "January",
      "year": 2025,
      "status": "paid",
      "invoiceNumber": "INV-001"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10,
  "totalPages": 1
}
```

### 3. Get Payment by ID
**GET** `/payments/{id}`

**Response (200 OK):**
```json
{
  "data": {
    "id": "payment-1",
    "studentId": "student-1",
    "amount": 500000,
    "month": "January",
    "year": 2025,
    "paymentMethod": "cash",
    "status": "paid",
    "invoiceNumber": "INV-001",
    "notes": "Payment received in full",
    "paidDate": "2025-01-01T12:00:00Z",
    "branchId": "branch-1",
    "createdAt": "2025-01-01T12:00:00Z"
  }
}
```

### 4. Update Payment
**PUT** `/payments/{id}`

**Request Body:**
```json
{
  "status": "partial",
  "amount": 250000,
  "notes": "Partial payment received"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "payment-1",
    "studentId": "student-1",
    "amount": 250000,
    "status": "partial",
    "notes": "Partial payment received",
    ...
  },
  "message": "Payment updated successfully",
  "code": 200
}
```

### 5. Delete Payment
**DELETE** `/payments/{id}`

**Response (200 OK):**
```json
{
  "message": "Payment deleted successfully",
  "code": 200
}
```

---

## Salaries Endpoints

### 1. Create Salary
**POST** `/salaries`

**Request Body:**
```json
{
  "teacherId": "teacher-1",
  "amount": 3000000,
  "month": "January",
  "year": 2025,
  "paymentMethod": "bank",
  "status": "paid"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "salary-1",
    "teacherId": "teacher-1",
    "amount": 3000000,
    "month": "January",
    "year": 2025,
    "paymentMethod": "bank",
    "status": "paid",
    "paidDate": "2025-01-01T12:00:00Z",
    "branchId": "branch-1",
    "createdAt": "2025-01-01T12:00:00Z"
  },
  "message": "Salary created successfully",
  "code": 201
}
```

### 2. Get All Salaries
**GET** `/salaries`

**Query Parameters:**
- `page` (optional)
- `pageSize` (optional)
- `branchId` (optional)
- `teacherId` (optional)
- `status` (optional)
- `month` (optional)
- `year` (optional)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "salary-1",
      "teacherId": "teacher-1",
      "amount": 3000000,
      "month": "January",
      "year": 2025,
      "status": "paid"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10,
  "totalPages": 1
}
```

### 3. Get Salary by ID
**GET** `/salaries/{id}`

**Response (200 OK):**
```json
{
  "data": {
    "id": "salary-1",
    "teacherId": "teacher-1",
    "amount": 3000000,
    "month": "January",
    "year": 2025,
    "paymentMethod": "bank",
    "status": "paid",
    "notes": "Salary paid on time",
    "paidDate": "2025-01-01T12:00:00Z",
    "branchId": "branch-1",
    "createdAt": "2025-01-01T12:00:00Z"
  }
}
```

### 4. Update Salary
**PUT** `/salaries/{id}`

**Request Body:**
```json
{
  "status": "unpaid",
  "notes": "Pending approval"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "salary-1",
    "status": "unpaid",
    "notes": "Pending approval",
    ...
  },
  "message": "Salary updated successfully",
  "code": 200
}
```

### 5. Delete Salary
**DELETE** `/salaries/{id}`

**Response (200 OK):**
```json
{
  "message": "Salary deleted successfully",
  "code": 200
}
```

---

## Expenses Endpoints

### 1. Create Expense
**POST** `/expenses`

**Request Body:**
```json
{
  "title": "Office Supplies",
  "description": "Printer ink and paper",
  "amount": 500000,
  "category": "supplies",
  "paymentMethod": "bank",
  "date": "2025-01-01T00:00:00Z",
  "notes": "Monthly supplies"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "expense-1",
    "title": "Office Supplies",
    "description": "Printer ink and paper",
    "amount": 500000,
    "category": "supplies",
    "paymentMethod": "bank",
    "date": "2025-01-01T00:00:00Z",
    "branchId": "branch-1",
    "createdBy": "user-1",
    "createdAt": "2025-01-01T12:00:00Z"
  },
  "message": "Expense created successfully",
  "code": 201
}
```

### 2. Get All Expenses
**GET** `/expenses`

**Query Parameters:**
- `page` (optional)
- `pageSize` (optional)
- `branchId` (optional)
- `category` (optional)
- `startDate` (optional)
- `endDate` (optional)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "expense-1",
      "title": "Office Supplies",
      "amount": 500000,
      "category": "supplies",
      "date": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10,
  "totalPages": 1
}
```

### 3. Delete Expense
**DELETE** `/expenses/{id}`

**Response (200 OK):**
```json
{
  "message": "Expense deleted successfully",
  "code": 200
}
```

---

## Dashboard Endpoints

### 1. Get Dashboard Statistics
**GET** `/dashboard/stats`

**Response (200 OK):**
```json
{
  "data": {
    "totalStudents": 150,
    "totalTeachers": 12,
    "totalClasses": 10,
    "totalIncome": 75000000,
    "totalExpenses": 40000000,
    "netProfit": 35000000,
    "pendingPayments": 15000000,
    "pendingSalaries": 9000000
  }
}
```

### 2. Get Financial Summary
**GET** `/dashboard/financial-summary`

**Query Parameters:**
- `branchId` (optional)
- `startDate` (optional)
- `endDate` (optional)

**Response (200 OK):**
```json
{
  "data": {
    "totalIncome": 75000000,
    "totalExpenses": 40000000,
    "netProfit": 35000000,
    "studentPayments": {
      "paid": 60000000,
      "unpaid": 10000000,
      "partial": 5000000
    },
    "teacherSalaries": {
      "paid": 36000000,
      "unpaid": 9000000
    },
    "expenses": {
      "supplies": 5000000,
      "maintenance": 8000000,
      "utilities": 7000000,
      "other": 20000000
    }
  }
}
```

---

## Settings Endpoints

### 1. Get Settings
**GET** `/settings`

**Response (200 OK):**
```json
{
  "data": {
    "id": "settings-1",
    "defaultMonthlyPayment": 500000,
    "defaultTeacherSalary": 3000000,
    "currency": "UZS",
    "language": "uz-latn",
    "schoolName": "Maktab Boshqaruv Tizimi",
    "schoolLogo": "https://example.com/logo.png",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
}
```

### 2. Update Settings
**PUT** `/settings`

**Request Body:**
```json
{
  "defaultMonthlyPayment": 600000,
  "language": "en",
  "schoolName": "Modern School System"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "settings-1",
    "defaultMonthlyPayment": 600000,
    "language": "en",
    "schoolName": "Modern School System",
    "updatedAt": "2025-01-02T00:00:00Z"
  },
  "message": "Settings updated successfully",
  "code": 200
}
```

---

## Reports Endpoints

### 1. Generate Student Payment Report
**GET** `/reports/student-payments`

**Query Parameters:**
- `branchId` (optional)
- `startDate` (optional)
- `endDate` (optional)
- `status` (optional)

**Response (200 OK):**
```json
{
  "data": [
    {
      "studentId": "student-1",
      "studentName": "Ahmed Ali",
      "className": "Grade 10 A",
      "requiredPayment": 500000,
      "totalPaid": 500000,
      "pendingPayment": 0,
      "status": "paid"
    }
  ]
}
```

### 2. Generate Teacher Salary Report
**GET** `/reports/teacher-salaries`

**Query Parameters:**
- `branchId` (optional)
- `month` (optional)
- `year` (optional)

**Response (200 OK):**
```json
{
  "data": [
    {
      "teacherId": "teacher-1",
      "teacherName": "Dr. Sarah Smith",
      "monthlySalary": 3000000,
      "totalPaid": 9000000,
      "pendingPayment": 0,
      "status": "paid"
    }
  ]
}
```

### 3. Export Report to PDF
**GET** `/reports/export/pdf`

**Query Parameters:**
- `type` (required): "student-payments", "teacher-salaries", "financial"
- `branchId` (optional)
- `startDate` (optional)
- `endDate` (optional)

**Response:** PDF file

### 4. Export Report to CSV
**GET** `/reports/export/csv`

**Query Parameters:**
- `type` (required): "student-payments", "teacher-salaries", "financial"
- `branchId` (optional)
- `startDate` (optional)
- `endDate` (optional)

**Response:** CSV file

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "code": 400
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

---

## Rate Limiting

- Rate limit: 100 requests per minute per user
- Rate limit headers:
  - `X-RateLimit-Limit`: 100
  - `X-RateLimit-Remaining`: Number of remaining requests
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 10, max: 100)

**Response:**
```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "pageSize": 10,
  "totalPages": 15
}
```
