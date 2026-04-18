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
	"github.com/school-crm/finance-service/internal/config"
	"github.com/school-crm/finance-service/internal/db"
	financegrpc "github.com/school-crm/finance-service/internal/grpc"
	"github.com/school-crm/finance-service/internal/handler"
	"github.com/school-crm/finance-service/internal/service"
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

	// Writer = primary, Reader = replica (or same if DATABASE_READ_URL unset)
	database, err := db.New(context.Background(), cfg.DatabaseURL, cfg.DatabaseReadURL)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer database.Close()

	expenseSvc := service.NewExpenseService(database)
	budgetSvc := service.NewBudgetService(database)

	grpcSrv := financegrpc.NewFinanceGRPCServer(expenseSvc)
	go func() {
		log.Printf("finance_service gRPC listening on :%s", cfg.GRPCPort)
		if err := grpcSrv.Serve(":" + cfg.GRPCPort); err != nil {
			log.Fatalf("grpc serve: %v", err)
		}
	}()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "finance_service"})
	})
	handler.New(expenseSvc, budgetSvc).Register(r.Group("/api/v1"))

	httpSrv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 90 * time.Second, // longer for report queries
	}
	go func() {
		log.Printf("finance_service HTTP listening on :%s", cfg.Port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http serve: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	grpcSrv.GracefulStop()
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutCtx)
	log.Println("finance_service stopped")
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
