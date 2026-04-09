// cmd/grpc/main.go — standalone gRPC server
// Run alongside (or instead of) the REST server.
// All business logic is shared through the same service layer.
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/school-crm/backend/internal/config"
	"github.com/school-crm/backend/internal/db"
	grpcserver "github.com/school-crm/backend/internal/grpc/server"
	pb "github.com/school-crm/backend/internal/grpc/pb/schoolcrm/v1"
	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/utils"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

var startTime = time.Now()

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Railway injects PORT; GRPC_PORT is the fallback for local dev / explicit override.
	grpcPort := os.Getenv("PORT")
	if grpcPort == "" {
		grpcPort = os.Getenv("GRPC_PORT")
	}
	if grpcPort == "" {
		grpcPort = "9090"
	}

	cfg := &config.Config{
		Port:        grpcPort,
		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		Environment: os.Getenv("ENVIRONMENT"),
		RedisURL:    os.Getenv("REDIS_URL"),
	}
	if cfg.Environment == "" {
		cfg.Environment = "development"
	}
	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	// Initialize database
	database, err := db.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Initialize Redis (optional)
	var redisClient *utils.RedisClient
	if cfg.RedisURL != "" {
		rc, err := utils.NewRedisClient(cfg.RedisURL)
		if err != nil {
			log.Printf("Warning: Failed to connect to Redis: %v", err)
		} else {
			redisClient = rc
			defer redisClient.Close()
		}
	}

	// Initialize services (same service layer as REST)
	studentService := service.NewStudentService(database)
	paymentService := service.NewPaymentService(database)
	classService := service.NewClassService(database)
	branchService := service.NewBranchService(database)

	// Build gRPC server
	grpcSrv := grpc.NewServer()

	pb.RegisterHealthServiceServer(grpcSrv, grpcserver.NewHealthServer(database, redisClient, startTime, cfg.Environment))
	pb.RegisterStudentServiceServer(grpcSrv, grpcserver.NewStudentServer(studentService))
	pb.RegisterPaymentServiceServer(grpcSrv, grpcserver.NewPaymentServer(paymentService, branchService))
	pb.RegisterBranchServiceServer(grpcSrv, grpcserver.NewBranchServer(branchService))
	pb.RegisterClassServiceServer(grpcSrv, grpcserver.NewClassServer(classService))

	// Enable server reflection (allows grpcurl and other tooling to discover services)
	reflection.Register(grpcSrv)

	addr := fmt.Sprintf(":%s", cfg.Port)
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("Failed to listen on %s: %v", addr, err)
	}

	log.Printf("gRPC server listening on %s (environment: %s)", addr, cfg.Environment)
	if err := grpcSrv.Serve(lis); err != nil {
		log.Fatalf("gRPC server failed: %v", err)
	}
}
