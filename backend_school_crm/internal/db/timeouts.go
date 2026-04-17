package db

import "time"

// Query timeout constants. Use these to wrap every DB call with
// context.WithTimeout so runaway queries never block the connection pool.
const (
	// QueryTimeout applies to ordinary CRUD reads and writes.
	QueryTimeout = 5 * time.Second

	// ReportTimeout applies to aggregate / analytics queries.
	ReportTimeout = 30 * time.Second

	// BulkImportTimeout applies to bulk CSV imports or bulk payment creation.
	BulkImportTimeout = 60 * time.Second
)
