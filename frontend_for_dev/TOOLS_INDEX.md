# Developer Dashboard Tools Index

Quick reference guide for all developer tools in the dashboard.

## Overview

| Tool | Path | Auth | Purpose | Key Features |
|------|------|------|---------|--------------|
| API Tester | `/tools/api-tester` | No | Test API endpoints | Request builder, response viewer, logging |
| Security Tools | `/tools/security` | No | JWT management | Login, token import/export, claims viewing |
| System Health | `/tools/health` | No | Backend monitoring | Status checks, endpoint health, auto-refresh |
| API Docs | `/tools/api-docs` | No | API reference | Endpoint catalog, schemas, method info |
| DB Explorer | `/tools/db-explorer` | No | Schema viewer | Tables, columns, migrations, types |
| Settings Manager | `/tools/settings-manager` | Yes | Edit settings | Branch config, payments, currency |
| User Management | `/tools/user-management` | Yes | User CRUD | Create users, list users, manage roles |
| Test Data | `/tools/test-data` | Yes | Generate data | Dummy records, bulk creation |

---

## Tool Details

### 1. API Tester
**URL**: `http://localhost:3000/tools/api-tester`

**Purpose**: Test and debug API endpoints in real-time

**Features**:
- HTTP method selection (GET, POST, PUT, DELETE, PATCH)
- Custom headers and request body
- Quick endpoint shortcuts for common APIs
- Response status and timing display
- Request/response logging with history
- Copy response to clipboard
- Clear logs functionality

**When to use**:
- Testing new API endpoints
- Debugging endpoint behavior
- Validating request/response formats
- Performance testing
- Integration testing

**Key Shortcuts**:
- `/api/students` - List students
- `/api/users` - List users
- `/api/payments` - List payments
- `/api/settings` - Get settings
- `/api/classes` - List classes

---

### 2. Security Tools
**URL**: `http://localhost:3000/tools/security`

**Purpose**: Manage JWT tokens and authentication

**Features**:
- Quick login form for demo credentials
- JWT token import/export
- Token decoding with claims inspection
- Token expiry status monitoring
- Copy token to clipboard
- Clear/revoke token
- Token format reference

**When to use**:
- Logging in for the first time
- Testing with different user credentials
- Debugging authentication issues
- Inspecting token claims
- Managing token lifecycle

**Token Management**:
- View current token and expiry
- Paste JWT tokens for import
- Decode and inspect claims
- Check token validity

---

### 3. System Health
**URL**: `http://localhost:3000/tools/health`

**Purpose**: Monitor backend service status and health

**Features**:
- Real-time service status (Healthy/Offline)
- Last check timestamp
- Endpoint-specific health checks
- Auto-refresh every 30 seconds
- API endpoint status verification
- Full response JSON viewer

**When to use**:
- Before starting development session
- After deploying new backend changes
- Troubleshooting connection issues
- Verifying service availability
- Performance monitoring

**Monitored Endpoints**:
- `/api/students`
- `/api/users`
- `/api/settings`
- `/api/payments`

---

### 4. API Documentation
**URL**: `http://localhost:3000/tools/api-docs`

**Purpose**: Browse complete API endpoint reference

**Features**:
- Categorized endpoint listing
- Method and path information
- Public vs. protected indication
- Request/response schema preview
- Endpoint descriptions
- Collapsible detail view

**Categories**:
- Authentication (login, register, password reset)
- Users (CRUD operations)
- Students (CRUD operations)
- Payments (CRUD operations)
- Settings (get, update)

**When to use**:
- Learning API structure
- Finding endpoint names/methods
- Checking if endpoint is public/protected
- Understanding request parameters
- Reviewing response formats

---

### 5. Database Explorer
**URL**: `http://localhost:3000/tools/db-explorer`

**Purpose**: View database schema and structure

**Features**:
- Table listing with descriptions
- Column details (name, type, nullable)
- Migration history viewer
- Data type reference
- Relationship information
- Statistics (total tables, columns, migrations)

**Tables Available**:
- users - User accounts
- students - Student records
- payments - Payment transactions
- classes - Class information
- branches - Branch/location data

**When to use**:
- Understanding data structure
- Checking column constraints
- Learning table relationships
- Reviewing migration history
- Database troubleshooting

---

### 6. Settings Manager
**URL**: `http://localhost:3000/tools/settings-manager`

**Purpose**: Manage branch-level settings and configuration

**Features**:
- View current settings
- Edit branch name
- Configure monthly payment amount
- Select currency
- Automatic date tracking
- Real-time API integration

**Editable Fields**:
- **Branch Name**: Your branch identifier
- **Monthly Payment**: Default payment amount (supports decimals)
- **Currency**: UZS, USD, EUR, GBP

**Display Fields**:
- **Created Date**: Immutable creation timestamp
- **Updated Date**: Auto-updated on save

**When to use**:
- Configuring branch parameters
- Updating payment defaults
- Changing currency settings
- Reviewing configuration history

**Note**: Requires authentication. Use Security Tools to login first.

---

### 7. User Management
**URL**: `http://localhost:3000/tools/user-management`

**Purpose**: Create and manage user accounts

**Features**:
- Create new user accounts
- View all users in table format
- User details (email, name, role)
- User creation timestamps
- Edit and delete functionality (UI prepared)
- Bulk user operations

