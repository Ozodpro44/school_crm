package handlers

// This file contains swaggo route annotations for all handlers.
// The actual handler logic lives in the individual handler files.
// Swag picks up these annotations when running `swag init -g cmd/main.go`.
//
// Response body types use map[string]interface{} for simplicity;
// request body schemas for POST/PUT endpoints are documented inline in each handler file.

// ──────────────────────────────────────────────
// Students
// ──────────────────────────────────────────────

// swaggerListStudents godoc
//
//	@Summary      List students
//	@Description  Returns a paginated list of students for the given branch.
//	@Tags         students
//	@Produce      json
//	@Security     BearerAuth
//	@Param        branchId  query     string  true   "Branch ID"
//	@Param        page      query     int     false  "Page number (default 1)"
//	@Param        limit     query     int     false  "Page size (default 10, max 1000)"
//	@Success      200       {object}  map[string]interface{}  "data, total, page, limit, totalPages"
//	@Failure      400       {object}  map[string]string       "branchId required"
//	@Failure      401       {object}  map[string]string       "unauthorized"
//	@Router       /students [get]
func swaggerListStudents() {}

// swaggerGetStudent godoc
//
//	@Summary      Get student
//	@Description  Returns a single student by ID.
//	@Tags         students
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id   path      string                 true  "Student UUID"
//	@Success      200  {object}  map[string]interface{} "student object"
//	@Failure      404  {object}  map[string]string      "not found"
//	@Router       /students/{id} [get]
func swaggerGetStudent() {}

// swaggerCreateStudent godoc
//
//	@Summary      Create student
//	@Description  Creates a new student in the branch.
//	@Tags         students
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      map[string]interface{}  true  "Student data (full_name, monthly_payment, status, branch_id)"
//	@Success      201   {object}  map[string]interface{}  "created student"
//	@Failure      400   {object}  map[string]string       "invalid body"
//	@Failure      402   {object}  map[string]string       "subscription_limit_reached"
//	@Router       /students [post]
func swaggerCreateStudent() {}

// swaggerUpdateStudent godoc
//
//	@Summary      Update student
//	@Description  Partially updates a student record (any field provided in body).
//	@Tags         students
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id    path      string                  true  "Student UUID"
//	@Param        body  body      map[string]interface{}  true  "Fields to update"
//	@Success      200   {object}  map[string]interface{}  "updated student"
//	@Failure      400   {object}  map[string]string       "invalid body"
//	@Failure      500   {object}  map[string]string       "internal error"
//	@Router       /students/{id} [put]
func swaggerUpdateStudent() {}

// swaggerDeleteStudent godoc
//
//	@Summary      Delete student
//	@Description  Permanently removes a student record.
//	@Tags         students
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id   path      string             true  "Student UUID"
//	@Success      200  {object}  map[string]string  "student deleted"
//	@Failure      500  {object}  map[string]string  "internal error"
//	@Router       /students/{id} [delete]
func swaggerDeleteStudent() {}

// swaggerGetStudentsConsolidated godoc
//
//	@Summary      Consolidated student data
//	@Description  Returns students with payment status, class info, and filters for the dashboard table.
//	@Tags         students
//	@Produce      json
//	@Security     BearerAuth
//	@Param        branchId       query  string  true   "Branch ID"
//	@Param        page           query  int     false  "Page"
//	@Param        limit          query  int     false  "Limit"
//	@Param        search         query  string  false  "Name search"
//	@Param        status         query  string  false  "active | inactive | left"
//	@Param        classId        query  string  false  "Filter by class UUID"
//	@Param        paymentStatus  query  string  false  "paid | partial | not_paid"
//	@Param        month          query  string  false  "MM"
//	@Param        year           query  string  false  "YYYY"
//	@Success      200  {object}  map[string]interface{}
//	@Failure      400  {object}  map[string]string
//	@Router       /students/consolidated/data [get]
func swaggerGetStudentsConsolidated() {}

// ──────────────────────────────────────────────
// Payments
// ──────────────────────────────────────────────

// swaggerListPayments godoc
//
//	@Summary      List payments
//	@Description  Returns payments for a branch, with optional month/year/status filters.
//	@Tags         payments
//	@Produce      json
//	@Security     BearerAuth
//	@Param        branchId  query  string  true   "Branch ID"
//	@Param        month     query  int     false  "Month (1-12)"
//	@Param        year      query  int     false  "Year (e.g. 2025)"
//	@Param        status    query  string  false  "paid | partial | not_paid"
//	@Param        page      query  int     false  "Page"
//	@Param        limit     query  int     false  "Limit"
//	@Success      200  {object}  map[string]interface{}
//	@Failure      400  {object}  map[string]string
//	@Router       /payments [get]
func swaggerListPayments() {}

