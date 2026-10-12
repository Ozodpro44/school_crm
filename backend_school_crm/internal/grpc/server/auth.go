package server

import (
	"context"
	"strings"

	"github.com/redis/go-redis/v9"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// Caller is the authenticated identity attached to the request context by
// the auth interceptor.
type Caller struct {
	UserID string
	Role   string
}

type callerCtxKey struct{}

// CallerFromContext returns the authenticated caller. ok is false only for
// public methods (health), which never need it.
func CallerFromContext(ctx context.Context) (Caller, bool) {
	c, ok := ctx.Value(callerCtxKey{}).(Caller)
	return c, ok
}

// AccessChecker is the tenant-lookup surface the interceptor needs;
// *service.UserService satisfies it.
type AccessChecker interface {
	BelongsToBranch(ctx context.Context, userID, branchID string) (bool, error)
	ResourceBranchID(ctx context.Context, table, id string) (branchID string, found bool, err error)
}

// AuthConfig wires the interceptor. HasPermission is optional; when nil no
// per-flag permission check is made (branch membership is still enforced).
type AuthConfig struct {
	JWTSecret     string
	Redis         *redis.Client
	Access        AccessChecker
	HasPermission func(ctx context.Context, userID, permission string) (bool, error)
}

// NewAuthConfig builds the production AuthConfig backed by the user service.
func NewAuthConfig(jwtSecret string, rdb *redis.Client, userSvc *service.UserService) AuthConfig {
	return AuthConfig{
		JWTSecret: jwtSecret,
		Redis:     rdb,
		Access:    userSvc,
		HasPermission: func(ctx context.Context, userID, permission string) (bool, error) {
			return middleware.UserHasPermission(ctx, userSvc, userID, permission)
		},
	}
}

type scopeKind int

const (
	scopeNone     scopeKind = iota // authenticated is enough; the handler scopes by Caller
	scopeBranch                    // request carries branch_id
	scopeResource                  // request carries id of a row in `table`
	scopeBranchID                  // request id *is* a branch id
)

type methodPolicy struct {
	kind       scopeKind
	table      string
	permission string
}

// methodPolicies is deny-by-default: any gRPC method missing from this table
// (other than the public ones) is rejected, so a newly added RPC cannot ship
// unauthenticated by accident.
var methodPolicies = map[string]methodPolicy{
	"/schoolcrm.v1.StudentService/ListStudents":  {scopeBranch, "", "canViewStudents"},
	"/schoolcrm.v1.StudentService/GetStudent":    {scopeResource, "students", "canViewStudents"},
	"/schoolcrm.v1.StudentService/CreateStudent": {scopeBranch, "", "canCreateStudents"},
	"/schoolcrm.v1.StudentService/UpdateStudent": {scopeResource, "students", "canEditStudents"},
	"/schoolcrm.v1.StudentService/DeleteStudent": {scopeResource, "students", "canDeleteStudents"},

	"/schoolcrm.v1.PaymentService/ListPayments":  {scopeBranch, "", "canViewPayments"},
	"/schoolcrm.v1.PaymentService/GetPayment":    {scopeResource, "payments", "canViewPayments"},
	"/schoolcrm.v1.PaymentService/CreatePayment": {scopeBranch, "", "canCreatePayments"},
	"/schoolcrm.v1.PaymentService/DeletePayment": {scopeResource, "payments", "canEditPayments"},

	"/schoolcrm.v1.ClassService/ListClasses": {scopeBranch, "", "canViewClasses"},
	"/schoolcrm.v1.ClassService/GetClass":    {scopeResource, "classes", "canViewClasses"},
	"/schoolcrm.v1.ClassService/CreateClass": {scopeBranch, "", "canCreateClasses"},
	"/schoolcrm.v1.ClassService/DeleteClass": {scopeResource, "classes", "canDeleteClasses"},

	// Branch methods are scoped inside BranchServer (they need the caller's
	// identity to filter / force ownership), except Get which is a plain
	// membership check.
	"/schoolcrm.v1.BranchService/ListBranches": {kind: scopeNone},
	"/schoolcrm.v1.BranchService/GetBranch":    {kind: scopeBranchID},
	"/schoolcrm.v1.BranchService/CreateBranch": {kind: scopeNone},
	"/schoolcrm.v1.BranchService/DeleteBranch": {kind: scopeNone},
}

// publicMethods need no token: liveness probes only.
var publicMethods = map[string]bool{
	"/schoolcrm.v1.HealthService/Check": true,
}

// UnaryAuthInterceptor authenticates every unary RPC with a Bearer JWT from
// the "authorization" metadata, then authorizes it against the caller's
// branch memberships and permission flags per methodPolicies.
func UnaryAuthInterceptor(cfg AuthConfig) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		if publicMethods[info.FullMethod] {
			return handler(ctx, req)
		}

		md, _ := metadata.FromIncomingContext(ctx)
		vals := md.Get("authorization")
		if len(vals) == 0 {
			return nil, status.Error(codes.Unauthenticated, "authorization metadata required")
		}
		parts := strings.SplitN(vals[0], " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			return nil, status.Error(codes.Unauthenticated, "invalid authorization format")
		}
		claims, err := middleware.ParseAccessToken(ctx, cfg.JWTSecret, strings.TrimSpace(parts[1]), cfg.Redis)
		if err != nil {
			return nil, status.Error(codes.Unauthenticated, err.Error())
		}
		caller := Caller{UserID: claims.UserID, Role: claims.Role}
		ctx = context.WithValue(ctx, callerCtxKey{}, caller)

		policy, ok := methodPolicies[info.FullMethod]
		if !ok {
			return nil, status.Error(codes.PermissionDenied, "method not permitted")
		}

		if policy.permission != "" && cfg.HasPermission != nil {
			allowed, perr := cfg.HasPermission(ctx, caller.UserID, policy.permission)
			if perr != nil {
				return nil, status.Error(codes.Unauthenticated, "user not found")
			}
			if !allowed {
				return nil, status.Error(codes.PermissionDenied, "insufficient permissions")
			}
		}

		var branchID string
		switch policy.kind {
		case scopeBranch:
			g, ok := req.(interface{ GetBranchId() string })
			if !ok || g.GetBranchId() == "" {
				return nil, status.Error(codes.InvalidArgument, "branch_id is required")
			}
			branchID = g.GetBranchId()
		case scopeBranchID, scopeResource:
			g, ok := req.(interface{ GetId() string })
			if !ok || g.GetId() == "" {
				return nil, status.Error(codes.InvalidArgument, "id is required")
			}
			if policy.kind == scopeBranchID {
				branchID = g.GetId()
				break
			}
			bid, found, rerr := cfg.Access.ResourceBranchID(ctx, policy.table, g.GetId())
			if rerr != nil {
				return nil, status.Error(codes.Internal, "failed to verify access")
			}
			if !found {
				return nil, status.Error(codes.NotFound, "not found")
			}
			branchID = bid
		}

		if branchID != "" {
			member, merr := cfg.Access.BelongsToBranch(ctx, caller.UserID, branchID)
			if merr != nil {
				return nil, status.Error(codes.Internal, "failed to verify access")
			}
			if !member {
				// Same answer as a missing row so foreign ids are not probeable.
				if policy.kind == scopeResource || policy.kind == scopeBranchID {
					return nil, status.Error(codes.NotFound, "not found")
				}
				return nil, status.Error(codes.PermissionDenied, "access denied: you do not belong to this branch")
			}
		}

		return handler(ctx, req)
	}
}
