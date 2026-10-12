// Tests for gRPC server input-validation early exits.
// All tests run without a real database — they exercise the guards that fire
// before any service/DB call.
package server_test

import (
	"context"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	grpcserver "github.com/school-crm/backend/internal/grpc/server"
	pb "github.com/school-crm/backend/internal/grpc/pb/schoolcrm/v1"
)

// ---- StudentServer ----

func TestStudentServer_GetStudent_EmptyID(t *testing.T) {
	srv := grpcserver.NewStudentServer(nil)
	_, err := srv.GetStudent(context.Background(), &pb.GetStudentRequest{Id: ""})
	if err == nil {
		t.Fatal("expected error for empty ID")
	}
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.InvalidArgument {
		t.Errorf("expected InvalidArgument, got %v", err)
	}
}

func TestStudentServer_UpdateStudent_EmptyID(t *testing.T) {
	srv := grpcserver.NewStudentServer(nil)
	_, err := srv.UpdateStudent(context.Background(), &pb.UpdateStudentRequest{Id: ""})
	if err == nil {
		t.Fatal("expected error for empty ID")
	}
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.InvalidArgument {
		t.Errorf("expected InvalidArgument, got %v", err)
	}
}

func TestStudentServer_DeleteStudent_EmptyID(t *testing.T) {
	srv := grpcserver.NewStudentServer(nil)
	_, err := srv.DeleteStudent(context.Background(), &pb.DeleteStudentRequest{Id: ""})
	if err == nil {
		t.Fatal("expected error for empty ID")
	}
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.InvalidArgument {
		t.Errorf("expected InvalidArgument, got %v", err)
	}
}

// ---- BranchServer ----

func TestBranchServer_GetBranch_EmptyID(t *testing.T) {
	srv := grpcserver.NewBranchServer(nil)
	_, err := srv.GetBranch(context.Background(), &pb.GetBranchRequest{Id: ""})
	if err == nil {
		t.Fatal("expected error for empty ID")
	}
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.InvalidArgument {
		t.Errorf("expected InvalidArgument, got %v", err)
	}
}

func TestBranchServer_DeleteBranch_EmptyID(t *testing.T) {
	srv := grpcserver.NewBranchServer(nil)
	_, err := srv.DeleteBranch(context.Background(), &pb.DeleteBranchRequest{Id: ""})
	if err == nil {
		t.Fatal("expected error for empty ID")
	}
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.InvalidArgument {
		t.Errorf("expected InvalidArgument, got %v", err)
	}
}

// ---- ClassServer ----

func TestClassServer_GetClass_EmptyID(t *testing.T) {
	srv := grpcserver.NewClassServer(nil)
	_, err := srv.GetClass(context.Background(), &pb.GetClassRequest{Id: ""})
	if err == nil {
		t.Fatal("expected error for empty ID")
	}
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.InvalidArgument {
		t.Errorf("expected InvalidArgument, got %v", err)
	}
}

func TestClassServer_DeleteClass_EmptyID(t *testing.T) {
	srv := grpcserver.NewClassServer(nil)
	_, err := srv.DeleteClass(context.Background(), &pb.DeleteClassRequest{Id: ""})
	if err == nil {
		t.Fatal("expected error for empty ID")
	}
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.InvalidArgument {
		t.Errorf("expected InvalidArgument, got %v", err)
	}
}

// ---- PaymentServer ----

func TestPaymentServer_GetPayment_EmptyID(t *testing.T) {
	srv := grpcserver.NewPaymentServer(nil, nil)
	_, err := srv.GetPayment(context.Background(), &pb.GetPaymentRequest{Id: ""})
	if err == nil {
		t.Fatal("expected error for empty ID")
	}
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.InvalidArgument {
		t.Errorf("expected InvalidArgument, got %v", err)
	}
}

func TestPaymentServer_DeletePayment_EmptyID(t *testing.T) {
	srv := grpcserver.NewPaymentServer(nil, nil)
	_, err := srv.DeletePayment(context.Background(), &pb.DeletePaymentRequest{Id: ""})
	if err == nil {
		t.Fatal("expected error for empty ID")
	}
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.InvalidArgument {
		t.Errorf("expected InvalidArgument, got %v", err)
	}
}
