# School CRM — Phase 3 Plan
## Microservices Architecture + DB Optimization + Performance

---

## OVERVIEW

Current state: single Go monolith (Gin), single PostgreSQL DB, optional Redis.
Target state: microservices with an API Gateway, gRPC inter-service communication,
shared proto definitions, per-domain DB schemas, PgBouncer connection pooling,
and Redis as a first-class dependency.

Migration strategy: **Strangler Fig** — extract one service at a time, keep the
monolith running in parallel, route new traffic to the extracted service, then
remove the old code. No big-bang rewrite.

```
Clients (Frontend / Dev Panel)
         │
         ▼
   ┌─────────────────┐
   │   api_gateway   │  ← Single entry point. Auth verify, rate limit, routing
   └────────┬────────┘
            │ gRPC / HTTP
    ┌───────┼───────┬────────────┬──────────────┐
    ▼       ▼       ▼            ▼              ▼
 auth_   user_   student_    payment_      finance_
 service service  service     service       service
            │                    │
            ▼                    ▼
       teacher_           notification_
        service              service
            │
            ▼
        protos  ← shared .proto files, generated code for all services
```

---

## PART 1 — SERVICE BOUNDARIES

### 1.1 api_gateway
**Responsibility:** Single public entry point. Does NOT touch the DB.
- Verify JWT (shared secret) — no DB call
- Extract `user_id`, `role` from token claims, forward as gRPC metadata
- Route by path prefix to correct downstream service
- Global rate limiting (Redis-backed)
- CORS, request-id injection, structured logging
- Health aggregation (`GET /health` calls all services and merges)
- WebSocket proxy (future: real-time notifications)

**Tech:** Go, Gin or stdlib `net/http`, grpc-gateway for REST→gRPC translation

---

### 1.2 auth_service
**Responsibility:** Identity only. Issues and validates JWTs.
- Login: verify bcrypt password → issue JWT (24h) + refresh token (7d)
- Register: create admin account + default branch + trial subscription event
- Forgot password / OTP / reset password
- Token refresh, logout (Redis token blacklist)
- Developer auth (separate JWT type)

**Owns tables:** `users` (credentials columns only), `otp_codes`
**Publishes events:** `user.registered`, `user.password_changed`, `user.deleted`
**gRPC methods:**
  - `ValidateToken(token) → Claims`
  - `GetUserByID(id) → AuthUser`

---

### 1.3 user_service
**Responsibility:** User profiles, roles, permissions, branches, manager assignments.
- User CRUD (profile data, role, permissions)
- Branch CRUD (create, assign managers, settings)
- Permission matrix management
- Branch financial month management
- Teacher portal data assembly

**Owns tables:** `users` (profile columns), `permissions`, `branches`,
`branch_managers`, `financial_months`, `settings`
**Subscribes to:** `user.registered` (seed permission row)
**gRPC methods:**
  - `GetUser(id) → User`
  - `GetBranch(id) → Branch`
  - `ListUserBranches(user_id) → []Branch`
  - `CheckPermission(user_id, action) → bool`
  - `GetCurrentFinancialMonth(branch_id) → FinancialMonth`

---

### 1.4 student_service
**Responsibility:** Academic core — students, classes, attendance, assignments, schedules.
- Student CRUD + bulk CSV import
- Class management + enrollment
- Attendance mark + reporting
- Assignments + submissions
- Schedule slots
- Student notes + contact logs

**Owns tables:** `students`, `classes`, `teacher_subjects`, `attendance`,
`student_notes`, `contact_logs`, `schedule_slots`, `assignments`,
`assignment_submissions`
**gRPC methods:**
  - `GetStudent(id) → Student`
  - `ListStudents(branch_id, filters) → []Student`
  - `GetClass(id) → Class`
  - `ListClasses(branch_id) → []Class`
  - `GetStudentPaymentSummary(student_id, month, year) → PaymentStatus`
  - `GetTeacherClasses(teacher_id) → []Class`

---

### 1.5 payment_service
**Responsibility:** All money flows — student fees, subscriptions, external payment gateways.
- Student payment records (CRUD, bulk-mark-paid)
- Payment status computation (paid / partial / unpaid)
- Click.uz webhook receiver + payment confirmation
- Telegram payment link generation
- Subscription SaaS billing (plans, subscriptions, usage tracking)
- Subscription payment history

