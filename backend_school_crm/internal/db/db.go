package db

import (
	"context"
	"database/sql"
	"fmt"

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

	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(5)

	return &Database{conn: conn}, nil
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

func (db *Database) RunMigrations(ctx context.Context) error {
	migrations := []string{
		createUsersTable,
		createBranchesTable,
		addBranchAdminForeignKey,
		addBranchMissingColumns,
		createTeachersTable,
		createClassesTable,
		createStudentsTable,
		createTeacherClassesTable,
		createPaymentsTable,
		createSalariesTable,
		createExpensesTable,
		createIncomesTable,
		dropSettingsTable,
		createSettingsTable,
		createPermissionsTable,
		createBranchManagersTable,
		createFinancialMonthsTable,
		addCurrentFinancialMonthToBranches,
		addFinancialMonthIdToPayments,
		addFinancialMonthIdToSalaries,
		addFinancialMonthIdToExpenses,
		populateFinancialMonths,
		removeCurrentMonthYearFromBranches,
		addUpdatedAtToPayments,
		addUpdatedAtToSalaries,

		grantTablePermissions,
		createIndexes,
		seedSampleData,
	}

	for _, migration := range migrations {
		if _, err := db.conn.ExecContext(ctx, migration); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	return nil
}
