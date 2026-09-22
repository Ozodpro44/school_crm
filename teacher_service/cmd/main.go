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
	"github.com/school-crm/teacher-service/internal/config"
	"github.com/school-crm/teacher-service/internal/db"
	teachergrpc "github.com/school-crm/teacher-service/internal/grpc"
	"github.com/school-crm/teacher-service/internal/handler"
	"github.com/school-crm/teacher-service/internal/logger"
	"github.com/school-crm/teacher-service/internal/middleware"
	"github.com/school-crm/teacher-service/internal/service"
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

	teacherSvc := service.NewTeacherService(database)
	salarySvc := service.NewSalaryService(database)

	// Trash purge: rows soft-deleted more than 30 days ago (the longer of
	// the two restore windows — 7 days for a regular admin, 30 for
	// developer/super_admin) are permanently removed. A purged teacher's
	// still-soft-deleted login (users row) is cleaned up in the same pass,
	// since nothing else will ever restore it once the teacher itself is
	// gone for good.
	go func() {
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			if _, err := database.Conn().ExecContext(context.Background(),
				`DELETE FROM users WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days'
				 AND id IN (SELECT user_id FROM teachers WHERE user_id IS NOT NULL AND deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days')`,
			); err != nil {
				slog.Error("trash purge: teacher logins", "error", err)
			}
			if n, err := database.Conn().ExecContext(context.Background(),
				`DELETE FROM teachers WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days'`); err != nil {
				slog.Error("trash purge: teachers", "error", err)
			} else if rows, _ := n.RowsAffected(); rows > 0 {
				slog.Info("trash purge: teachers", "purged", rows)
			}
			if n, err := database.Conn().ExecContext(context.Background(),
				`DELETE FROM salaries WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days'`); err != nil {
				slog.Error("trash purge: salaries", "error", err)
			} else if rows, _ := n.RowsAffected(); rows > 0 {
				slog.Info("trash purge: salaries", "purged", rows)
			}
		}
	}()

	grpcSrv := teachergrpc.NewTeacherGRPCServer(teacherSvc)
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
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "teacher_service"})
	})

	api := r.Group("/api/v1")
	api.Use(middleware.JWTAuth(cfg.JWTSecret))
	h := handler.New(teacherSvc, salarySvc, database)
	h.Register(api)

	httpSrv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
	}
	go func() {
		slog.Info("HTTP listening", "port", cfg.Port, "service", "teacher_service")
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("http serve failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down", "service", "teacher_service")
	grpcSrv.GracefulStop()
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutCtx); err != nil {
		slog.Error("http shutdown error", "error", err)
	}
	slog.Info("stopped", "service", "teacher_service")
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
