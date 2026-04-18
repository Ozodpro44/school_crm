package db

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

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

	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(5 * time.Minute)
	conn.SetConnMaxIdleTime(2 * time.Minute)

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
	if strings.HasPrefix(migrationPath, "file:/") && !strings.HasPrefix(migrationPath, "file://") {
		normalized := strings.TrimPrefix(migrationPath, "file:")
		if !strings.HasPrefix(normalized, "/") {
			normalized = "/" + normalized
		}
		migrationPath = "file://" + filepath.ToSlash(normalized)
	}
	if migrationPath == "" || strings.HasPrefix(migrationPath, "file://") == false {
		// Try common locations
		wd, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("failed to get working directory: %w", err)
		}

		if migrationPath != "" && !strings.HasPrefix(migrationPath, "file://") {
			if filepath.IsAbs(migrationPath) {
				migrationPath = "file://" + filepath.ToSlash(migrationPath)
			} else {
				migrationPath = "file://" + filepath.ToSlash(filepath.Join(wd, migrationPath))
			}
		} else {
			// Check if migrations directory exists in current directory
			if _, err := os.Stat(filepath.Join(wd, "migrations")); err == nil {
				migrationPath = "file://" + filepath.ToSlash(filepath.Join(wd, "migrations"))
			} else if _, err := os.Stat(filepath.Join(wd, "backend_school_crm", "migrations")); err == nil {
				migrationPath = "file://" + filepath.ToSlash(filepath.Join(wd, "backend_school_crm", "migrations"))
			} else {
				// Default to file://migrations (relative to working directory)
				migrationPath = "file://" + filepath.ToSlash(filepath.Join(wd, "migrations"))
			}
		}
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
	// Force the version back to the failed number minus one so the corrected
	// migration file can be re-applied cleanly on the next m.Up() call.
	version, dirty, err := m.Version()
	if err == nil && dirty {
		log.Printf("[Database.RunMigrations] Dirty state detected at version %d — forcing back to %d to re-run", version, version-1)
		if forceErr := m.Force(int(version) - 1); forceErr != nil {
			return fmt.Errorf("database is dirty at version %d and auto-force failed: %w", version, forceErr)
		}
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

	// Safety check: migration metadata can be out of sync with real schema.
	// If required tables are missing even though version is up-to-date, repair automatically.
	requiredTables := []string{
		"users",
		"branches",
		"classes",
		"students",
		"teachers",
		"payments",
		"salaries",
		"expenses",
		"incomes",
		"permissions",
		"subscription_plans",
		"subscriptions",
		"subscription_usage",
		"subscription_payments",
		"developers",
		"logs",
		"branch_managers",
		"notifications",
		"audit_logs",
		"expense_budgets",
	}

	missingTables, err := db.getMissingTables(ctx, requiredTables)
	if err != nil {
		return fmt.Errorf("failed to validate migrated schema: %w", err)
	}
	if len(missingTables) > 0 {
		log.Printf("[Database.RunMigrations] Detected missing tables despite migration state: %s", strings.Join(missingTables, ", "))
		log.Printf("[Database.RunMigrations] Attempting auto-repair: force version to 0 and re-run all migrations")

		if err := m.Force(0); err != nil {
			return fmt.Errorf("failed to force migration version to 0 for repair: %w", err)
		}
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			return fmt.Errorf("auto-repair migration failed: %w", err)
		}

		missingTables, err = db.getMissingTables(ctx, requiredTables)
		if err != nil {
			return fmt.Errorf("failed to validate schema after auto-repair: %w", err)
		}
		if len(missingTables) > 0 {
			return fmt.Errorf("auto-repair incomplete, missing tables: %s", strings.Join(missingTables, ", "))
		}

		version, dirty, err := m.Version()
		if err == nil {
			log.Printf("[Database.RunMigrations] Auto-repair completed successfully. Current version: %d (dirty: %v)", version, dirty)
		} else {
			log.Printf("[Database.RunMigrations] Auto-repair completed successfully")
		}
	}

	return nil
}

func (db *Database) getMissingTables(ctx context.Context, tableNames []string) ([]string, error) {
	missing := make([]string, 0)
	for _, tableName := range tableNames {
		var regName sql.NullString
		if err := db.conn.QueryRowContext(ctx, "SELECT to_regclass($1)", "public."+tableName).Scan(&regName); err != nil {
			return nil, err
		}
		if !regName.Valid {
			missing = append(missing, tableName)
		}
	}
	return missing, nil
}
