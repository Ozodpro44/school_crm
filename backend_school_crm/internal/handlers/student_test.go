package handlers_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/handlers"
	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/testhelpers"
)

// newStudentRouter builds a minimal Gin router for student endpoints without
// auth/permission middleware so we can test handler logic in isolation.
func newStudentRouter(studentSvc *service.StudentService) *gin.Engine {
	r := gin.New()
	api := r.Group("/api/v1")
	handlers.RegisterStudentRoutes(api, studentSvc, nil, nil, nil)
	return r
}

func TestGetStudent_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}
	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	subSvc := service.NewSubscriptionService(database)
	studentSvc := service.NewStudentService(database, subSvc)
	r := newStudentRouter(studentSvc)

	// Create a student directly via service.
	student, err := studentSvc.Create(t.Context(), &service.CreateStudentRequest{
		FullName:       "Handler Test Student",
		MonthlyPayment: 400000,
		Status:         "active",
	})
	if err != nil {
		t.Fatalf("Create student: %v", err)
	}

	// Fetch via handler.
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/students/"+student.ID, nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestGetStudent_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}
	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	studentSvc := service.NewStudentService(database, nil)
	r := newStudentRouter(studentSvc)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/students/00000000-0000-0000-0000-000000000000", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestCreateStudent_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}
	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	subSvc := service.NewSubscriptionService(database)
	studentSvc := service.NewStudentService(database, subSvc)
	r := newStudentRouter(studentSvc)

	body := bytes.NewBufferString(`{"full_name":"New Student","monthly_payment":300000,"status":"active"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/students", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d body=%s", w.Code, w.Body.String())
	}
}
