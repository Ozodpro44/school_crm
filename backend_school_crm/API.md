# School CRM API Documentation

## Base URL

```
http://localhost:8080/api
```

## Authentication

All protected endpoints require Bearer token in Authorization header:

```
Authorization: Bearer <token>
```

## Response Format

All responses are JSON:

```json
{
  "data": {},
  "error": null,
  "message": ""
}
```

## Authentication Endpoints

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "admin",
    "branchId": "uuid"
  }
}
```

### Register

```http
POST /auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "password123",
  "fullName": "Jane Doe",
  "role": "manager",
  "branchId": "uuid"
}
```

## Student Endpoints

### Create Student

```http
POST /students
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "Ahmed Ali",
  "classId": "class-uuid",
  "phone": "998901234567",
  "parentPhone": "998901234567",
  "monthlyPayment": 100000,
  "status": "active",
  "branchId": "branch-uuid",
  "enrollmentDate": "2024-01-15T00:00:00Z"
}
```

### Get Student

```http
GET /students/{studentId}
Authorization: Bearer <token>
```

### List Students by Branch

```http
GET /students?branchId={branchId}
Authorization: Bearer <token>
```

### Update Student

```http
PUT /students/{studentId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "monthlyPayment": 120000,
  "status": "active"
}
```

### Delete Student

```http
DELETE /students/{studentId}
Authorization: Bearer <token>
```

## Payment Endpoints

### Create Payment

```http
POST /payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "studentId": "student-uuid",
  "amount": 100000,
  "month": "01",
  "year": 2024,
  "paymentMethod": "cash",
  "status": "paid",
  "invoiceNumber": "INV-12345",
  "notes": "Payment received in cash",
  "paidDate": "2024-01-15T00:00:00Z",
  "branchId": "branch-uuid"
}
```

### Get Payment

```http
GET /payments/{paymentId}
Authorization: Bearer <token>
```

### List Payments

```http
GET /payments?branchId={branchId}
Authorization: Bearer <token>
```

Or by student period:

```http
GET /payments?studentId={studentId}&month=01&year=2024
Authorization: Bearer <token>
```

### Update Payment

```http
PUT /payments/{paymentId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "paid",
  "paymentMethod": "card"
}
```

### Delete Payment

```http
DELETE /payments/{paymentId}
Authorization: Bearer <token>
```

### Payment Summary

```http
GET /payments/branch/{branchId}/summary
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalPaid": 5000000,
  "totalUnpaid": 2000000,
  "totalPartial": 500000,
  "byMethod": {
    "card": 2000000,
    "cash": 2500000,
    "bank": 500000
  }
}
```

## Class Endpoints

### Create Class

```http
POST /classes
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Class 1A",
  "teacherId": "teacher-uuid",
  "branchId": "branch-uuid"
}
```

### Get Class

```http
GET /classes/{classId}
Authorization: Bearer <token>
```

### List Classes

```http
GET /classes?branchId={branchId}
Authorization: Bearer <token>
```

### Update Class

```http
PUT /classes/{classId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Class 1B",
  "teacherId": "teacher-uuid"
}
```

### Delete Class

```http
DELETE /classes/{classId}
Authorization: Bearer <token>
```

## Branch Endpoints

### Create Branch

```http
POST /branches
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Main Branch",
  "address": "123 Main Street, City",
  "phone": "998901234567",
  "monthlyPayment": 100000,
  "adminId": "admin-uuid"
}
```

### Get Branch

```http
GET /branches/{branchId}
Authorization: Bearer <token>
```

### List All Branches

```http
GET /branches
Authorization: Bearer <token>
```

### Update Branch

```http
PUT /branches/{branchId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Branch Name",
  "phone": "998909876543"
}
```

### Delete Branch

```http
DELETE /branches/{branchId}
Authorization: Bearer <token>
```

## Teacher Endpoints

### Create Teacher

```http
POST /teachers
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "Dr. Smith",
  "subjects": ["Mathematics", "Physics"],
  "monthlySalary": 500000,
  "phone": "998901234567",
  "email": "smith@example.com",
  "branchId": "branch-uuid",
  "joinedDate": "2024-01-01T00:00:00Z"
}
```

### Get Teacher

```http
GET /teachers/{teacherId}
Authorization: Bearer <token>
```

### List Teachers

```http
GET /teachers?branchId={branchId}
Authorization: Bearer <token>
```

### Update Teacher

```http
PUT /teachers/{teacherId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "monthlySalary": 550000,
  "subjects": ["Mathematics", "Physics", "Chemistry"]
}
```

### Delete Teacher

```http
DELETE /teachers/{teacherId}
Authorization: Bearer <token>
```

## Salary Endpoints

### Create Salary Record

```http
POST /salaries
Authorization: Bearer <token>
Content-Type: application/json

{
  "teacherId": "teacher-uuid",
  "amount": 500000,
  "month": "01",
  "year": 2024,
  "paymentMethod": "bank",
  "status": "paid",
  "paidDate": "2024-01-31T00:00:00Z",
  "branchId": "branch-uuid"
}
```

### Get Salary

```http
GET /salaries/{salaryId}
Authorization: Bearer <token>
```

### List Salaries

```http
GET /salaries?branchId={branchId}
Authorization: Bearer <token>
```

### Update Salary

```http
PUT /salaries/{salaryId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "paid",
  "paymentMethod": "bank"
}
```

### Delete Salary

```http
DELETE /salaries/{salaryId}
Authorization: Bearer <token>
```

## Expense Endpoints

### Create Expense

```http
POST /expenses
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Office Supplies",
  "description": "Purchased printer ink and paper",
  "amount": 50000,
  "category": "supplies",
  "paymentMethod": "cash",
  "date": "2024-01-15T00:00:00Z",
  "branchId": "branch-uuid",
  "notes": "Bulk purchase"
}
```

### Get Expense

```http
GET /expenses/{expenseId}
Authorization: Bearer <token>
```

### List Expenses

```http
GET /expenses?branchId={branchId}
Authorization: Bearer <token>
```

### Delete Expense

```http
DELETE /expenses/{expenseId}
Authorization: Bearer <token>
```

## User Roles

- `admin` - Full access
- `branch_admin` - Access to branch data
- `manager` - Branch operations
- `accountant` - Payment and salary management
- `teacher` - View own information
- `student` - View own information
- `parent` - View child information

## Payment Methods

- `cash`
- `card`
- `bank`

## Student Status

- `active` - Currently enrolled
- `left` - Dropped out
- `suspended` - Temporarily suspended

## Payment Status

- `paid` - Fully paid
- `unpaid` - Not paid
- `partial` - Partially paid

## Error Responses

### 400 Bad Request
```json
{
  "error": "invalid input"
}
```

### 401 Unauthorized
```json
{
  "error": "authorization header required"
}
```

### 403 Forbidden
```json
{
  "error": "forbidden"
}
```

### 404 Not Found
```json
{
  "error": "resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "internal server error"
}
```
