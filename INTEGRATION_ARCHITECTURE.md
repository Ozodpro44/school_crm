# Integration Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User Browser                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Frontend: http://localhost:5173                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    React Components                          │  │
│  │  ┌────────────────┐  ┌──────────────┐  ┌───────────────┐   │  │
│  │  │ Students Page  │  │ Payments UI  │  │ Dashboard    │   │  │
│  │  └────────┬───────┘  └──────┬───────┘  └───────┬──────┘   │  │
│  │           │                 │                  │           │  │
│  │  ┌────────▼─────────────────▼──────────────────▼──────────┐│  │
│  │  │         Custom React Hooks Layer                       ││  │
│  │  │  useStudents() │ usePayments() │ useMutation()        ││  │
│  │  └────────────────────┬──────────────────────────────────┘│  │
│  │                       │                                    │  │
│  │  ┌────────────────────▼───────────────────────────────┐   │  │
│  │  │            API Client (api-client.ts)              │   │  │
│  │  │ • Token management • Request handling              │   │  │
│  │  │ • Error handling   • Type-safe calls               │   │  │
│  │  └────────────┬────────────────────────┬──────────────┘   │  │
│  │              │                        │                   │  │
│  │              │ HTTP Requests          │                   │  │
│  │              │ Authorization Bearer   │                   │  │
│  │              │                        │                   │  │
│  └──────────────┼────────────────────────┼───────────────────┘  │
│                 │                        │                      │
│  ┌──────────────▼────────┐    ┌──────────▼──────────────────┐   │
│  │ Backend API           │    │ Railway Logs Service        │   │
│  │ :8080/api             │    │ api.railway.app/graphql     │   │
│  └──────────────────────┘    └─────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Detailed Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Pages: StudentsPage, PaymentsPage, ClassesPage            │   │
│  │  Forms: CreateStudentForm, CreatePaymentForm               │   │
│  │  Components: StudentsList, PaymentTable, LogViewer         │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│                      HOOKS LAYER                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Query Hooks: useStudents(), usePayments(), etc.            │   │
│  │  Mutation Hooks: useCreateStudent(), useUpdateStudent()     │   │
│  │  Features: Loading, Error, Refetch, Callbacks              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│                      API CLIENT LAYER                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  apiClient Methods:                                         │   │
│  │  • login(email, password)                                   │   │
│  │  • getStudents(branchId)  → Students[]                     │   │
│  │  • createStudent(data)    → Student                         │   │
│  │  • updateStudent(id, data) → Student                        │   │
│  │  • getPayments(branchId)  → Payments[]                     │   │
│  │  • And more for all resources...                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│                  REQUEST/RESPONSE HANDLER                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Features:                                                  │   │
│  │  • Automatic token injection in headers                    │   │
│  │  • Request timeout (30 seconds)                             │   │
│  │  • Error handling (401, 400, 500, etc.)                    │   │
│  │  • Auto-logout on 401                                       │   │
│  │  • JSON parsing                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
            ┌────────────┴─────────────┐
            │                          │
    ┌───────▼──────────┐      ┌────────▼──────────┐
    │  Backend API     │      │  Railway API      │
    │  :8080/api       │      │  Logs Service     │
    │                  │      │                   │
    │  HTTP/HTTPS      │      │  GraphQL         │
    │  JSON            │      │  Authorization   │
    │  Bearer Token    │      │  API Key         │
    └──────────────────┘      └───────────────────┘
```

## Data Flow Diagrams

### Query Flow (Get Students)

```
User Component
    │
    ├─ useStudents(branchId)
    │
    ├─ useState: data, loading, error
    │
    ├─ useEffect: call fetch
    │
    └─▶ apiClient.getStudents(branchId)
        │
        ├─ Build URL: /students?branchId={id}
        │
        ├─ Add headers:
        │  • Content-Type: application/json
        │  • Authorization: Bearer {token}
        │
        ├─ fetch() call to backend
        │
        └─▶ Response handling
            ├─ 200 OK: Parse JSON → setState(data)
            ├─ 401: Clear token → redirect to login
            ├─ 400/500: setState(error)
            └─ Timeout: setState(error)
```

### Mutation Flow (Create Student)

```
User submits Form
    │
    ├─ useCreateStudent() hook
    │
    ├─ mutate(studentData)
    │
    ├─ setState: loading = true
    │
    └─▶ apiClient.createStudent(studentData)
        │
        ├─ Build URL: /students
        │ Method: POST
        │
        ├─ Body: JSON.stringify(studentData)
        │
        ├─ Headers + Auth token
        │
        ├─ fetch() call
        │
        └─▶ Response
            ├─ 201 Created: setState(data)
            │                onSuccess(data)
            │                setState(loading = false)
            │
            ├─ Error: setState(error)
            │          onError(error)
            │          setState(loading = false)
            │
            └─▶ UI Updates: Show success/error
