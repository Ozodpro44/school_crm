// Package testhelpers provides shared test infrastructure.
// Integration tests import this package to get a real PostgreSQL database.
//
// Usage:
//
//	func TestSomething(t *testing.T) {
//	    if testing.Short() { t.Skip("integration test") }
//	    db, cleanup := testhelpers.NewTestDB(t)
//	    defer cleanup()
//	    // use db...
//	}
package testhelpers

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/school-crm/backend/internal/db"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
)

// isDockerUnavailableError reports whether err indicates that Docker is not
// running or not reachable, so tests can skip rather than fail.
func isDockerUnavailableError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "docker") ||
		strings.Contains(msg, "provider") ||
		strings.Contains(msg, "socket") ||
		strings.Contains(msg, "connection refused") ||
		strings.Contains(msg, "no such file")
}

// NewTestDB starts a throwaway PostgreSQL container, runs all migrations,
// and returns a ready *db.Database plus a cleanup function.
//
// The test is skipped automatically when testing.Short() is true.
func NewTestDB(t *testing.T) (*db.Database, func()) {
	t.Helper()
	if testing.Short() {
		t.Skip("skipping integration test (-short flag set)")
	}

	ctx := context.Background()

	pg, err := tcpostgres.Run(ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("testdb"),
		tcpostgres.WithUsername("test"),
		tcpostgres.WithPassword("test"),
		tcpostgres.BasicWaitStrategies(),
	)
	if err != nil {
		// If Docker is not available (dev machine without daemon, some CI configs)
		// skip rather than fail so that unit tests still pass.
		if isDockerUnavailableError(err) {
			t.Skipf("testhelpers: Docker not available, skipping integration test: %v", err)
		}
		t.Fatalf("testhelpers: start postgres container: %v", err)
	}

	dsn, err := pg.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = pg.Terminate(ctx)
		t.Fatalf("testhelpers: get connection string: %v", err)
	}

	// RunMigrations reads DATABASE_URL from env, so we must set it.
	t.Setenv("DATABASE_URL", dsn)

	// Locate migrations directory relative to this file so tests work
	// regardless of which directory `go test` is run from.
	_, thisFile, _, _ := runtime.Caller(0)
	migrationsDir := filepath.Join(filepath.Dir(thisFile), "..", "..", "migrations")
	abs, err := filepath.Abs(migrationsDir)
	if err != nil {
		_ = pg.Terminate(ctx)
		t.Fatalf("testhelpers: abs migrations path: %v", err)
	}
	if _, err := os.Stat(abs); err != nil {
		_ = pg.Terminate(ctx)
		t.Fatalf("testhelpers: migrations dir not found at %s: %v", abs, err)
	}
	t.Setenv("MIGRATION_PATH", fmt.Sprintf("file://%s", abs))

	database, err := db.New(ctx, dsn)
	if err != nil {
		_ = pg.Terminate(ctx)
		t.Fatalf("testhelpers: db.New: %v", err)
	}

	if err := database.RunMigrations(ctx); err != nil {
		database.Close()
		_ = pg.Terminate(ctx)
		t.Fatalf("testhelpers: RunMigrations: %v", err)
	}

	cleanup := func() {
		database.Close()
		_ = pg.Terminate(ctx)
	}
	return database, cleanup
}