// swaggerCreatePayment godoc
//
//	@Summary      Create payment
//	@Description  Records a new payment entry for a student.
//	@Tags         payments
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      map[string]interface{}  true  "student_id, branch_id, amount, month, year, payment_method"
//	@Success      201   {object}  map[string]interface{}  "created payment"
//	@Failure      400   {object}  map[string]string
//	@Router       /payments [post]
func swaggerCreatePayment() {}

// swaggerUpdatePayment godoc
//
//	@Summary      Update payment
//	@Tags         payments
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id    path  string                 true  "Payment UUID"
//	@Param        body  body  map[string]interface{} true  "Fields to update"
//	@Success      200   {object}  map[string]interface{}
//	@Failure      400   {object}  map[string]string
//	@Router       /payments/{id} [put]
func swaggerUpdatePayment() {}

// swaggerDeletePayment godoc
//
//	@Summary      Delete payment
//	@Description  Permanently removes a payment record.
//	@Tags         payments
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id   path      string             true  "Payment UUID"
//	@Success      200  {object}  map[string]string  "payment deleted"
//	@Failure      500  {object}  map[string]string
//	@Router       /payments/{id} [delete]
func swaggerDeletePayment() {}

// swaggerGetPaymentsConsolidated godoc
//
//	@Summary      Consolidated payment data
//	@Description  Returns payment totals, method breakdown, and per-student summary for the dashboard.
//	@Tags         payments
//	@Produce      json
//	@Security     BearerAuth
//	@Param        branchId  query  string  true  "Branch ID"
//	@Param        month     query  int     true  "Month (1-12)"
//	@Param        year      query  int     true  "Year"
//	@Success      200  {object}  map[string]interface{}
//	@Failure      400  {object}  map[string]string
//	@Router       /payments/consolidated/data [get]
func swaggerGetPaymentsConsolidated() {}

// ──────────────────────────────────────────────
// Teachers
// ──────────────────────────────────────────────

// swaggerListTeachers godoc
//
//	@Summary      List teachers
//	@Description  Returns all teachers for the given branch.
//	@Tags         teachers
//	@Produce      json
//	@Security     BearerAuth
//	@Param        branchId  query  string  true  "Branch ID"
//	@Success      200  {object}  map[string]interface{}
//	@Failure      400  {object}  map[string]string
//	@Router       /teachers [get]
func swaggerListTeachers() {}

// swaggerCreateTeacher godoc
//
//	@Summary      Create teacher
//	@Description  Creates a new teacher profile and its linked user account.
//	@Tags         teachers
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      map[string]interface{}  true  "full_name, email, phone, branch_id, subjects, monthly_salary"
//	@Success      201   {object}  map[string]interface{}  "created teacher"
//	@Failure      400   {object}  map[string]string
//	@Router       /teachers [post]
func swaggerCreateTeacher() {}

// swaggerUpdateTeacher godoc
//
//	@Summary      Update teacher
//	@Tags         teachers
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id    path  string                 true  "Teacher UUID"
//	@Param        body  body  map[string]interface{} true  "Fields to update"
//	@Success      200   {object}  map[string]interface{}
//	@Failure      400   {object}  map[string]string
//	@Router       /teachers/{id} [put]
func swaggerUpdateTeacher() {}

// swaggerDeleteTeacher godoc
//
//	@Summary      Delete teacher
//	@Tags         teachers
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id   path      string             true  "Teacher UUID"
//	@Success      200  {object}  map[string]string  "teacher deleted"
//	@Failure      500  {object}  map[string]string
//	@Router       /teachers/{id} [delete]
func swaggerDeleteTeacher() {}

// ──────────────────────────────────────────────
// Branches
// ──────────────────────────────────────────────

// swaggerListBranches godoc
//
//	@Summary      List branches
//	@Description  Returns all branches belonging to the authenticated admin.
//	@Tags         branches
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {array}   map[string]interface{}
//	@Failure      500  {object}  map[string]string
//	@Router       /branches [get]
func swaggerListBranches() {}

// swaggerCreateBranch godoc
//
//	@Summary      Create branch
//	@Description  Creates a new branch under the authenticated school owner.
//	@Tags         branches
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      map[string]interface{}  true  "name, address, phone"
//	@Success      201   {object}  map[string]interface{}  "created branch"
//	@Failure      400   {object}  map[string]string
//	@Failure      402   {object}  map[string]string  "subscription_limit_reached"
//	@Router       /branches [post]
func swaggerCreateBranch() {}

