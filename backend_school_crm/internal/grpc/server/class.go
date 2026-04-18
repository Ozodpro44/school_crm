package server

import (
	"context"

	"github.com/school-crm/backend/internal/models"
	pb "github.com/school-crm/backend/internal/grpc/pb/schoolcrm/v1"
	"github.com/school-crm/backend/internal/service"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// ClassServer implements pb.ClassServiceServer.
type ClassServer struct {
	pb.UnimplementedClassServiceServer
	svc *service.ClassService
}

// NewClassServer creates a ClassServer.
func NewClassServer(svc *service.ClassService) *ClassServer {
	return &ClassServer{svc: svc}
}

func (s *ClassServer) ListClasses(ctx context.Context, req *pb.ListClassesRequest) (*pb.ListClassesResponse, error) {
	classes, err := s.svc.GetByBranchID(ctx, req.BranchId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list classes: %v", err)
	}

	items := make([]*pb.Class, 0, len(classes))
	for _, c := range classes {
		items = append(items, classModelToProto(c))
	}

	return &pb.ListClassesResponse{
		Items: items,
		Total: int64(len(classes)),
	}, nil
}

func (s *ClassServer) GetClass(ctx context.Context, req *pb.GetClassRequest) (*pb.Class, error) {
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}
	c, err := s.svc.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "class not found: %v", err)
	}
	return classModelToProto(*c), nil
}

func (s *ClassServer) CreateClass(ctx context.Context, req *pb.CreateClassRequest) (*pb.Class, error) {
	svcReq := &service.CreateClassRequest{
		Name:     req.Name,
		BranchID: req.BranchId,
	}
	if req.TeacherId != "" {
		svcReq.TeacherID = &req.TeacherId
	}

	c, err := s.svc.Create(ctx, svcReq)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "create class: %v", err)
	}
	return classModelToProto(*c), nil
}

func (s *ClassServer) DeleteClass(ctx context.Context, req *pb.DeleteClassRequest) (*pb.DeleteClassResponse, error) {
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}
	if err := s.svc.Delete(ctx, req.Id); err != nil {
		return nil, status.Errorf(codes.Internal, "delete class: %v", err)
	}
	return &pb.DeleteClassResponse{Success: true}, nil
}

// classModelToProto converts a models.Class to *pb.Class.
// ClassModelToProtoExported is the exported version for testing.
var ClassModelToProtoExported = classModelToProto

func classModelToProto(c models.Class) *pb.Class {
	proto := &pb.Class{
		Id:        c.ID,
		Name:      c.Name,
		BranchId:  c.BranchID,
		CreatedAt: timestamppb.New(c.CreatedAt),
		UpdatedAt: timestamppb.New(c.UpdatedAt),
	}
	if c.TeacherID != nil {
		proto.TeacherId = *c.TeacherID
	}
	return proto
}
