package config

import (
	"os"
	"strings"
)

type Config struct {
	Port        string
	JWTSecret   string
	Environment string
	RedisURL    string
	SentryDSN   string
	// CORSOrigins is the allowlist of frontend origins permitted to call this
	// API. Set via CORS_ORIGINS (comma-separated) in production — the
	// default only covers local dev (frontend_school_crm:3000,
	// frontend_for_dev:3001).
	CORSOrigins []string

	// Upstream service addresses
	MonolithURL            string // e.g. http://backend:8082
	AuthServiceURL         string // e.g. http://auth_service:8081
	PaymentServiceURL      string // e.g. http://payment_service:8083 (P3.5)
	UserServiceURL         string // e.g. http://user_service:8084         (P4.1)
	StudentServiceURL      string // e.g. http://student_service:8085       (P4.2)
	TeacherServiceURL      string // e.g. http://teacher_service:8086       (P5.1)
	FinanceServiceURL      string // e.g. http://finance_service:8087       (P5.2)
	NotificationServiceURL string // e.g. http://notification_service:8088  (P5.3)
}

func Load() *Config {
	return &Config{
		Port:                   getEnv("PORT", "8080"),
		JWTSecret:              os.Getenv("JWT_SECRET"),
		Environment:            getEnv("ENVIRONMENT", "development"),
		RedisURL:               os.Getenv("REDIS_URL"),
		SentryDSN:              os.Getenv("SENTRY_DSN"),
		MonolithURL:            getEnv("MONOLITH_URL", "http://backend:8082"),
		AuthServiceURL:         getEnv("AUTH_SERVICE_URL", "http://auth_service:8081"),
		PaymentServiceURL:      getEnv("PAYMENT_SERVICE_URL", "http://payment_service:8083"),
		UserServiceURL:         getEnv("USER_SERVICE_URL", "http://user_service:8084"),
		StudentServiceURL:      getEnv("STUDENT_SERVICE_URL", "http://student_service:8085"),
		TeacherServiceURL:      getEnv("TEACHER_SERVICE_URL", "http://teacher_service:8086"),
		FinanceServiceURL:      getEnv("FINANCE_SERVICE_URL", "http://finance_service:8087"),
		NotificationServiceURL: getEnv("NOTIFICATION_SERVICE_URL", "http://notification_service:8088"),
		CORSOrigins:            parseCSV(getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")),
	}
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

func (c *Config) Validate() []string {
	var errs []string
	if c.JWTSecret == "" {
		errs = append(errs, "JWT_SECRET is required")
	}
	if c.RedisURL == "" {
		errs = append(errs, "REDIS_URL is required")
	}
	if c.MonolithURL == "" {
		errs = append(errs, "MONOLITH_URL is required")
	}
	return errs
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
