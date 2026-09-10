package config

import (
	"os"
	"strings"
)

type Config struct {
	Port        string
	GRPCPort    string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string
	Environment string
	// CORSOrigins is the allowlist of frontend origins permitted to call
	// this API directly. Set via CORS_ORIGINS (comma-separated) in
	// production — the default only covers local dev.
	CORSOrigins []string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8086"),
		GRPCPort:    getEnv("GRPC_PORT", "50056"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		RedisURL:    os.Getenv("REDIS_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		Environment: getEnv("ENVIRONMENT", "development"),
		CORSOrigins: parseCSV(getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")),
	}
}

func (c *Config) Validate() []string {
	var errs []string
	if c.DatabaseURL == "" {
		errs = append(errs, "DATABASE_URL is required")
	}
	if c.RedisURL == "" {
		errs = append(errs, "REDIS_URL is required")
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