**Owns tables:** `payments`, `subscription_plans`, `subscriptions`,
`subscription_usage`, `subscription_payments`, `payment_types`
**Calls via gRPC:** `student_service.GetStudent`, `user_service.GetBranch`
**Publishes events:** `payment.created`, `payment.status_changed`,
`subscription.expired`, `subscription.renewed`
**gRPC methods:**
  - `GetPayment(id) → Payment`
  - `ListPayments(branch_id, month, year) → []Payment`
  - `GetStudentPayments(student_id) → []Payment`
  - `GetSubscription(user_id) → Subscription`
  - `CheckSubscriptionActive(user_id) → bool`

---

### 1.6 teacher_service
**Responsibility:** HR — teacher profiles, salaries, subject assignments.
- Teacher CRUD (creates user account + teacher profile atomically)
- Salary records (create, mark paid, history)
- Subject assignments

**Owns tables:** `teachers`, `salaries`
**Calls via gRPC:** `user_service.GetUser`, `student_service.GetClass`
**gRPC methods:**
  - `GetTeacher(id) → Teacher`
  - `ListTeachers(branch_id) → []Teacher`
  - `GetTeacherPortal(teacher_id) → TeacherPortalData`

---

### 1.7 finance_service
**Responsibility:** Non-payment financials — expenses, income, budgets, reports.
- Expense CRUD + category budgets
- Income records
- Async financial report generation (branch P&L, payment aging, student roll)
- Cross-domain aggregation for dashboard totals

**Owns tables:** `expenses`, `incomes`, `expense_budgets`, `report_jobs`
**Calls via gRPC:** `payment_service.ListPayments`, `student_service.ListStudents`,
`teacher_service.ListTeachers`

---

### 1.8 notification_service
**Responsibility:** Async fan-out — in-app alerts, bulk SMS, Telegram messages.
- Consume domain events from message bus (payment created → notify student)
- In-app notification storage + read status
- Bulk Telegram/SMS campaigns (initiated by managers)
- Message log history

**Owns tables:** `notifications`, `message_logs`
**Consumes events:** `payment.status_changed`, `user.registered`, `subscription.expired`

---

### 1.9 protos (shared repository)
Shared `.proto` files for all inter-service gRPC contracts.
All services import this as a Go module.

```
protos/
├── auth/        v1/auth.proto
├── user/        v1/user.proto
├── student/     v1/student.proto
├── payment/     v1/payment.proto
├── teacher/     v1/teacher.proto
├── finance/     v1/finance.proto
├── notification/v1/notification.proto
└── common/      v1/common.proto  ← shared types (Pagination, Error, BranchCtx)
```

---

## PART 2 — DATABASE ARCHITECTURE

### 2.1 Per-Service Schemas (same PostgreSQL instance, separate schemas)
Rather than one flat `public` schema for all tables, each service owns its schema.
This enforces boundaries without the operational overhead of multiple databases.

```sql
-- Schema ownership
auth.users          (credentials only: id, email, password_hash, role, created_at)
users.users         (profile: id, full_name, phone, branch_id, settings)
users.permissions   
users.branches      
users.financial_months

students.students   
students.classes    
students.attendance 

payments.payments   
payments.payment_types
payments.subscriptions

teachers.teachers   
teachers.salaries   

finance.expenses    
finance.incomes     
finance.expense_budgets

notifications.notifications
notifications.message_logs
```

**Cross-schema reads via gRPC, not JOIN.** Services never query another service's schema.

---

### 2.2 Missing Indexes (add immediately to current DB)

```sql
-- Students (most queried table)
CREATE INDEX CONCURRENTLY idx_students_class_status    ON students(class_id, status);
CREATE INDEX CONCURRENTLY idx_students_branch_created  ON students(branch_id, created_at DESC);

-- Payments (hot path — monthly billing views)
CREATE INDEX CONCURRENTLY idx_payments_month_year_status ON payments(branch_id, year, month, status);
CREATE INDEX CONCURRENTLY idx_payments_student_month    ON payments(student_id, year, month);

-- Attendance (bulk inserts + date range queries)
CREATE INDEX CONCURRENTLY idx_attendance_class_date     ON attendance(class_id, date DESC);
CREATE INDEX CONCURRENTLY idx_attendance_student_month  ON attendance(student_id, date);

-- Audit logs (usually queried by branch + date range)
CREATE INDEX CONCURRENTLY idx_audit_logs_branch_created ON audit_logs(branch_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_audit_logs_user_action    ON audit_logs(user_id, action);

-- Notifications
CREATE INDEX CONCURRENTLY idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Salaries
CREATE INDEX CONCURRENTLY idx_salaries_teacher_month    ON salaries(teacher_id, year, month);
```

