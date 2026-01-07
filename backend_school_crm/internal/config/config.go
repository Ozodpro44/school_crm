package config

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	Environment string
	RedisURL    string
	SMTPHost    string
	SMTPPort    string
	SMTPUser    string
	SMTPPass    string
	SMTPFrom    string
}