// swaggerUpdateBranch godoc
//
//	@Summary      Update branch
//	@Tags         branches
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id    path  string                 true  "Branch UUID"
//	@Param        body  body  map[string]interface{} true  "Fields to update"
//	@Success      200   {object}  map[string]interface{}
//	@Failure      400   {object}  map[string]string
//	@Router       /branches/{id} [put]
func swaggerUpdateBranch() {}

// swaggerDeleteBranch godoc
//
//	@Summary      Delete branch
//	@Tags         branches
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id   path      string             true  "Branch UUID"
//	@Success      200  {object}  map[string]string  "branch deleted"
//	@Failure      500  {object}  map[string]string
//	@Router       /branches/{id} [delete]
func swaggerDeleteBranch() {}

// ──────────────────────────────────────────────
// Classes
// ──────────────────────────────────────────────

// swaggerListClasses godoc
//
//	@Summary      List classes
//	@Description  Returns all classes for a branch.
//	@Tags         classes
//	@Produce      json
//	@Security     BearerAuth
//	@Param        branchId  query  string  true  "Branch ID"
//	@Success      200  {array}   map[string]interface{}
//	@Failure      400  {object}  map[string]string
//	@Router       /classes [get]
func swaggerListClasses() {}

// swaggerCreateClass godoc
//
//	@Summary      Create class
//	@Tags         classes
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      map[string]interface{}  true  "name, branch_id, teacher_id, schedule"
//	@Success      201   {object}  map[string]interface{}  "created class"
//	@Failure      400   {object}  map[string]string
//	@Router       /classes [post]
func swaggerCreateClass() {}

// swaggerDeleteClass godoc
//
//	@Summary      Delete class
//	@Tags         classes
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id   path      string             true  "Class UUID"
//	@Success      200  {object}  map[string]string  "class deleted"
//	@Failure      500  {object}  map[string]string
//	@Router       /classes/{id} [delete]
func swaggerDeleteClass() {}

// ──────────────────────────────────────────────
// Salaries
// ──────────────────────────────────────────────

// swaggerListSalaries godoc
//
//	@Summary      List salaries
//	@Description  Returns salary records for a branch, optionally filtered by month/year.
//	@Tags         salaries
//	@Produce      json
//	@Security     BearerAuth
//	@Param        branchId  query  string  true   "Branch ID"
//	@Param        month     query  int     false  "Month (1-12)"
//	@Param        year      query  int     false  "Year"
//	@Success      200  {object}  map[string]interface{}
//	@Failure      400  {object}  map[string]string
//	@Router       /salaries [get]
func swaggerListSalaries() {}

// swaggerCreateSalary godoc
//
//	@Summary      Create salary record
//	@Tags         salaries
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      map[string]interface{}  true  "teacher_id, branch_id, amount, month, year, payment_method"
//	@Success      201   {object}  map[string]interface{}  "created salary"
//	@Failure      400   {object}  map[string]string
//	@Router       /salaries [post]
func swaggerCreateSalary() {}

// swaggerUpdateSalary godoc
//
//	@Summary      Update salary
//	@Tags         salaries
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id    path  string                 true  "Salary UUID"
//	@Param        body  body  map[string]interface{} true  "Fields to update"
//	@Success      200   {object}  map[string]interface{}
//	@Failure      400   {object}  map[string]string
//	@Router       /salaries/{id} [put]
func swaggerUpdateSalary() {}

// swaggerDeleteSalary godoc
//
//	@Summary      Delete salary
//	@Tags         salaries
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id   path      string             true  "Salary UUID"
//	@Success      200  {object}  map[string]string  "salary deleted"
//	@Failure      500  {object}  map[string]string
//	@Router       /salaries/{id} [delete]
func swaggerDeleteSalary() {}

// ──────────────────────────────────────────────
// Expenses
// ──────────────────────────────────────────────

// swaggerListExpenses godoc
//
//	@Summary      List expenses
//	@Description  Returns expense records for a branch, optionally filtered by date range.
//	@Tags         expenses
//	@Produce      json
//	@Security     BearerAuth
//	@Param        branchId   query  string  true   "Branch ID"
//	@Param        startDate  query  string  false  "YYYY-MM-DD"
//	@Param        endDate    query  string  false  "YYYY-MM-DD"
//	@Success      200  {object}  map[string]interface{}
//	@Failure      400  {object}  map[string]string
//	@Router       /expenses [get]
func swaggerListExpenses() {}

