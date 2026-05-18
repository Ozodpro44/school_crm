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

	"github.com/golang-migrate/migrate/v4"
	migratedb "github.com/golang-migrate/migrate/v4/database"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
)

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

// RunMigrations runs all pending database migrations automatically.
func (db *Database) RunMigrations(ctx context.Context) error {
	migrationPath := os.Getenv("MIGRATION_PATH")
	if strings.HasPrefix(migrationPath, "file:/") && !strings.HasPrefix(migrationPath, "file://") {
		normalized := strings.TrimPrefix(migrationPath, "file:")
		if !strings.HasPrefix(normalized, "/") {
			normalized = "/" + normalized
		}
		migrationPath = "file://" + filepath.ToSlash(normalized)
	}
	if migrationPath == "" || !strings.HasPrefix(migrationPath, "file://") {
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
			if _, err := os.Stat(filepath.Join(wd, "migrations")); err == nil {
				migrationPath = "file://" + filepath.ToSlash(filepath.Join(wd, "migrations"))
			} else if _, err := os.Stat(filepath.Join(wd, "backend_school_crm", "migrations")); err == nil {
				migrationPath = "file://" + filepath.ToSlash(filepath.Join(wd, "backend_school_crm", "migrations"))
			} else {
				migrationPath = "file://" + filepath.ToSlash(filepath.Join(wd, "migrations"))
			}
		}
	}

	log.Printf("[Database.RunMigrations] Using migration path: %s", migrationPath)

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return fmt.Errorf("DATABASE_URL environment variable not set")
	}

	m, err := migrate.New(migrationPath, databaseURL)
	if err != nil {
		return fmt.Errorf("failed to create migration instance: %w", err)
	}
	defer m.Close()

	// Version 0 is not golang-migrate's empty database marker; NilVersion (-1) is.
	// Some deployments ended up with schema_migrations.version = 0, which makes
	// Up() look for a nonexistent 000000 migration before applying 000001.
	version, dirty, err := m.Version()
	if err == nil && version == 0 {
		log.Printf("[Database.RunMigrations] Detected invalid migration version 0 (dirty: %v). Resetting to nil version before running migrations.", dirty)
		if err := m.Force(migratedb.NilVersion); err != nil {
			return fmt.Errorf("failed to reset migration version 0: %w", err)
		}
	} else if err == nil && dirty && version == 1 {
		log.Printf("[Database.RunMigrations] Detected dirty initial migration at version 1. Resetting to nil version so idempotent migration can repair the schema.")
		if err := m.Force(migratedb.NilVersion); err != nil {
			return fmt.Errorf("failed to reset dirty initial migration: %w", err)
		}
	} else if err == nil && dirty {
		return fmt.Errorf("database is dirty at migration version %d; repair the failed migration and force the correct version", version)
	} else if err != nil && err != migrate.ErrNilVersion {
		return fmt.Errorf("failed to get migration version: %w", err)
	}

	if err == migrate.ErrNilVersion {
		log.Printf("[Database.RunMigrations] No migration version found; running from the first migration")
	}

	if err := ctx.Err(); err != nil {
		return err
	}

	if err := db.ensureMigrationVersionIsNotZero(ctx); err != nil {
		return err
	}

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
		log.Printf("[Database.RunMigrations] Attempting auto-repair: force version to -1 (NilVersion) and re-run all migrations")

		if err := m.Force(migratedb.NilVersion); err != nil {
			return fmt.Errorf("failed to force migration version to -1 for repair: %w", err)
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

func (db *Database) ensureMigrationVersionIsNotZero(ctx context.Context) error {
	var exists bool
	if err := db.conn.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'schema_migrations'
		)
	`).Scan(&exists); err != nil {
		return fmt.Errorf("failed to inspect schema_migrations table: %w", err)
	}
	if !exists {
		return nil
	}

	result, err := db.conn.ExecContext(ctx, `
		UPDATE schema_migrations
		SET version = $1, dirty = false
		WHERE version = 0
	`, migratedb.NilVersion)
	if err != nil {
		return fmt.Errorf("failed to repair migration version 0: %w", err)
	}
	if rows, err := result.RowsAffected(); err == nil && rows > 0 {
		log.Printf("[Database.RunMigrations] Repaired schema_migrations version 0 to nil version")
	}

	return nil
}
