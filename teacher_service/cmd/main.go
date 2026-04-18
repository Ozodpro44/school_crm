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
	"github.com/school-crm/teacher-service/internal/config"
	"github.com/school-crm/teacher-service/internal/db"
	teachergrpc "github.com/school-crm/teacher-service/internal/grpc"
	"github.com/school-crm/teacher-service/internal/handler"
	"github.com/school-crm/teacher-service/internal/service"
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

	teacherSvc := service.NewTeacherService(database)
	salarySvc := service.NewSalaryService(database)

	grpcSrv := teachergrpc.NewTeacherGRPCServer(teacherSvc)
	go func() {
		log.Printf("teacher_service gRPC listening on :%s", cfg.GRPCPort)
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
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "teacher_service"})
	})
	handler.New(teacherSvc, salarySvc).Register(r.Group("/api/v1"))

	httpSrv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
	}
	go func() {
		log.Printf("teacher_service HTTP listening on :%s", cfg.Port)
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
	log.Println("teacher_service stopped")
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
