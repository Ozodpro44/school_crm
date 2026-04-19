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
	"github.com/school-crm/notification-service/internal/config"
	"github.com/school-crm/notification-service/internal/db"
	"github.com/school-crm/notification-service/internal/handler"
	"github.com/school-crm/notification-service/internal/logger"
	"github.com/school-crm/notification-service/internal/service"
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

	svc := service.New(database, rdb)

	eventCtx, eventCancel := context.WithCancel(context.Background())
	go func() {
		slog.Info("event consumer started")
		svc.ConsumeEvents(eventCtx)
	}()
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-eventCtx.Done():
				return
			case <-ticker.C:
				n, err := svc.PurgeOld(context.Background(), 30*24*time.Hour)
				if err != nil {
					slog.Error("notification purge failed", "error", err)
				} else {
					slog.Info("notification purge complete", "deleted", n)
				}
			}
		}
	}()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(logger.RequestLogger())
	r.Use(corsMiddleware())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "notification_service"})
	})
	handler.New(svc).Register(r.Group("/api/v1"))

	httpSrv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}
	go func() {
		slog.Info("HTTP listening", "port", cfg.Port, "service", "notification_service")
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("http serve failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down", "service", "notification_service")
	eventCancel()
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutCtx)
	slog.Info("stopped", "service", "notification_service")
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
