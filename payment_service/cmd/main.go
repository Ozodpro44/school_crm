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
	"github.com/school-crm/payment-service/internal/config"
	"github.com/school-crm/payment-service/internal/db"
	paymentgrpc "github.com/school-crm/payment-service/internal/grpc"
	"github.com/school-crm/payment-service/internal/handler"
	"github.com/school-crm/payment-service/internal/service"
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
	paymentSvc := service.New(database, rdb)

	// ── gRPC server (P3.2 — GetPayment, ListPayments, CheckSubscriptionActive) ─
	grpcSrv := paymentgrpc.NewPaymentGRPCServer(paymentSvc)
	go func() {
		log.Printf("payment_service gRPC listening on :%s", cfg.GRPCPort)
		if err := grpcSrv.Serve(":" + cfg.GRPCPort); err != nil {
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
		log.Printf("payment_service HTTP listening on :%s", cfg.Port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http serve: %v", err)
		}
	}()

	// ── Graceful shutdown ─────────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down payment_service...")
	grpcSrv.GracefulStop()

	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutCtx); err != nil {
		log.Printf("http shutdown error: %v", err)
	}
	log.Println("payment_service stopped")
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
