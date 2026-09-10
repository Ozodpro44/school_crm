// Package grpc implements the UserService gRPC server defined in
// protos/user/v1/user.proto. The generated stubs are now compiled in (see
// protos/go.mod) and actually registered — previously this package defined
// a parallel hand-rolled interface (missing ListUserBranches and
// GetCurrentFinancialMonth entirely) that was never registered with the
// underlying grpc.Server, so the server accepted TCP connections but
// answered every real RPC with Unimplemented.
package grpc

import (
	"context"
	"fmt"
	"net"

	userv1 "github.com/school-crm/user-service/internal/pb/userv1"

	"github.com/school-crm/user-service/internal/service"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type UserGRPCServer struct {
	userv1.UnimplementedUserServiceServer
	users       *service.UserService
	branches    *service.BranchService
	permissions *service.PermissionService
	grpc        *grpc.Server
}

func NewUserGRPCServer(
	users *service.UserService,
	branches *service.BranchService,
	permissions *service.PermissionService,
) *UserGRPCServer {
	s := &UserGRPCServer{
		users:       users,
		branches:    branches,
		permissions: permissions,
		grpc:        grpc.NewServer(),
	}
	userv1.RegisterUserServiceServer(s.grpc, s)
	return s
}

func toProtoBranch(b *service.Branch) *userv1.Branch {
	p := &userv1.Branch{
		BranchId:       b.ID,
		Name:           b.Name,
		Address:        b.Address,
		Phone:          b.Phone,
		MonthlyPayment: b.MonthlyPayment,
		Currency:       b.Currency,
		CreatedAt:      timestamppb.New(b.CreatedAt),
	}
	if b.AdminID != nil {
		p.AdminId = *b.AdminID
	}
	return p
}

// GetUser returns profile data for a user ID.
// Called by other services that need user metadata (teacher_service, payment_service).
func (s *UserGRPCServer) GetUser(ctx context.Context, req *userv1.GetUserRequest) (*userv1.GetUserResponse, error) {
	u, err := s.users.GetByID(ctx, req.GetUserId())
	if err != nil {
		if err == service.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "user %s not found", req.GetUserId())
		}
		return nil, status.Errorf(codes.Internal, "get user: %v", err)
	}
	resp := &userv1.GetUserResponse{User: &userv1.User{
		UserId:    u.ID,
		Email:     u.Email,
		FullName:  u.FullName,
		Role:      u.Role,
		Language:  u.Language,
		CreatedAt: timestamppb.New(u.CreatedAt),
	}}
	if u.Phone != nil {
		resp.User.Phone = *u.Phone
	}
	if u.AvatarURL != nil {
		resp.User.AvatarUrl = *u.AvatarURL
	}
	return resp, nil
}

// GetBranch returns branch metadata.
// Called by payment_service to verify branch exists before creating records.
func (s *UserGRPCServer) GetBranch(ctx context.Context, req *userv1.GetBranchRequest) (*userv1.GetBranchResponse, error) {
	b, err := s.branches.GetByID(ctx, req.GetBranchId())
	if err != nil {
		if err == service.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "branch %s not found", req.GetBranchId())
		}
		return nil, status.Errorf(codes.Internal, "get branch: %v", err)
	}
	return &userv1.GetBranchResponse{Branch: toProtoBranch(b)}, nil
}

// ListUserBranches returns every branch a user administers.
func (s *UserGRPCServer) ListUserBranches(ctx context.Context, req *userv1.ListUserBranchesRequest) (*userv1.ListUserBranchesResponse, error) {
	branches, err := s.branches.GetByAdminID(ctx, req.GetUserId())
	if err != nil {
		return nil, status.Errorf(codes.Internal, "list user branches: %v", err)
	}
	items := make([]*userv1.Branch, 0, len(branches))
	for i := range branches {
		items = append(items, toProtoBranch(&branches[i]))
	}
	return &userv1.ListUserBranchesResponse{Branches: items}, nil
}

// CheckPermission returns whether a user has a specific permission.
// Action names match the camelCase field names on the Permission struct
// (e.g. "canCreatePayments", "canEditStudents").
func (s *UserGRPCServer) CheckPermission(ctx context.Context, req *userv1.CheckPermissionRequest) (*userv1.CheckPermissionResponse, error) {
	p, err := s.permissions.GetByUserID(ctx, req.GetUserId())
	if err != nil {
		return nil, status.Errorf(codes.Internal, "check permission: %v", err)
	}
	if p == nil {
		// No permission row → deny by default
		return &userv1.CheckPermissionResponse{Allowed: false}, nil
	}
	return &userv1.CheckPermissionResponse{Allowed: checkField(p, req.GetAction())}, nil
}

// GetCurrentFinancialMonth returns the branch's currently open financial
// month.
func (s *UserGRPCServer) GetCurrentFinancialMonth(ctx context.Context, req *userv1.GetCurrentFinancialMonthRequest) (*userv1.GetCurrentFinancialMonthResponse, error) {
	b, err := s.branches.GetByID(ctx, req.GetBranchId())
	if err != nil {
		if err == service.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "branch %s not found", req.GetBranchId())
		}
		return nil, status.Errorf(codes.Internal, "get branch: %v", err)
	}
	if b.CurrentFinancialMonth == nil {
		return nil, status.Errorf(codes.NotFound, "no open financial month for branch %s", req.GetBranchId())
	}
	return &userv1.GetCurrentFinancialMonthResponse{
		Month: fmt.Sprintf("%02d", b.CurrentFinancialMonth.Month),
		Year:  int32(b.CurrentFinancialMonth.Year),
	}, nil
}

// checkField maps an action string to the corresponding Permission bool field.
func checkField(p *service.Permission, action string) bool {
	switch action {
	case "canViewStudents":
		return p.CanViewStudents
	case "canCreateStudents":
		return p.CanCreateStudents
	case "canEditStudents":
		return p.CanEditStudents
	case "canDeleteStudents":
		return p.CanDeleteStudents
	case "canViewTeachers":
		return p.CanViewTeachers
	case "canCreateTeachers":
		return p.CanCreateTeachers
	case "canEditTeachers":
		return p.CanEditTeachers
	case "canDeleteTeachers":
		return p.CanDeleteTeachers
	case "canViewClasses":
		return p.CanViewClasses
	case "canCreateClasses":
		return p.CanCreateClasses
	case "canEditClasses":
		return p.CanEditClasses
	case "canViewPayments":
		return p.CanViewPayments
	case "canCreatePayments":
		return p.CanCreatePayments
	case "canEditPayments":
		return p.CanEditPayments
	case "canViewSalaries":
		return p.CanViewSalaries
	case "canCreateSalaries":
		return p.CanCreateSalaries
	case "canEditSalaries":
		return p.CanEditSalaries
	case "canViewExpenses":
		return p.CanViewExpenses
	case "canCreateExpenses":
		return p.CanCreateExpenses
	case "canEditExpenses":
		return p.CanEditExpenses
	case "canDeleteExpenses":
		return p.CanDeleteExpenses
	case "canViewReports":
		return p.CanViewReports
	case "canViewSettings":
		return p.CanViewSettings
	case "canEditSettings":
		return p.CanEditSettings
	case "canViewSubscriptions":
		return p.CanViewSubscriptions
	case "canManageSubscriptions":
		return p.CanManageSubscriptions
	}
	return false
}

func (s *UserGRPCServer) Serve(addr string) error {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	return s.grpc.Serve(lis)
}

func (s *UserGRPCServer) GracefulStop() { s.grpc.GracefulStop() }
