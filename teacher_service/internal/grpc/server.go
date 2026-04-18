// Package grpc implements the TeacherService gRPC server.
// Hand-rolled proto types until buf-generated stubs are published.
package grpc

import (
	"context"
	"net"

	"github.com/school-crm/teacher-service/internal/service"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ── Hand-rolled proto types ───────────────────────────────────────────────────

type GetTeacherRequest struct{ TeacherID string }
type GetTeacherResponse struct {
	ID            string
	FullName      string
	Email         string
	Phone         string
	BranchID      string
	MonthlySalary float64
	Subjects      []string
}

type ListTeachersRequest struct{ BranchID string }
type ListTeachersResponse struct{ Items []*GetTeacherResponse }

// ── Server ────────────────────────────────────────────────────────────────────

type TeacherGRPCServer struct {
	svc  *service.TeacherService
	grpc *grpc.Server
}

func NewTeacherGRPCServer(svc *service.TeacherService) *TeacherGRPCServer {
	s := &TeacherGRPCServer{svc: svc, grpc: grpc.NewServer()}
	return s
}

// GetTeacher returns teacher data by ID.
// Called by student_service to resolve teacher names on class listings.
func (s *TeacherGRPCServer) GetTeacher(ctx context.Context, req *GetTeacherRequest) (*GetTeacherResponse, error) {
	t, err := s.svc.GetByID(ctx, req.TeacherID)
	if err != nil {
		if err == service.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "teacher %s not found", req.TeacherID)
		}
		return nil, status.Errorf(codes.Internal, "get teacher: %v", err)
	}
	return &GetTeacherResponse{
		ID:            t.ID,
		FullName:      t.FullName,
		Email:         t.Email,
		Phone:         t.Phone,
		BranchID:      t.BranchID,
		MonthlySalary: t.MonthlySalary,
		Subjects:      t.Subjects,
	}, nil
}

// ListTeachers returns all teachers for a branch.
// Called by finance_service when generating salary reports.
func (s *TeacherGRPCServer) ListTeachers(ctx context.Context, req *ListTeachersRequest) (*ListTeachersResponse, error) {
	teachers, err := s.svc.GetAll(ctx, req.BranchID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list teachers: %v", err)
	}
	items := make([]*GetTeacherResponse, 0, len(teachers))
	for _, t := range teachers {
		items = append(items, &GetTeacherResponse{
			ID:            t.ID,
			FullName:      t.FullName,
			Email:         t.Email,
			Phone:         t.Phone,
			BranchID:      t.BranchID,
			MonthlySalary: t.MonthlySalary,
			Subjects:      t.Subjects,
		})
	}
	return &ListTeachersResponse{Items: items}, nil
}

func (s *TeacherGRPCServer) Serve(addr string) error {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	return s.grpc.Serve(lis)
}

func (s *TeacherGRPCServer) GracefulStop() { s.grpc.GracefulStop() }
