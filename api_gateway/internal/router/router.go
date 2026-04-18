// Package router wires up all routes for the api_gateway.
//
// Routing strategy (Strangler Fig — P5.5 decommission complete):
//   - /api/v1/auth/*              → auth_service       (P2.4)
//   - /api/v1/payments/*          → payment_service    (P3.5)
//   - /api/v1/subscriptions/*     → payment_service    (P3.5)
//   - /api/v1/users/*             → user_service       (P4.1)
//   - /api/v1/branches/*          → user_service       (P4.1)
//   - /api/v1/permissions/*       → user_service       (P4.1)
//   - /api/v1/settings            → user_service       (P5.5)
//   - /api/v1/audit-logs          → user_service       (P5.5)
//   - /api/v1/students/*          → student_service    (P4.2)
//   - /api/v1/classes/*           → student_service    (P4.2)
//   - /api/v1/attendance/*        → student_service    (P4.2)
//   - /api/v1/schedule/*          → student_service    (P5.5)
//   - /api/v1/assignments/*       → student_service    (P5.5)
//   - /api/v1/consolidated/*      → gateway fan-out    (P4.4)
//   - /api/v1/teachers/*          → teacher_service    (P5.1)
//   - /api/v1/salaries/*          → teacher_service    (P5.1)
//   - /api/v1/expenses/*          → finance_service    (P5.2)
//   - /api/v1/expense-budgets     → finance_service    (P5.5)
//   - /api/v1/notifications/*     → notification_service (P5.3)
//   - Everything else             → monolith (auth, subscriptions, Click.uz, Telegram, reports, dev panel)
package router

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/api-gateway/internal/config"
	"github.com/school-crm/api-gateway/internal/middleware"
	"github.com/school-crm/api-gateway/internal/proxy"
)

