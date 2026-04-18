package middleware_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
)

// TestRequestTimeout_ContextHasDeadline verifies that the request context
// carries a deadline after passing through RequestTimeout.
func TestRequestTimeout_ContextHasDeadline(t *testing.T) {
	var deadlineSet bool

	r := gin.New()
	r.Use(middleware.RequestTimeout(5 * time.Second))
	r.GET("/", func(c *gin.Context) {
		_, deadlineSet = c.Request.Context().Deadline()
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !deadlineSet {
		t.Error("expected request context to have a deadline after RequestTimeout middleware")
	}
}

// TestRequestTimeout_DeadlineIsInFuture verifies that the deadline is
// approximately the configured timeout from now (not in the past).
func TestRequestTimeout_DeadlineIsInFuture(t *testing.T) {
	const timeout = 10 * time.Second
	var deadline time.Time

	r := gin.New()
	r.Use(middleware.RequestTimeout(timeout))
	r.GET("/", func(c *gin.Context) {
		deadline, _ = c.Request.Context().Deadline()
		c.Status(http.StatusOK)
	})

	before := time.Now()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(httptest.NewRecorder(), req)

	if deadline.IsZero() {
		t.Fatal("deadline should not be zero")
	}
	if deadline.Before(before) {
		t.Errorf("deadline %v is in the past (before=%v)", deadline, before)
	}
	// Deadline must be <= before + timeout + small slack.
	slack := 500 * time.Millisecond
	upperBound := before.Add(timeout).Add(slack)
	if deadline.After(upperBound) {
		t.Errorf("deadline %v is too far in the future (upper=%v)", deadline, upperBound)
	}
}

// TestRequestTimeout_ShortTimeoutCancel verifies that a very short timeout
// causes the context to be cancelled before a slow handler could finish.
func TestRequestTimeout_ShortTimeoutCancel(t *testing.T) {
	var ctxErr error

	r := gin.New()
	r.Use(middleware.RequestTimeout(50 * time.Millisecond))
	r.GET("/", func(c *gin.Context) {
		ctx := c.Request.Context()
		// Wait for cancellation or give up after 1s.
		select {
		case <-ctx.Done():
			ctxErr = ctx.Err()
		case <-time.After(time.Second):
		}
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(httptest.NewRecorder(), req)

	if ctxErr == nil {
		t.Error("expected context to be cancelled by RequestTimeout")
	}
	if ctxErr != context.DeadlineExceeded {
		t.Errorf("expected DeadlineExceeded, got %v", ctxErr)
	}
}
