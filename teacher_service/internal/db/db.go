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

type DB struct{ conn *sql.DB }

func New(ctx context.Context, dsn string) (*DB, error) {
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	conn.SetMaxOpenConns(20)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := conn.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return &DB{conn: conn}, nil
}

func (d *DB) Conn() *sql.DB { return d.conn }
func (d *DB) Close() error  { return d.conn.Close() }
