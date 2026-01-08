package config

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	Environment string
	RedisURL    string
	ResendAPIKey string
	ResendFrom  string
}
