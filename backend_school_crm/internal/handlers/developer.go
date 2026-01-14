package handlers

import (
	"context"
	"database/sql"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/db"
)

// DatabaseTable represents a table in the database schema
type DatabaseTable struct {
	Name    string `json:"name"`
	Columns []DatabaseColumn `json:"columns"`
}

// DatabaseColumn represents a column in a database table
type DatabaseColumn struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Nullable bool   `json:"nullable"`
	Default  string `json:"default,omitempty"`
}

// DatabaseSchema represents the entire database schema
type DatabaseSchema struct {
	Tables   []DatabaseTable `json:"tables"`
	Count    int             `json:"count"`
	Version  string          `json:"version"`
}

// TestDataStats represents generated test data statistics
type TestDataStats struct {
	Students int    `json:"students"`
	Teachers int    `json:"teachers"`
	Classes  int    `json:"classes"`
	Payments int    `json:"payments"`
	Message  string `json:"message"`
	Status   string `json:"status"`
}

// APIEndpoint represents an API endpoint in documentation
type APIEndpoint struct {
	Method      string            `json:"method"`
	Path        string            `json:"path"`
	Description string            `json:"description"`
	Public      bool              `json:"public"`
	Params      map[string]string `json:"params,omitempty"`
}

// APIDocumentation represents API docs
type APIDocumentation struct {
	Version   string         `json:"version"`
	Endpoints []APIEndpoint  `json:"endpoints"`
	Count     int            `json:"count"`
}

// GetDatabaseSchema returns the database schema information
func GetDatabaseSchema(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("[DEV] Fetching database schema")

		tables, err := fetchDatabaseTables(database.GetConn())
		if err != nil {
			log.Printf("[DEV ERROR] Failed to fetch schema: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch database schema"})
			return
		}

		schema := DatabaseSchema{
			Tables:  tables,
			Count:   len(tables),
			Version: "1.0.0",
		}

		c.JSON(http.StatusOK, schema)
	}
}

// GetDatabaseMigrations returns migration history
func GetDatabaseMigrations(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("[DEV] Fetching database migrations")

		migrations, err := fetchDatabaseMigrations(database.GetConn())
		if err != nil {
			log.Printf("[DEV ERROR] Failed to fetch migrations: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch migrations"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"migrations": migrations,
			"count":      len(migrations),
		})
	}
}

// GenerateTestData generates test data for development
func GenerateTestData(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("[DEV] Generating test data")

		ctx := c.Request.Context()

		// Check if admin making request
		role, exists := c.Get("role")
		if !exists || role != "admin" {
			log.Printf("[DEV] Unauthorized test data generation attempt")
			c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can generate test data"})
			return
		}

		// Insert test data
		stats := TestDataStats{
			Students: 0,
			Teachers: 0,
			Classes:  0,
			Payments: 0,
			Status:   "pending",
		}

		// Get branch ID from claims
		branchID, exists := c.Get("branchID")
		if !exists {
			log.Printf("[DEV] Missing branch ID")
			c.JSON(http.StatusBadRequest, gin.H{"error": "Branch ID not found"})
			return
		}

		branch := branchID.(string)
		conn := database.GetConn()

		// Generate test students
		studentCount, err := generateTestStudents(ctx, conn, branch)
		if err != nil {
			log.Printf("[DEV ERROR] Failed to generate students: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate test data"})
			return
		}
		stats.Students = studentCount

		// Generate test teachers
		teacherCount, err := generateTestTeachers(ctx, conn, branch)
		if err != nil {
			log.Printf("[DEV ERROR] Failed to generate teachers: %v", err)
		}
		stats.Teachers = teacherCount

		// Generate test classes
		classCount, err := generateTestClasses(ctx, conn, branch)
		if err != nil {
			log.Printf("[DEV ERROR] Failed to generate classes: %v", err)
		}
		stats.Classes = classCount

		// Generate test payments
		paymentCount, err := generateTestPayments(ctx, conn, branch)
		if err != nil {
			log.Printf("[DEV ERROR] Failed to generate payments: %v", err)
		}
		stats.Payments = paymentCount

		stats.Status = "completed"
		stats.Message = "Test data generated successfully for development"

		log.Printf("[DEV] Test data generated: %d students, %d teachers, %d classes, %d payments",
			stats.Students, stats.Teachers, stats.Classes, stats.Payments)

		c.JSON(http.StatusOK, stats)
	}
}

