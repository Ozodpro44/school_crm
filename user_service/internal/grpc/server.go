// Package grpc implements the UserService gRPC server.
// Hand-rolled types until buf-generated stubs are published.
package grpc

import (
	"context"
	"net"

	"github.com/school-crm/user-service/internal/service"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ── Hand-rolled proto types ───────────────────────────────────────────────────

type GetUserRequest struct{ UserID string }
type GetUserResponse struct {
	ID       string
	Email    string
	FullName string
	Role     string
	BranchID string
}

type GetBranchRequest struct{ BranchID string }
type GetBranchResponse struct {
	ID             string
	Name           string
	MonthlyPayment float64
}

type CheckPermissionRequest struct {
	UserID string
	Action string
}
type CheckPermissionResponse struct{ Allowed bool }

// ── Server ────────────────────────────────────────────────────────────────────

type UserGRPCServer struct {
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
	return s
}

// GetUser returns profile data for a user ID.
// Called by other services that need user metadata (teacher_service, payment_service).
func (s *UserGRPCServer) GetUser(ctx context.Context, req *GetUserRequest) (*GetUserResponse, error) {
	u, err := s.users.GetByID(ctx, req.UserID)
	if err != nil {
		if err == service.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "user %s not found", req.UserID)
		}
		return nil, status.Errorf(codes.Internal, "get user: %v", err)
	}
	resp := &GetUserResponse{ID: u.ID, Email: u.Email, FullName: u.FullName, Role: u.Role}
	if u.BranchID != nil {
		resp.BranchID = *u.BranchID
	}
	return resp, nil
}

// GetBranch returns branch metadata.
// Called by payment_service to verify branch exists before creating records.
func (s *UserGRPCServer) GetBranch(ctx context.Context, req *GetBranchRequest) (*GetBranchResponse, error) {
	b, err := s.branches.GetByID(ctx, req.BranchID)
	if err != nil {
		if err == service.ErrNotFound {
			return nil, status.Errorf(codes.NotFound, "branch %s not found", req.BranchID)
		}
		return nil, status.Errorf(codes.Internal, "get branch: %v", err)
	}
	return &GetBranchResponse{ID: b.ID, Name: b.Name, MonthlyPayment: b.MonthlyPayment}, nil
}

// CheckPermission returns whether a user has a specific permission.
// Action names match the camelCase field names on the Permission struct
// (e.g. "canCreatePayments", "canEditStudents").
func (s *UserGRPCServer) CheckPermission(ctx context.Context, req *CheckPermissionRequest) (*CheckPermissionResponse, error) {
	p, err := s.permissions.GetByUserID(ctx, req.UserID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "check permission: %v", err)
	}
	if p == nil {
		// No permission row → deny by default
		return &CheckPermissionResponse{Allowed: false}, nil
	}
	allowed := checkField(p, req.Action)
	return &CheckPermissionResponse{Allowed: allowed}, nil
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
