package config

import (
	"fmt"
	"strings"
)

// PlaceholderJWTSecret is the example value shipped in docs/templates; it must
// never be used in production.
const PlaceholderJWTSecret = "change_me_in_production_min_32_chars!!"

// MinJWTSecretLen is the minimum accepted JWT secret length in production.
const MinJWTSecretLen = 32

// Validate checks the configuration for unsafe values. In production
// (ENVIRONMENT=production) the JWT secret must not be the placeholder and must
// be at least MinJWTSecretLen characters. Non-fatal issues are returned as
// warnings (e.g. LOGS_TOKEN unset).
func (c *Config) Validate() (warnings []string, err error) {
	if c.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is required")
	}
	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is required")
	}
	if strings.EqualFold(c.Environment, "production") {
		if c.JWTSecret == PlaceholderJWTSecret {
			return nil, fmt.Errorf("JWT_SECRET is the placeholder value; set a unique secret in production")
		}
		if len(c.JWTSecret) < MinJWTSecretLen {
			return nil, fmt.Errorf("JWT_SECRET must be at least %d characters in production", MinJWTSecretLen)
		}
	} else if c.JWTSecret == PlaceholderJWTSecret || len(c.JWTSecret) < MinJWTSecretLen {
		warnings = append(warnings, "JWT_SECRET is the placeholder or shorter than 32 chars (rejected when ENVIRONMENT=production)")
	}
	if c.LogsToken == "" {
		warnings = append(warnings, "LOGS_TOKEN is not set; the log ingestion endpoint will reject requests")
	}
	return warnings, nil
}

type Config struct {
	Port         string
	DatabaseURL  string
	JWTSecret    string
	Environment  string
	RedisURL     string
	ResendAPIKey string
	ResendFrom   string
	LogsToken    string // Bearer token for ingesting logs
	SentryDSN   string // Optional — Sentry error monitoring
}
