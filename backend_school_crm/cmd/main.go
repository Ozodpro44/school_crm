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

	// Storage bucket for employee face photos (optional — nil when no bucket
	// credentials are found in the environment; see storage_service.go for
	// the exact variable names it checks).
	storageService := service.NewStorageServiceFromEnv()
	attendanceService := service.NewAttendanceService(database, storageService)

	// Background poller for Hikvision terminals that can't push attendance
	// events to us over the internet (e.g. Wonder Kids' terminal — only an
	// inbound port-forward exists on its network, confirmed by testing both
	// a direct HTTPS connection and a raw TCP proxy: neither ever reached
	// our webhook). Since we CAN already reach such devices directly for
	// CreateUser/UploadFace/ConfigurePush, polling their event log from
	// right here works too and needs no separate machine on their LAN — see
	// AttendanceService.RunEventPoller / PollAndRecordEvents. Runs
	// alongside the HTTP server for the life of the process.
	go attendanceService.RunEventPoller(context.Background(), 20*time.Second)

	// Initialize Click.uz service (using environment variables or defaults)
	clickMerchantID := os.Getenv("CLICK_MERCHANT_ID")
	if clickMerchantID == "" {
		clickMerchantID = "398062629" // Test merchant ID
	}
	clickServiceID := os.Getenv("CLICK_SERVICE_ID")
	if clickServiceID == "" {
		clickServiceID = "999999999" // Test service ID
	}
	clickSecretKey := os.Getenv("CLICK_SECRET_KEY")
	if clickSecretKey == "" {
		clickSecretKey = "F91D8F69C042267444B74CC0B3C747757EB0E065" // Test secret key
	}
	clickUzService := service.NewClickUzService(database, clickMerchantID, clickServiceID, clickSecretKey)

	// Initialize Telegram payment service
	telegramBotToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if telegramBotToken == "" {
		telegramBotToken = "5996211575:AAHpj_Lp_UkUJfx2TYPkRcZuF6Y6La-LcCA" // Telegram bot token
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

	// Health check — returns real system stats
	router.GET("/health", func(c *gin.Context) {
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
	})

	// Public routes
	router.POST("/api/auth/login", handlers.Login(userService, cfg.JWTSecret))
	router.POST("/api/auth/register", handlers.Register(userService, cfg.JWTSecret))
	router.POST("/api/auth/forgot-password", handlers.ForgotPassword(userService))
	router.POST("/api/auth/verify-otp", handlers.VerifyOTP(userService))
	router.POST("/api/auth/resend-otp", handlers.ResendOTP(userService))
	router.POST("/api/auth/reset-password", handlers.ResetPassword(userService))

	// Public subscription plans
	// SUBSCRIPTIONS DISABLED
	// router.GET("/api/subscriptions/plans", handlers.GetSubscriptionPlans(subscriptionService))

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

	// Log ingestion endpoint (LOGS_TOKEN bearer auth)
	handlers.RegisterLogsIngestRoute(router, database, cfg.LogsToken)

	// Log startup status
	handlers.CheckLogsTable(database)

	// Protected routes
	protected := router.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))

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

	// Hikvision face-recognition attendance (device/employee management + reports)
	// Admin-only: RegisterAttendanceRoutes applies its own RoleChecker(admin)
	// middleware to the whole /hikvision group.
	handlers.RegisterAttendanceRoutes(protected, attendanceService, userService)

	// SUBSCRIPTIONS DISABLED
	// Subscriptions (protected routes only, plans is public)
	// handlers.RegisterSubscriptionProtectedRoutes(protected, subscriptionService, userService)
	// handlers.RegisterClickUzRoutes(protected, clickUzService, subscriptionService)
	// handlers.RegisterTelegramPaymentRoutes(protected, telegramPaymentService, subscriptionService)

	// Payment webhooks (public, no auth required)
	handlers.RegisterClickUzWebhooks(router.Group("/api"), clickUzService)
	handlers.RegisterTelegramPaymentWebhooks(router.Group("/api"), telegramPaymentService)

	// Hikvision device webhook (public, authenticated by a per-device token in the URL)
	handlers.RegisterHikvisionWebhookRoutes(router.Group("/api"), attendanceService)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting server on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
