package grpc

import (
	"context"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func callInterceptor(t *testing.T, md metadata.MD) error {
	t.Helper()
	ctx := metadata.NewIncomingContext(context.Background(), md)
	_, err := internalAuthInterceptor()(ctx, nil, &grpc.UnaryServerInfo{}, func(context.Context, interface{}) (interface{}, error) {
		return nil, nil
	})
	return err
}

func TestInternalAuthInterceptor(t *testing.T) {
	t.Setenv("INTERNAL_GRPC_TOKEN", "s3cret")
	if status.Code(callInterceptor(t, metadata.Pairs())) != codes.Unauthenticated {
		t.Error("missing token must be rejected")
	}
	if status.Code(callInterceptor(t, metadata.Pairs("x-internal-token", "wrong"))) != codes.Unauthenticated {
		t.Error("wrong token must be rejected")
	}
	if err := callInterceptor(t, metadata.Pairs("x-internal-token", "s3cret")); err != nil {
		t.Errorf("valid token rejected: %v", err)
	}
}

func TestInternalAuthInterceptorFailsClosedInProduction(t *testing.T) {
	t.Setenv("INTERNAL_GRPC_TOKEN", "")
	t.Setenv("ENVIRONMENT", "production")
	if status.Code(callInterceptor(t, metadata.Pairs())) != codes.Unauthenticated {
		t.Error("production without token must reject")
	}
}
