package utils

import (
	"context"
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
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

// GenerateOTP generates a cryptographically random 6-digit OTP. math/rand
// (seeded from wall-clock time) let an attacker who knows roughly when a
// request fired narrow the OTP space dramatically — a real weakness for a
// code that gates account creation and a free trial grant.
func GenerateOTP() string {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		// crypto/rand failing means the OS entropy source is broken — not
		// something to silently paper over with a weaker fallback.
		panic(fmt.Sprintf("GenerateOTP: crypto/rand unavailable: %v", err))
	}
	return fmt.Sprintf("%06d", n.Int64())
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

// SetPendingRegistration stores a not-yet-created signup (OTP + the
// request needed to actually create the account) with a 15 minute
// expiration — long enough to find and read a verification email, short
// enough that an abandoned signup doesn't squat on an email indefinitely.
func (rc *RedisClient) SetPendingRegistration(ctx context.Context, email, data string) error {
	key := fmt.Sprintf("pending_registration:%s", email)
	return rc.client.Set(ctx, key, data, 15*time.Minute).Err()
}

// GetPendingRegistration retrieves a pending signup's stored JSON blob.
func (rc *RedisClient) GetPendingRegistration(ctx context.Context, email string) (string, error) {
	key := fmt.Sprintf("pending_registration:%s", email)
	return rc.client.Get(ctx, key).Result()
}

// DeletePendingRegistration removes a pending signup after it's completed
// (or abandoned in favor of a fresh one, which overwrites this key anyway).
func (rc *RedisClient) DeletePendingRegistration(ctx context.Context, email string) error {
	key := fmt.Sprintf("pending_registration:%s", email)
	return rc.client.Del(ctx, key).Err()
}

// GetClient returns the underlying redis.Client for use by the cache package.
func (rc *RedisClient) GetClient() *redis.Client {
	return rc.client
}

// Close closes the Redis connection
func (rc *RedisClient) Close() error {
	return rc.client.Close()
}