func New(cfg *config.Config) (*gin.Engine, error) {
	monolithProxy, err := proxy.New(cfg.MonolithURL)
	if err != nil {
		return nil, err
	}
	authProxy, err := proxy.New(cfg.AuthServiceURL)
	if err != nil {
		return nil, err
	}
	paymentProxy, err := proxy.New(cfg.PaymentServiceURL)
	if err != nil {
		return nil, err
	}
	userProxy, err := proxy.New(cfg.UserServiceURL)
	if err != nil {
		return nil, err
	}
	studentProxy, err := proxy.New(cfg.StudentServiceURL)
	if err != nil {
		return nil, err
	}
	teacherProxy, err := proxy.New(cfg.TeacherServiceURL)
	if err != nil {
		return nil, err
	}
	financeProxy, err := proxy.New(cfg.FinanceServiceURL)
	if err != nil {
		return nil, err
	}
	notifProxy, err := proxy.New(cfg.NotificationServiceURL)
	if err != nil {
		return nil, err
	}

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(corsMiddleware())

	// ── Health ────────────────────────────────────────────────────────────────
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "api_gateway"})
	})

	// ── Public auth routes (no JWT required) — P2.4 ──────────────────────────
	// These are forwarded to auth_service unchanged.
	authPublic := r.Group("/api/v1/auth")
	{
		authPublic.POST("/login", gin.WrapH(proxy.Handler(authProxy)))
		authPublic.POST("/register", gin.WrapH(proxy.Handler(authProxy)))
		authPublic.POST("/forgot-password", gin.WrapH(proxy.Handler(authProxy)))
		authPublic.POST("/verify-otp", gin.WrapH(proxy.Handler(authProxy)))
		authPublic.POST("/resend-otp", gin.WrapH(proxy.Handler(authProxy)))
		authPublic.POST("/reset-password", gin.WrapH(proxy.Handler(authProxy)))
	}

	// Legacy /api/auth/* aliases (same target)
	authLegacy := r.Group("/api/auth")
	{
		authLegacy.POST("/login", gin.WrapH(proxy.Handler(authProxy)))
		authLegacy.POST("/register", gin.WrapH(proxy.Handler(authProxy)))
		authLegacy.POST("/forgot-password", gin.WrapH(proxy.Handler(authProxy)))
		authLegacy.POST("/verify-otp", gin.WrapH(proxy.Handler(authProxy)))
		authLegacy.POST("/resend-otp", gin.WrapH(proxy.Handler(authProxy)))
		authLegacy.POST("/reset-password", gin.WrapH(proxy.Handler(authProxy)))
	}

	// Authenticated auth routes (logout requires a valid token)
	authProtected := r.Group("/api/v1/auth")
	authProtected.Use(middleware.JWTAuth(cfg.JWTSecret))
	{
		authProtected.POST("/logout", gin.WrapH(proxy.Handler(authProxy)))
	}

	// ── Rate-limited public endpoints ────────────────────────────────────────
	publicAPI := r.Group("/api/v1")
	publicAPI.Use(middleware.RateLimiter(60, time.Minute))
	{
		// /subscriptions/plans → payment_service (P3.5)
		publicAPI.GET("/subscriptions/plans", gin.WrapH(proxy.Handler(paymentProxy)))
		// payment-types stays on monolith until finance_service is extracted (P5)
		publicAPI.Any("/payment-types/active", gin.WrapH(proxy.Handler(monolithProxy)))
	}

	// ── Payments & subscriptions → payment_service (P3.5) ────────────────────
	// All authenticated CRUD for payments and subscriptions is now served by
	// payment_service. The monolith still handles writes during the Strangler
	// Fig overlap, but the gateway now routes reads and writes here.
	paymentRoutes := r.Group("/api/v1")
	paymentRoutes.Use(middleware.JWTAuth(cfg.JWTSecret))
	{
		paymentRoutes.Any("/payments", gin.WrapH(proxy.Handler(paymentProxy)))
		paymentRoutes.Any("/payments/*action", gin.WrapH(proxy.Handler(paymentProxy)))
		paymentRoutes.Any("/subscriptions", gin.WrapH(proxy.Handler(paymentProxy)))
		paymentRoutes.Any("/subscriptions/*action", gin.WrapH(proxy.Handler(paymentProxy)))
	}

	// ── Users, branches, permissions, settings, audit-logs → user_service ────
	userRoutes := r.Group("/api/v1")
	userRoutes.Use(middleware.JWTAuth(cfg.JWTSecret))
	{
		userRoutes.Any("/users", gin.WrapH(proxy.Handler(userProxy)))
		userRoutes.Any("/users/*action", gin.WrapH(proxy.Handler(userProxy)))
		userRoutes.Any("/branches", gin.WrapH(proxy.Handler(userProxy)))
		userRoutes.Any("/branches/*action", gin.WrapH(proxy.Handler(userProxy)))
		userRoutes.Any("/permissions/*action", gin.WrapH(proxy.Handler(userProxy)))
		userRoutes.Any("/settings", gin.WrapH(proxy.Handler(userProxy)))
		userRoutes.Any("/audit-logs", gin.WrapH(proxy.Handler(userProxy)))
	}

	// ── Students, classes, attendance, schedule, assignments → student_service ─
	studentRoutes := r.Group("/api/v1")
	studentRoutes.Use(middleware.JWTAuth(cfg.JWTSecret))
	{
		studentRoutes.Any("/students", gin.WrapH(proxy.Handler(studentProxy)))
		studentRoutes.Any("/students/*action", gin.WrapH(proxy.Handler(studentProxy)))
		studentRoutes.Any("/classes", gin.WrapH(proxy.Handler(studentProxy)))
		studentRoutes.Any("/classes/*action", gin.WrapH(proxy.Handler(studentProxy)))
		studentRoutes.Any("/attendance", gin.WrapH(proxy.Handler(studentProxy)))
		studentRoutes.Any("/attendance/*action", gin.WrapH(proxy.Handler(studentProxy)))
		studentRoutes.Any("/schedule", gin.WrapH(proxy.Handler(studentProxy)))
		studentRoutes.Any("/schedule/*action", gin.WrapH(proxy.Handler(studentProxy)))
		studentRoutes.Any("/assignments", gin.WrapH(proxy.Handler(studentProxy)))
		studentRoutes.Any("/assignments/*action", gin.WrapH(proxy.Handler(studentProxy)))
	}

	// ── Consolidated fan-out endpoints (P4.4) ─────────────────────────────────
	// Gateway fans out to multiple services in parallel and merges results.
	// This avoids N round-trips from the frontend.
	consolidated := r.Group("/api/v1/consolidated")
	consolidated.Use(middleware.JWTAuth(cfg.JWTSecret))
	{
		// GET /api/v1/consolidated/students?branchId=
		// → students (student_service) + classes (student_service) in parallel
		consolidated.GET("/students", func(c *gin.Context) {
			consolidatedStudents(c, cfg.StudentServiceURL)
		})

		// GET /api/v1/consolidated/payments?branchId=&month=&year=
		// → payments (payment_service) + students (student_service) in parallel
		consolidated.GET("/payments", func(c *gin.Context) {
			consolidatedPayments(c, cfg.PaymentServiceURL, cfg.StudentServiceURL)
		})
	}

	// ── Teachers & salaries → teacher_service (P5.1) ─────────────────────────
	teacherRoutes := r.Group("/api/v1")
	teacherRoutes.Use(middleware.JWTAuth(cfg.JWTSecret))
	{
		teacherRoutes.Any("/teachers", gin.WrapH(proxy.Handler(teacherProxy)))
		teacherRoutes.Any("/teachers/*action", gin.WrapH(proxy.Handler(teacherProxy)))
		teacherRoutes.Any("/salaries", gin.WrapH(proxy.Handler(teacherProxy)))
		teacherRoutes.Any("/salaries/*action", gin.WrapH(proxy.Handler(teacherProxy)))
	}

	// ── Expenses + budgets → finance_service (P5.2) ──────────────────────────
	financeRoutes := r.Group("/api/v1")
	financeRoutes.Use(middleware.JWTAuth(cfg.JWTSecret))
	{
		financeRoutes.Any("/expenses", gin.WrapH(proxy.Handler(financeProxy)))
		financeRoutes.Any("/expenses/*action", gin.WrapH(proxy.Handler(financeProxy)))
		financeRoutes.Any("/expense-budgets", gin.WrapH(proxy.Handler(financeProxy)))
	}

	// ── Notifications → notification_service (P5.3) ───────────────────────────
	notifRoutes := r.Group("/api/v1")
	notifRoutes.Use(middleware.JWTAuth(cfg.JWTSecret))
	{
		notifRoutes.Any("/notifications", gin.WrapH(proxy.Handler(notifProxy)))
		notifRoutes.Any("/notifications/*action", gin.WrapH(proxy.Handler(notifProxy)))
	}

	// ── Developer auth (public) ───────────────────────────────────────────────
	r.POST("/api/v1/dev/auth/login", gin.WrapH(proxy.Handler(monolithProxy)))
	r.POST("/api/v1/dev/auth/register", gin.WrapH(proxy.Handler(monolithProxy)))

	// ── Catch-all: forward everything else to monolith ────────────────────────
	// This covers all protected /api/v1/* routes still owned by the monolith.
	r.NoRoute(gin.WrapH(proxy.Handler(monolithProxy)))

	return r, nil
}

