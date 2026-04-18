package config

import "os"

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string
	Environment string
	// Email (Resend) for OTP delivery
	ResendAPIKey string
	ResendFrom   string
	// gRPC listen address (for ValidateToken / GetUserByID)
	GRPCPort string
}

func Load() *Config {
	cfg := &Config{
		Port:         getEnv("PORT", "8081"),
		GRPCPort:     getEnv("GRPC_PORT", "50051"),
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		RedisURL:     os.Getenv("REDIS_URL"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		Environment:  getEnv("ENVIRONMENT", "development"),
		ResendAPIKey: os.Getenv("RESEND_API_KEY"),
		ResendFrom:   os.Getenv("RESEND_FROM"),
	}
	return cfg
}

func (c *Config) Validate() []string {
	var errs []string
	if c.DatabaseURL == "" {
		errs = append(errs, "DATABASE_URL is required")
	}
	if c.JWTSecret == "" {
		errs = append(errs, "JWT_SECRET is required")
	} else if len(c.JWTSecret) < 32 {
		errs = append(errs, "JWT_SECRET must be at least 32 characters")
	}
	if c.RedisURL == "" {
		errs = append(errs, "REDIS_URL is required")
	}
	return errs
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