---

### 2.3 Table Partitioning (for high-growth tables)

`payments`, `attendance`, `audit_logs`, and `notifications` grow without bound.
Partition by year to keep query plans fast.

```sql
-- Example: partition payments by year
CREATE TABLE payments (
    id          UUID DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL,
    student_id  UUID NOT NULL,
    amount      NUMERIC(12,2) NOT NULL,
    month       SMALLINT NOT NULL,
    year        SMALLINT NOT NULL,
    status      TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
) PARTITION BY RANGE (year);

CREATE TABLE payments_2024 PARTITION OF payments FOR VALUES FROM (2024) TO (2025);
CREATE TABLE payments_2025 PARTITION OF payments FOR VALUES FROM (2025) TO (2026);
CREATE TABLE payments_2026 PARTITION OF payments FOR VALUES FROM (2026) TO (2027);
-- add future partitions via cron each January
```

Same pattern for: `attendance`, `audit_logs` (partition by month), `notifications`.

---

### 2.4 Connection Pooling — PgBouncer
Current: each service connects directly to PostgreSQL (max 50 connections).
With 8 microservices each opening a pool → ~400 connections → PostgreSQL OOM.

Add PgBouncer in **transaction mode** between services and PostgreSQL:

```
Service A ─┐
Service B ─┼──► PgBouncer (port 6432) ──► PostgreSQL (port 5432)
Service C ─┘     pool_size = 20 per DB    max_connections = 100
```

**Config changes per service:**
```go
// From direct PostgreSQL:
db.Open("postgres://user:pass@postgres:5432/schoolcrm")
// To PgBouncer:
db.Open("postgres://user:pass@pgbouncer:6432/schoolcrm")
```

---

### 2.5 Read Replicas for Heavy Queries
Reports, analytics, and audit log queries hit a **read replica**, not the primary.

```go
// Service: two DB pools
type DB struct {
    Writer *sqlx.DB  // primary — INSERT/UPDATE/DELETE
    Reader *sqlx.DB  // replica — SELECT (reports, list queries, exports)
}
```

All `GET /reports/*`, `GET /audit-logs`, `GET /students` (list) use `Reader`.
All mutations use `Writer`.

---

### 2.6 Schema Migrations — golang-migrate per service
Each service owns its migration directory. No cross-service migrations.

```
auth_service/migrations/
student_service/migrations/
payment_service/migrations/
...
```

Migrations run at service startup (`RunMigrations()` in `db.go`).
Lock via advisory lock to prevent concurrent migration on multi-replica startup.

---

## PART 3 — PERFORMANCE OPTIMIZATIONS

### 3.1 Redis as First-Class Dependency
Currently Redis is optional. Make it required. Use it for:

| Use case | Key pattern | TTL |
|----------|-------------|-----|
| JWT blacklist (logout) | `auth:blacklist:{jti}` | token expiry |
| User session cache | `auth:session:{user_id}` | 15 min |
| Branch data cache | `crm:branch:{id}` | 10 min |
| Students list cache | `crm:students:{branch_id}:{page}:{filters_hash}` | 2 min |
| Payment summary | `crm:payment_summary:{branch_id}:{month}:{year}` | 5 min |
| Rate limit counters | `rl:{user_id}:{window}` | 60 sec |
| Teacher portal | `crm:teacher_portal:{teacher_id}` | 2 min |
| OTP codes | `auth:otp:{email}` | 10 min |

**Cache invalidation rule:** Write-through on mutations. When a payment is
created/updated, delete `crm:payment_summary:{branch_id}:{month}:{year}`.

---

### 3.2 Consolidated API Endpoints (fewer round-trips)
Replace per-resource fetches with aggregation endpoints:

