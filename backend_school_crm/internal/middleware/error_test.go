package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
)

// TestErrorHandling_NoErrors verifies that the middleware is transparent when
// no errors are attached to the context.
func TestErrorHandling_NoErrors(t *testing.T) {
	r := gin.New()
	r.Use(middleware.ErrorHandling())
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// TestErrorHandling_BindError verifies that a gin.ErrorTypeBind error
// is returned as a 400 Bad Request.
func TestErrorHandling_BindError(t *testing.T) {
	r := gin.New()
	r.Use(middleware.ErrorHandling())
	r.GET("/", func(c *gin.Context) {
		_ = c.Error(&gin.Error{
			Err:  http.ErrNoCookie,
			Type: gin.ErrorTypeBind,
		})
		// Do NOT write a response — let the middleware handle it.
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for ErrorTypeBind, got %d", w.Code)
	}
}

// TestErrorHandling_PublicError verifies that a gin.ErrorTypePublic error
// is returned as a 500 Internal Server Error.
func TestErrorHandling_PublicError(t *testing.T) {
	r := gin.New()
	r.Use(middleware.ErrorHandling())
	r.GET("/", func(c *gin.Context) {
		_ = c.Error(&gin.Error{
			Err:  http.ErrAbortHandler,
			Type: gin.ErrorTypePublic,
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 for ErrorTypePublic, got %d", w.Code)
	}
}

// TestErrorHandling_PrivateErrorIgnored verifies that gin.ErrorTypePrivate
// (internal errors) are not surfaced to the client.
func TestErrorHandling_PrivateErrorIgnored(t *testing.T) {
	r := gin.New()
	r.Use(middleware.ErrorHandling())
	r.GET("/", func(c *gin.Context) {
		_ = c.Error(&gin.Error{
			Err:  http.ErrNoCookie,
			Type: gin.ErrorTypePrivate,
		})
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// Private errors don't trigger 400 or 500 — handler's own status wins.
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for private error, got %d", w.Code)
	}
}