**Create User Form**:
- Email address (required)
- Password (required)
- First name
- Last name

**User List View**:
- Email address
- Full name
- Role assignment
- Creation date
- Action buttons

**When to use**:
- Creating test users
- Adding new team members
- Setting up demo accounts
- Testing role-based features
- User account maintenance

**Note**: Requires authentication.

---

### 8. Test Data Generator
**URL**: `http://localhost:3000/tools/test-data`

**Purpose**: Generate dummy data for development and testing

**Features**:
- One-click test data generation
- Configurable record counts
- Multiple entity types
- Data export capability
- Generation status reporting
- Development-focused data

**Generated Data Types**:
- **Students**: 50 sample student records
- **Teachers**: 10 sample teacher accounts
- **Classes**: 5 sample classes
- **Payments**: 150 sample payment records

**Data Characteristics**:
- Random names and emails
- Valid data types
- Realistic dates
- Proper relationships
- Test-friendly values

**When to use**:
- Populating database for testing
- Feature development with data
- Performance testing with volume
- UI testing with realistic data
- Demo setup

**Note**: Requires authentication. Generates demo data structure (actual implementation would seed database).

---

## Quick Navigation

### By Use Case

**Setting up development environment**:
1. API Tester - Verify backend connectivity
2. System Health - Check service status
3. Security Tools - Authenticate

**Testing features**:
1. API Tester - Test endpoint behavior
2. API Docs - Check endpoint specs
3. User Management - Create test users
4. Test Data - Generate test data

**Debugging issues**:
1. System Health - Check backend status
2. API Tester - Debug endpoint
3. API Docs - Verify endpoint specs
4. Security Tools - Check authentication

**Learning the system**:
1. API Documentation - Overview
2. Database Explorer - Schema understanding
3. System Health - Service components
4. API Tester - Hands-on testing

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Click` | Open in new tab |
| `Tab` | Navigate form inputs |
| `Enter` | Submit forms |

---

## Common Tasks

### Task: Test Student Creation
1. Go to API Tester
2. Select POST method
3. Enter `/api/students`
4. Add body:
   ```json
   {
     "firstName": "John",
     "lastName": "Doe",
     "email": "john@example.com"
   }
   ```
5. Click Send Request

### Task: Add Middleware User
1. Go to Security Tools
2. Enter user email/password
3. Click Login
4. Verify "Authenticated" status
5. Use token in other tools

### Task: Check Database Structure
1. Go to Database Explorer
2. Find table (e.g., "students")
3. Click to expand
4. Review columns and types

### Task: Monitor Backend
1. Go to System Health
2. Check status indicator
3. Review endpoint health
4. Auto-refresh every 30s

---

## Troubleshooting by Tool

### API Tester Issues
- **Can't connect**: Check System Health first
- **No response**: Verify endpoint in API Docs
- **Wrong data**: Check request body format

### Security Tools Issues
- **Login fails**: Verify user exists in backend
- **Token invalid**: Use fresh login
- **Token expired**: Get new token via login

### Settings Manager Issues
- **Not authorized**: Login via Security Tools
- **Save fails**: Check for validation errors
- **Field disabled**: Refresh page

### User Management Issues
- **Create fails**: Check email uniqueness
- **List empty**: Generate test data
- **Not authorized**: Need valid JWT token

---

## Performance Tips

1. **API Tester**: Clear logs regularly to maintain UI speed
2. **System Health**: Auto-refresh keeps data fresh
3. **User Management**: List shows 10 users per page
4. **Test Data**: Generation may take time with large volumes

---

## Data Flow

```
┌─────────────────────────────────────┐
│   Developer Dashboard (Next.js)     │
├─────────────────────────────────────┤
│                                     │
│  ┌─ API Tester ───────────────┐   │
│  │ ┌─ Security Tools ────┐    │   │
│  │ │ ┌─ System Health  ─┐│    │   │
│  │ │ │ API Docs │DB Ex  ││    │   │
│  │ │ │ Settings │Users  ││    │   │
│  │ │ │ Test Data        ││    │   │
│  │ │ └────────────────┘ ││    │   │
│  │ └────────────────────┘    │   │
│  │ Zustand Store (Auth, Logs)│   │
│  │ Axios Client               │   │
│  └────────────────────────────┘   │
└──────────┬──────────────────────┬──┘
           │                      │
           v                      v
      HTTP Requests      JWT Token Mgmt
           │                      │
           └──────────────────────┘
                    │
                    v
            ┌───────────────────┐
            │   Backend API     │
            │ (Port 8080)       │
            │  ─────────────    │
            │  Auth            │
            │  Students        │
            │  Payments        │
            │  Settings        │
            │  Users           │
            └───────────────────┘
```

---

## Related Resources

- **Main README**: `README.md` - Complete documentation
- **Setup Guide**: `SETUP_GUIDE.md` - Installation and configuration
- **Backend API**: `../API_ENDPOINTS_SUMMARY.md` - Full API reference
- **Backend Setup**: `../BACKEND_SETUP.md` - Backend configuration
- **Settings Guide**: `../SETTINGS_QUICK_REFERENCE.md` - Settings deep dive

---

## Support

- Check tool-specific help sections
- Review API Documentation tool
- Inspect browser DevTools Network tab
- Check backend logs for errors
- Verify .env.local configuration
