# Developer Authentication Setup

## Overview

Added developer authentication system for the frontend_for_dev dashboard to allow developers to login with their own credentials.

## What Was Added

### 1. Database Table (Migration 000002)

Created a new `developers` table for storing developer accounts:

```sql
CREATE TABLE developers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'developer',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Default Credentials:**
- Email: `dev@school.ru`
- Password: `dev123456`

### 2. Backend Services

#### Developer Service (`internal/service/developer_service.go`)

Methods provided:
- `GetDeveloperByEmail()` - Fetch developer by email
- `GetDeveloperByID()` - Fetch developer by ID
- `AuthenticateDeveloper()` - Verify credentials and return developer
- `CreateDeveloper()` - Register new developer
- `UpdateDeveloperLastLogin()` - Track login time
- `ListDevelopers()` - List all developers
- `DeleteDeveloper()` - Delete developer account
- `UpdateDeveloperPassword()` - Change password

#### Developer Models (`internal/models/developer.go`)

- `Developer` - Developer account model
- `DeveloperLoginRequest` - Login request DTO
- `DeveloperLoginResponse` - Login response with JWT token
- `DeveloperRegisterRequest` - Registration request DTO

#### Developer Auth Handlers (`internal/handlers/developer_auth.go`)

**Endpoints:**

1. **POST /api/dev/auth/login**
   - Authenticates developer with email and password
   - Returns JWT token valid for API calls
   - Updates last_login timestamp
   
   Request:
   ```json
   {
     "email": "dev@school.ru",
     "password": "dev123456"
   }
   ```
   
   Response:
   ```json
   {
     "id": "...",
     "email": "dev@school.ru",
     "fullName": "Developer",
     "role": "developer",
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   }
   ```

2. **POST /api/dev/auth/register**
   - Register new developer account
   - Returns JWT token for immediate use
   
   Request:
   ```json
   {
     "email": "newdev@example.com",
     "password": "securepassword123",
     "fullName": "New Developer"
   }
   ```

**Middleware:**

- `DeveloperMiddleware()` - Validates JWT tokens and extracts developer info
  - Checks Authorization header for Bearer token
  - Validates token signature
  - Ensures token type is "developer"

### 3. Security Features

- **Password Hashing**: Uses bcrypt with cost 10
- **JWT Tokens**: Signed with JWT_SECRET from environment
- **Token Claims**: Includes developer_id, email, role, and token type
- **Account Status**: Can deactivate accounts with is_active flag
- **Password Updates**: Secure password change with new hash generation

## Usage

### For Developers

1. **Login to Dev Dashboard:**
   ```bash
   curl -X POST http://localhost:8080/api/dev/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "dev@school.ru",
       "password": "dev123456"
     }'
   ```

2. **Use Token for API Calls:**
   ```bash
   curl -X POST http://localhost:8080/api/dev/subscription-plans \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -d '{...}'
   ```

3. **Register New Developer:**
   ```bash
   curl -X POST http://localhost:8080/api/dev/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "newdev@example.com",
       "password": "securepassword",
       "fullName": "Developer Name"
     }'
   ```

### For Frontend

The frontend_for_dev should:

1. Send login request to `/api/dev/auth/login`
2. Store the returned token in localStorage
3. Include token in Authorization header for all subsequent API requests
4. Handle 401 responses by redirecting to login page

## Token Structure

JWT token contains:
```json
{
  "developer_id": "...",
  "email": "dev@school.ru",
  "role": "developer",
  "type": "developer"
}
```

## Migration Info

- **Up Migration**: `migrations/000002_create_developers_table.up.sql`
- **Down Migration**: `migrations/000002_create_developers_table.down.sql`
- **Migrations Run Automatically**: On application startup

## Environment Variables

Required:
- `JWT_SECRET` - Secret key for signing JWT tokens (must be same for user and developer tokens)

## Related Files

- Backend: `internal/service/developer_service.go`
- Backend: `internal/models/developer.go`
- Backend: `internal/handlers/developer_auth.go`
- Backend: `cmd/main.go` (initialization)
- Database: `migrations/000002_create_developers_table.up.sql`

## Default Developer Account

Created automatically on first migration:
- Email: `dev@school.ru`
- Password: `dev123456`
- Can be deleted and new accounts created via registration endpoint
