// Black-box handler tests that exercise input-validation paths (bad JSON,
// missing auth) without touching the database.  All tests are safe to run in
// -short mode.
package handlers_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/handlers"
)

// ---- createBranch — bad JSON ----
// Branch POST has no PermissionChecker, so the handler reaches JSON-bind first.

func TestCreateBranch_BadJSON(t *testing.T) {
	r := gin.New()
	api := r.Group("/api/v1")
	handlers.RegisterBranchRoutes(api, nil, nil, nil)

	body := bytes.NewBufferString("{not valid json}")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/branches", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for bad JSON, got %d", w.Code)
	}
}

// ---- createClass — missing auth (PermissionChecker fires before JSON bind) ----

func TestCreateClass_NoAuth(t *testing.T) {
	r := gin.New()
	api := r.Group("/api/v1")
	handlers.RegisterClassRoutes(api, nil, nil, nil)

	body := bytes.NewBufferString(`{"name":"Test Class"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/classes", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// PermissionChecker runs first — no userID in context → 401.
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 when no auth, got %d", w.Code)
	}
}

// ---- createPayment — missing auth ----

func TestCreatePayment_NoAuth(t *testing.T) {
	// Wrap the payment route without any auth middleware; userID is absent from
	// the gin context so the handler must return 401.
	r := gin.New()
	api := r.Group("/api/v1")
	handlers.RegisterPaymentRoutes(api, nil, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/payments", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 when no user_id in context, got %d", w.Code)
	}
}

// ---- createUser — missing auth ----

func TestCreateUser_NoAuth(t *testing.T) {
	r := gin.New()
	api := r.Group("/api/v1")
	handlers.RegisterUserRoutes(api, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 when no user_id in context, got %d", w.Code)
	}
}

// ---- listPayments — missing auth (PermissionChecker fires before handler) ----

func TestListPayments_NoAuth(t *testing.T) {
	r := gin.New()
	api := r.Group("/api/v1")
	handlers.RegisterPaymentRoutes(api, nil, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/payments", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// PermissionChecker requires a userID in context — none present → 401.
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 when no auth, got %d", w.Code)
	}
}