// GetAPIDocumentation returns API endpoint documentation
func GetAPIDocumentation() gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("[DEV] Fetching API documentation")

		endpoints := []APIEndpoint{
			// Auth endpoints
			{
				Method:      "POST",
				Path:        "/api/auth/login",
				Description: "User login",
				Public:      true,
				Params: map[string]string{
					"email":    "user email",
					"password": "user password",
				},
			},
			{
				Method:      "POST",
				Path:        "/api/auth/register",
				Description: "User registration",
				Public:      true,
			},
			// Users endpoints
			{
				Method:      "GET",
				Path:        "/api/users",
				Description: "List all users",
				Public:      false,
			},
			{
				Method:      "GET",
				Path:        "/api/users/:id",
				Description: "Get user by ID",
				Public:      false,
			},
			{
				Method:      "PUT",
				Path:        "/api/users/:id",
				Description: "Update user",
				Public:      false,
			},
			// Students endpoints
			{
				Method:      "GET",
				Path:        "/api/students",
				Description: "List all students",
				Public:      false,
			},
			{
				Method:      "POST",
				Path:        "/api/students",
				Description: "Create student",
				Public:      false,
			},
			{
				Method:      "GET",
				Path:        "/api/students/:id",
				Description: "Get student by ID",
				Public:      false,
			},
			// Payments endpoints
			{
				Method:      "GET",
				Path:        "/api/payments",
				Description: "List all payments",
				Public:      false,
			},
			{
				Method:      "POST",
				Path:        "/api/payments",
				Description: "Create payment",
				Public:      false,
			},
			// Settings endpoints
			{
				Method:      "GET",
				Path:        "/api/settings",
				Description: "Get system settings",
				Public:      false,
			},
			{
				Method:      "PUT",
				Path:        "/api/settings",
				Description: "Update system settings",
				Public:      false,
			},
		}

		docs := APIDocumentation{
			Version:   "1.0.0",
			Endpoints: endpoints,
			Count:     len(endpoints),
		}

		c.JSON(http.StatusOK, docs)
	}
}

// Helper functions

