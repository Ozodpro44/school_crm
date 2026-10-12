package server_test

import (
	"context"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	pb "github.com/school-crm/backend/internal/grpc/pb/schoolcrm/v1"
	grpcserver "github.com/school-crm/backend/internal/grpc/server"
	"github.com/school-crm/backend/internal/middleware"
)

const testSecret = "0123456789abcdef0123456789abcdef"

type fakeAccess struct {
	member      map[string]bool // "user|branch"
	resBranch   map[string]string
	permissions map[string]bool
}

func (f fakeAccess) BelongsToBranch(_ context.Context, u, b string) (bool, error) {
	return f.member[u+"|"+b], nil
}
func (f fakeAccess) ResourceBranchID(_ context.Context, table, id string) (string, bool, error) {
	b, ok := f.resBranch[table+"|"+id]
	return b, ok, nil
}

func newInterceptor(f fakeAccess) grpc.UnaryServerInterceptor {
	return grpcserver.UnaryAuthInterceptor(grpcserver.AuthConfig{
		JWTSecret: testSecret,
		Access:    f,
		HasPermission: func(_ context.Context, _, perm string) (bool, error) {
			return f.permissions[perm], nil
		},
	})
}

func token(t *testing.T, method jwt.SigningMethod, secret string, uid string, exp time.Duration) string {
	t.Helper()
	claims := middleware.CustomClaims{UserID: uid, Role: "admin"}
	claims.ExpiresAt = jwt.NewNumericDate(time.Now().Add(exp))
	var key interface{} = []byte(secret)
	if method == jwt.SigningMethodNone {
		key = jwt.UnsafeAllowNoneSignatureType
	}
	s, err := jwt.NewWithClaims(method, claims).SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func ctxWith(tok string) context.Context {
	if tok == "" {
		return context.Background()
	}
	return metadata.NewIncomingContext(context.Background(), metadata.Pairs("authorization", "Bearer "+tok))
}

func call(t *testing.T, ic grpc.UnaryServerInterceptor, ctx context.Context, method string, req interface{}) (codes.Code, bool) {
	t.Helper()
	called := false
	_, err := ic(ctx, req, &grpc.UnaryServerInfo{FullMethod: method}, func(ctx context.Context, _ interface{}) (interface{}, error) {
		called = true
		return nil, nil
	})
	return status.Code(err), called
}

func TestAuth_HealthIsPublic(t *testing.T) {
	code, called := call(t, newInterceptor(fakeAccess{}), ctxWith(""), "/schoolcrm.v1.HealthService/Check", &pb.HealthRequest{})
	if code != codes.OK || !called {
		t.Errorf("health should be public, got %v called=%v", code, called)
	}
}

func TestAuth_RejectsMissingAndBadTokens(t *testing.T) {
	ic := newInterceptor(fakeAccess{})
	m := "/schoolcrm.v1.StudentService/GetStudent"
	req := &pb.GetStudentRequest{Id: "s1"}
	cases := map[string]string{
		"missing":      "",
		"garbage":      "not-a-jwt",
		"wrong secret": token(t, jwt.SigningMethodHS256, "another-secret-another-secret-xx", "u1", time.Hour),
		"expired":      token(t, jwt.SigningMethodHS256, testSecret, "u1", -time.Hour),
		"alg none":     token(t, jwt.SigningMethodNone, "", "u1", time.Hour),
	}
	for name, tok := range cases {
		if code, called := call(t, ic, ctxWith(tok), m, req); code != codes.Unauthenticated || called {
			t.Errorf("%s: got %v called=%v, want Unauthenticated", name, code, called)
		}
	}
}

func TestAuth_UnknownMethodDenied(t *testing.T) {
	ic := newInterceptor(fakeAccess{})
	code, called := call(t, ic, ctxWith(token(t, jwt.SigningMethodHS256, testSecret, "u1", time.Hour)), "/schoolcrm.v1.NewService/Do", &pb.HealthRequest{})
	if code != codes.PermissionDenied || called {
		t.Errorf("got %v called=%v", code, called)
	}
}

func TestAuth_BranchScoping(t *testing.T) {
	f := fakeAccess{
		member:      map[string]bool{"u1|b1": true},
		permissions: map[string]bool{"canViewStudents": true},
	}
	ic := newInterceptor(f)
	ctx := ctxWith(token(t, jwt.SigningMethodHS256, testSecret, "u1", time.Hour))
	m := "/schoolcrm.v1.StudentService/ListStudents"

	if code, called := call(t, ic, ctx, m, &pb.ListStudentsRequest{BranchId: "b1"}); code != codes.OK || !called {
		t.Errorf("own branch: %v called=%v", code, called)
	}
	if code, called := call(t, ic, ctx, m, &pb.ListStudentsRequest{BranchId: "b2"}); code != codes.PermissionDenied || called {
		t.Errorf("foreign branch: %v called=%v", code, called)
	}
	if code, called := call(t, ic, ctx, m, &pb.ListStudentsRequest{}); code != codes.InvalidArgument || called {
		t.Errorf("empty branch: %v called=%v", code, called)
	}
}

func TestAuth_ResourceScoping(t *testing.T) {
	f := fakeAccess{
		member:      map[string]bool{"u1|b1": true},
		resBranch:   map[string]string{"students|mine": "b1", "students|theirs": "b2"},
		permissions: map[string]bool{"canViewStudents": true, "canDeleteStudents": true},
	}
	ic := newInterceptor(f)
	ctx := ctxWith(token(t, jwt.SigningMethodHS256, testSecret, "u1", time.Hour))

	if code, called := call(t, ic, ctx, "/schoolcrm.v1.StudentService/GetStudent", &pb.GetStudentRequest{Id: "mine"}); code != codes.OK || !called {
		t.Errorf("own row: %v called=%v", code, called)
	}
	for _, id := range []string{"theirs", "missing"} {
		if code, called := call(t, ic, ctx, "/schoolcrm.v1.StudentService/DeleteStudent", &pb.DeleteStudentRequest{Id: id}); code != codes.NotFound || called {
			t.Errorf("%s: %v called=%v, want NotFound", id, code, called)
		}
	}
}

func TestAuth_PermissionFlagEnforced(t *testing.T) {
	f := fakeAccess{
		member:      map[string]bool{"u1|b1": true},
		resBranch:   map[string]string{"students|mine": "b1"},
		permissions: map[string]bool{"canViewStudents": true}, // no delete
	}
	ic := newInterceptor(f)
	ctx := ctxWith(token(t, jwt.SigningMethodHS256, testSecret, "u1", time.Hour))
	if code, called := call(t, ic, ctx, "/schoolcrm.v1.StudentService/DeleteStudent", &pb.DeleteStudentRequest{Id: "mine"}); code != codes.PermissionDenied || called {
		t.Errorf("got %v called=%v", code, called)
	}
}

func TestAuth_GetBranchMembership(t *testing.T) {
	f := fakeAccess{member: map[string]bool{"u1|b1": true}}
	ic := newInterceptor(f)
	ctx := ctxWith(token(t, jwt.SigningMethodHS256, testSecret, "u1", time.Hour))
	m := "/schoolcrm.v1.BranchService/GetBranch"
	if code, _ := call(t, ic, ctx, m, &pb.GetBranchRequest{Id: "b1"}); code != codes.OK {
		t.Errorf("own branch: %v", code)
	}
	if code, called := call(t, ic, ctx, m, &pb.GetBranchRequest{Id: "b2"}); code != codes.NotFound || called {
		t.Errorf("foreign branch: %v called=%v", code, called)
	}
}

func TestBranchServer_RequiresCaller(t *testing.T) {
	srv := grpcserver.NewBranchServer(nil)
	if _, err := srv.ListBranches(context.Background(), &pb.ListBranchesRequest{}); status.Code(err) != codes.Unauthenticated {
		t.Errorf("ListBranches without caller: %v", err)
	}
	if _, err := srv.CreateBranch(context.Background(), &pb.CreateBranchRequest{Name: "x"}); status.Code(err) != codes.Unauthenticated {
		t.Errorf("CreateBranch without caller: %v", err)
	}
	if _, err := srv.DeleteBranch(context.Background(), &pb.DeleteBranchRequest{Id: "b1"}); status.Code(err) != codes.Unauthenticated {
		t.Errorf("DeleteBranch without caller: %v", err)
	}
}
