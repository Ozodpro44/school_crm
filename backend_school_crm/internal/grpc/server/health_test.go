package server_test

import (
	"context"
	"testing"
	"time"

	grpcserver "github.com/school-crm/backend/internal/grpc/server"
	pb "github.com/school-crm/backend/internal/grpc/pb/schoolcrm/v1"
)

func TestHealthServer_Check_NoDatabase(t *testing.T) {
	srv := grpcserver.NewHealthServer(nil, nil, time.Now(), "test")
	_, err := srv.Check(context.Background(), &pb.HealthRequest{})
	if err == nil {
		t.Fatal("expected error when database is nil")
	}
}

func TestHealthServer_Check_Response_Fields(t *testing.T) {
	// We cannot use a real DB in unit tests; just verify the nil-db guard triggers.
	srv := grpcserver.NewHealthServer(nil, nil, time.Now().Add(-10*time.Second), "development")
	_, err := srv.Check(context.Background(), &pb.HealthRequest{})
	if err == nil {
		t.Fatal("expected error for nil database")
	}
}