func fetchDatabaseTables(conn *sql.DB) ([]DatabaseTable, error) {
	// Query to get table names
	rows, err := conn.Query(`
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = 'public' 
		AND table_type = 'BASE TABLE'
		ORDER BY table_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []DatabaseTable

	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			continue
		}

		// Get columns for this table
		columns, err := fetchTableColumns(conn, tableName)
		if err != nil {
			continue
		}

		tables = append(tables, DatabaseTable{
			Name:    tableName,
			Columns: columns,
		})
	}

	return tables, nil
}

func fetchTableColumns(conn *sql.DB, tableName string) ([]DatabaseColumn, error) {
	rows, err := conn.Query(`
		SELECT 
			column_name,
			data_type,
			is_nullable,
			column_default
		FROM information_schema.columns
		WHERE table_name = $1
		AND table_schema = 'public'
		ORDER BY ordinal_position
	`, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var columns []DatabaseColumn

	for rows.Next() {
		var colName, dataType, isNullable string
		var colDefault *string

		if err := rows.Scan(&colName, &dataType, &isNullable, &colDefault); err != nil {
			continue
		}

		defaultVal := ""
		if colDefault != nil {
			defaultVal = *colDefault
		}

		columns = append(columns, DatabaseColumn{
			Name:     colName,
			Type:     dataType,
			Nullable: isNullable == "YES",
			Default:  defaultVal,
		})
	}

	return columns, nil
}

func fetchDatabaseMigrations(conn *sql.DB) ([]map[string]interface{}, error) {
	rows, err := conn.Query(`
		SELECT version, dirty, tstamp
		FROM schema_migrations
		ORDER BY version DESC
		LIMIT 20
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var migrations []map[string]interface{}

	for rows.Next() {
		var version int64
		var dirty bool
		var tstamp *string

		if err := rows.Scan(&version, &dirty, &tstamp); err != nil {
			continue
		}

		migrations = append(migrations, map[string]interface{}{
			"version": version,
			"dirty":   dirty,
			"time":    tstamp,
		})
	}

	return migrations, nil
}

func generateTestStudents(ctx context.Context, conn *sql.DB, branchID string) (int, error) {
	testNames := []string{
		"John Doe", "Jane Smith", "Ahmed Ali", "Maria Garcia",
		"Chen Wei", "Priya Patel", "Carlos Rodriguez", "Anna Mueller",
		"Kofi Mensah", "Yuki Tanaka", "Sofia Rossi", "Dmitri Volkov",
	}

	count := 0
	for i, name := range testNames {
		parts := ""
		if i < len(testNames) {
			parts = name
		}

		_, err := conn.ExecContext(ctx, `
			INSERT INTO students (id, first_name, last_name, email, phone, branch_id, created_at, updated_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
			ON CONFLICT DO NOTHING
		`, "Test", parts, "", "", branchID)

		if err == nil {
			count++
		}
	}

	return count, nil
}

func generateTestTeachers(ctx context.Context, conn *sql.DB, branchID string) (int, error) {
	testTeachers := []string{
		"Mr. Johnson", "Ms. Williams", "Dr. Brown", "Prof. Davis",
		"Mr. Miller", "Ms. Wilson", "Mr. Moore", "Ms. Taylor",
	}

	count := 0
	for _, name := range testTeachers {
		_, err := conn.ExecContext(ctx, `
			INSERT INTO teachers (id, first_name, last_name, email, phone, branch_id, created_at, updated_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
			ON CONFLICT DO NOTHING
		`, "Teacher", name, "", "", branchID)

		if err == nil {
			count++
		}
	}

	return count, nil
}

func generateTestClasses(ctx context.Context, conn *sql.DB, branchID string) (int, error) {
	testClasses := []string{
		"Class A", "Class B", "Class C", "Class D", "Advanced Level",
	}

	count := 0
	for _, className := range testClasses {
		_, err := conn.ExecContext(ctx, `
			INSERT INTO classes (id, name, branch_id, created_at, updated_at)
			VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
			ON CONFLICT DO NOTHING
		`, className, branchID)

		if err == nil {
			count++
		}
	}

	return count, nil
}

func generateTestPayments(ctx context.Context, conn *sql.DB, branchID string) (int, error) {
	// Get some students first
	studentRows, err := conn.QueryContext(ctx, `
		SELECT id FROM students WHERE branch_id = $1 LIMIT 10
	`, branchID)
	if err != nil {
		return 0, err
	}
	defer studentRows.Close()

	var studentIDs []string
	for studentRows.Next() {
		var id string
		if err := studentRows.Scan(&id); err != nil {
			continue
		}
		studentIDs = append(studentIDs, id)
	}

	count := 0
	amounts := []float64{50000, 100000, 150000, 200000, 250000}
	statuses := []string{"paid", "pending", "overdue"}

	for i, studentID := range studentIDs {
		amount := amounts[i%len(amounts)]
		status := statuses[i%len(statuses)]

		_, err := conn.ExecContext(ctx, `
			INSERT INTO payments (id, student_id, amount, status, date, created_at, updated_at)
			VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW(), NOW())
			ON CONFLICT DO NOTHING
		`, studentID, amount, status)

		if err == nil {
			count++
		}
	}

	return count, nil
}

// RegisterDeveloperRoutes registers developer endpoints
func RegisterDeveloperRoutes(router *gin.RouterGroup, database *db.Database) {
	log.Println("[ROUTES] Registering developer routes")

	// Schema and migrations info (no auth required for learning)
	router.GET("/dev/schema", GetDatabaseSchema(database))
	router.GET("/dev/migrations", GetDatabaseMigrations(database))
	router.GET("/dev/api-docs", GetAPIDocumentation())

	// Test data generation (admin only)
	router.POST("/dev/generate-test-data", GenerateTestData(database))
}
