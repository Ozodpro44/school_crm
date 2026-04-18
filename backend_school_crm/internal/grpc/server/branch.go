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

// BranchServer implements pb.BranchServiceServer.
type BranchServer struct {
	pb.UnimplementedBranchServiceServer
	svc *service.BranchService
}

// NewBranchServer creates a BranchServer.
func NewBranchServer(svc *service.BranchService) *BranchServer {
	return &BranchServer{svc: svc}
}

func (s *BranchServer) ListBranches(ctx context.Context, req *pb.ListBranchesRequest) (*pb.ListBranchesResponse, error) {
	branches, err := s.svc.GetAll(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list branches: %v", err)
	}

	items := make([]*pb.Branch, 0, len(branches))
	for _, b := range branches {
		items = append(items, branchModelToProto(b))
	}

	return &pb.ListBranchesResponse{
		Items: items,
		Total: int64(len(branches)),
	}, nil
}

func (s *BranchServer) GetBranch(ctx context.Context, req *pb.GetBranchRequest) (*pb.Branch, error) {
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}
	b, err := s.svc.GetByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "branch not found: %v", err)
	}
	return branchModelToProto(*b), nil
}

func (s *BranchServer) CreateBranch(ctx context.Context, req *pb.CreateBranchRequest) (*pb.Branch, error) {
	svcReq := &service.CreateBranchRequest{
		Name:           req.Name,
		Address:        req.Address,
		Phone:          req.Phone,
		MonthlyPayment: req.MonthlyPayment,
	}
	if req.AdminId != "" {
		svcReq.AdminID = &req.AdminId
	}

	b, err := s.svc.Create(ctx, svcReq)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "create branch: %v", err)
	}
	return branchModelToProto(*b), nil
}

func (s *BranchServer) DeleteBranch(ctx context.Context, req *pb.DeleteBranchRequest) (*pb.DeleteBranchResponse, error) {
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}
	if err := s.svc.Delete(ctx, req.Id); err != nil {
		return nil, status.Errorf(codes.Internal, "delete branch: %v", err)
	}
	return &pb.DeleteBranchResponse{Success: true}, nil
}

// BranchModelToProtoExported is the exported version for testing.
var BranchModelToProtoExported = branchModelToProto

// branchModelToProto converts a models.Branch to *pb.Branch.
func branchModelToProto(b models.Branch) *pb.Branch {
	proto := &pb.Branch{
		Id:             b.ID,
		Name:           b.Name,
		Address:        b.Address,
		Phone:          b.Phone,
		MonthlyPayment: b.MonthlyPayment,
		Currency:       b.Currency,
		CreatedAt:      timestamppb.New(b.CreatedAt),
		UpdatedAt:      timestamppb.New(b.UpdatedAt),
	}
	if b.AdminID != nil {
		proto.AdminId = *b.AdminID
	}
	return proto
}
