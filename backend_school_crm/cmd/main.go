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

	// Initialize services
	userService := service.NewUserService(database)
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

	// Protected routes
	protected := router.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))

	// Users
	handlers.RegisterUserRoutes(protected, userService)

	// Students
	handlers.RegisterStudentRoutes(protected, studentService, classService, userService)

	// Payments
	handlers.RegisterPaymentRoutes(protected, paymentService, userService)

	// Classes
	handlers.RegisterClassRoutes(protected, classService, userService)

	// Branches
	handlers.RegisterBranchRoutes(protected, branchService, userService)

	// Teachers
	handlers.RegisterTeacherRoutes(protected, teacherService, userService)

	// Salaries
	handlers.RegisterSalaryRoutes(protected, salaryService, userService)

	// Expenses
	handlers.RegisterExpenseRoutes(protected, expenseService, userService)

	// Reports
	handlers.RegisterReportRoutes(protected, reportService, userService)

	// Settings
	handlers.RegisterSettingsRoutes(protected, branchService, userService)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting server on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
