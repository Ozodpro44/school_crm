// Package platformsettings holds the platform-wide operational settings
// exposed on the developer portal's Settings page (Server/Security/Logging
// sections) — JWT expiry, rate limiting, login lockout threshold, MFA,
// request timeout, log level, query logging.
//
// These are read by three separate deployables (auth_service, api_gateway,
// backend_school_crm), so Redis — already shared by all three — is the
// source of truth rather than a per-service Postgres dependency api_gateway
// doesn't otherwise have. Each service keeps its own small in-memory copy,
// refreshed on a timer, so hot paths (login, every request) never pay a
// Redis round-trip. This package is duplicated per-service rather than
// shared, matching the existing per-service duplication of
// blacklistKey/sessionRevokedKey string helpers in this codebase.
package platformsettings

import (
	"context"
	"encoding/json"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisKey is the single global key all services read/write.
const RedisKey = "platform:settings"

const pollInterval = 15 * time.Second

// FlexInt unmarshals from either a JSON number or a numeric string —
// the frontend Settings page keeps these values as text input state and
// sends them as strings (e.g. "24"), while this package re-serializes them
// as plain numbers once persisted, so a Settings value must accept both.
type FlexInt int

func (f *FlexInt) UnmarshalJSON(b []byte) error {
	var asInt int
	if err := json.Unmarshal(b, &asInt); err == nil {
		*f = FlexInt(asInt)
		return nil
	}
	var asStr string
	if err := json.Unmarshal(b, &asStr); err != nil {
		return err
	}
	asStr = strings.TrimSpace(asStr)
	if asStr == "" {
		return nil
	}
	n, err := strconv.Atoi(asStr)
	if err != nil {
		return err
	}
	*f = FlexInt(n)
	return nil
}

// Settings mirrors every key the dev portal's Settings page persists.
// Environment/MaintenanceMode have no server-side consumer (MaintenanceMode
// is a purely client-side localStorage flag, Environment is display-only) —
// they round-trip here only so GetDevSettings/UpdateDevSettings keep
// returning the full blob the frontend already expects.
type Settings struct {
	RequestTimeoutSeconds FlexInt `json:"requestTimeout"`
	RateLimitingEnabled   bool    `json:"rateLimiting"`
	Environment           string  `json:"environment"`
	JWTExpiryHours        FlexInt `json:"jwtExpiry"`
	MaxLoginAttempts      FlexInt `json:"maxLoginAttempts"`
	RequireMFA            bool    `json:"requireMFA"`
	MaintenanceMode       bool    `json:"maintenanceMode"`
	LogLevel              string  `json:"logLevel"`
	QueryLoggingEnabled   bool    `json:"queryLogging"`
}

// Defaults match today's hardcoded behavior exactly, so a missing/corrupt
// Redis key degrades to the status quo rather than an outage.
var Defaults = Settings{
	RequestTimeoutSeconds: 30,
	RateLimitingEnabled:   true,
	Environment:           "production",
	JWTExpiryHours:        24,
	MaxLoginAttempts:      5,
	RequireMFA:            false,
	MaintenanceMode:       false,
	LogLevel:              "info",
	QueryLoggingEnabled:   false,
}

// Store serves the latest known Settings from memory, refreshed from Redis
// on a timer, with Defaults as the fail-safe when Redis is unreachable or
// the key doesn't exist yet.
type Store struct {
	rdb *redis.Client
	mu  sync.RWMutex
	cur Settings
}

func NewStore(rdb *redis.Client) *Store {
	s := &Store{rdb: rdb, cur: Defaults}
	s.refresh()
	go s.pollLoop()
	return s
}

func (s *Store) Get() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cur
}

// Save persists newSettings as the canonical value and updates this
// process's in-memory copy immediately (other processes pick it up within
// one poll interval).
func (s *Store) Save(ctx context.Context, newSettings Settings) error {
	raw, err := json.Marshal(newSettings)
	if err != nil {
		return err
	}
	if err := s.rdb.Set(ctx, RedisKey, raw, 0).Err(); err != nil {
		return err
	}
	s.mu.Lock()
	s.cur = newSettings
	s.mu.Unlock()
	return nil
}

func (s *Store) refresh() {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	data, err := s.rdb.Get(ctx, RedisKey).Bytes()
	if err != nil {
		if err != redis.Nil {
			log.Printf("[platformsettings] refresh failed, keeping previous values: %v", err)
		}
		return
	}
	merged := Defaults
	if err := json.Unmarshal(data, &merged); err != nil {
		log.Printf("[platformsettings] invalid JSON in %s, keeping previous values: %v", RedisKey, err)
		return
	}
	s.mu.Lock()
	s.cur = merged
	s.mu.Unlock()
}

func (s *Store) pollLoop() {
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()
	for range ticker.C {
		s.refresh()
	}
}
