package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"github.com/school-crm/auth-service/internal/config"
	"github.com/school-crm/auth-service/internal/db"
	authgrpc "github.com/school-crm/auth-service/internal/grpc"
	"github.com/school-crm/auth-service/internal/handler"
	"github.com/school-crm/auth-service/internal/service"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()
	if errs := cfg.Validate(); len(errs) > 0 {
		for _, e := range errs {
			log.Printf("CONFIG ERROR: %s", e)
		}
		log.Fatal("startup aborted — fix configuration errors above")
	}

	// ── Database ──────────────────────────────────────────────────────────────
	database, err := db.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer database.Close()

	// ── Redis ─────────────────────────────────────────────────────────────────
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("parse redis url: %v", err)
	}
	rdb := redis.NewClient(opt)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("connect redis: %v", err)
	}
	defer rdb.Close()

	// ── Services ──────────────────────────────────────────────────────────────
	authSvc := service.New(database, rdb)

	// ── gRPC server (P2.2 — ValidateToken, GetUserByID) ──────────────────────
	grpcSrv := authgrpc.NewAuthGRPCServer(authSvc, cfg.JWTSecret)
	go func() {
		log.Printf("auth_service gRPC listening on :%s", cfg.GRPCPort)
		if err := grpcSrv.Listen(":" + cfg.GRPCPort); err != nil {
			log.Fatalf("grpc serve: %v", err)
		}
	}()

	// ── HTTP server ───────────────────────────────────────────────────────────
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "auth_service"})
	})

	authHandler := handler.NewAuthHandler(authSvc, cfg.JWTSecret)
	authHandler.Register(r.Group("/api/v1"))
	// Legacy prefix — api_gateway forwards /api/auth/* without rewriting to /api/v1/auth/*
	authHandler.Register(r.Group("/api"))

	httpSrv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Port),
		Handler: r,
	}

	go func() {
		log.Printf("auth_service HTTP listening on :%s", cfg.Port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http serve: %v", err)
		}
	}()

	// ── Graceful shutdown ─────────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down auth_service...")
	grpcSrv.GracefulStop()

	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutCtx); err != nil {
		log.Printf("http shutdown error: %v", err)
	}
	log.Println("auth_service stopped")
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