// ── Consolidated fan-out helpers (P4.4) ──────────────────────────────────────

// fetchJSON performs a GET against serviceBase+path and decodes the JSON body.
func fetchJSON(ctx context.Context, serviceBase, path string, out interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, serviceBase+path, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, out)
}

// consolidatedStudents fans out to student_service for students + classes in parallel.
func consolidatedStudents(c *gin.Context, studentSvcURL string) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}

	type result struct {
		data interface{}
		err  error
	}
	studentCh := make(chan result, 1)
	classCh := make(chan result, 1)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	go func() {
		var data interface{}
		err := fetchJSON(ctx, studentSvcURL, "/api/v1/students?branchId="+branchID, &data)
		studentCh <- result{data, err}
	}()
	go func() {
		var data interface{}
		err := fetchJSON(ctx, studentSvcURL, "/api/v1/classes?branchId="+branchID, &data)
		classCh <- result{data, err}
	}()

	sr := <-studentCh
	cr := <-classCh

	if sr.err != nil || cr.err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"students": sr.data, "classes": cr.data})
}

// consolidatedPayments fans out to payment_service (payments) and student_service
// (students for context) in parallel, then merges into a single response.
func consolidatedPayments(c *gin.Context, paymentSvcURL, studentSvcURL string) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	month := c.Query("month")
	year := c.Query("year")

	type result struct {
		data interface{}
		err  error
	}
	paymentCh := make(chan result, 1)
	studentCh := make(chan result, 1)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	go func() {
		path := "/api/v1/payments?branchId=" + branchID
		if month != "" {
			path += "&month=" + month
		}
		if year != "" {
			path += "&year=" + year
		}
		var data interface{}
		err := fetchJSON(ctx, paymentSvcURL, path, &data)
		paymentCh <- result{data, err}
	}()
	go func() {
		var data interface{}
		err := fetchJSON(ctx, studentSvcURL, "/api/v1/students?branchId="+branchID+"&limit=200", &data)
		studentCh <- result{data, err}
	}()

	pr := <-paymentCh
	sr := <-studentCh

	if pr.err != nil || sr.err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"payments": pr.data, "students": sr.data})
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Branch-ID,X-Request-ID")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
