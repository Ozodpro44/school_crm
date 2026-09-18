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

// SuppressCtxKey marks a context whose queries must never be logged, even
// while queryLoggingEnabled is true. WriteLog's own INSERT INTO logs uses
// the same *sql.DB as every other query, so without this guard that INSERT
// would trip the After hook, call LogQueryFunc (== WriteLog) again, which
// issues another INSERT that trips the hook again — an unbounded recursive
// write storm that starves the connection pool and hangs the process. Every
// caller writing to the logs table (WriteLog, and anything else that ends up
// calling it) must run its query through a context carrying this marker.
type suppressLogKey struct{}

// WithSuppressedQueryLog returns a context whose queries the hooks below
// will never forward to LogQueryFunc.
func WithSuppressedQueryLog(ctx context.Context) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, suppressLogKey{}, true)
}

func isSuppressed(ctx context.Context) bool {
	v, _ := ctx.Value(suppressLogKey{}).(bool)
	return v
}

type queryLogHooks struct{}

func (h *queryLogHooks) Before(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	if !queryLoggingEnabled.Load() || isSuppressed(ctx) {
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
	if !queryLoggingEnabled.Load() || LogQueryFunc == nil || isSuppressed(ctx) {
		return
	}
	var duration time.Duration
	if start, ok := ctx.Value(queryStartKey{}).(time.Time); ok {
		duration = time.Since(start)
	}
	// Fired off in a goroutine rather than called inline: LogQueryFunc does a
	// synchronous DB write (WriteLog), and this hook runs on every single
	// query — calling it inline would make each query pay for an extra
	// round-trip on the request's own critical path, roughly doubling total
	// latency for anything that issues several queries (measured: an 18s
	// endpoint became a 30s+ timeout). This is a debug/observability
	// feature, not core plumbing, so it must never slow down the request it's
	// observing. Query text only — argument VALUES are never logged (they
	// can carry passwords, tokens, or other PII) — just how many were bound.
	go LogQueryFunc(query, argCount, duration, err)
}
