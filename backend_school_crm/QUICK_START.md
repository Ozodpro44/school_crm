# Quick Start Guide

## 1. Prerequisites

- Go 1.21 or higher
- PostgreSQL 12 or higher
- Docker (optional)

## 2. Setup with Docker (Recommended)

### Start PostgreSQL

```bash
cd backend_school_crm
docker-compose up -d
```

This will start PostgreSQL on `localhost:5432` with:
- Username: `school_user`
- Password: `school_password`
- Database: `school_crm`

### Create .env file

```bash
cp .env.example .env
```

The default `.env` is already configured for Docker PostgreSQL.

### Download Dependencies

```bash
go mod download
```

### Run Application

```bash
go run cmd/main.go
```

The API will be available at `http://localhost:8080`

## 3. Manual Setup

### Install PostgreSQL

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

**Windows:**
- Download from https://www.postgresql.org/download/windows/

### Create Database

```bash
createdb school_crm
```

### Update .env

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgres://postgres:password@localhost:5432/school_crm
```

Replace `password` with your PostgreSQL password.

### Run Application

```bash
go mod download
go run cmd/main.go
```

## 4. Test the API

### Health Check

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "healthy"
}
```

### Register User

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123",
    "fullName": "Admin User",
    "role": "admin"
  }'
```

### Login

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'
```

Save the token from response.

### Use Token

```bash
TOKEN="your-token-here"

# List users
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/users

# Create branch
curl -X POST http://localhost:8080/api/branches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Branch",
    "address": "123 Main Street",
    "phone": "998901234567",
    "monthlyPayment": 100000
  }'
```

## 5. Build for Production

```bash
make build
```

Binary will be at `bin/school-crm`

## 6. Docker Build (Production)

Create `Dockerfile`:

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY . .
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o school-crm cmd/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/school-crm .
EXPOSE 8080

CMD ["./school-crm"]
```

Build image:
```bash
docker build -t school-crm:latest .
```

Run container:
```bash
docker run -p 8080:8080 \
  -e DATABASE_URL="postgres://school_user:school_password@host.docker.internal:5432/school_crm" \
  -e JWT_SECRET="your-secret-key" \
  school-crm:latest
```

## 7. Troubleshooting

### Port Already in Use

Change port in `.env`:
```env
PORT=8081
```

### Database Connection Error

Check PostgreSQL is running:
```bash
# macOS
brew services list

# Ubuntu
sudo service postgresql status

# Windows
Services > PostgreSQL
```

Check connection string in `.env` is correct.

### Module Not Found

```bash
go mod download
go mod tidy
```

### Migration Errors

Ensure database is empty or drop it:
```bash
dropdb school_crm
createdb school_crm
```

## 8. Development Workflow

### Format Code
```bash
make fmt
```

### Run Tests
```bash
make test
```

### Clean Build
```bash
make clean
make build
```

## 9. Environment Variables

See `.env.example` for all available options.

Key variables:
- `PORT` - Server port (default: 8080)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `ENVIRONMENT` - `development` or `production`

## 10. API Documentation

See `API.md` for complete API reference.

## Next Steps

1. Create an admin user
2. Create branches
3. Create classes
4. Add students
5. Record payments
6. Add teachers and manage salaries
7. Track expenses

For more details, see `README.md` and `API.md`.
