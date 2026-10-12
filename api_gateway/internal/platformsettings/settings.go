// Package platformsettings holds the platform-wide operational settings
// exposed on the developer portal's Settings page (Server/Security/Logging
// sections). api_gateway is read-only here — it has no Postgres dependency
// by design, so Redis (shared by every service) is the only viable source
// of truth. See the identical file in backend_school_crm/internal/platformsettings
// (the writer) and auth_service/internal/platformsettings for more context;
// duplicated per-service rather than shared, matching this codebase's
// existing per-service duplication of small string-keyed helpers.
package platformsettings

import (
	"context"
	"encoding/json"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const RedisKey = "platform:settings"

const pollInterval = 15 * time.Second

// FlexInt unmarshals from either a JSON number or a numeric string.
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

// Defaults match today's hardcoded behavior exactly.
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

func (s *Store) refresh() {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	data, err := s.rdb.Get(ctx, RedisKey).Bytes()
	if err != nil {
		if err != redis.Nil {
			slog.Warn("platformsettings refresh failed, keeping previous values", "error", err)
		}
		return
	}
	merged := Defaults
	if err := json.Unmarshal(data, &merged); err != nil {
		slog.Warn("platformsettings invalid JSON, keeping previous values", "error", err)
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
