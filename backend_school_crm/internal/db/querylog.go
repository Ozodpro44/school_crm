package db

import (
	"context"
	"database/sql"
	"sync/atomic"
	"time"

	"github.com/lib/pq"
	"github.com/qustavo/sqlhooks/v2"
)

// queryLoggingDriverName is registered once in init() via sqlhooks, which
// wraps lib/pq's driver.Driver correctly (including the optional
// QueryerContext/ExecerContext/etc. interfaces database/sql looks for) —
// safer than hand-rolling a driver.Conn wrapper, which is easy to get subtly
// wrong (losing context cancellation or connection-pooling behavior) for
// what is fundamentally a debug/observability feature, not core plumbing.
const queryLoggingDriverName = "postgres+querylog"

func init() {
	sql.Register(queryLoggingDriverName, sqlhooks.Wrap(&pq.Driver{}, &queryLogHooks{}))
}

// queryLoggingEnabled is toggled at runtime by the platform-wide "Query
// Logging" setting (see internal/platformsettings) — checked on every query,
// so flipping it in the developer portal takes effect immediately without a
// restart.
var queryLoggingEnabled atomic.Bool

// SetQueryLoggingEnabled is called by the settings poller whenever the
// platform-wide setting changes value.
func SetQueryLoggingEnabled(enabled bool) {
	queryLoggingEnabled.Store(enabled)
}

// LogQueryFunc receives each query when logging is enabled. Wired from
// cmd/main.go to handlers.WriteLog — internal/db can't import
// internal/handlers directly (handlers already imports db), hence the
// function-variable indirection.
var LogQueryFunc func(query string, argCount int, duration time.Duration, err error)

type queryStartKey struct{}

type queryLogHooks struct{}

func (h *queryLogHooks) Before(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	if !queryLoggingEnabled.Load() {
		return ctx, nil
	}
	return context.WithValue(ctx, queryStartKey{}, time.Now()), nil
}

func (h *queryLogHooks) After(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	h.record(ctx, query, len(args), nil)
	return ctx, nil
}

// OnError implements sqlhooks.OnErrorer so failed queries are logged too —
// without it, sqlhooks would silently swallow the failure from this hook's
// point of view.
func (h *queryLogHooks) OnError(ctx context.Context, err error, query string, args ...interface{}) error {
	h.record(ctx, query, len(args), err)
	return err
}

func (h *queryLogHooks) record(ctx context.Context, query string, argCount int, err error) {
	if !queryLoggingEnabled.Load() || LogQueryFunc == nil {
		return
	}
	var duration time.Duration
	if start, ok := ctx.Value(queryStartKey{}).(time.Time); ok {
		duration = time.Since(start)
	}
	// Query text only — argument VALUES are never logged (they can carry
	// passwords, tokens, or other PII) — just how many were bound.
	LogQueryFunc(query, argCount, duration, err)
}
