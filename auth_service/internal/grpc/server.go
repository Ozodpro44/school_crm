// Package grpc implements the AuthService gRPC server.
// It satisfies the contract defined in protos/auth/v1/auth.proto.
//
// Because buf-generated code is not yet compiled into this module, we define
// the interface manually here and keep it in sync with the proto. When the
// protos module is published, replace the hand-rolled interface with the
// generated stubs.
package grpc

import (
	"context"
	"fmt"
	"net"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/school-crm/auth-service/internal/middleware"
	"github.com/school-crm/auth-service/internal/service"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ── Hand-rolled proto types (replace with buf-generated when protos published) ─

type TokenClaims struct {
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	BranchID  string    `json:"branch_id"`
	ExpiresAt time.Time `json:"expires_at"`
}

type AuthUser struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
	BranchID string `json:"branch_id"`
}

// ValidateTokenRequest / Response
type ValidateTokenRequest struct{ Token string }
type ValidateTokenResponse struct {
	Valid  bool
	Claims *TokenClaims
	Error  string
}

// GetUserByIDRequest / Response
type GetUserByIDRequest struct{ UserID string }
type GetUserByIDResponse struct{ User *AuthUser }

// ── gRPC server implementation ────────────────────────────────────────────────

type AuthGRPCServer struct {
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
	// Register self — when proto-generated stubs are available, replace with:
	// authv1.RegisterAuthServiceServer(s.grpc, s)
	return s
}

// ValidateToken parses and validates a JWT, returning its claims.
// Called by api_gateway on every inbound request.
func (s *AuthGRPCServer) ValidateToken(_ context.Context, req *ValidateTokenRequest) (*ValidateTokenResponse, error) {
	claims := &middleware.CustomClaims{}
	tok, err := jwt.ParseWithClaims(req.Token, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})

	if err != nil || !tok.Valid {
		return &ValidateTokenResponse{Valid: false, Error: "invalid or expired token"}, nil
	}

	exp := time.Time{}
	if claims.ExpiresAt != nil {
		exp = claims.ExpiresAt.Time
	}

	return &ValidateTokenResponse{
		Valid: true,
		Claims: &TokenClaims{
			UserID:    claims.UserID,
			Role:      claims.Role,
			BranchID:  claims.BranchID,
			ExpiresAt: exp,
		},
	}, nil
}

// GetUserByID fetches minimal user data — used by services that only have a user_id.
func (s *AuthGRPCServer) GetUserByID(ctx context.Context, req *GetUserByIDRequest) (*GetUserByIDResponse, error) {
	user, err := s.authSvc.GetByID(ctx, req.UserID)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "user not found: %v", err)
	}
	return &GetUserByIDResponse{
		User: &AuthUser{
			UserID:   user.ID,
			Email:    user.Email,
			FullName: user.FullName,
			Role:     user.Role,
			BranchID: user.BranchID,
		},
	}, nil
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
