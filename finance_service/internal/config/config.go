package config

import (
	"os"
	"strings"
)

type Config struct {
	Port        string
	GRPCPort    string
	DatabaseURL string
	// DatabaseReadURL is the read-replica DSN (P5.2).
	// When empty, both reads and writes use DatabaseURL (single-node mode).
	DatabaseReadURL string
	JWTSecret       string
	Environment     string
	// CORSOrigins is the allowlist of frontend origins permitted to call
	// this API directly. Set via CORS_ORIGINS (comma-separated) in
	// production — the default only covers local dev.
	CORSOrigins []string
}

func Load() *Config {
	return &Config{
		Port:            getEnv("PORT", "8087"),
		GRPCPort:        getEnv("GRPC_PORT", "50057"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		DatabaseReadURL: os.Getenv("DATABASE_READ_URL"),
		JWTSecret:       os.Getenv("JWT_SECRET"),
		Environment:     getEnv("ENVIRONMENT", "development"),
		CORSOrigins:     parseCSV(getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")),
	}
}

func (c *Config) Validate() []string {
	var errs []string
	if c.DatabaseURL == "" {
		errs = append(errs, "DATABASE_URL is required")
	}
	if c.JWTSecret == "" {
		errs = append(errs, "JWT_SECRET is required")
	}
	return errs
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// parseCSV splits a comma-separated env value into trimmed, non-empty parts.
func parseCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