```
GET /api/v1/consolidated/students     → students + classes + branch config
GET /api/v1/consolidated/payments     → payments + student map + indicators
GET /api/v1/consolidated/dashboard    → stats + recent activity + alerts
```

These already exist (`getStudentsConsolidatedData`, `getPaymentsConsolidatedData`).
**Keep them in the API gateway layer** — gateway fans out to student_service +
payment_service in parallel using goroutines, merges results.

---

### 3.3 Async Report Generation
Current: reports block the HTTP request.
Fix: always async with job queue.

```
POST /reports/generate → returns { job_id: "..." } immediately
GET  /reports/{job_id} → { status: "pending|done|failed", url: "..." }
```

Use a **persistent job queue** (Redis Streams or PostgreSQL `report_jobs` table)
instead of in-memory. Jobs survive service restarts.

```sql
CREATE TABLE report_jobs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL,
    type        TEXT NOT NULL,           -- 'financial', 'students', 'attendance'
    params      JSONB NOT NULL,
    status      TEXT DEFAULT 'pending',  -- pending | processing | done | failed
    result_url  TEXT,
    error       TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON report_jobs(branch_id, status, created_at DESC);
```

---

### 3.4 gRPC for Inter-Service Communication
Benchmark: gRPC (protobuf binary) is ~5–7× faster than REST (JSON) for
internal calls. All service-to-service calls use gRPC.

**Example: payment_service needs student name for a payment record:**
```go
// Instead of HTTP GET /students/{id}:
studentResp, err := s.studentClient.GetStudent(ctx, &pb.GetStudentRequest{Id: studentId})
```

Connection management: each service maintains a persistent gRPC connection
pool to its dependencies (not reconnect per request).

---

### 3.5 Pagination & Cursor-Based Queries
Current: `OFFSET/LIMIT` pagination. On large tables, `OFFSET 5000` scans
5000 rows before returning results.

Switch to **keyset/cursor pagination** for all list endpoints:

```sql
-- Current (slow on large offsets):
SELECT * FROM students WHERE branch_id = $1 ORDER BY created_at DESC LIMIT 20 OFFSET 500;

-- New (always fast):
SELECT * FROM students
WHERE branch_id = $1 AND created_at < $2  -- $2 = cursor from last item
ORDER BY created_at DESC
LIMIT 20;
```

API response includes `next_cursor` instead of page number.
Support both `page` (backwards compat) and `cursor` parameters.

---

### 3.6 N+1 Query Elimination
**Problem areas found:**
- `student_service`: fetching class name per student in list → N DB calls
- `payment_service`: fetching student name per payment → N DB calls
- `teacher_portal`: separate queries per class to get students

**Fix:** Use `JOIN` or `IN (...)` batch queries instead of per-row fetches.

```sql
-- Bad (N+1):
for each student: SELECT name FROM classes WHERE id = student.class_id

-- Good (1 query):
SELECT s.*, c.name AS class_name
FROM students s
LEFT JOIN classes c ON c.id = s.class_id
WHERE s.branch_id = $1
```

---

### 3.7 Database Query Timeouts
Every query gets a context timeout. No runaway queries block the pool.

```go
const (
    QueryTimeout    = 5 * time.Second
    ReportTimeout   = 30 * time.Second
    BulkImportTimeout = 60 * time.Second
)

ctx, cancel := context.WithTimeout(ctx, QueryTimeout)
defer cancel()
rows, err := db.QueryContext(ctx, query, args...)
```

---

## PART 4 — REPOSITORY STRUCTURE

