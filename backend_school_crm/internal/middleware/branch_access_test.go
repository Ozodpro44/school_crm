package middleware_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
)

func TestInjectAndGetBranchCtxFromContext(t *testing.T) {
	want := middleware.BranchCtx{BranchID: "branch-42", UserID: "user-99"}
	ctx := middleware.InjectBranchCtx(context.Background(), want)

	got, ok := middleware.GetBranchCtxFromContext(ctx)
	if !ok {
		t.Fatal("GetBranchCtxFromContext: expected ok=true")
	}
	if got.BranchID != want.BranchID {
		t.Errorf("BranchID = %q, want %q", got.BranchID, want.BranchID)
	}
	if got.UserID != want.UserID {
		t.Errorf("UserID = %q, want %q", got.UserID, want.UserID)
	}
}

func TestGetBranchCtxFromContext_Missing(t *testing.T) {
	_, ok := middleware.GetBranchCtxFromContext(context.Background())
	if ok {
		t.Error("expected ok=false for empty context")
	}
}

func TestGetBranchCtx_FromGin(t *testing.T) {
	var gotBranch middleware.BranchCtx
	var gotOK bool

	r := gin.New()
	r.GET("/", func(c *gin.Context) {
		gotBranch, gotOK = middleware.GetBranchCtx(c)
		c.Status(http.StatusOK)
	})

	// Inject manually into gin context to simulate TenantBranchMiddleware.
	r2 := gin.New()
	r2.GET("/", func(c *gin.Context) {
		bc := middleware.BranchCtx{BranchID: "b-1", UserID: "u-1"}
		c.Set("branch_ctx", bc)
		gotBranch, gotOK = middleware.GetBranchCtx(c)
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	r2.ServeHTTP(w, req)

	if !gotOK {
		t.Fatal("GetBranchCtx: expected ok=true after Set")
	}
	if gotBranch.BranchID != "b-1" || gotBranch.UserID != "u-1" {
		t.Errorf("BranchCtx = %+v, want {b-1 u-1}", gotBranch)
	}

	// Missing case.
	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if gotOK {
		t.Error("GetBranchCtx: expected ok=false when not set")
	}
}

func TestInjectBranchCtx_DoesNotMutateParent(t *testing.T) {
	parent := context.Background()
	child := middleware.InjectBranchCtx(parent, middleware.BranchCtx{BranchID: "x"})

	_, ok := middleware.GetBranchCtxFromContext(parent)
	if ok {
		t.Error("InjectBranchCtx should not mutate parent context")
	}
	_, ok = middleware.GetBranchCtxFromContext(child)
	if !ok {
		t.Error("child context should have BranchCtx")
	}
}
