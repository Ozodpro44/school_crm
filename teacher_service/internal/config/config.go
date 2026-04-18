package config

import "os"

type Config struct {
	Port        string
	GRPCPort    string
	DatabaseURL string
	RedisURL    string
	Environment string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8086"),
		GRPCPort:    getEnv("GRPC_PORT", "50056"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		RedisURL:    os.Getenv("REDIS_URL"),
		Environment: getEnv("ENVIRONMENT", "development"),
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
	return errs
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
