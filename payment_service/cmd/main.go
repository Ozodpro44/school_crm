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
	"github.com/school-crm/payment-service/internal/config"
	"github.com/school-crm/payment-service/internal/db"
	paymentgrpc "github.com/school-crm/payment-service/internal/grpc"
	"github.com/school-crm/payment-service/internal/handler"
	"github.com/school-crm/payment-service/internal/logger"
	"github.com/school-crm/payment-service/internal/service"
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

	// ── Database ──────────────────────────────────────────────────────────────
	database, err := db.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		slog.Error("connect db", "error", err)
		os.Exit(1)
	}
	defer database.Close()
	slog.Info("database connected")

	// ── Redis ─────────────────────────────────────────────────────────────────
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		slog.Error("parse redis url", "error", err)
		os.Exit(1)
	}
	rdb := redis.NewClient(opt)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		slog.Error("connect redis", "error", err)
		os.Exit(1)
	}
	defer rdb.Close()
	slog.Info("redis connected")

	// ── Services ──────────────────────────────────────────────────────────────
	paymentSvc := service.New(database, rdb)

	// ── gRPC server ───────────────────────────────────────────────────────────
	grpcSrv := paymentgrpc.NewPaymentGRPCServer(paymentSvc)
	go func() {
		slog.Info("gRPC listening", "port", cfg.GRPCPort)
		if err := grpcSrv.Serve(":" + cfg.GRPCPort); err != nil {
			slog.Error("grpc serve failed", "error", err)
			os.Exit(1)
		}
	}()

	// ── HTTP server ───────────────────────────────────────────────────────────
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(logger.RequestLogger())
	r.Use(corsMiddleware())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "payment_service"})
	})

	api := r.Group("/api/v1")
	paymentHandler := handler.NewPaymentHandler(paymentSvc)
	paymentHandler.Register(api)

	httpSrv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	go func() {
		slog.Info("HTTP listening", "port", cfg.Port, "service", "payment_service")
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("http serve failed", "error", err)
			os.Exit(1)
		}
	}()

	// ── Graceful shutdown ─────────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down", "service", "payment_service")
	grpcSrv.GracefulStop()

	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutCtx); err != nil {
		slog.Error("http shutdown error", "error", err)
	}
	slog.Info("stopped", "service", "payment_service")
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-User-ID")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
