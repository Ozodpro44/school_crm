# Wonderkids' CRM Backend

A Go-based REST API backend for Wonderkids' CRM system with Gin framework and PostgreSQL.

## Features

- User authentication with JWT
- Role-based access control
- Student management
- Payment tracking
- Teacher and salary management
- Expense tracking
- Branch management
- Class management

## Prerequisites

- Go 1.21+
- PostgreSQL 12+
- Make (optional)

## Setup

### 1. Clone and Install Dependencies

```bash
cd backend_school_crm
go mod download
```

### 2. Database Setup

Create PostgreSQL database:

```bash
createdb school_crm
```

### 3. Environment Variables

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=8080
DATABASE_URL=postgres://user:password@localhost:5432/school_crm
JWT_SECRET=your-secret-key-here
ENVIRONMENT=development
```

### 4. Run Application

```bash
make run
```

Or manually:

```bash
go run cmd/main.go
```

The server will start on `http://localhost:8080`

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login user
- `POST /api/auth/register` - Register new user

### Users

- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Students

- `POST /api/students` - Create student
- `GET /api/students/:id` - Get student by ID
- `GET /api/students?branchId=...` - List students by branch
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Payments

- `POST /api/payments` - Create payment
- `GET /api/payments/:id` - Get payment by ID
- `GET /api/payments?branchId=...` - List payments
- `PUT /api/payments/:id` - Update payment
- `DELETE /api/payments/:id` - Delete payment
- `GET /api/payments/branch/:branchId/summary` - Payment summary

### Classes

- `POST /api/classes` - Create class
- `GET /api/classes/:id` - Get class by ID
- `GET /api/classes?branchId=...` - List classes
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Delete class

### Branches

- `POST /api/branches` - Create branch
- `GET /api/branches/:id` - Get branch by ID
- `GET /api/branches` - List all branches
- `PUT /api/branches/:id` - Update branch
- `DELETE /api/branches/:id` - Delete branch

### Teachers

- `POST /api/teachers` - Create teacher
- `GET /api/teachers/:id` - Get teacher by ID
- `GET /api/teachers?branchId=...` - List teachers
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher

### Salaries

- `POST /api/salaries` - Create salary record
- `GET /api/salaries/:id` - Get salary by ID
- `GET /api/salaries?branchId=...` - List salaries
- `PUT /api/salaries/:id` - Update salary
- `DELETE /api/salaries/:id` - Delete salary

### Expenses

- `POST /api/expenses` - Create expense
- `GET /api/expenses/:id` - Get expense by ID
- `GET /api/expenses?branchId=...` - List expenses
- `DELETE /api/expenses/:id` - Delete expense

## Project Structure

```
backend_school_crm/
├── cmd/
│   └── main.go                 # Application entry point
├── internal/
│   ├── config/                 # Configuration
│   ├── db/                      # Database connection and migrations
│   ├── handlers/                # HTTP handlers
│   ├── middleware/              # Middleware (auth, cors, errors)
│   ├── models/                  # Data models
│   └── service/                 # Business logic
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

## Development

### Format Code

```bash
make fmt
```

### Run Linter

```bash
make lint
```

### Run Tests

```bash
make test
```

## Error Handling

The API returns standard HTTP status codes:

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid authentication
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Security

- JWT-based authentication
- Password hashing with bcrypt
- CORS middleware configured
- SQL injection prevention with parameterized queries
- Role-based access control

## License

MIT
