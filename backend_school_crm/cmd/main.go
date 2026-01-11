package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/school-crm/backend/internal/config"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/handlers"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/utils"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	cfg := &config.Config{
		Port:        os.Getenv("PORT"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		Environment: os.Getenv("ENVIRONMENT"),
		RedisURL:    os.Getenv("REDIS_URL"),
		ResendAPIKey: os.Getenv("RESEND_API_KEY"),
		ResendFrom:  os.Getenv("RESEND_FROM"),
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

	// Initialize router
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Middleware
	router.Use(middleware.CORSMiddleware())
	router.Use(middleware.ErrorHandling())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	// Public routes
	router.POST("/api/auth/login", handlers.Login(userService, cfg.JWTSecret))
	router.POST("/api/auth/register", handlers.Register(userService, cfg.JWTSecret))
	router.POST("/api/auth/forgot-password", handlers.ForgotPassword(userService))
	router.POST("/api/auth/verify-otp", handlers.VerifyOTP(userService))
	router.POST("/api/auth/resend-otp", handlers.ResendOTP(userService))
	router.POST("/api/auth/reset-password", handlers.ResetPassword(userService))

	// Protected routes
	protected := router.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))

	// Users
	handlers.RegisterUserRoutes(protected, userService)

	// Students
	handlers.RegisterStudentRoutes(protected, studentService, classService, userService)

	// Payments
	handlers.RegisterPaymentRoutes(protected, paymentService, branchService, userService)

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

	// Developer endpoints
	// handlers.RegisterDeveloperRoutes(protected, database)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting server on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
