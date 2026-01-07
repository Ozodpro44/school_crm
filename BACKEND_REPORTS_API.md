# Reports API Documentation

## Overview
The Reports API provides endpoints for generating various financial reports including payment reports, salary reports, debtor reports, expense reports, and financial summaries.

## Endpoints

### 1. Payment Report
**GET** `/api/reports/payments`

Returns a list of payments with student and class information.

#### Query Parameters
- `branchId` (required): The branch ID
- `startDate` (required): Start date in YYYY-MM-DD format
- `endDate` (required): End date in YYYY-MM-DD format
- `status` (optional): Filter by payment status (all, paid, unpaid, partial)
- `classId` (optional): Filter by class ID

#### Response
```json
[
  {
    "id": "payment-uuid",
    "studentId": "student-uuid",
    "studentName": "John Doe",
    "className": "Class 10A",
    "amount": 50000,
    "month": "01",
    "year": 2024,
    "status": "paid",
    "paymentMethod": "cash",
    "paidDate": "2024-01-15T10:30:00Z",
    "createdBy": "user-uuid",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### 2. Salary Report
**GET** `/api/reports/salaries`

Returns a list of salaries with teacher information.

#### Query Parameters
- `branchId` (required): The branch ID
- `startDate` (required): Start date in YYYY-MM-DD format
- `endDate` (required): End date in YYYY-MM-DD format
- `status` (optional): Filter by salary status (all, paid, unpaid, partial)

#### Response
```json
[
  {
    "id": "salary-uuid",
    "teacherId": "teacher-uuid",
    "teacherName": "Jane Smith",
    "amount": 150000,
    "month": "01",
    "year": 2024,
    "status": "paid",
    "paymentMethod": "bank",
    "paidDate": "2024-01-30T14:00:00Z",
    "createdBy": "user-uuid",
    "createdAt": "2024-01-30T14:00:00Z"
  }
]
```

### 3. Debtors Report
**GET** `/api/reports/debtors`

Returns students who owe money for a specific month/year.

#### Query Parameters
- `branchId` (required): The branch ID
- `month` (required): Month in MM format (01-12)
- `year` (required): Year in YYYY format
- `classId` (optional): Filter by class ID

#### Response
```json
[
  {
    "id": "student-uuid-01-2024",
    "studentId": "student-uuid",
    "studentName": "John Doe",
    "className": "Class 10A",
    "month": "01",
    "year": 2024,
    "monthlyPayment": 50000,
    "paidAmount": 25000,
    "dueAmount": 25000,
    "status": "active"
  }
]
```

### 4. Expenses Report
**GET** `/api/reports/expenses`

Returns a list of expenses for the given date range.

#### Query Parameters
- `branchId` (required): The branch ID
- `startDate` (required): Start date in YYYY-MM-DD format
- `endDate` (required): End date in YYYY-MM-DD format
- `category` (optional): Filter by expense category

#### Response
```json
[
  {
    "id": "expense-uuid",
    "title": "Office Supplies",
    "description": "Pens, paper, and notebooks",
    "category": "supplies",
    "amount": 100000,
    "paymentMethod": "cash",
    "date": "2024-01-10T08:00:00Z",
    "createdBy": "user-uuid",
    "notes": "Monthly supplies",
    "createdAt": "2024-01-10T08:00:00Z"
  }
]
```

### 5. Financial Summary
**GET** `/api/reports/financial-summary`

Returns a comprehensive financial summary for the date range.

#### Query Parameters
- `branchId` (required): The branch ID
- `startDate` (required): Start date in YYYY-MM-DD format
- `endDate` (required): End date in YYYY-MM-DD format

#### Response
```json
{
  "totalIncome": 500000,
  "totalSalaries": 300000,
  "totalExpenses": 450000,
  "netProfit": 50000,
  "paymentsByMethod": {
    "cash": 250000,
    "card": 150000,
    "bank": 100000
  },
  "salariesByStatus": {
    "paid": 300000,
    "unpaid": 0,
    "partial": 0
  }
}
```

## Authentication
All endpoints require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

## Permission Requirements
All report endpoints require the `canViewReports` permission.

## Error Responses

### 400 Bad Request
Missing or invalid query parameters
```json
{
  "error": "branchId, startDate, and endDate are required"
}
```

### 401 Unauthorized
Missing or invalid JWT token
```json
{
  "error": "unauthorized"
}
```

### 403 Forbidden
User doesn't have `canViewReports` permission
```json
{
  "error": "insufficient permissions"
}
```

### 500 Internal Server Error
Server error during report generation
```json
{
  "error": "error message"
}
```

## Usage Examples

### Get Payment Report for January 2024
```bash
curl -X GET "http://localhost:8080/api/reports/payments?branchId=branch-123&startDate=2024-01-01&endDate=2024-01-31&status=paid" \
  -H "Authorization: Bearer your_token_here"
```

### Get Debtors Report for February 2024
```bash
curl -X GET "http://localhost:8080/api/reports/debtors?branchId=branch-123&month=02&year=2024" \
  -H "Authorization: Bearer your_token_here"
```

### Get Financial Summary
```bash
curl -X GET "http://localhost:8080/api/reports/financial-summary?branchId=branch-123&startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer your_token_here"
```

## Notes

1. **Date Format**: All date parameters must be in YYYY-MM-DD format
2. **Month Format**: Month parameters must be in MM format (01-12)
3. **Filtering**: Use "all" as the value to get all results without filtering
4. **Pagination**: Reports return all matching results without pagination
5. **Performance**: For large datasets, consider using date ranges to limit results
6. **Timestamps**: All timestamps are returned in UTC (ISO 8601 format)

## Future Enhancements
- Add pagination support for large result sets
- Add CSV/PDF export functionality
- Add chart data endpoints
- Add scheduled report generation
- Add report caching for frequently accessed data
