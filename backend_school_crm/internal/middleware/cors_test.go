package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func corsReq(t *testing.T, method, origin string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CORSMiddleware(ParseCORSOrigins("https://app.example.com/, http://localhost:3000")))
	r.Any("/x", func(c *gin.Context) { c.Status(http.StatusOK) })
	req := httptest.NewRequest(method, "/x", nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestCORS_AllowedOrigin(t *testing.T) {
	w := corsReq(t, http.MethodGet, "https://app.example.com")
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Errorf("ACAO = %q", got)
	}
	if w.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Error("expected credentials header for allowed origin")
	}
}

func TestCORS_DisallowedOrigin(t *testing.T) {
	w := corsReq(t, http.MethodGet, "https://evil.example")
	if w.Header().Get("Access-Control-Allow-Origin") != "" || w.Header().Get("Access-Control-Allow-Credentials") != "" {
		t.Error("disallowed origin must not receive CORS grant headers")
	}
}

func TestCORS_NoOriginNoWildcard(t *testing.T) {
	w := corsReq(t, http.MethodGet, "")
	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Error("no Origin header must not yield ACAO")
	}
}

func TestCORS_Preflight(t *testing.T) {
	w := corsReq(t, http.MethodOptions, "http://localhost:3000")
	if w.Code != http.StatusNoContent {
		t.Errorf("preflight code = %d", w.Code)
	}
	if w.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Error("preflight missing ACAO for allowed origin")
	}
}
