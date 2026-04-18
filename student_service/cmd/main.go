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
	"github.com/school-crm/student-service/internal/config"
	"github.com/school-crm/student-service/internal/db"
	studentgrpc "github.com/school-crm/student-service/internal/grpc"
	"github.com/school-crm/student-service/internal/handler"
	"github.com/school-crm/student-service/internal/service"
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

	// ── Services ──────────────────────────────────────────────────────────────
	studentSvc := service.NewStudentService(database)
	classSvc := service.NewClassService(database)
	attendanceSvc := service.NewAttendanceService(database)
	scheduleSvc := service.NewScheduleService(database)
	assignmentSvc := service.NewAssignmentService(database)
	notesSvc := service.NewStudentNotesService(database)

	// ── gRPC ──────────────────────────────────────────────────────────────────
	grpcSrv := studentgrpc.NewStudentGRPCServer(studentSvc, classSvc)
	go func() {
		log.Printf("student_service gRPC listening on :%s", cfg.GRPCPort)
		if err := grpcSrv.Serve(":" + cfg.GRPCPort); err != nil {
			log.Fatalf("grpc serve: %v", err)
		}
	}()

	// ── HTTP ──────────────────────────────────────────────────────────────────
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "student_service"})
	})

	h := handler.New(studentSvc, classSvc, attendanceSvc, scheduleSvc, assignmentSvc, notesSvc)
	h.Register(r.Group("/api/v1"))

	httpSrv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	go func() {
		log.Printf("student_service HTTP listening on :%s", cfg.Port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http serve: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down student_service...")
	grpcSrv.GracefulStop()

	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutCtx); err != nil {
		log.Printf("http shutdown error: %v", err)
	}
	log.Println("student_service stopped")
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
