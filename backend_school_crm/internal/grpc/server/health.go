package server

import (
	"context"
	"math"
	"time"

	"github.com/school-crm/backend/internal/db"
	pb "github.com/school-crm/backend/internal/grpc/pb/schoolcrm/v1"
	"github.com/school-crm/backend/internal/utils"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// HealthServer implements pb.HealthServiceServer.
type HealthServer struct {
	pb.UnimplementedHealthServiceServer
	database    *db.Database
	redisClient *utils.RedisClient
	startTime   time.Time
	environment string
}

// NewHealthServer creates a HealthServer.
func NewHealthServer(database *db.Database, redisClient *utils.RedisClient, startTime time.Time, environment string) *HealthServer {
	return &HealthServer{
		database:    database,
		redisClient: redisClient,
		startTime:   startTime,
		environment: environment,
	}
}

// Check returns system health status.
func (s *HealthServer) Check(ctx context.Context, _ *pb.HealthRequest) (*pb.HealthResponse, error) {
	if s.database == nil {
		return nil, status.Error(codes.Internal, "database not initialized")
	}

	dbStats := s.database.GetConn().Stats()

	redisStatus := "inactive"
	redisConnected := false
	if s.redisClient != nil {
		redisStatus = "active"
		redisConnected = true
	}

	uptimeSeconds := int64(math.Round(time.Since(s.startTime).Seconds()))

	return &pb.HealthResponse{
		Status:        "healthy",
		Environment:   s.environment,
		UptimeSeconds: uptimeSeconds,
		Database: &pb.DatabaseStatus{
			Status:             "connected",
			OpenConnections:    int32(dbStats.OpenConnections),
			IdleConnections:    int32(dbStats.Idle),
			MaxOpenConnections: int32(dbStats.MaxOpenConnections),
		},
		Redis: &pb.RedisStatus{
			Status:    redisStatus,
			Connected: redisConnected,
		},
	}, nil
}
