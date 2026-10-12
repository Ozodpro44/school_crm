package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ParseCORSOrigins splits a comma-separated origin list (the CORS_ORIGINS env
// var), trimming whitespace and trailing slashes and dropping empty entries.
func ParseCORSOrigins(csv string) []string {
	var out []string
	for _, o := range strings.Split(csv, ",") {
		o = strings.TrimRight(strings.TrimSpace(o), "/")
		if o != "" {
			out = append(out, o)
		}
	}
	return out
}

// CORSMiddleware only echoes the request Origin back when it is in the
// allowlist. Reflecting arbitrary origins together with
// Access-Control-Allow-Credentials would let any website make authenticated
// requests on behalf of a logged-in user.
func CORSMiddleware(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = true
	}
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Add("Vary", "Origin")
		if origin := c.Request.Header.Get("Origin"); origin != "" && allowed[origin] {
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Credentials", "true")
		}
		h.Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Branch-ID")
		h.Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")
		h.Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
		h.Set("Pragma", "no-cache")
		h.Set("Expires", "0")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
