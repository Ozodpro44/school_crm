package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/school-crm/backend/internal/middleware"
)

const testSecret = "supersecretkey32byteslong!!!!!!!"

func signClaims(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func callAuth(t *testing.T, token string) int {
	t.Helper()
	r := gin.New()
	r.Use(middleware.AuthMiddleware(testSecret, nil))
	r.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestAuthMiddleware_RejectsDeveloperToken(t *testing.T) {
	exp := time.Now().Add(time.Hour).Unix()
	dev := signClaims(t, jwt.MapClaims{"developer_id": "d1", "role": "admin", "type": "developer", "exp": exp})
	if got := callAuth(t, dev); got != http.StatusUnauthorized {
		t.Errorf("developer token without user_id: want 401, got %d", got)
	}
	devWithUser := signClaims(t, jwt.MapClaims{"user_id": "u1", "role": "admin", "type": "developer", "exp": exp})
	if got := callAuth(t, devWithUser); got != http.StatusUnauthorized {
		t.Errorf("type=developer token: want 401, got %d", got)
	}
	user := signClaims(t, jwt.MapClaims{"user_id": "u1", "role": "admin", "exp": exp})
	if got := callAuth(t, user); got != http.StatusOK {
		t.Errorf("normal user token: want 200, got %d", got)
	}
}
