package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/handlers"
	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/testhelpers"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// newAuthRouter builds a minimal gin router with login + register routes wired up.
func newAuthRouter(userSvc *service.UserService, subSvc *service.SubscriptionService) *gin.Engine {
	r := gin.New()
	r.POST("/login", handlers.Login(userSvc, "test-secret-key-that-is-long-enough"))
	r.POST("/register", handlers.Register(userSvc, subSvc, "test-secret-key-that-is-long-enough"))
	return r
}

// --- Login handler ---

func TestLoginHandler_BadJSON(t *testing.T) {
	// No DB needed — handler returns 400 before touching the service.
	r := gin.New()
	r.POST("/login", handlers.Login(nil, "secret"))

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewBufferString("{bad json"))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for bad JSON, got %d", w.Code)
	}
}

func TestLoginHandler_Success(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}
	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	userSvc := service.NewUserService(database)
	subSvc := service.NewSubscriptionService(database)
	r := newAuthRouter(userSvc, subSvc)

	// Pre-register a user.
	_, err := userSvc.Register(t.Context(), &service.RegisterRequest{
		Email:    "loginhandler@test.example",
		Password: "mypassword",
		FullName: "Login Handler Test",
		Role:     "admin",
	})
	if err != nil {
		t.Fatalf("pre-register: %v", err)
	}

	body, _ := json.Marshal(map[string]string{
		"email":    "loginhandler@test.example",
		"password": "mypassword",
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for valid login, got %d body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if _, ok := resp["token"]; !ok {
		t.Error("response should contain a token field")
	}
}

func TestLoginHandler_WrongPassword(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}
	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	userSvc := service.NewUserService(database)
	subSvc := service.NewSubscriptionService(database)
	r := newAuthRouter(userSvc, subSvc)

	_, err := userSvc.Register(t.Context(), &service.RegisterRequest{
		Email:    "wrongpw@test.example",
		Password: "rightpassword",
		FullName: "Wrong PW Test",
		Role:     "admin",
	})
	if err != nil {
		t.Fatalf("pre-register: %v", err)
	}

	body, _ := json.Marshal(map[string]string{
		"email":    "wrongpw@test.example",
		"password": "wrongpassword",
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for wrong password, got %d", w.Code)
	}
}

// --- Register handler ---

func TestRegisterHandler_BadJSON(t *testing.T) {
	r := gin.New()
	r.POST("/register", handlers.Register(nil, nil, "secret"))

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewBufferString("not json"))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for bad JSON, got %d", w.Code)
	}
}

func TestRegisterHandler_NonAdminForbidden(t *testing.T) {
	// No DB needed — handler returns 403 before touching the service.
	r := gin.New()
	r.POST("/register", handlers.Register(nil, nil, "secret"))

	body, _ := json.Marshal(map[string]string{
		"email":    "teacher@test.example",
		"password": "pass123",
		"fullName": "Test Teacher",
		"role":     "teacher",
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for non-admin role, got %d", w.Code)
	}
}

func TestRegisterHandler_Success(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}
	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	userSvc := service.NewUserService(database)
	subSvc := service.NewSubscriptionService(database)
	r := newAuthRouter(userSvc, subSvc)

	body, _ := json.Marshal(map[string]string{
		"email":    "newadmin@test.example",
		"password": "adminpass123",
		"fullName": "New Admin",
		"role":     "admin",
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected 201 for successful register, got %d body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if _, ok := resp["token"]; !ok {
		t.Error("register response should contain a token field")
	}
}

func TestRegisterHandler_DuplicateEmail(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}
	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	userSvc := service.NewUserService(database)
	subSvc := service.NewSubscriptionService(database)
	r := newAuthRouter(userSvc, subSvc)

	payload := map[string]string{
		"email":    "dup-handler@test.example",
		"password": "pass123",
		"fullName": "Dup Handler",
		"role":     "admin",
	}

	// First registration — should succeed.
	body, _ := json.Marshal(payload)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("first register failed: %d %s", w.Code, w.Body.String())
	}

	// Second registration with same email — should fail.
	body, _ = json.Marshal(payload)
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code == http.StatusCreated {
		t.Error("expected error for duplicate email registration")
	}
}
