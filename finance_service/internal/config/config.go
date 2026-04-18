package config

import "os"

type Config struct {
	Port           string
	GRPCPort       string
	DatabaseURL    string
	// DatabaseReadURL is the read-replica DSN (P5.2).
	// When empty, both reads and writes use DatabaseURL (single-node mode).
	DatabaseReadURL string
	Environment    string
}

func Load() *Config {
	return &Config{
		Port:            getEnv("PORT", "8087"),
		GRPCPort:        getEnv("GRPC_PORT", "50057"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		DatabaseReadURL: os.Getenv("DATABASE_READ_URL"),
		Environment:     getEnv("ENVIRONMENT", "development"),
	}
}

func (c *Config) Validate() []string {
	var errs []string
	if c.DatabaseURL == "" {
		errs = append(errs, "DATABASE_URL is required")
	}
	return errs
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