```
school-crm/
├── api_gateway/          ← new: routes, JWT verify, gRPC proxy
│   ├── cmd/main.go
│   ├── internal/
│   │   ├── router/       routes + middleware
│   │   ├── proxy/        gRPC client connections to each service
│   │   └── middleware/   auth, rate limit, logging
│   └── Dockerfile
│
├── auth_service/         ← extracted from monolith
│   ├── cmd/main.go
│   ├── internal/
│   │   ├── handlers/
│   │   ├── service/
│   │   └── db/           owns: auth.users, otp_codes
│   ├── migrations/
│   └── Dockerfile
│
├── user_service/         ← extracted
│   ├── cmd/main.go
│   ├── internal/
│   └── migrations/
│
├── student_service/      ← extracted
├── payment_service/      ← extracted
├── teacher_service/      ← extracted
├── finance_service/      ← extracted
├── notification_service/ ← extracted
│
├── protos/               ← shared .proto files + generated Go code
│   ├── auth/v1/
│   ├── user/v1/
│   ├── student/v1/
│   ├── payment/v1/
│   ├── teacher/v1/
│   ├── finance/v1/
│   ├── notification/v1/
│   └── common/v1/
│
└── infra/
    ├── docker-compose.yml    local dev (all services + postgres + redis + pgbouncer)
    ├── pgbouncer.ini
    └── nginx.conf            (optional: TLS termination before gateway)
```

---

## PART 5 — MIGRATION ROADMAP

