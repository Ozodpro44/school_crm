package utils

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client *redis.Client
}

// NewRedisClient initializes a new Redis client
func NewRedisClient(redisURL string) (*RedisClient, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	log.Println("Successfully connected to Redis")
	return &RedisClient{client: client}, nil
}

// GenerateOTP generates a random 6-digit OTP
func GenerateOTP() string {
	rand.Seed(time.Now().UnixNano())
	return fmt.Sprintf("%06d", rand.Intn(1000000))
}

// SetOTP stores OTP in Redis with 10 minutes expiration
func (rc *RedisClient) SetOTP(ctx context.Context, email, otp string) error {
	key := fmt.Sprintf("otp:%s", email)
	return rc.client.Set(ctx, key, otp, 10*time.Minute).Err()
}

// GetOTP retrieves OTP from Redis
func (rc *RedisClient) GetOTP(ctx context.Context, email string) (string, error) {
	key := fmt.Sprintf("otp:%s", email)
	return rc.client.Get(ctx, key).Result()
}

// DeleteOTP removes OTP from Redis after successful verification
func (rc *RedisClient) DeleteOTP(ctx context.Context, email string) error {
	key := fmt.Sprintf("otp:%s", email)
	return rc.client.Del(ctx, key).Err()
}

// SetPasswordReset stores password reset token in Redis with 1 hour expiration
func (rc *RedisClient) SetPasswordReset(ctx context.Context, email, token string) error {
	key := fmt.Sprintf("reset:%s", email)
	return rc.client.Set(ctx, key, token, 1*time.Hour).Err()
}

// GetPasswordReset retrieves password reset token from Redis
func (rc *RedisClient) GetPasswordReset(ctx context.Context, email string) (string, error) {
	key := fmt.Sprintf("reset:%s", email)
	return rc.client.Get(ctx, key).Result()
}

// DeletePasswordReset removes password reset token from Redis
func (rc *RedisClient) DeletePasswordReset(ctx context.Context, email string) error {
	key := fmt.Sprintf("reset:%s", email)
	return rc.client.Del(ctx, key).Err()
}

// Close closes the Redis connection
func (rc *RedisClient) Close() error {
	return rc.client.Close()
}