// swaggerCreateExpense godoc
//
//	@Summary      Create expense
//	@Tags         expenses
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      map[string]interface{}  true  "title, amount, category, branch_id, date, payment_method"
//	@Success      201   {object}  map[string]interface{}  "created expense"
//	@Failure      400   {object}  map[string]string
//	@Router       /expenses [post]
func swaggerCreateExpense() {}

// swaggerDeleteExpense godoc
//
//	@Summary      Delete expense
//	@Tags         expenses
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id   path      string             true  "Expense UUID"
//	@Success      200  {object}  map[string]string  "expense deleted"
//	@Failure      500  {object}  map[string]string
//	@Router       /expenses/{id} [delete]
func swaggerDeleteExpense() {}

// ──────────────────────────────────────────────
// Users
// ──────────────────────────────────────────────

// swaggerGetCurrentUser godoc
//
//	@Summary      Get current user
//	@Description  Returns the profile of the authenticated user.
//	@Tags         users
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  map[string]interface{}
//	@Failure      401  {object}  map[string]string
//	@Router       /users/me [get]
func swaggerGetCurrentUser() {}

// swaggerListUsers godoc
//
//	@Summary      List users
//	@Description  Returns all users visible to the authenticated admin.
//	@Tags         users
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {array}   map[string]interface{}
//	@Failure      500  {object}  map[string]string
//	@Router       /users [get]
func swaggerListUsers() {}

// ──────────────────────────────────────────────
// Subscriptions
// ──────────────────────────────────────────────

// swaggerGetSubscriptionPlans godoc
//
//	@Summary      List subscription plans
//	@Description  Returns available subscription plans (public — no auth required).
//	@Tags         subscriptions
//	@Produce      json
//	@Success      200  {array}  map[string]interface{}
//	@Router       /subscriptions/plans [get]
func swaggerGetSubscriptionPlans() {}

// ──────────────────────────────────────────────
// Attendance
// ──────────────────────────────────────────────

// swaggerRecordAttendance godoc
//
//	@Summary      Record attendance
//	@Description  Creates or updates attendance records for a class session.
//	@Tags         attendance
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      map[string]interface{}  true  "class_id, date, records (student_id, status)"
//	@Success      200   {object}  map[string]string
//	@Failure      400   {object}  map[string]string
//	@Router       /attendance [post]
func swaggerRecordAttendance() {}

// swaggerGetAttendance godoc
//
//	@Summary      Get attendance
//	@Description  Returns attendance records for a class and date.
//	@Tags         attendance
//	@Produce      json
//	@Security     BearerAuth
//	@Param        classId  query  string  true  "Class ID"
//	@Param        date     query  string  true  "YYYY-MM-DD"
//	@Success      200  {object}  map[string]interface{}
//	@Failure      400  {object}  map[string]string
//	@Router       /attendance [get]
func swaggerGetAttendance() {}

// ──────────────────────────────────────────────
// Reports
// ──────────────────────────────────────────────

// swaggerGetReport godoc
//
//	@Summary      Generate report
//	@Description  Returns financial and student summary for the specified branch and period.
//	@Tags         reports
//	@Produce      json
//	@Security     BearerAuth
//	@Param        branchId  query  string  true  "Branch ID"
//	@Param        month     query  int     true  "Month (1-12)"
//	@Param        year      query  int     true  "Year"
//	@Success      200  {object}  map[string]interface{}
//	@Failure      400  {object}  map[string]string
//	@Router       /reports [get]
func swaggerGetReport() {}

// ──────────────────────────────────────────────
// Notifications
// ──────────────────────────────────────────────

// swaggerListNotifications godoc
//
//	@Summary      List notifications
//	@Description  Returns unread notifications for the current user's branch.
//	@Tags         notifications
//	@Produce      json
//	@Security     BearerAuth
//	@Param        branchId  query  string  true  "Branch ID"
//	@Success      200  {array}   map[string]interface{}
//	@Failure      400  {object}  map[string]string
//	@Router       /notifications [get]
func swaggerListNotifications() {}

// swaggerMarkNotificationsRead godoc
//
//	@Summary      Mark notifications as read
//	@Tags         notifications
//	@Produce      json
//	@Security     BearerAuth
//	@Param        branchId  query  string  true  "Branch ID"
//	@Success      200  {object}  map[string]string
//	@Router       /notifications/read [post]
func swaggerMarkNotificationsRead() {}

