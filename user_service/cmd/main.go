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
	"github.com/redis/go-redis/v9"
	"github.com/school-crm/user-service/internal/config"
	"github.com/school-crm/user-service/internal/db"
	usergrpc "github.com/school-crm/user-service/internal/grpc"
	"github.com/school-crm/user-service/internal/handler"
	"github.com/school-crm/user-service/internal/logger"
	"github.com/school-crm/user-service/internal/middleware"
	"github.com/school-crm/user-service/internal/service"
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

	// Redis backs the permission cache (CheckPermission is on the hot path
	// for every authorization check other services make over gRPC). Not
	// fatal if unreachable — PermissionService falls through to Postgres.
	var rdb *redis.Client
	if opt, err := redis.ParseURL(cfg.RedisURL); err != nil {
		slog.Warn("parse redis url — permission caching disabled", "error", err)
	} else {
		rdb = redis.NewClient(opt)
		if err := rdb.Ping(context.Background()).Err(); err != nil {
			slog.Warn("connect redis — permission caching disabled", "error", err)
			rdb = nil
		} else {
			defer rdb.Close()
			slog.Info("redis connected")
		}
	}

	userSvc := service.NewUserService(database)
	branchSvc := service.NewBranchService(database)
	permSvc := service.NewPermissionService(database, rdb)

	grpcSrv := usergrpc.NewUserGRPCServer(userSvc, branchSvc, permSvc)
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
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "user_service"})
	})

	api := r.Group("/api/v1")
	api.Use(middleware.JWTAuth(cfg.JWTSecret))
	h := handler.New(userSvc, branchSvc, permSvc, database.Conn())
	h.Register(api)

	httpSrv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
	}
	go func() {
		slog.Info("HTTP listening", "port", cfg.Port, "service", "user_service")
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("http serve failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down", "service", "user_service")
	grpcSrv.GracefulStop()
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutCtx); err != nil {
		slog.Error("http shutdown error", "error", err)
	}
	slog.Info("stopped", "service", "user_service")
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
