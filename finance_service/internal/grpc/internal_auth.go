package grpc

import (
	"context"
	"crypto/subtle"
	"log"
	"os"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// internalTokenHeader carries the shared secret between internal services.
const internalTokenHeader = "x-internal-token"

// internalAuthInterceptor requires callers to present INTERNAL_GRPC_TOKEN in
// the "x-internal-token" metadata (constant-time compare). These gRPC servers
// are internal-only; without this any network peer could call them.
// If the token is unset: in production the interceptor fails closed (every
// call is rejected); elsewhere it allows calls and logs a warning once.
func internalAuthInterceptor() grpc.UnaryServerInterceptor {
	token := os.Getenv("INTERNAL_GRPC_TOKEN")
	prod := os.Getenv("ENVIRONMENT") == "production"
	if token == "" {
		if prod {
			log.Println("ERROR: INTERNAL_GRPC_TOKEN is required in production; all gRPC calls will be rejected")
		} else {
			log.Println("WARNING: INTERNAL_GRPC_TOKEN not set; gRPC server is unauthenticated (non-production only)")
		}
	}
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		if token == "" {
			if prod {
				return nil, status.Error(codes.Unauthenticated, "internal gRPC token not configured")
			}
			return handler(ctx, req)
		}
		md, _ := metadata.FromIncomingContext(ctx)
		vals := md.Get(internalTokenHeader)
		if len(vals) != 1 || subtle.ConstantTimeCompare([]byte(vals[0]), []byte(token)) != 1 {
			return nil, status.Error(codes.Unauthenticated, "invalid internal token")
		}
		return handler(ctx, req)
	}
}
