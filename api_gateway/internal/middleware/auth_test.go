package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const gwTestSecret = "supersecretkey32byteslong!!!!!!!"

func gwCall(t *testing.T, claims jwt.MapClaims) int {
	t.Helper()
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(gwTestSecret))
	if err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(JWTAuth(gwTestSecret))
	r.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestJWTAuthRejectsDeveloperTokens(t *testing.T) {
	exp := time.Now().Add(time.Hour).Unix()
	if got := gwCall(t, jwt.MapClaims{"developer_id": "d", "type": "developer", "role": "admin", "exp": exp}); got != http.StatusUnauthorized {
		t.Errorf("developer token: want 401, got %d", got)
	}
	if got := gwCall(t, jwt.MapClaims{"user_id": "u", "type": "developer", "exp": exp}); got != http.StatusUnauthorized {
		t.Errorf("type=developer: want 401, got %d", got)
	}
	if got := gwCall(t, jwt.MapClaims{"user_id": "u", "role": "admin", "exp": exp}); got != http.StatusOK {
		t.Errorf("user token: want 200, got %d", got)
	}
}
