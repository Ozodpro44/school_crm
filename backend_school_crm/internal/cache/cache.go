package cache

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

// Client wraps a Redis client with helpers for JSON-based application caching.
type Client struct {
	rdb *redis.Client
}

// New creates a new cache Client backed by the given redis.Client.
func New(rdb *redis.Client) *Client {
	return &Client{rdb: rdb}
}

// Get deserialises the cached value at key into dest.
// Returns (true, nil) on hit, (false, nil) on miss, (false, err) on error.
func (c *Client) Get(ctx context.Context, key string, dest interface{}) (bool, error) {
	data, err := c.rdb.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, json.Unmarshal(data, dest)
}

// Set serialises val to JSON and stores it at key with the given TTL.
func (c *Client) Set(ctx context.Context, key string, val interface{}, ttl time.Duration) error {
	data, err := json.Marshal(val)
	if err != nil {
		return err
	}
	return c.rdb.Set(ctx, key, data, ttl).Err()
}

// Delete removes a single key from the cache.
func (c *Client) Delete(ctx context.Context, key string) error {
	return c.rdb.Del(ctx, key).Err()
}

// DeleteByPrefix removes all keys whose names start with prefix using SCAN.
// Safe on large keyspaces — iterates in pages of 100.
func (c *Client) DeleteByPrefix(ctx context.Context, prefix string) error {
	var cursor uint64
	for {
		keys, next, err := c.rdb.Scan(ctx, cursor, prefix+"*", 100).Result()
		if err != nil {
			return err
		}
		if len(keys) > 0 {
			if err := c.rdb.Del(ctx, keys...).Err(); err != nil {
				return err
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	return nil
}
