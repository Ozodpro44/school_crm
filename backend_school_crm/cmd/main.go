// @title           School CRM API
// @version         1.0
// @description     Residual monolith — auth, subscriptions, Click.uz/Telegram payments, messaging, reports, dev panel.
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
		cfg.Port = "8082"
	}
	if cfg.Environment == "" {
		cfg.Environment = "development"
	}

	// ── Startup config validation ──────────────────────────────────────────────
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
		startupErrors = append(startupErrors, "REDIS_URL is required")
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

	log.Println("──────────────────────────────────────────────")
	log.Printf("  School CRM Monolith (residual)  [%s]", cfg.Environment)
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
		return "✗ MISSING (required)"
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

	// ── Sentry (optional) ─────────────────────────────────────────────────────
	if cfg.SentryDSN != "" {
		if err := sentry.Init(sentry.ClientOptions{
			Dsn:              cfg.SentryDSN,
			Environment:      cfg.Environment,
			TracesSampleRate: 0.2,
			AttachStacktrace: true,
		}); err != nil {
			log.Printf("Warning: Sentry initialization failed: %v", err)
		} else {
			log.Println("Sentry initialized")
			defer sentry.Flush(5 * time.Second)
		}
	}

	// ── Database & Redis ───────────────────────────────────────────────────────
	database, err := db.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	if err := database.RunMigrations(context.Background()); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	redisClient, err := utils.NewRedisClient(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	var emailSender *utils.EmailSender
	if cfg.ResendAPIKey != "" && cfg.ResendFrom != "" {
		emailSender = utils.NewEmailSender(cfg.ResendAPIKey, cfg.ResendFrom)
	}

	// ── Services (residual monolith only) ─────────────────────────────────────
	// auth + subscription + branch — core of the remaining monolith
	userService := service.NewUserService(database)
	userService.SetRedisClient(redisClient)
	if emailSender != nil {
		userService.SetEmailSender(emailSender)
	}
	subscriptionService := service.NewSubscriptionService(database)
	branchService := service.NewBranchService(database, subscriptionService)

	// Cache for hot-path auth/subscription lookups
	cacheClient := cache.New(redisClient.GetClient())
	subscriptionService.SetCache(cacheClient)

	// Periodically flip lapsed subscriptions to "expired" — nothing else in
	// the codebase called ExpireLapsedSubscriptions/CheckSubscriptionExpiry,
	// so platform stats/admin listings kept reporting long-past subscriptions
	// as active/trial forever (access itself was already correctly blocked
	// elsewhere by a live end_date check; this is purely a status/reporting
	// sweep, so an hourly cadence is more than sufficient).
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			n, err := subscriptionService.ExpireLapsedSubscriptions(context.Background())
			if err != nil {
				log.Printf("[subscription-expiry] sweep failed: %v", err)
			} else if n > 0 {
				log.Printf("[subscription-expiry] marked %d lapsed subscription(s) as expired", n)
			}
		}
	}()

	rateLimiter := middleware.NewRateLimiter(redisClient.GetClient())
	log.Println("Rate limiting enabled")

	// Reports — still served from monolith (complex aggregation across tables)
	reportService := service.NewReportService(database)

	// Payment types — subscription billing UI needs the list
	paymentTypeService := service.NewPaymentTypeService(database)

	// Developer panel
	developerService := service.NewDeveloperService(database)

	// Teacher portal — thin read endpoint for teachers to see their own schedule/students
	// (Will move to teacher_service in a future cleanup after portal usage is stable)
	teacherService := service.NewTeacherService(database)
	teacherService.SetCache(cacheClient)
	teacherPortalService := service.NewTeacherPortalService(database, teacherService)

	// Mass messaging (Telegram-backed)
	telegramBotToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if telegramBotToken == "" {
		log.Println("Warning: TELEGRAM_BOT_TOKEN not set. Telegram payment webhooks will not work.")
	}
	messagingService := service.NewMessagingService(database, telegramBotToken)

	// Click.uz integration
	clickMerchantID := os.Getenv("CLICK_MERCHANT_ID")
	clickServiceID := os.Getenv("CLICK_SERVICE_ID")
	clickSecretKey := os.Getenv("CLICK_SECRET_KEY")
	if clickMerchantID == "" || clickServiceID == "" || clickSecretKey == "" {
		log.Println("Warning: CLICK_MERCHANT_ID/CLICK_SERVICE_ID/CLICK_SECRET_KEY not set. Click.uz disabled.")
	}
	clickUzService := service.NewClickUzService(database, clickMerchantID, clickServiceID, clickSecretKey)
	clickUzService.SetCache(cacheClient)

	// Telegram payment service
	telegramPaymentService := service.NewTelegramPaymentService(database, telegramBotToken)
	telegramPaymentService.SetCache(cacheClient)

	// ── Router ────────────────────────────────────────────────────────────────
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	logger := middleware.NewLogger(cfg.Environment)

	// Background job queue (4 workers, DB-backed, survives restarts)
	jobQueue := jobs.New(database, reportService, logger)

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.RequestID())
	if cfg.SentryDSN != "" {
		router.Use(middleware.SentryMiddleware())
	}
	router.Use(middleware.StructuredLogger(logger))
	router.Use(middleware.CORSMiddleware())
	router.Use(middleware.ErrorHandling())
	router.Use(handlers.SafeRequestLogger(database))
	router.Use(middleware.AuditMiddleware(database))

	healthHandler := func(c *gin.Context) {
		dbStats := database.GetConn().Stats()
		uptimeSeconds := int64(math.Round(time.Since(startTime).Seconds()))
		c.JSON(http.StatusOK, gin.H{
			"status":         "healthy",
			"service":        "monolith",
			"environment":    cfg.Environment,
			"uptime_seconds": uptimeSeconds,
			"database": gin.H{
				"status":               "connected",
				"open_connections":     dbStats.OpenConnections,
				"idle_connections":     dbStats.Idle,
				"max_open_connections": dbStats.MaxOpenConnections,
			},
		})
	}
	router.GET("/health", healthHandler)
	router.GET("/api/health", healthHandler)

	router.GET("/api/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	authRateLimit := rateLimiter.ByIP(10, time.Minute)

	// ── Public routes ─────────────────────────────────────────────────────────
	// Auth — these are also served by auth_service via the gateway; kept here
	// so the monolith can still validate tokens and serve as fallback.
	router.POST("/api/v1/auth/login", authRateLimit, handlers.Login(userService, cfg.JWTSecret))
	router.POST("/api/v1/auth/register", authRateLimit, handlers.Register(userService, subscriptionService, cfg.JWTSecret))
	router.POST("/api/v1/auth/forgot-password", authRateLimit, handlers.ForgotPassword(userService))
	router.POST("/api/v1/auth/verify-otp", authRateLimit, handlers.VerifyOTP(userService))
	router.POST("/api/v1/auth/resend-otp", authRateLimit, handlers.ResendOTP(userService))
	router.POST("/api/v1/auth/reset-password", authRateLimit, handlers.ResetPassword(userService))

	// Subscription plans (public)
	router.GET("/api/v1/subscriptions/plans", handlers.GetSubscriptionPlans(subscriptionService))
	router.GET("/api/subscriptions/plans", handlers.GetSubscriptionPlans(subscriptionService))

	// Payment types
	legacyPublicApi := router.Group("/api")
	handlers.RegisterPaymentTypePublicRoutes(legacyPublicApi, paymentTypeService)
	publicApi := router.Group("/api/v1")
	handlers.RegisterPaymentTypePublicRoutes(publicApi, paymentTypeService)

	// Developer auth & public dev panel
	handlers.RegisterDeveloperAuthRoutes(router, developerService, cfg.JWTSecret)
	publicDev := router.Group("/api/v1")
	handlers.RegisterDeveloperRoutes(publicDev, database, subscriptionService)

	// Log ingestion
	handlers.RegisterLogsIngestRoute(router, database, cfg.LogsToken)
	handlers.CheckLogsTable(database)

	// ── Dev-protected routes ──────────────────────────────────────────────────
	devProtected := router.Group("/api/v1")
	devProtected.Use(middleware.DevAuthMiddleware(cfg.JWTSecret, developerService))
	handlers.RegisterDevSettingsRoutes(devProtected, database)
	handlers.RegisterDevLogsRoutes(devProtected, database)
	handlers.RegisterDevCRMRoutes(devProtected, userService, branchService)
	handlers.RegisterAdminSubscriptionRoutes(devProtected, subscriptionService)
	handlers.RegisterAdminPlatformStatsRoute(devProtected, subscriptionService)
	handlers.RegisterAdminPlansRoutes(devProtected, subscriptionService)
	handlers.RegisterSubscriptionPlanDevRoutes(devProtected, subscriptionService)
	handlers.RegisterPaymentTypeDevRoutes(devProtected, paymentTypeService)
	handlers.RegisterClickUzDevRoutes(devProtected, clickUzService)
	handlers.RegisterDevUtilityRoutes(devProtected, database)
	handlers.RegisterDeveloperSessionRoutes(devProtected, developerService)

	// ── Auth-only (login required, subscription not required) ─────────────────
	authOnly := router.Group("/api/v1")
	authOnly.Use(middleware.AuthMiddleware(cfg.JWTSecret, redisClient.GetClient()))
	authOnly.Use(middleware.RequestTimeout(30 * time.Second))
	handlers.RegisterSubscriptionProtectedRoutes(authOnly, subscriptionService, userService)
	handlers.RegisterClickUzRoutes(authOnly, clickUzService, subscriptionService)
	handlers.RegisterTelegramPaymentRoutes(authOnly, telegramPaymentService, subscriptionService)

	// ── Protected routes (login + active subscription) ────────────────────────
	protected := router.Group("/api/v1")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret, redisClient.GetClient()))
	protected.Use(middleware.SubscriptionGate(userService, subscriptionService))
	protected.Use(middleware.TenantBranchMiddleware(userService))
	protected.Use(middleware.RequestTimeout(30 * time.Second))
	protected.Use(rateLimiter.ByUser(300, time.Minute))

	// Reports (complex aggregation — still on monolith)
	handlers.RegisterReportRoutes(protected, reportService, userService, branchService)

	// Async report jobs
	handlers.RegisterJobRoutes(protected, jobQueue)

	// Teacher portal (read-only teacher self-service view)
	handlers.RegisterTeacherPortalRoutes(protected, teacherPortalService, userService)

	// Mass messaging
	handlers.RegisterMessagingRoutes(protected, messagingService, userService)

	// ── Payment webhooks (no auth — called by external payment providers) ─────
	webhookGroup := router.Group("/api/v1")
	webhookGroup.Use(rateLimiter.ByIP(100, time.Minute))
	handlers.RegisterClickUzWebhooks(webhookGroup, clickUzService)
	handlers.RegisterTelegramPaymentWebhooks(webhookGroup, telegramPaymentService)

	// ── Legacy /api/* aliases ─────────────────────────────────────────────────
	router.POST("/api/dev/auth/login", authRateLimit, handlers.DeveloperLogin(developerService, cfg.JWTSecret))
	router.POST("/api/dev/auth/register", authRateLimit, handlers.DeveloperRegister(developerService, cfg.JWTSecret))

	router.POST("/api/auth/login", authRateLimit, handlers.Login(userService, cfg.JWTSecret))
	router.POST("/api/auth/register", authRateLimit, handlers.Register(userService, subscriptionService, cfg.JWTSecret))
	router.POST("/api/auth/forgot-password", authRateLimit, handlers.ForgotPassword(userService))
	router.POST("/api/auth/verify-otp", authRateLimit, handlers.VerifyOTP(userService))
	router.POST("/api/auth/resend-otp", authRateLimit, handlers.ResendOTP(userService))
	router.POST("/api/auth/reset-password", authRateLimit, handlers.ResetPassword(userService))

	legacyPublicDev := router.Group("/api")
	handlers.RegisterDeveloperRoutes(legacyPublicDev, database, subscriptionService)

	legacyDevProtected := router.Group("/api")
	legacyDevProtected.Use(middleware.DevAuthMiddleware(cfg.JWTSecret, developerService))
	handlers.RegisterDevLogsRoutes(legacyDevProtected, database)
	handlers.RegisterDevSettingsRoutes(legacyDevProtected, database)
	handlers.RegisterDevCRMRoutes(legacyDevProtected, userService, branchService)
	handlers.RegisterAdminSubscriptionRoutes(legacyDevProtected, subscriptionService)
	handlers.RegisterAdminPlatformStatsRoute(legacyDevProtected, subscriptionService)
	handlers.RegisterAdminPlansRoutes(legacyDevProtected, subscriptionService)
	handlers.RegisterSubscriptionPlanDevRoutes(legacyDevProtected, subscriptionService)
	handlers.RegisterPaymentTypeDevRoutes(legacyDevProtected, paymentTypeService)
	handlers.RegisterDevUtilityRoutes(legacyDevProtected, database)
	handlers.RegisterDeveloperSessionRoutes(legacyDevProtected, developerService)

	legacyAuthOnly := router.Group("/api")
	legacyAuthOnly.Use(middleware.AuthMiddleware(cfg.JWTSecret, redisClient.GetClient()))
	legacyAuthOnly.Use(middleware.RequestTimeout(30 * time.Second))
	handlers.RegisterSubscriptionProtectedRoutes(legacyAuthOnly, subscriptionService, userService)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting residual monolith on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
