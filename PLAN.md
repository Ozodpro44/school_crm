Now I have the full picture. Let me compile the plan.

  ---
  School CRM — Improvement Plan

  Quick Legend

  - 🔴 Critical / Breaks trust
  - 🟠 High impact, do soon
  - 🟡 Medium, meaningful quality boost
  - 🟢 Nice-to-have / polish

  ---
  PART 1 — BACKEND PERFORMANCE

  1.1 Add Redis Caching for Hot Queries ✅ DONE

  Redis is already integrated for OTP but never used for data caching. Every request hits
  PostgreSQL cold.

  Cache these:

  ┌────────────────────────────────────────────────┬──────┬─────────────────────────────┐
  │                      Data                      │ TTL  │        Invalidate on        │
  ├────────────────────────────────────────────────┼──────┼─────────────────────────────┤
  │ GET /students/consolidated/data per            │ 60s  │ Student                     │
  │ branch+month                                   │      │ create/update/delete        │
  ├────────────────────────────────────────────────┼──────┼─────────────────────────────┤
  │ GET /payments/consolidated/data per            │ 30s  │ Payment                     │
  │ branch+month                                   │      │ create/update/delete        │
  ├────────────────────────────────────────────────┼──────┼─────────────────────────────┤
  │ GET /classes per branch                        │ 120s │ Class create/update/delete  │
  ├────────────────────────────────────────────────┼──────┼─────────────────────────────┤
  │ GET /teachers per branch                       │ 120s │ Teacher                     │
  │                                                │      │ create/update/delete        │
  ├────────────────────────────────────────────────┼──────┼─────────────────────────────┤
  │ IsUserSubscriptionActive() per user            │ 300s │ Subscription change         │
  ├────────────────────────────────────────────────┼──────┼─────────────────────────────┤
  │ GET /settings per branch                       │ 600s │ Settings update             │
  └────────────────────────────────────────────────┴──────┴─────────────────────────────┘

  Implementation: Add a cache package in internal/cache/, wrap service methods with a
  read-through cache pattern. Key format: crm:{branchId}:{resource}:{params_hash}.

  ---
  1.2 Add Missing Database Indexes ✅ DONE

  backend_school_crm/migrations/000009_add_performance_indexes.up.sql — create this file:

  -- Payments — most queried by branch+month+year
  CREATE INDEX IF NOT EXISTS idx_payments_branch_month_year
    ON payments(branch_id, month, year);

  CREATE INDEX IF NOT EXISTS idx_payments_student_id_status
    ON payments(student_id, status);

  -- Students — filtered by branch + status constantly
  CREATE INDEX IF NOT EXISTS idx_students_branch_status
    ON students(branch_id, status);

  -- Salaries — filtered by branch + month + year
  CREATE INDEX IF NOT EXISTS idx_salaries_branch_month_year
    ON salaries(branch_id, month, year);

  -- Expenses — filtered by branch + date
  CREATE INDEX IF NOT EXISTS idx_expenses_branch_date
    ON expenses(branch_id, date);

  -- Classes — filtered by branch
  CREATE INDEX IF NOT EXISTS idx_classes_branch_id
    ON classes(branch_id);

  Run EXPLAIN ANALYZE on the consolidated endpoints to confirm these are hit.

  ---
  1.3 Rate Limiting Middleware ✅ DONE

  Redis is available. Add rate limiting in internal/middleware/ratelimit.go:
  - Auth endpoints (/auth/login, /auth/forgot-password): 10 req/min per IP
  - API endpoints: 300 req/min per user JWT
  - Webhook endpoints (Click.uz, Telegram): 100 req/min per IP
  - Return 429 Too Many Requests with Retry-After header

  ---
  1.4 Increase DB Connection Pool ✅ DONE

  internal/db/db.go — current: MaxOpenConns=25, MaxIdleConns=5.

  For a school CRM with multiple concurrent users:
  db.SetMaxOpenConns(50)
  db.SetMaxIdleConns(10)
  db.SetConnMaxLifetime(5 * time.Minute)
  db.SetConnMaxIdleTime(2 * time.Minute)

  ---
  1.5 Fix N+1 Queries in Consolidated Endpoints ✅ DONE

  The consolidated data endpoints (/students/consolidated/data, /payments/consolidated/data)
   likely call multiple sequential queries. Rewrite with CTEs (Common Table Expressions) to
  fetch everything in one round-trip:

  WITH student_data AS (
    SELECT s.*, c.name as class_name FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    WHERE s.branch_id = $1 AND s.status = $2
  ),
  payment_summary AS (
    SELECT student_id,
      SUM(amount) FILTER (WHERE status = 'paid') as paid_total,
      ...
    FROM payments
    WHERE branch_id = $1 AND month = $3 AND year = $4
    GROUP BY student_id
  )
  SELECT sd.*, ps.paid_total, ...
  FROM student_data sd
  LEFT JOIN payment_summary ps ON sd.id = ps.student_id

  ---
  1.6 Add Response Compression ✅ DONE

  Add gzip middleware to Gin. The consolidated endpoints return large JSON arrays that
  compress 60–80%:

  import "github.com/gin-contrib/gzip"
  router.Use(gzip.Gzip(gzip.DefaultCompression))

  ---
  1.7 Structured Logging + Request Tracing ✅ DONE

  Replace fmt.Println/log.Printf with zerolog or slog (stdlib since Go 1.21). Add a
  request-ID middleware that injects a UUID into every request context. Log:
  - Request: method, path, user_id, branch_id, latency
  - Slow queries (> 200ms)
  - All 500 errors with stack trace

  ---
  1.8 Background Job Queue for Heavy Reports ✅ DONE (backend + frontend)

  Currently reports are generated synchronously. For large schools (500+ students) this can
  block. Add a simple job queue (can use Redis lists or a Go goroutine pool) for:
  - Report generation
  - Bulk payment status recalculation
  - Subscription usage recounting

  Return a job_id immediately, frontend polls /jobs/:id/status.

  ---
  1.9 API Versioning ✅ DONE

  All routes are currently /api/. Change to /api/v1/ now before users rely on the
  unversioned path. This allows breaking changes later without disrupting clients.

  ---
  1.10 Database Query Timeout ✅ DONE

  Add query timeout context to all DB calls:

  ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
  defer cancel()
  rows, err := db.QueryContext(ctx, query, args...)

  Prevents runaway queries from holding connections indefinitely.

  ---
  PART 2 — SCHOOL OWNERS

  2.1 Real Dashboard KPIs ✅ DONE

  Current dashboard shows basic totals. School owners need:
  - Student churn rate: students who left this month vs last month
  - Collection rate: paid / expected × 100% — the single most important metric
  - Revenue trend: 6-month bar chart, month-over-month % change
  - Unpaid by class: which class has the most debtors
  - Top debtors list: students with highest outstanding balances
  - Salary payout %: how much of salary budget has been paid

  ---
  2.2 Notifications System ✅ DONE

  No notification system exists. Add:
  - In-app notifications — bell icon in sidebar, notification center
  - SMS/Telegram alerts (Telegram Bot is already wired) to parents when:
    - Payment is received
    - Student marks left
    - Monthly payment is due (1 day before)
  - Email digests to owner: weekly summary (Resend already integrated)

  Backend: notifications table + notification_service.go. Webhook triggers on
  payment/student events.

  ---
  2.3 Audit Log UI ✅ DONE

  logs table exists in the database but there is no UI for it. Add /audit-log page showing:
  - Who did what and when (create/update/delete)
  - Filterable by user, resource type, date range
  - Useful for investigating disputes ("who changed this payment?")

  ---
  2.4 Financial Forecasting ✅ DONE

  On the reports page, add a "Forecast" tab:
  - Expected monthly income = active students × average monthly payment
  - Expected vs actual chart
  - Break-even analysis: total expenses vs income
  - Projected salary costs for next month

  ---
  2.5 Multi-Branch Analytics ✅ DONE

  Admin users managing multiple branches currently have to switch branches to compare them.
  Add a Cross-Branch Overview page:
  - Revenue by branch (bar chart)
  - Student count by branch
  - Collection rate by branch
  - Top performing branch highlight

  ---
  2.6 Expense Categories Budget ✅ DONE

  Current expenses track amount + category but no budgeting. Add:
  - Monthly budget per category (e.g., Rent: $2,000/month)
  - Budget vs actual spending widget on dashboard
  - Alert when a category exceeds 90% of budget

  ---
  2.7 Printable / Exportable Reports ✅ DONE

  The report download exists but is limited. Add:
  - PDF export for payment history, salary summary, debtor list
  - Excel/CSV export that works correctly for Cyrillic characters (add BOM for Excel
  compatibility)
  - Print-friendly view for any table (window.print() with proper CSS)

  ---
  PART 3 — SCHOOL EMPLOYEES

  3.1 Attendance Tracking ✅ DONE

  No attendance system exists. This is the most requested feature in school software:
  - /attendance page: daily class attendance grid
  - Mark present/absent/late per student per class session
  - Attendance summary per student (% present this month)
  - Alert teacher when student has missed 3+ consecutive classes
  - Parent notification on absence (via Telegram)

  Backend: attendance table: id, branch_id, class_id, student_id, date,
  status(present/absent/late), note, created_by.

  ---
  3.2 Quick Payment Entry ✅ DONE

  Currently adding a payment requires opening a dialog, searching for a student, filling a
  form. Teachers/managers need:
  - Barcode/QR scan to load student profile instantly
  - Bulk payment entry: select multiple students, mark all as paid at once
  - "Collect payment" mode: shows unpaid students for current month, tap to mark paid
  - One-tap receipt printing from student card

  ---
  3.3 Student Profile — Full History ✅ DONE

  The student details page should show:
  - Complete payment history with running balance
  - Attendance record (once 3.1 is done)
  - Class history (which classes they've attended)
  - Notes/comments thread (teacher can add internal notes)
  - Contact attempts log ("Called parent on 12.03.2025, no answer")

  ---
  3.4 Teacher Portal View ✅ DONE

  Teachers currently have a limited view. Add a dedicated teacher dashboard:
  - My classes: list of classes they teach with student counts
  - Today's attendance: quick attendance entry for today's sessions
  - Students I teach: filterable list with payment status visible (paid/unpaid)
  - My salary: current month salary status
  - No access to other teachers' salaries or financial data

  ---
  3.5 Class Schedule / Timetable ✅ DONE

  No schedule/timetable system. Add:
  - Weekly schedule grid per class (Mon–Sat, time slots)
  - Teacher assigned to each slot
  - Room/location field
  - Export schedule as PDF for printing on notice board
  - iCal export for Google Calendar sync

  ---
  3.6 Mass Messaging ✅ DONE

  Add a messaging page for managers:
  - Select students by: class, payment status, enrollment date range
  - Send Telegram message to all selected students' parents
  - Template messages: "Your payment for [month] is due", "Payment received: [amount]"
  - Message history log

  ---
  3.7 Homework / Assignment Tracker ✅ DONE

  - Teacher creates assignment: subject, due date, description
  - Students marked as submitted/not submitted
  - Grade entry (0–100 or letter grade)
  - Progress report per student per subject

  ---
  PART 4 — DEVELOPER EXPERIENCE

  4.1 OpenAPI / Swagger Documentation ✅ DONE

  Zero API documentation exists. Add swaggo/swag to the Go backend:
  go get github.com/swaggo/swag/cmd/swag
  go get github.com/swaggo/gin-swagger
  Add annotations to all handlers. Auto-generates interactive Swagger UI at /api/docs. Every
   developer touching the API will immediately benefit.

  ---
  4.2 Test Coverage — Backend ✅ DONE

  Currently only 4 test files exist. Target 70% coverage on:
  - All service layer functions (payment_service_test.go, student_service_test.go, etc.)
  - All middleware (auth_test.go, branch_access_test.go, subscription_test.go)
  - Use testcontainers-go for real PostgreSQL in tests (not mocks)
  - Add a make test target and wire into CI

  ---
  4.3 Remove the localStorage Storage Layer ✅ DONE

  frontend_school_crm/src/lib/storage.ts is a full localStorage-based DB that was the
  original offline fallback. It's now partly bypassed by the real API. It should be deleted
  entirely. Every page that still imports from storage.ts needs to be migrated to the API.

  Check all imports: grep -r "from.*lib/storage" src/pages/.

  ---
  4.4 Environment Config Validation at Startup ✅ DONE

  Backend already checks JWT_SECRET and DATABASE_URL. Extend to validate:
  - Warn clearly if REDIS_URL is missing (rate limiting and OTP won't work)
  - Validate JWT_SECRET is at least 32 chars
  - Print startup summary: which optional services are enabled/disabled

  Frontend: add a src/lib/config.ts that validates NEXT_PUBLIC_API_URL is set and reachable
  on app start, showing a clear error page instead of silent API failures.

  ---
  4.5 Error Monitoring (Sentry) ✅ DONE

  Add Sentry to both frontend and backend:
  - Backend: github.com/getsentry/sentry-go — captures panics + 500 errors with stack traces
  - Frontend: @sentry/nextjs — captures JS errors, failed API calls, slow page loads
  - Group errors by type, see frequency, get alerts on new errors
  - SENTRY_DSN env var (optional, graceful when missing)

  ---
  4.6 CI/CD Pipeline ✅ DONE

  No GitHub Actions / CI pipeline exists. Add .github/workflows/ci.yml:
  on: [push, pull_request]
  jobs:
    backend:
      - go vet ./...
      - go test ./... -race -cover
      - docker build (smoke test)
    frontend:
      - npm run lint
      - npx tsc --noEmit
      - npm run build

  ---
  4.7 Remove Dead Code ✅ DONE

  Several .disabled files exist in frontend pages:
  src/pages/subscriptions.tsx.disabled
  src/pages/subscription-details.tsx.disabled
  src/components/SubscriptionStatus.tsx.disabled
  Either restore them or delete them. They add confusion and TypeScript compile noise.

  Also: frontend_for_dev/ is a second frontend — clarify its purpose or remove it.

  ---
  4.8 Frontend Query Layer (React Query / SWR) ✅ DONE

  Currently every page manages its own useState + useEffect + fetch manually. This leads to:
  - No deduplication (same data fetched multiple times)
  - No background refresh
  - No optimistic updates

  Replace with TanStack Query (@tanstack/react-query):
  - Automatic caching and deduplication
  - Background refetch on focus (currently done manually via use-refetch-on-focus.ts)
  - Optimistic updates for instant UI feedback
  - Built-in loading/error states

  ---
  4.9 TypeScript Strict Mode ✅ DONE

  tsconfig.json — enable:
  {
    "compilerOptions": {
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": true
    }
  }
  Then fix the resulting errors. Prevents a whole class of runtime bugs.

  ---
  4.10 Database Backup Strategy ✅ DONE

  No backup configuration documented. Add to DEPLOY.md:
  - Railway managed PostgreSQL: enable automatic backups in dashboard
  - Add pg_dump script to cron for off-site backup
  - Document restore procedure
  - Test restore quarterly

  ---
  PART 5 — UX / PRODUCT POLISH

  5.1 Missing Translations ✅ DONE

  The translation key t("main"), t("support"), t("more") are used in the new sidebar but
  likely not in the translations file. Audit all t("...") calls vs the translations
  dictionary and fill gaps for uz-cyrl, uz-latn, and en.

  Run: grep -r 't("' src/ | grep -v node_modules and cross-reference
  src/lib/translations.ts.

  ---
  5.2 Offline / Poor Connection State ✅ DONE

  When the API is unreachable:
  - Show a global "No connection" banner instead of silent failures
  - Queue payment entries locally, sync when back online
  - Mark pages as "stale" with a timestamp ("Last updated 5 min ago")

  ---
  5.3 Mobile Responsiveness Audit ✅ DONE

  All data tables (students, payments, salaries) are desktop-only layouts that overflow on
  mobile. Each table needs a mobile card view that collapses columns:

  // Desktop: table row
  // Mobile: card with name + key info + action buttons

  The bottom nav added in the sidebar redesign is a good start — now the content must match.

  ---
  5.4 Loading Skeleton Consistency ✅ DONE

  Some pages use <Skeleton>, others show blank space. Audit all pages and ensure every
  data-fetching page has a consistent skeleton that matches the content shape (not just
  random grey bars).

  ---
  5.5 Form Validation UX ✅ DONE

  Most forms use basic validation. Improve:
  - Inline field errors (not just toast notifications)
  - Phone number format guide (+998 XX XXX-XX-XX)
  - Currency input auto-formatting as user types (already partially done in some pages)
  - Prevent double-submit (disable button while request in flight — already done in some
  pages, standardize)

  ---
  Priority Order Summary

  ┌──────────┬──────────────────────────┬──────────────────────────┐
  │ Priority │           Item           │          Impact          │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 1        │ DB indexes (1.2)         │ 3–10× faster queries     │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 2        │ Redis caching (1.1)      │ 80% reduction in DB load │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 3        │ Attendance system (3.1)  │ Core missing feature     │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 4        │ Dashboard KPIs (2.1)     │ Owner retention          │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 5        │ Remove storage.ts (4.3)  │ Data integrity risk      │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 6        │ Rate limiting (1.3)      │ Security                 │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 7        │ Swagger docs (4.1)       │ Dev velocity             │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 8        │ Notifications (2.2)      │ User engagement          │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 9        │ Test coverage (4.2)      │ Stability                │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 10       │ React Query (4.8)        │ Frontend reliability     │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 11       │ Audit log UI (2.3)       │ Owner trust              │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 12       │ Mobile table views (5.3) │ Mobile usability         │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 13       │ OpenAPI versioning (1.9) │ Future-proofing          │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 14       │ CI/CD pipeline (4.6)     │ Ship safely              │
  ├──────────┼──────────────────────────┼──────────────────────────┤
  │ 15       │ Sentry monitoring (4.5)  │ Ops visibility           │
  └──────────┴──────────────────────────┴──────────────────────────┘