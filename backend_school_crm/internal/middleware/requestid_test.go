package middleware_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
)

func TestRequestID_GeneratesUUID(t *testing.T) {
	var capturedID string

	r := gin.New()
	r.Use(middleware.RequestID())
	r.GET("/", func(c *gin.Context) {
		v, _ := c.Get("request_id")
		capturedID, _ = v.(string)
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if capturedID == "" {
		t.Error("expected a non-empty request_id in gin context")
	}
	if w.Header().Get("X-Request-ID") != capturedID {
		t.Errorf("X-Request-ID header = %q, want %q", w.Header().Get("X-Request-ID"), capturedID)
	}
}

func TestRequestID_HonoursExistingHeader(t *testing.T) {
	const existingID = "my-upstream-request-id"
	var capturedID string

	r := gin.New()
	r.Use(middleware.RequestID())
	r.GET("/", func(c *gin.Context) {
		v, _ := c.Get("request_id")
		capturedID, _ = v.(string)
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Request-ID", existingID)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if capturedID != existingID {
		t.Errorf("request_id = %q, want %q (should re-use upstream ID)", capturedID, existingID)
	}
}

func TestRequestID_TwoRequestsGetDifferentIDs(t *testing.T) {
	ids := make([]string, 0, 2)

	r := gin.New()
	r.Use(middleware.RequestID())
	r.GET("/", func(c *gin.Context) {
		v, _ := c.Get("request_id")
		ids = append(ids, v.(string))
		c.Status(http.StatusOK)
	})

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		r.ServeHTTP(httptest.NewRecorder(), req)
	}

	if len(ids) != 2 {
		t.Fatalf("expected 2 IDs, got %d", len(ids))
	}
	if ids[0] == ids[1] {
		t.Errorf("two requests should not get the same request_id (%q)", ids[0])
	}
}

func TestGetRequestID_FromContext(t *testing.T) {
	ctx := context.WithValue(context.Background(), middleware.RequestIDKey, "test-req-id")
	got := middleware.GetRequestID(ctx)
	if got != "test-req-id" {
		t.Errorf("GetRequestID = %q, want %q", got, "test-req-id")
	}
}

func TestGetRequestID_MissingFromContext(t *testing.T) {
	got := middleware.GetRequestID(context.Background())
	if got != "" {
		t.Errorf("GetRequestID = %q, want empty string for missing key", got)
	}
}
