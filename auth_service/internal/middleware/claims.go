package middleware

import "github.com/golang-jwt/jwt/v5"

// CustomClaims is the JWT payload used by both auth_service (issuer)
// and api_gateway (verifier). Keep in sync with monolith middleware.
type CustomClaims struct {
	UserID   string `json:"user_id"`
	Role     string `json:"role"`
	BranchID string `json:"branch_id,omitempty"`
	jwt.RegisteredClaims
}
