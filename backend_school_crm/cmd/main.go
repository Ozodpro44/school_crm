// @title           School CRM API
// @version         1.0
// @description     REST API for School CRM — manages students, payments, teachers, classes, branches, and salaries.
// @termsOfService  http://swagger.io/terms/

// @contact.name  School CRM Support
// @contact.email support@school-crm.example

// @license.name  Proprietary

// @host      localhost:8080
// @BasePath  /api/v1

// @securityDefinitions.apikey BearerAuth
// @in                         header
// @name                       Authorization
// @description                JWT token — prefix with "Bearer "

// @externalDocs.description  OpenAPI spec
// @externalDocs.url          http://localhost:8080/api/docs/doc.json
package main

import (
	"context"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/school-crm/backend/internal/cache"
	"github.com/school-crm/backend/internal/config"
	_ "github.com/school-crm/backend/docs"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/handlers"
	"github.com/school-crm/backend/internal/jobs"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/utils"
	ginSwagger "github.com/swaggo/gin-swagger"
	swaggerFiles "github.com/swaggo/files"
)

var startTime = time.Now()

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	cfg := &config.Config{
		Port:         os.Getenv("PORT"),
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		Environment:  os.Getenv("ENVIRONMENT"),
		RedisURL:     os.Getenv("REDIS_URL"),
		ResendAPIKey: os.Getenv("RESEND_API_KEY"),
		ResendFrom:   os.Getenv("RESEND_FROM"),
		LogsToken:    os.Getenv("LOGS_TOKEN"),
		SentryDSN:    os.Getenv("SENTRY_DSN"),
	}

	if cfg.Port == "" {
		cfg.Port = "8080"
	}
	if cfg.Environment == "" {
		cfg.Environment = "development"
	}

	// ── Startup config validation ─────────────────────────────────────────────
	var startupErrors []string
	var startupWarnings []string

	if cfg.DatabaseURL == "" {
		startupErrors = append(startupErrors, "DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		startupErrors = append(startupErrors, "JWT_SECRET is required")
	} else if len(cfg.JWTSecret) < 32 {
		startupErrors = append(startupErrors, fmt.Sprintf("JWT_SECRET is too short (%d chars); minimum 32 required", len(cfg.JWTSecret)))
	}
	if cfg.RedisURL == "" {
		startupWarnings = append(startupWarnings, "REDIS_URL not set — rate limiting, OTP, and caching will be disabled")
	}
	if cfg.ResendAPIKey == "" || cfg.ResendFrom == "" {
		startupWarnings = append(startupWarnings, "RESEND_API_KEY / RESEND_FROM not set — password-reset emails will be disabled")
	}
	if os.Getenv("CLICK_MERCHANT_ID") == "" {
		startupWarnings = append(startupWarnings, "CLICK_MERCHANT_ID / CLICK_SERVICE_ID / CLICK_SECRET_KEY not set — Click.uz webhooks disabled")
	}
	if os.Getenv("TELEGRAM_BOT_TOKEN") == "" {
		startupWarnings = append(startupWarnings, "TELEGRAM_BOT_TOKEN not set — Telegram notifications/payments disabled")
	}

	// Print startup summary
	log.Println("──────────────────────────────────────────────")
	log.Printf("  School CRM Backend  [%s]", cfg.Environment)
	log.Println("──────────────────────────────────────────────")
	log.Printf("  Port         : %s", cfg.Port)
	log.Printf("  Database     : %s", func() string {
		if cfg.DatabaseURL != "" { return "✓ configured" }
		return "✗ MISSING"
	}())
	log.Printf("  JWT secret   : %s", func() string {
		if cfg.JWTSecret == "" { return "✗ MISSING" }
		if len(cfg.JWTSecret) < 32 { return fmt.Sprintf("✗ too short (%d/32 chars)", len(cfg.JWTSecret)) }
		return fmt.Sprintf("✓ OK (%d chars)", len(cfg.JWTSecret))
	}())
	log.Printf("  Redis        : %s", func() string {
		if cfg.RedisURL != "" { return "✓ configured" }
		return "⚠ not set (optional)"
	}())
	log.Printf("  Email (Resend): %s", func() string {
		if cfg.ResendAPIKey != "" && cfg.ResendFrom != "" { return "✓ configured" }
		return "⚠ not set (optional)"
	}())
	log.Printf("  Click.uz     : %s", func() string {
		if os.Getenv("CLICK_MERCHANT_ID") != "" { return "✓ configured" }
		return "⚠ not set (optional)"
	}())
	log.Printf("  Telegram bot : %s", func() string {
		if os.Getenv("TELEGRAM_BOT_TOKEN") != "" { return "✓ configured" }
		return "⚠ not set (optional)"
	}())
	log.Printf("  Sentry       : %s", func() string {
		if cfg.SentryDSN != "" { return "✓ configured" }
		return "⚠ not set (optional)"
	}())

	if len(startupWarnings) > 0 {
		log.Println("──────────────────────────────────────────────")
		for _, w := range startupWarnings {
			log.Printf("  ⚠ WARNING: %s", w)
		}
	}
	if len(startupErrors) > 0 {
		log.Println("──────────────────────────────────────────────")
		for _, e := range startupErrors {
			log.Printf("  ✗ ERROR: %s", e)
		}
		log.Println("──────────────────────────────────────────────")
		log.Fatal("Startup aborted due to configuration errors above")
	}
	log.Println("──────────────────────────────────────────────")

	// ── Sentry error monitoring (optional) ──────────────────────────────────
	if cfg.SentryDSN != "" {
		if err := sentry.Init(sentry.ClientOptions{
			Dsn:              cfg.SentryDSN,
			Environment:      cfg.Environment,
			TracesSampleRate: 0.2, // 20% of transactions traced for performance monitoring
			AttachStacktrace: true,
		}); err != nil {
			log.Printf("Warning: Sentry initialization failed: %v", err)
		} else {
			log.Println("Sentry initialized")
			defer sentry.Flush(5 * time.Second)
		}
	}

	// Initialize database
	database, err := db.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Run migrations
	if err := database.RunMigrations(context.Background()); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize Redis (optional but recommended for OTP)
	var redisClient *utils.RedisClient
	if cfg.RedisURL != "" {
		rc, err := utils.NewRedisClient(cfg.RedisURL)
		if err != nil {
			log.Printf("Warning: Failed to connect to Redis: %v. OTP features will be disabled.", err)
		} else {
			redisClient = rc
			defer redisClient.Close()
		}
	}

	// Initialize Email Sender (optional for password reset)
	var emailSender *utils.EmailSender
	if cfg.ResendAPIKey != "" && cfg.ResendFrom != "" {
		emailSender = utils.NewEmailSender(cfg.ResendAPIKey, cfg.ResendFrom)
	}

	// Initialize services
	userService := service.NewUserService(database)

	// Set Redis and Email clients in UserService
	if redisClient != nil {
		userService.SetRedisClient(redisClient)
	}
	if emailSender != nil {
		userService.SetEmailSender(emailSender)
	}
	subscriptionService := service.NewSubscriptionService(database)
	branchService := service.NewBranchService(database, subscriptionService)
	studentService := service.NewStudentService(database, subscriptionService)
	paymentService := service.NewPaymentService(database, branchService)
	classService := service.NewClassService(database)
	teacherService := service.NewTeacherService(database)

	// Wire Redis cache into hot-path services (no-op when Redis is absent)
	var rateLimiter *middleware.RateLimiter
	if redisClient != nil {
		cacheClient := cache.New(redisClient.GetClient())
		subscriptionService.SetCache(cacheClient)
		studentService.SetCache(cacheClient)
		paymentService.SetCache(cacheClient)
		classService.SetCache(cacheClient)
		teacherService.SetCache(cacheClient)
		log.Println("Redis cache enabled for hot-path services")

		rateLimiter = middleware.NewRateLimiter(redisClient.GetClient())
		log.Println("Rate limiting enabled")
	}
	salaryService := service.NewSalaryService(database, branchService)
	expenseService := service.NewExpenseService(database, branchService)
	budgetService := service.NewBudgetService(database)
	reportService := service.NewReportService(database)
	financeService := service.NewFinanceService(branchService, paymentService, studentService, classService)
	paymentTypeService := service.NewPaymentTypeService(database)
	notificationService := service.NewNotificationService(database)
	developerService := service.NewDeveloperService(database)
	attendanceService := service.NewAttendanceService(database)
	studentNotesService := service.NewStudentNotesService(database)
	teacherPortalService := service.NewTeacherPortalService(database, teacherService)
	scheduleService := service.NewScheduleService(database)
	assignmentService := service.NewAssignmentService(database)

	// Initialize Click.uz service (requires environment variables)
	clickMerchantID := os.Getenv("CLICK_MERCHANT_ID")
	clickServiceID := os.Getenv("CLICK_SERVICE_ID")
	clickSecretKey := os.Getenv("CLICK_SECRET_KEY")
	if clickMerchantID == "" || clickServiceID == "" || clickSecretKey == "" {
		log.Println("Warning: CLICK_MERCHANT_ID, CLICK_SERVICE_ID, or CLICK_SECRET_KEY not set. Click.uz payment webhooks will not work.")
	}
	clickUzService := service.NewClickUzService(database, clickMerchantID, clickServiceID, clickSecretKey)

	// Initialize Telegram payment service (requires environment variable)
	telegramBotToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if telegramBotToken == "" {
		log.Println("Warning: TELEGRAM_BOT_TOKEN not set. Telegram payment webhooks will not work.")
	}
	telegramPaymentService := service.NewTelegramPaymentService(database, telegramBotToken)
	messagingService := service.NewMessagingService(database, telegramBotToken)

	// Initialize router
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	logger := middleware.NewLogger(cfg.Environment)

	// Background job queue (4 workers, report generation)
	jobQueue := jobs.New(reportService, logger)

	router := gin.New() // use gin.New() so we control all middleware ourselves
	router.Use(gin.Recovery())

	// Middleware
	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.RequestID())
	// Sentry must come after RequestID (so request_id tag is set) but before auth.
	if cfg.SentryDSN != "" {
		router.Use(middleware.SentryMiddleware())
	}
	router.Use(middleware.StructuredLogger(logger))
	router.Use(middleware.CORSMiddleware())
	router.Use(middleware.ErrorHandling())
	router.Use(handlers.SafeRequestLogger(database))  // persist 4xx/5xx to DB logs table
	router.Use(middleware.AuditMiddleware(database))   // persist CRUD operations to audit_logs

	// healthHandler returns real system stats
	healthHandler := func(c *gin.Context) {
		dbStats := database.GetConn().Stats()

		redisStatus := "inactive"
		redisConnected := false
		if redisClient != nil {
			redisStatus = "active"
			redisConnected = true
		}

		uptimeSeconds := int64(math.Round(time.Since(startTime).Seconds()))

		c.JSON(http.StatusOK, gin.H{
			"status":         "healthy",
			"environment":    cfg.Environment,
			"uptime_seconds": uptimeSeconds,
			"database": gin.H{
				"status":               "connected",
				"open_connections":     dbStats.OpenConnections,
				"idle_connections":     dbStats.Idle,
				"max_open_connections": dbStats.MaxOpenConnections,
			},
			"redis": gin.H{
				"status":    redisStatus,
				"connected": redisConnected,
			},
		})
	}
	// Register health at both /health (canonical) and /api/health (frontend alias)
	router.GET("/health", healthHandler)
	router.GET("/api/health", healthHandler)

	// Swagger UI — available in all environments (restrict in prod via nginx if needed)
	router.GET("/api/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Auth rate limiter: 10 req/min per IP (applied when Redis is available)
	var authRateLimit gin.HandlerFunc = func(c *gin.Context) { c.Next() }
	if rateLimiter != nil {
		authRateLimit = rateLimiter.ByIP(10, time.Minute)
	}

	// Public routes
	router.POST("/api/v1/auth/login", authRateLimit, handlers.Login(userService, cfg.JWTSecret))
	router.POST("/api/v1/auth/register", authRateLimit, handlers.Register(userService, subscriptionService, cfg.JWTSecret))
	router.POST("/api/v1/auth/forgot-password", authRateLimit, handlers.ForgotPassword(userService))
	router.POST("/api/v1/auth/verify-otp", authRateLimit, handlers.VerifyOTP(userService))
	router.POST("/api/v1/auth/resend-otp", authRateLimit, handlers.ResendOTP(userService))
	router.POST("/api/v1/auth/reset-password", authRateLimit, handlers.ResetPassword(userService))

	// Public subscription plans
	router.GET("/api/v1/subscriptions/plans", handlers.GetSubscriptionPlans(subscriptionService))
	router.GET("/api/subscriptions/plans", handlers.GetSubscriptionPlans(subscriptionService)) // legacy alias

	// Public: active payment types — legacy alias
	legacyPublicApi := router.Group("/api")
	handlers.RegisterPaymentTypePublicRoutes(legacyPublicApi, paymentTypeService)

	// Public: active payment types (used by billing UI)
	publicApi := router.Group("/api/v1")
	handlers.RegisterPaymentTypePublicRoutes(publicApi, paymentTypeService)

	// Public developer auth routes
	handlers.RegisterDeveloperAuthRoutes(router, developerService, cfg.JWTSecret)

	// Public developer routes (dev endpoints)
	publicDev := router.Group("/api/v1")
	handlers.RegisterDeveloperRoutes(publicDev, database, subscriptionService)

	// Authenticated developer routes (require developer JWT)
	devProtected := router.Group("/api/v1")
	devProtected.Use(middleware.DevAuthMiddleware(cfg.JWTSecret))
	handlers.RegisterDevSettingsRoutes(devProtected, database)
	handlers.RegisterDevLogsRoutes(devProtected, database)
	handlers.RegisterDevCRMRoutes(devProtected, userService, branchService)
	handlers.RegisterAdminSubscriptionRoutes(devProtected, subscriptionService)
	handlers.RegisterAdminPlatformStatsRoute(devProtected, subscriptionService)
	handlers.RegisterAdminPlansRoutes(devProtected, subscriptionService)
	handlers.RegisterSubscriptionPlanDevRoutes(devProtected, subscriptionService)
	handlers.RegisterPaymentTypeDevRoutes(devProtected, paymentTypeService)

	// Log ingestion endpoint (LOGS_TOKEN bearer auth)
	handlers.RegisterLogsIngestRoute(router, database, cfg.LogsToken)

	// Log startup status
	handlers.CheckLogsTable(database)

	// Auth-only routes — require login but NOT an active subscription.
	// Subscription self-service must be here so expired users can check and renew.
	authOnly := router.Group("/api/v1")
	authOnly.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	authOnly.Use(middleware.RequestTimeout(30 * time.Second))
	handlers.RegisterSubscriptionProtectedRoutes(authOnly, subscriptionService, userService)

	// Protected routes — require login AND an active subscription.
	protected := router.Group("/api/v1")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	protected.Use(middleware.SubscriptionGate(userService, subscriptionService))
	// BOLA/IDOR guard: verify the X-Branch-ID header belongs to the JWT user.
	protected.Use(middleware.TenantBranchMiddleware(userService))
	// Query timeout: cancel context after 30 s to prevent runaway DB queries.
	protected.Use(middleware.RequestTimeout(30 * time.Second))
	// API rate limit: 300 req/min per authenticated user
	if rateLimiter != nil {
		protected.Use(rateLimiter.ByUser(300, time.Minute))
	}

	// Users
	handlers.RegisterUserRoutes(protected, userService)

	// Students
	handlers.RegisterStudentRoutes(protected, studentService, userService, financeService, notificationService)

	// Payments
	handlers.RegisterPaymentRoutes(protected, paymentService, branchService, userService, financeService, notificationService)

	// Classes
	handlers.RegisterClassRoutes(protected, classService, userService, subscriptionService)

	// Branches
	handlers.RegisterBranchRoutes(protected, branchService, userService, subscriptionService)

	// Teachers
	handlers.RegisterTeacherRoutes(protected, teacherService, userService)

	// Salaries
	handlers.RegisterSalaryRoutes(protected, salaryService, branchService, userService)

	// Expenses
	handlers.RegisterExpenseRoutes(protected, expenseService, branchService, userService)
	handlers.RegisterBudgetRoutes(protected, budgetService, userService)

	// Reports
	handlers.RegisterReportRoutes(protected, reportService, userService, branchService)

	// Notifications
	handlers.RegisterNotificationRoutes(protected, notificationService)

	// Audit logs
	handlers.RegisterAuditRoutes(protected, database)

	// Background jobs (async report generation)
	handlers.RegisterJobRoutes(protected, jobQueue)

	// Settings
	handlers.RegisterSettingsRoutes(protected, branchService, userService)

	// Attendance
	handlers.RegisterAttendanceRoutes(protected, attendanceService, userService)

	// Student notes, contact log, and per-student attendance
	handlers.RegisterStudentNotesRoutes(protected, studentNotesService, attendanceService, userService)

	// Teacher portal
	handlers.RegisterTeacherPortalRoutes(protected, teacherPortalService, userService)

	// Class schedule
	handlers.RegisterScheduleRoutes(protected, scheduleService, userService)

	// Mass messaging
	handlers.RegisterMessagingRoutes(protected, messagingService, userService)

	// Assignments
	handlers.RegisterAssignmentRoutes(protected, assignmentService, userService)

	// Payment initiation routes — placed on authOnly so expired/trial users can still pay
	handlers.RegisterClickUzRoutes(authOnly, clickUzService, subscriptionService)
	handlers.RegisterTelegramPaymentRoutes(authOnly, telegramPaymentService, subscriptionService)

	// Payment webhooks (public, no auth required — called by external payment providers)
	// Webhook rate limit: 100 req/min per IP
	webhookGroup := router.Group("/api/v1")
	if rateLimiter != nil {
		webhookGroup.Use(rateLimiter.ByIP(100, time.Minute))
	}
	handlers.RegisterClickUzWebhooks(webhookGroup, clickUzService)
	handlers.RegisterTelegramPaymentWebhooks(webhookGroup, telegramPaymentService)

	// Developer-only test payment endpoint (behind DevAuth)
	handlers.RegisterClickUzDevRoutes(devProtected, clickUzService)

	// ── Backward-compatible /api/ aliases (clients not yet on /api/v1/) ──────────
	// Developer auth (public — no middleware needed)
	router.POST("/api/dev/auth/login", authRateLimit, handlers.DeveloperLogin(developerService, cfg.JWTSecret))
	router.POST("/api/dev/auth/register", authRateLimit, handlers.DeveloperRegister(developerService, cfg.JWTSecret))

	// Auth
	router.POST("/api/auth/login", authRateLimit, handlers.Login(userService, cfg.JWTSecret))
	router.POST("/api/auth/register", authRateLimit, handlers.Register(userService, subscriptionService, cfg.JWTSecret))
	router.POST("/api/auth/forgot-password", authRateLimit, handlers.ForgotPassword(userService))
	router.POST("/api/auth/verify-otp", authRateLimit, handlers.VerifyOTP(userService))
	router.POST("/api/auth/resend-otp", authRateLimit, handlers.ResendOTP(userService))
	router.POST("/api/auth/reset-password", authRateLimit, handlers.ResetPassword(userService))

	// Public dev routes under /api (old prefix) — no auth required
	legacyPublicDev := router.Group("/api")
	handlers.RegisterDeveloperRoutes(legacyPublicDev, database, subscriptionService)

	// Dev protected (old prefix)
	legacyDevProtected := router.Group("/api")
	legacyDevProtected.Use(middleware.DevAuthMiddleware(cfg.JWTSecret))
	handlers.RegisterDevLogsRoutes(legacyDevProtected, database)
	handlers.RegisterDevSettingsRoutes(legacyDevProtected, database)
	handlers.RegisterDevCRMRoutes(legacyDevProtected, userService, branchService)
	handlers.RegisterAdminSubscriptionRoutes(legacyDevProtected, subscriptionService)
	handlers.RegisterAdminPlatformStatsRoute(legacyDevProtected, subscriptionService)
	handlers.RegisterAdminPlansRoutes(legacyDevProtected, subscriptionService)
	handlers.RegisterSubscriptionPlanDevRoutes(legacyDevProtected, subscriptionService)
	handlers.RegisterPaymentTypeDevRoutes(legacyDevProtected, paymentTypeService)

	// Auth-only legacy routes — require login but NOT subscription (e.g. notifications)
	legacyAuthOnly := router.Group("/api")
	legacyAuthOnly.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	legacyAuthOnly.Use(middleware.RequestTimeout(30 * time.Second))
	handlers.RegisterNotificationRoutes(legacyAuthOnly, notificationService)
	handlers.RegisterSubscriptionProtectedRoutes(legacyAuthOnly, subscriptionService, userService)

	// All other protected routes under /api (old prefix)
	legacyProtected := router.Group("/api")
	legacyProtected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	legacyProtected.Use(middleware.SubscriptionGate(userService, subscriptionService))
	legacyProtected.Use(middleware.TenantBranchMiddleware(userService))
	legacyProtected.Use(middleware.RequestTimeout(30 * time.Second))
	if rateLimiter != nil {
		legacyProtected.Use(rateLimiter.ByUser(300, time.Minute))
	}
	handlers.RegisterUserRoutes(legacyProtected, userService)
	handlers.RegisterStudentRoutes(legacyProtected, studentService, userService, financeService, notificationService)
	handlers.RegisterPaymentRoutes(legacyProtected, paymentService, branchService, userService, financeService, notificationService)
	handlers.RegisterClassRoutes(legacyProtected, classService, userService, subscriptionService)
	handlers.RegisterTeacherRoutes(legacyProtected, teacherService, userService)
	handlers.RegisterSalaryRoutes(legacyProtected, salaryService, branchService, userService)
	handlers.RegisterExpenseRoutes(legacyProtected, expenseService, branchService, userService)
	handlers.RegisterBudgetRoutes(legacyProtected, budgetService, userService)
	handlers.RegisterReportRoutes(legacyProtected, reportService, userService, branchService)
	handlers.RegisterAuditRoutes(legacyProtected, database)
	handlers.RegisterJobRoutes(legacyProtected, jobQueue)
	handlers.RegisterBranchRoutes(legacyProtected, branchService, userService, subscriptionService)
	handlers.RegisterSettingsRoutes(legacyProtected, branchService, userService)
	handlers.RegisterAttendanceRoutes(legacyProtected, attendanceService, userService)
	handlers.RegisterStudentNotesRoutes(legacyProtected, studentNotesService, attendanceService, userService)
	handlers.RegisterTeacherPortalRoutes(legacyProtected, teacherPortalService, userService)
	handlers.RegisterScheduleRoutes(legacyProtected, scheduleService, userService)
	handlers.RegisterMessagingRoutes(legacyProtected, messagingService, userService)
	handlers.RegisterAssignmentRoutes(legacyProtected, assignmentService, userService)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting server on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
