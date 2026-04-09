package db

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "github.com/lib/pq"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
) // fmt still needed for error messages in New()

type Database struct {
	conn *sql.DB
}

func New(ctx context.Context, dsn string) (*Database, error) {
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := conn.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(5)

	db := &Database{conn: conn}

	return db, nil
}

func (db *Database) Close() error {
	return db.conn.Close()
}

func (db *Database) GetConn() *sql.DB {
	return db.conn
}

func (db *Database) BeginTx(ctx context.Context) (*sql.Tx, error) {
	return db.conn.BeginTx(ctx, nil)
}

// RunMigrations runs all pending database migrations automatically
// This is called during database initialization on app startup
func (db *Database) RunMigrations(ctx context.Context) error {
	// Find migrations directory
	migrationPath := os.Getenv("MIGRATION_PATH")
	if migrationPath == "" {
		// Try common locations
		wd, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("failed to get working directory: %w", err)
		}
		
		// Check if migrations directory exists in current directory
		if _, err := os.Stat(filepath.Join(wd, "migrations")); err == nil {
			migrationPath = filepath.Join("file://", wd, "migrations")
		} else if _, err := os.Stat(filepath.Join(wd, "backend_school_crm", "migrations")); err == nil {
			migrationPath = filepath.Join("file://", wd, "backend_school_crm", "migrations")
		} else {
			// Default to file://migrations (relative to working directory)
			migrationPath = "file://migrations"
		}
	} else if !filepath.IsAbs(migrationPath) {
		// Make path absolute if it's relative
		migrationPath = filepath.Join("file://", migrationPath)
	}

	log.Printf("[Database.RunMigrations] Using migration path: %s", migrationPath)

	// Get database URL from connection string
	// The dsn is already validated at this point
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return fmt.Errorf("DATABASE_URL environment variable not set")
	}

	// Create migration instance
	m, err := migrate.New(migrationPath, databaseURL)
	if err != nil {
		return fmt.Errorf("failed to create migration instance: %w", err)
	}
	defer m.Close()

	// Dirty state means a previous migration failed part-way.
	// Do not force-forward automatically, because it can skip required tables.
	version, dirty, err := m.Version()
	if err == nil && dirty {
		return fmt.Errorf("database is in dirty migration state at version %d; fix migration and run force manually", version)
	}

	// Run migrations up
	err = m.Up()
	if err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migration failed: %w", err)
	}

	if err == migrate.ErrNoChange {
		log.Printf("[Database.RunMigrations] No new migrations to run")
	} else {
		version, dirty, err := m.Version()
		if err != nil {
			return fmt.Errorf("failed to get migration version: %w", err)
		}
		log.Printf("[Database.RunMigrations] Migrations applied successfully. Current version: %d (dirty: %v)", version, dirty)
	}

	return nil
}