```

### Authentication Flow

```
Login Page
    │
    ├─ User enters email + password
    │
    ├─ Form submit → apiClient.login(email, password)
    │
    ├─ POST /auth/login
    │
    └─▶ Backend response
        {
          token: "eyJhbGciOiJIUzI1NiIs...",
          user: {
            id: "uuid",
            email: "user@example.com",
            role: "admin",
            branchId: "uuid"
          }
        }
        │
        ├─ setToken(token)
        │  • localStorage.setItem('token', token)
        │  • apiClient.token = token
        │
        ├─ Redirect to Dashboard
        │
        └─▶ All subsequent requests
            Include: Authorization: Bearer {token}
```

### Error Handling Flow

```
API Request
    │
    ├─ Try: fetch()
    │
    ├─ Response received
    │
    └─▶ Status check
        │
        ├─ 200-299: Success
        │  └─ Return data
        │
        ├─ 401: Unauthorized
        │  ├─ clearToken()
        │  ├─ Remove from localStorage
        │  └─ window.location.href = '/login'
        │
        ├─ 400-500: Error
        │  ├─ Parse error message
        │  └─ Throw Error
        │
        └─ Network error: Timeout
           └─ Throw Error
```

## Component Composition Example

```
Dashboard
├── Header
│   └── UserInfo
│
├── Sidebar
│   ├── StudentsList
│   │   └── useStudents()
│   │       └── apiClient.getStudents()
│   │
│   └── PaymentsSummary
│       └── usePaymentSummary()
│           └── apiClient.getPaymentSummary()
│
├── MainContent
│   ├── CreateStudentForm
│   │   └── useCreateStudent()
│   │       └── apiClient.createStudent()
│   │
│   └── PaymentsTable
│       └── usePayments()
│           └── apiClient.getPayments()
│
└── ServerLogsPanel
    └── railwayLogsService.getLogs()
        └── Railway API GraphQL
```

## State Management Flow

```
Component State:
├── data: T | null           ← API response
├── loading: boolean         ← Request in progress
├── error: Error | null      ← Error from request
├── isSuccess: boolean       ← Computed: !loading && !error && data
└── isError: boolean         ← Computed: error !== null

Lifecycle:
├── Component Mount
│   ├─ setState: loading = true
│   ├─ Call API
│   └─ Wait for response
│
├─ API Response (Success)
│  ├─ setState: data = response
│  ├─ setState: error = null
│  ├─ setState: loading = false
│  └─ Call onSuccess callback
│
└─ API Response (Error)
   ├─ setState: error = error
   ├─ setState: loading = false
   └─ Call onError callback
```

## Railway Integration Flow

```
ServerLogsPanel Component
        │
        ├─ useEffect: Fetch logs every 5 seconds
        │
        └─▶ railwayLogsService.getLogs(limit)
            │
            ├─ Check cache (5 second TTL)
            │
            └─▶ If cache expired:
                │
                ├─ Build GraphQL query
                │
                ├─ fetch() to api.railway.app/graphql
                │  Headers:
                │  • Authorization: Bearer {API_KEY}
                │  • Content-Type: application/json
                │
                ├─ Parse response
                │
                ├─ Transform to RailwayLog[]
                │  {
                │    timestamp: ISO string
                │    level: 'info'|'error'|'warn'|'debug'
                │    message: string
                │    service: string
                │  }
                │
                └─▶ Update cache
                    Display in UI
                    └─ Color-coded by level
```

## Types & Interfaces

```typescript
// API Response Types
interface LoginResponse {
  token: string
  user: {
    id: string
    email: string
    fullName: string
    role: string
    branchId: string
  }
}

interface Student {
  id: string
  fullName: string
  classId: string
  phone: string
  branchId: string
  status: 'active' | 'left' | 'suspended'
}

interface Payment {
  id: string
  studentId: string
  amount: number
  month: string
  year: number
  status: 'paid' | 'unpaid' | 'partial'
}

// Hook State
interface QueryState<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  isSuccess: boolean
  isError: boolean
}

// Log Types
interface RailwayLog {
  timestamp: string
  level: 'info' | 'error' | 'warn' | 'debug'
  message: string
  service?: string
}
```

## Environment Configuration

```
Development:
├── VITE_API_BASE_URL = http://localhost:8080/api
├── Backend: Local Go server
├── Logs: Mock data
└── Railway: Optional

Production:
├── VITE_API_BASE_URL = https://backend.up.railway.app/api
├── Backend: Railway deployment
├── Logs: Real Railway API
└── Railway: Required for logs
    ├── VITE_RAILWAY_API_KEY = {token}
    └── VITE_RAILWAY_PROJECT_ID = {id}
```

## Performance Optimizations

```
API Requests:
├── Timeout: 30 seconds
├── Request headers: Minimal (only necessary)
└── Response: Streamed JSON

Logs Service:
├── Caching: 5 seconds
├── Poll interval: 2 seconds (stream)
├── Batch size: Up to 100 logs
└── Mock fallback: When no credentials

React:
├── Hook dependency arrays
├── Component memoization (useCallback)
├── Lazy loading (React.lazy)
└── Code splitting
```