// ──────────────────────────────────────────────
// Health
// ──────────────────────────────────────────────

// swaggerHealth godoc
//
//	@Summary      Health check
//	@Description  Returns server uptime, DB connection stats, and Redis status.
//	@Tags         system
//	@Produce      json
//	@Success      200  {object}  map[string]interface{}
//	@Router       /health [get]
func swaggerHealth() {}

// ──────────────────────────────────────────────
// Teacher Portal
// ──────────────────────────────────────────────

// swaggerGetTeacherPortal godoc
//
//	@Summary      Get teacher portal data
//	@Description  Returns the authenticated teacher's classes, upcoming sessions, recent payments, and salary summary.
//	@Tags         teacher-portal
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  map[string]interface{}  "classes, sessions, payments, salary"
//	@Failure      401  {object}  map[string]string       "unauthorized"
//	@Failure      404  {object}  map[string]string       "teacher profile not found"
//	@Router       /teacher-portal/me [get]
func swaggerGetTeacherPortal() {}

// swaggerLinkTeacherUser godoc
//
//	@Summary      Link user to teacher profile
//	@Description  Associates the authenticated user account with an existing teacher record (admin only).
//	@Tags         teacher-portal
//	@Produce      json
//	@Security     BearerAuth
//	@Param        teacherId  path      string             true  "Teacher UUID"
//	@Success      200        {object}  map[string]string  "linked"
//	@Failure      400        {object}  map[string]string  "invalid teacher ID"
//	@Failure      403        {object}  map[string]string  "insufficient permissions"
//	@Router       /teacher-portal/me/link/{teacherId} [put]
func swaggerLinkTeacherUser() {}

// ──────────────────────────────────────────────
// Messaging
// ──────────────────────────────────────────────

// swaggerListMessages godoc
//
//	@Summary      List message history
//	@Description  Returns Telegram message log for the branch.
//	@Tags         messaging
//	@Produce      json
//	@Security     BearerAuth
//	@Param        branchId  query  string  true  "Branch ID"
//	@Success      200  {array}   map[string]interface{}
//	@Failure      400  {object}  map[string]string
//	@Router       /messages [get]
func swaggerListMessages() {}

// swaggerSendMessage godoc
//
//	@Summary      Send Telegram message
//	@Description  Sends a Telegram message to a filtered group of students (bulk or individual).
//	@Tags         messaging
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      map[string]interface{}  true  "branch_id, text, filter (classId, status, paymentStatus)"
//	@Success      200   {object}  map[string]interface{}  "sent, failed counts"
//	@Failure      400   {object}  map[string]string
//	@Router       /messages/send [post]
func swaggerSendMessage() {}

// swaggerSetStudentTelegram godoc
//
//	@Summary      Set student Telegram ID
//	@Description  Associates a Telegram chat ID with a student record so they receive Telegram notifications.
//	@Tags         messaging
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id    path      string                 true  "Student UUID"
//	@Param        body  body      map[string]interface{} true  "telegram_id"
//	@Success      200   {object}  map[string]string
//	@Failure      400   {object}  map[string]string
//	@Router       /messages/student/{id}/telegram [put]
func swaggerSetStudentTelegram() {}

// ──────────────────────────────────────────────
// Async Job Queue
// ──────────────────────────────────────────────

// swaggerSubmitJob godoc
//
//	@Summary      Submit async job
//	@Description  Enqueues a background job (e.g. report generation, bulk operations). Returns a job ID for polling.
//	@Tags         jobs
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      map[string]interface{}  true  "type, payload"
//	@Success      202   {object}  map[string]interface{}  "job_id, status"
//	@Failure      400   {object}  map[string]string
//	@Router       /jobs [post]
func swaggerSubmitJob() {}

// swaggerGetJob godoc
//
//	@Summary      Get job status
//	@Description  Polls the status and result of a background job by ID.
//	@Tags         jobs
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id   path      string                 true  "Job ID"
//	@Success      200  {object}  map[string]interface{}  "id, status, result, created_at"
//	@Failure      404  {object}  map[string]string       "job not found"
//	@Router       /jobs/{id} [get]
func swaggerGetJob() {}

// ──────────────────────────────────────────────
// Payment Types (public)
// ──────────────────────────────────────────────

// swaggerListPaymentTypes godoc
//
//	@Summary      List payment types
//	@Description  Returns all active payment types (public — no auth required).
//	@Tags         payment-types
//	@Produce      json
//	@Success      200  {array}  map[string]interface{}
//	@Router       /payment-types [get]
func swaggerListPaymentTypes() {}
