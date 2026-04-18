// Package db provides Writer (primary) and Reader (replica) PostgreSQL pools.
// When DatabaseReadURL is empty, both Writer and Reader point to the primary.
// This lets finance_service transparently use the replica for reports/lists
// without any code-path changes — just swap the Reader pool at deploy time.
package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)

const (
	QueryTimeout  = 5 * time.Second
	ReportTimeout = 30 * time.Second
)

// DB holds separate writer and reader connections.
type DB struct {
	writer *sql.DB
	reader *sql.DB
}

func New(ctx context.Context, writerDSN, readerDSN string) (*DB, error) {
	writer, err := openPool(ctx, writerDSN)
	if err != nil {
		return nil, fmt.Errorf("writer db: %w", err)
	}

	// If no read replica configured, reuse writer pool
	var reader *sql.DB
	if readerDSN != "" && readerDSN != writerDSN {
		reader, err = openPool(ctx, readerDSN)
		if err != nil {
			return nil, fmt.Errorf("reader db: %w", err)
		}
	} else {
		reader = writer
	}

	return &DB{writer: writer, reader: reader}, nil
}

func openPool(ctx context.Context, dsn string) (*sql.DB, error) {
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	conn.SetMaxOpenConns(20)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(5 * time.Minute)

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := conn.PingContext(pingCtx); err != nil {
		return nil, err
	}
	return conn, nil
}

// Write returns the primary connection (INSERT/UPDATE/DELETE).
func (d *DB) Write() *sql.DB { return d.writer }

// Read returns the replica connection (SELECT). Falls back to writer if no replica.
func (d *DB) Read() *sql.DB { return d.reader }

func (d *DB) Close() error {
	if d.reader != d.writer {
		_ = d.reader.Close()
	}
	return d.writer.Close()
}
