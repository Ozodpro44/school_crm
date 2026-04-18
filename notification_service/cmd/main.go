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
	"github.com/school-crm/notification-service/internal/config"
	"github.com/school-crm/notification-service/internal/db"
	"github.com/school-crm/notification-service/internal/handler"
	"github.com/school-crm/notification-service/internal/service"
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

	database, err := db.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer database.Close()

	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("parse redis url: %v", err)
	}
	rdb := redis.NewClient(opt)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("connect redis: %v", err)
	}
	defer rdb.Close()

	svc := service.New(database, rdb)

	// ── Background event consumer ─────────────────────────────────────────────
	eventCtx, eventCancel := context.WithCancel(context.Background())
	go func() {
		log.Println("notification_service event consumer started")
		svc.ConsumeEvents(eventCtx)
	}()

	// ── Background purge (daily) ──────────────────────────────────────────────
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
					log.Printf("notification purge error: %v", err)
				} else {
					log.Printf("notification purge: deleted %d old read notifications", n)
				}
			}
		}
	}()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())
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
		log.Printf("notification_service HTTP listening on :%s", cfg.Port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http serve: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down notification_service...")
	eventCancel()
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutCtx)
	log.Println("notification_service stopped")
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
