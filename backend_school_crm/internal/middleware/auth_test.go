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

func init() {
	gin.SetMode(gin.TestMode)
}

// makeJWT creates a signed JWT for test purposes.
func makeJWT(secret, userID string, expiry time.Duration) string {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(expiry).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		panic("makeJWT: " + err.Error())
	}
	return signed
}

func TestAuthMiddleware_MissingHeader(t *testing.T) {
	r := gin.New()
	r.Use(middleware.AuthMiddleware("supersecretkey32byteslong!!!!!!!"))
	r.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_MalformedHeader(t *testing.T) {
	r := gin.New()
	r.Use(middleware.AuthMiddleware("supersecretkey32byteslong!!!!!!!"))
	r.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "InvalidTokenWithoutBearer")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_InvalidToken(t *testing.T) {
	r := gin.New()
	r.Use(middleware.AuthMiddleware("supersecretkey32byteslong!!!!!!!"))
	r.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer thisisnotavalidjwt")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_ExpiredToken(t *testing.T) {
	secret := "supersecretkey32byteslong!!!!!!!"
	token := makeJWT(secret, "user-123", -time.Hour) // expired 1h ago

	r := gin.New()
	r.Use(middleware.AuthMiddleware(secret))
	r.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_ValidToken(t *testing.T) {
	secret := "supersecretkey32byteslong!!!!!!!"
	token := makeJWT(secret, "user-abc", time.Hour)

	var capturedUserID string
	r := gin.New()
	r.Use(middleware.AuthMiddleware(secret))
	r.GET("/", func(c *gin.Context) {
		id, err := middleware.GetUserID(c)
		if err != nil {
			t.Errorf("GetUserID: %v", err)
		}
		capturedUserID = id
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if capturedUserID != "user-abc" {
		t.Errorf("user_id = %q, want %q", capturedUserID, "user-abc")
	}
}

func TestAuthMiddleware_BranchIDPropagated(t *testing.T) {
	secret := "supersecretkey32byteslong!!!!!!!"
	token := makeJWT(secret, "user-xyz", time.Hour)

	var capturedBranch string
	r := gin.New()
	r.Use(middleware.AuthMiddleware(secret))
	r.GET("/", func(c *gin.Context) {
		v, _ := c.Get("branch_id")
		capturedBranch, _ = v.(string)
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Branch-ID", "branch-99")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if capturedBranch != "branch-99" {
		t.Errorf("branch_id = %q, want %q", capturedBranch, "branch-99")
	}
}

func TestGetUserID_NotInContext(t *testing.T) {
	r := gin.New()
	r.GET("/", func(c *gin.Context) {
		_, err := middleware.GetUserID(c)
		if err == nil {
			t.Error("expected error when userID not in context")
		}
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
}

func TestAuthMiddleware_WrongSecret(t *testing.T) {
	token := makeJWT("correct-secret-32bytes-long!!!!!", "u1", time.Hour)

	r := gin.New()
	r.Use(middleware.AuthMiddleware("wrong-secret-32bytes-long!!!!!!!"))
	r.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 with wrong secret, got %d", w.Code)
	}
}
