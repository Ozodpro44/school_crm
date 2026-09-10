// Package grpc implements the AuthService gRPC server defined in
// protos/auth/v1/auth.proto. The generated stubs are now compiled in (see
// protos/go.mod) and actually registered — previously this package defined
// a parallel hand-rolled interface that was never registered with the
// underlying grpc.Server, so the server accepted TCP connections but
// answered every real RPC with Unimplemented.
package grpc

import (
	"context"
	"fmt"
	"net"
	"time"

	authv1 "github.com/school-crm/protos/auth/v1"

	"github.com/golang-jwt/jwt/v5"
	"github.com/school-crm/auth-service/internal/middleware"
	"github.com/school-crm/auth-service/internal/service"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// AuthGRPCServer implements authv1.AuthServiceServer. RefreshToken is
// intentionally not implemented — AuthService has no refresh-token concept
// today (only a single 24h access token), so RefreshToken falls through to
// the embedded UnimplementedAuthServiceServer's Unimplemented response
// rather than faking a semantics that doesn't exist yet.
type AuthGRPCServer struct {
	authv1.UnimplementedAuthServiceServer
	authSvc   *service.AuthService
	jwtSecret string
	grpc      *grpc.Server
}

func NewAuthGRPCServer(authSvc *service.AuthService, jwtSecret string) *AuthGRPCServer {
	s := &AuthGRPCServer{
		authSvc:   authSvc,
		jwtSecret: jwtSecret,
		grpc:      grpc.NewServer(),
	}
	authv1.RegisterAuthServiceServer(s.grpc, s)
	return s
}

// ValidateToken parses and validates a JWT, returning its claims.
// Called by api_gateway on every inbound request.
func (s *AuthGRPCServer) ValidateToken(_ context.Context, req *authv1.ValidateTokenRequest) (*authv1.ValidateTokenResponse, error) {
	claims := &middleware.CustomClaims{}
	tok, err := jwt.ParseWithClaims(req.GetToken(), claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})

	if err != nil || !tok.Valid {
		return &authv1.ValidateTokenResponse{Valid: false, Error: "invalid or expired token"}, nil
	}

	var exp *timestamppb.Timestamp
	if claims.ExpiresAt != nil {
		exp = timestamppb.New(claims.ExpiresAt.Time)
	}

	return &authv1.ValidateTokenResponse{
		Valid: true,
		Claims: &authv1.TokenClaims{
			UserId:    claims.UserID,
			Role:      claims.Role,
			BranchId:  claims.BranchID,
			ExpiresAt: exp,
		},
	}, nil
}

// GetUserByID fetches minimal user data — used by services that only have a user_id.
func (s *AuthGRPCServer) GetUserByID(ctx context.Context, req *authv1.GetUserByIDRequest) (*authv1.GetUserByIDResponse, error) {
	user, err := s.authSvc.GetByID(ctx, req.GetUserId())
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "user not found: %v", err)
	}
	return &authv1.GetUserByIDResponse{
		User: &authv1.AuthUser{
			UserId:   user.ID,
			Email:    user.Email,
			FullName: user.FullName,
			Role:     user.Role,
			BranchId: user.BranchID,
		},
	}, nil
}

// Login mirrors handler.AuthHandler.Login (the REST path) so both entry
// points issue tokens the same way.
func (s *AuthGRPCServer) Login(ctx context.Context, req *authv1.LoginRequest) (*authv1.LoginResponse, error) {
	user, err := s.authSvc.Login(ctx, req.GetEmail(), req.GetPassword())
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "%v", err)
	}
	tok, err := s.issueToken(user)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate token: %v", err)
	}
	return &authv1.LoginResponse{
		AccessToken: tok,
		User: &authv1.AuthUser{
			UserId:   user.ID,
			Email:    user.Email,
			FullName: user.FullName,
			Role:     user.Role,
			BranchId: user.BranchID,
		},
	}, nil
}

// Logout mirrors handler.AuthHandler.Logout — best-effort blacklist, matching
// the REST path's behavior (a Redis outage doesn't fail the logout request).
func (s *AuthGRPCServer) Logout(ctx context.Context, req *authv1.LogoutRequest) (*authv1.LogoutResponse, error) {
	if tok := req.GetAccessToken(); tok != "" {
		_ = s.authSvc.BlacklistToken(ctx, tok, 25*time.Hour)
	}
	return &authv1.LogoutResponse{}, nil
}

// issueToken mirrors handler.AuthHandler.issueToken — kept in sync manually
// since the gRPC and REST entry points are separate handler packages.
func (s *AuthGRPCServer) issueToken(user *service.User) (string, error) {
	claims := &middleware.CustomClaims{
		UserID:   user.ID,
		Role:     user.Role,
		BranchID: user.BranchID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString([]byte(s.jwtSecret))
}

// Listen starts the gRPC server on the given address (e.g. ":50051").
func (s *AuthGRPCServer) Listen(addr string) error {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("grpc listen %s: %w", addr, err)
	}
	return s.grpc.Serve(lis)
}

// GracefulStop drains in-flight RPCs and stops the server.
func (s *AuthGRPCServer) GracefulStop() { s.grpc.GracefulStop() }
