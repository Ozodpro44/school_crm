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
	svc   *service.BranchService
	users *service.UserService // optional: lets non-owner roles list their branches
}

// NewBranchServer creates a BranchServer.
func NewBranchServer(svc *service.BranchService) *BranchServer {
	return &BranchServer{svc: svc}
}

// WithUserService enables listing the branches a non-admin user belongs to.
func (s *BranchServer) WithUserService(u *service.UserService) *BranchServer {
	s.users = u
	return s
}

func (s *BranchServer) ListBranches(ctx context.Context, req *pb.ListBranchesRequest) (*pb.ListBranchesResponse, error) {
	caller, ok := CallerFromContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "authentication required")
	}
	// Never GetAll: that would list every tenant's branches.
	var (
		branches []models.Branch
		err      error
	)
	if (caller.Role == "admin" || caller.Role == "branch_admin") || s.users == nil {
		branches, err = s.svc.GetByAdminID(ctx, caller.UserID)
	} else {
		branches, err = s.users.GetUserBranches(ctx, caller.UserID)
	}
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
	// The owner is always the authenticated caller; a client-supplied
	// admin_id would let anyone create branches owned by someone else.
	caller, ok := CallerFromContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "authentication required")
	}
	svcReq.AdminID = &caller.UserID

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
	caller, ok := CallerFromContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "authentication required")
	}
	b, err := s.svc.GetByID(ctx, req.Id)
	if err != nil || b.AdminID == nil || *b.AdminID != caller.UserID {
		// Only the owning admin may delete; same answer as "missing".
		return nil, status.Error(codes.NotFound, "branch not found")
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
