package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/school-crm/student-service/internal/config"
	"github.com/school-crm/student-service/internal/db"
	studentgrpc "github.com/school-crm/student-service/internal/grpc"
	"github.com/school-crm/student-service/internal/handler"
	"github.com/school-crm/student-service/internal/logger"
	"github.com/school-crm/student-service/internal/middleware"
	"github.com/school-crm/student-service/internal/service"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()
	logger.Init(cfg.Environment)

	if errs := cfg.Validate(); len(errs) > 0 {
		for _, e := range errs {
			slog.Error("config error", "error", e)
		}
		slog.Error("startup aborted — fix configuration errors above")
		os.Exit(1)
	}

	database, err := db.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		slog.Error("connect db", "error", err)
		os.Exit(1)
	}
	defer database.Close()
	slog.Info("database connected")

	studentSvc := service.NewStudentService(database)
	classSvc := service.NewClassService(database)
	attendanceSvc := service.NewAttendanceService(database)
	scheduleSvc := service.NewScheduleService(database)
	assignmentSvc := service.NewAssignmentService(database)
	notesSvc := service.NewStudentNotesService(database)

	grpcSrv := studentgrpc.NewStudentGRPCServer(studentSvc, classSvc)
	go func() {
		slog.Info("gRPC listening", "port", cfg.GRPCPort)
		if err := grpcSrv.Serve(":" + cfg.GRPCPort); err != nil {
			slog.Error("grpc serve failed", "error", err)
			os.Exit(1)
		}
	}()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(logger.RequestLogger())
	r.Use(corsMiddleware(cfg.CORSOrigins))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "student_service"})
	})

	api := r.Group("/api/v1")
	api.Use(middleware.JWTAuth(cfg.JWTSecret))
	h := handler.New(studentSvc, classSvc, attendanceSvc, scheduleSvc, assignmentSvc, notesSvc)
	h.Register(api)

	httpSrv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
	}
	go func() {
		slog.Info("HTTP listening", "port", cfg.Port, "service", "student_service")
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("http serve failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down", "service", "student_service")
	grpcSrv.GracefulStop()
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutCtx); err != nil {
		slog.Error("http shutdown error", "error", err)
	}
	slog.Info("stopped", "service", "student_service")
}

// corsMiddleware only reflects Origin back when it's on the configured
// allowlist — never a bare "*". See api_gateway/internal/router's
// corsMiddleware for the rationale.
func corsMiddleware(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = true
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if allowed[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		}
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-User-ID")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
