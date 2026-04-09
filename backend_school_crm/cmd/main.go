package main

import (
	"context"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/school-crm/backend/internal/config"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/handlers"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/utils"
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
	}

	if cfg.Port == "" {
		cfg.Port = "8080"
	}
	if cfg.Environment == "" {
		cfg.Environment = "development"
	}
	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
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
	studentService := service.NewStudentService(database)
	paymentService := service.NewPaymentService(database)
	classService := service.NewClassService(database)
	branchService := service.NewBranchService(database)
	teacherService := service.NewTeacherService(database)
	salaryService := service.NewSalaryService(database)
	expenseService := service.NewExpenseService(database)
	reportService := service.NewReportService(database)
	subscriptionService := service.NewSubscriptionService(database)
	developerService := service.NewDeveloperService(database)

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

	// Initialize router
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Middleware
	router.Use(middleware.CORSMiddleware())
	router.Use(middleware.ErrorHandling())
	router.Use(handlers.SafeRequestLogger(database)) // auto-log 4xx/5xx responses

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

	// Public routes
	router.POST("/api/auth/login", handlers.Login(userService, cfg.JWTSecret))
	router.POST("/api/auth/register", handlers.Register(userService, cfg.JWTSecret))
	router.POST("/api/auth/forgot-password", handlers.ForgotPassword(userService))
	router.POST("/api/auth/verify-otp", handlers.VerifyOTP(userService))
	router.POST("/api/auth/resend-otp", handlers.ResendOTP(userService))
	router.POST("/api/auth/reset-password", handlers.ResetPassword(userService))

	// Public subscription plans
	router.GET("/api/subscriptions/plans", handlers.GetSubscriptionPlans(subscriptionService))

	// Public developer auth routes
	handlers.RegisterDeveloperAuthRoutes(router, developerService, cfg.JWTSecret)

	// Public developer routes (dev endpoints)
	publicDev := router.Group("/api")
	handlers.RegisterDeveloperRoutes(publicDev, database, subscriptionService)

	// Authenticated developer routes (require developer JWT)
	devProtected := router.Group("/api")
	devProtected.Use(middleware.DevAuthMiddleware(cfg.JWTSecret))
	handlers.RegisterDevSettingsRoutes(devProtected, database)
	handlers.RegisterDevLogsRoutes(devProtected, database)
	handlers.RegisterAdminSubscriptionRoutes(devProtected, subscriptionService)
	handlers.RegisterAdminPlatformStatsRoute(devProtected, subscriptionService)
	handlers.RegisterAdminPlansRoutes(devProtected, subscriptionService)
	handlers.RegisterSubscriptionPlanDevRoutes(devProtected, subscriptionService)

	// Log ingestion endpoint (LOGS_TOKEN bearer auth)
	handlers.RegisterLogsIngestRoute(router, database, cfg.LogsToken)

	// Log startup status
	handlers.CheckLogsTable(database)

	// Protected routes
	protected := router.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	protected.Use(middleware.SubscriptionGate(userService, subscriptionService))

	// Users
	handlers.RegisterUserRoutes(protected, userService)

	// Students
	handlers.RegisterStudentRoutes(protected, studentService, classService, userService, paymentService)

	// Payments
	handlers.RegisterPaymentRoutes(protected, paymentService, branchService, userService, studentService, classService)

	// Classes
	handlers.RegisterClassRoutes(protected, classService, userService)

	// Branches
	handlers.RegisterBranchRoutes(protected, branchService, userService)

	// Teachers
	handlers.RegisterTeacherRoutes(protected, teacherService, userService)

	// Salaries
	handlers.RegisterSalaryRoutes(protected, salaryService, branchService, userService)

	// Expenses
	handlers.RegisterExpenseRoutes(protected, expenseService, branchService, userService)

	// Reports
	handlers.RegisterReportRoutes(protected, reportService, userService)

	// Settings
	handlers.RegisterSettingsRoutes(protected, branchService, userService)

	// Subscriptions (protected routes)
	handlers.RegisterSubscriptionProtectedRoutes(protected, subscriptionService, userService)
	// handlers.RegisterClickUzRoutes(protected, clickUzService, subscriptionService)
	// handlers.RegisterTelegramPaymentRoutes(protected, telegramPaymentService, subscriptionService)

	// Payment webhooks (public, no auth required)
	handlers.RegisterClickUzWebhooks(router.Group("/api"), clickUzService)
	handlers.RegisterTelegramPaymentWebhooks(router.Group("/api"), telegramPaymentService)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting server on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