### Phase 1 — Foundation (do first, unblocks everything)
| # | Task | Files touched | Notes |
|---|------|--------------|-------|
| P1.1 | Add missing DB indexes | `migrations/v000015_indexes.sql` | CONCURRENTLY, no downtime |
| P1.2 | Create `protos/` repo with all .proto files | new repo | Define contracts before splitting |
| P1.3 | Add PgBouncer to infra | `infra/pgbouncer.ini`, `docker-compose.yml` | Update connection strings |
| P1.4 | Add Redis as required dependency | `internal/cache/`, `cmd/main.go` | Remove optional Redis check |
| P1.5 | Split DB users table into auth vs profile columns | migration | Keep both views on same table for now |
| P1.6 | Implement cursor pagination on `/students` and `/payments` | handlers | Backwards compat with `page` param |
| P1.7 | Fix N+1 queries in student list + payment list | services | 1 query with JOIN |
| P1.8 | Add query timeouts to all DB calls | service/*.go | 5s default |
| P1.9 | Switch reports to persistent job queue (DB-backed) | `jobs/`, `report_service.go` | Remove in-memory queue |

---

### Phase 2 — Extract auth_service
| # | Task | Notes |
|---|------|-------|
| P2.1 | Create `auth_service/` with login, register, OTP endpoints | Copy from monolith |
| P2.2 | Implement `ValidateToken` gRPC method in auth_service | Used by api_gateway |
| P2.3 | Create `api_gateway/` skeleton — JWT verify + reverse proxy to monolith | No routing change yet |
| P2.4 | Route `/auth/*` through gateway → auth_service | Monolith auth handlers stay as fallback |
| P2.5 | Remove auth handlers from monolith once auth_service stable | Strangler complete |

---

### Phase 3 — Extract payment_service
| # | Task | Notes |
|---|------|-------|
| P3.1 | Define `protos/payment/v1/payment.proto` | `GetPayment`, `ListPayments`, `CheckSubscriptionActive` |
| P3.2 | Create `payment_service/` — payments, subscriptions, Click.uz, Telegram | Highest value extraction |
| P3.3 | Move `payments.*`, `subscriptions.*` tables to `payment` schema | Migration + app code |
| P3.4 | payment_service calls student_service via gRPC for student data | Replace direct DB join |
| P3.5 | Route `/payments/*`, `/subscriptions/*` through gateway → payment_service | |
| P3.6 | Remove from monolith | |

---

### Phase 4 — Extract user_service + student_service
| # | Task | Notes |
|---|------|-------|
| P4.1 | Extract user_service (users, permissions, branches) | |
| P4.2 | Extract student_service (students, classes, attendance) | |
| P4.3 | API gateway routes `/users/*`, `/branches/*`, `/students/*`, `/classes/*`, `/attendance/*` | |
| P4.4 | Consolidated endpoints move to gateway layer (fan-out in parallel goroutines) | |

---

### Phase 5 — Extract remaining services
| # | Task | Notes |
|---|------|-------|
| P5.1 | Extract teacher_service | |
| P5.2 | Extract finance_service (expenses, income, reports, budgets) | Add read replica here |
| P5.3 | Extract notification_service (async, event-driven) | |
| P5.4 | Add partitioning to `payments`, `attendance`, `audit_logs` | Maintenance window |
| P5.5 | Decommission monolith | |

---

## PART 6 — PROTO DEFINITIONS (key contracts)

```protobuf
// protos/common/v1/common.proto
message BranchContext {
    string branch_id = 1;
    string user_id   = 2;
    string role      = 3;
}

message Pagination {
    int32  page   = 1;
    int32  limit  = 2;
    string cursor = 3;  // keyset cursor
}

// protos/student/v1/student.proto
service StudentService {
    rpc GetStudent(GetStudentRequest)           returns (Student);
    rpc ListStudents(ListStudentsRequest)       returns (ListStudentsResponse);
    rpc GetClass(GetClassRequest)               returns (Class);
    rpc ListClasses(ListClassesRequest)         returns (ListClassesResponse);
    rpc GetTeacherClasses(GetTeacherClassesRequest) returns (ListClassesResponse);
}

// protos/payment/v1/payment.proto
service PaymentService {
    rpc GetPayment(GetPaymentRequest)           returns (Payment);
    rpc ListPayments(ListPaymentsRequest)       returns (ListPaymentsResponse);
    rpc CheckSubscriptionActive(CheckRequest)   returns (CheckResponse);
    rpc GetSubscription(GetSubscriptionRequest) returns (Subscription);
}

// protos/auth/v1/auth.proto
service AuthService {
    rpc ValidateToken(ValidateTokenRequest)  returns (TokenClaims);
    rpc GetUserByID(GetUserRequest)          returns (AuthUser);
    rpc BlacklistToken(BlacklistRequest)     returns (google.protobuf.Empty);
}
```

---

## PART 7 — DOCKER COMPOSE (local dev)

```yaml
# infra/docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: schoolcrm
      POSTGRES_USER: crm
      POSTGRES_PASSWORD: crm_secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    command: postgres -c max_connections=200 -c shared_buffers=256MB
             -c effective_cache_size=512MB -c work_mem=4MB

  pgbouncer:
    image: pgbouncer/pgbouncer:1.22
    volumes:
      - ./pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini
    depends_on: [postgres]

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

  api_gateway:
    build: ../api_gateway
    ports: ["8080:8080"]
    environment:
      AUTH_SERVICE_ADDR: auth_service:9090
      USER_SERVICE_ADDR: user_service:9091
      STUDENT_SERVICE_ADDR: student_service:9092
      PAYMENT_SERVICE_ADDR: payment_service:9093
      TEACHER_SERVICE_ADDR: teacher_service:9094
      FINANCE_SERVICE_ADDR: finance_service:9095
      NOTIFICATION_SERVICE_ADDR: notification_service:9096

  auth_service:
    build: ../auth_service
    environment:
      DATABASE_URL: postgres://crm:crm_secret@pgbouncer:6432/schoolcrm
      REDIS_URL: redis://redis:6379
      GRPC_PORT: 9090

  # ... repeat for each service
```

---

## PART 8 — PRIORITY ORDER

| Priority | Item | Impact | Phase |
|----------|------|--------|-------|
| 1 | P1.1 Add missing indexes | Immediate query speed | Phase 1 |
| 2 | P1.7 Fix N+1 queries | Eliminate worst slow queries | Phase 1 |
| 3 | P1.3 PgBouncer | Handle >50 concurrent connections | Phase 1 |
| 4 | P1.8 Query timeouts | Prevent pool starvation | Phase 1 |
| 5 | P1.4 Redis required | Consistent caching | Phase 1 |
| 6 | P1.9 Persistent report jobs | Fix data loss on restart | Phase 1 |
| 7 | P1.6 Cursor pagination | Fast large-table queries | Phase 1 |
| 8 | P2.1–P2.5 auth_service | First service extraction | Phase 2 |
| 9 | P1.2 protos repo | Required for Phase 2+ | Phase 1 |
| 10 | P3.1–P3.6 payment_service | Highest load, most value | Phase 3 |
| 11 | P4.1–P4.4 user + student | Core domain | Phase 4 |
| 12 | P5.1 teacher_service | Medium complexity | Phase 5 |
| 13 | P5.2 finance_service + read replica | Heavy queries | Phase 5 |
| 14 | P5.3 notification_service | Async, lowest risk | Phase 5 |
| 15 | P5.4 Partitioning | Long-term scale | Phase 5 |
| 16 | P5.5 Decommission monolith | Final cleanup | Phase 5 |
