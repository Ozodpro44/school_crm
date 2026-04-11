package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/service"
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
		phone := fmt.Sprintf("+998901234%03d", i)
		_, err := conn.ExecContext(ctx, `
			INSERT INTO students (id, full_name, phone, parent_phone, monthly_payment, status, branch_id, created_at, updated_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
			ON CONFLICT DO NOTHING
		`, name, phone, phone, 500000.0, "active", branchID)

		if err == nil {
			count++
		}
	}

	return count, nil
}

func generateTestTeachers(ctx context.Context, conn *sql.DB, branchID string) (int, error) {
	testTeachers := []struct {
		name  string
		phone string
		email string
	}{
		{"Mr. Johnson", "+998901110001", "johnson@test.com"},
		{"Ms. Williams", "+998901110002", "williams@test.com"},
		{"Dr. Brown", "+998901110003", "brown@test.com"},
		{"Prof. Davis", "+998901110004", "davis@test.com"},
		{"Mr. Miller", "+998901110005", "miller@test.com"},
		{"Ms. Wilson", "+998901110006", "wilson@test.com"},
		{"Mr. Moore", "+998901110007", "moore@test.com"},
		{"Ms. Taylor", "+998901110008", "taylor@test.com"},
	}

	count := 0
	for _, t := range testTeachers {
		_, err := conn.ExecContext(ctx, `
			INSERT INTO teachers (id, full_name, phone, email, monthly_salary, branch_id, created_at, updated_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
			ON CONFLICT DO NOTHING
		`, t.name, t.phone, t.email, 3000000.0, branchID)

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
		SELECT id, monthly_payment FROM students WHERE branch_id = $1 LIMIT 10
	`, branchID)
	if err != nil {
		return 0, err
	}
	defer studentRows.Close()

	type studentRow struct {
		id             string
		monthlyPayment float64
	}
	var students []studentRow
	for studentRows.Next() {
		var s studentRow
		if err := studentRows.Scan(&s.id, &s.monthlyPayment); err != nil {
			continue
		}
		students = append(students, s)
	}

	now := time.Now()
	month := now.Format("January")
	year := now.Year()
	statuses := []string{"paid", "partial"}
	methods := []string{"cash", "card", "bank"}

	count := 0
	for i, s := range students {
		amount := s.monthlyPayment
		if i%3 == 1 {
			amount = s.monthlyPayment / 2 // partial payment
		}
		status := statuses[i%len(statuses)]
		method := methods[i%len(methods)]

		_, err := conn.ExecContext(ctx, `
			INSERT INTO payments (id, student_id, amount, month, year, payment_method, status, branch_id, created_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
			ON CONFLICT DO NOTHING
		`, s.id, amount, month, year, method, status, branchID)

		if err == nil {
			count++
		}
	}

	return count, nil
}

// SeedSubscriptionPlans seeds default subscription plans if they don't exist
func SeedSubscriptionPlans(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("[DEV] Seeding subscription plans")

		query := `
			INSERT INTO subscription_plans (id, name, description, price, billing_period, max_branches, max_students, max_classes, features, status, created_at, updated_at)
			VALUES
				(gen_random_uuid(), 'Starter', 'Perfect for small schools starting their digital journey', 29.99, 'monthly', 1, 100, 5, '{"analytics": false, "api_access": false, "priority_support": false}', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
				(gen_random_uuid(), 'Professional', 'Designed for growing schools with multiple classes', 79.99, 'monthly', 3, 500, 20, '{"analytics": true, "api_access": false, "priority_support": true}', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
				(gen_random_uuid(), 'Enterprise', 'Complete solution for large educational institutions', 199.99, 'monthly', 10, 5000, 100, '{"analytics": true, "api_access": true, "priority_support": true}', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			ON CONFLICT DO NOTHING
		`

		result, err := database.GetConn().ExecContext(c.Request.Context(), query)
		if err != nil {
			log.Printf("[DEV ERROR] Failed to seed subscription plans: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to seed subscription plans", "details": err.Error()})
			return
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			log.Printf("[DEV ERROR] Failed to get rows affected: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get rows affected"})
			return
		}

		log.Printf("[DEV] Seeded %d subscription plans", rowsAffected)
		c.JSON(http.StatusOK, gin.H{
			"message": "Subscription plans seeded successfully",
			"plans_created": rowsAffected,
		})
	}
}

// GetDevSubscriptions returns all subscriptions for dev dashboard
func GetDevSubscriptions(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := `
			SELECT id, user_id, plan_id, branch_id, status, start_date, end_date, renewal_date,
				   auto_renew, payment_method, stripe_subscription_id, notes, cancelled_at, cancelled_by,
				   created_at, updated_at
			FROM subscriptions
			ORDER BY created_at DESC
			LIMIT 100
		`

		rows, err := database.GetConn().QueryContext(c.Request.Context(), query)
		if err != nil {
			log.Printf("[DEV ERROR] Failed to fetch subscriptions: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch subscriptions"})
			return
		}
		defer rows.Close()

		var subscriptions []map[string]interface{}
		for rows.Next() {
			var id, userID, planID string
			var branchID, status, paymentMethod, stripeSubID, notes *string
			var startDate, renewalDate, cancelledAt *time.Time
			var endDate, cancelledBy *string
			var autoRenew bool
			var createdAt, updatedAt time.Time

			if err := rows.Scan(&id, &userID, &planID, &branchID, &status, &startDate, &endDate, &renewalDate,
				&autoRenew, &paymentMethod, &stripeSubID, &notes, &cancelledAt, &cancelledBy,
				&createdAt, &updatedAt); err != nil {
				continue
			}

			subscriptions = append(subscriptions, map[string]interface{}{
				"id":                  id,
				"userId":              userID,
				"planId":              planID,
				"branchId":            branchID,
				"status":              status,
				"startDate":           startDate,
				"endDate":             endDate,
				"renewalDate":         renewalDate,
				"autoRenew":           autoRenew,
				"paymentMethod":       paymentMethod,
				"stripeSubscriptionId": stripeSubID,
				"notes":               notes,
				"cancelledAt":         cancelledAt,
				"cancelledBy":         cancelledBy,
				"createdAt":           createdAt,
				"updatedAt":           updatedAt,
			})
		}

		if subscriptions == nil {
			subscriptions = []map[string]interface{}{}
		}

		c.JSON(http.StatusOK, subscriptions)
	}
}

// GetDevUsers returns all users for dev dashboard
func GetDevUsers(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := `
			SELECT id, email, full_name, role, created_at, updated_at
			FROM users
			ORDER BY created_at DESC
			LIMIT 100
		`

		rows, err := database.GetConn().QueryContext(c.Request.Context(), query)
		if err != nil {
			log.Printf("[DEV ERROR] Failed to fetch users: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
			return
		}
		defer rows.Close()

		var users []map[string]interface{}
		for rows.Next() {
			var id, email, fullName, role string
			var createdAt, updatedAt time.Time

			if err := rows.Scan(&id, &email, &fullName, &role, &createdAt, &updatedAt); err != nil {
				continue
			}

			users = append(users, map[string]interface{}{
				"id":        id,
				"email":     email,
				"fullName":  fullName,
				"role":      role,
				"createdAt": createdAt,
				"updatedAt": updatedAt,
			})
		}

		if users == nil {
			users = []map[string]interface{}{}
		}

		c.JSON(http.StatusOK, users)
	}
}

// RegisterDeveloperRoutes registers developer endpoints
func RegisterDeveloperRoutes(router *gin.RouterGroup, database *db.Database, subscriptionService *service.SubscriptionService) {
	log.Println("[ROUTES] Registering developer routes")

	// Schema and migrations info (no auth required for learning)
	router.GET("/dev/schema", GetDatabaseSchema(database))
	router.GET("/dev/migrations", GetDatabaseMigrations(database))
	router.GET("/dev/api-docs", GetAPIDocumentation())

	// Test data generation (admin only)
	router.POST("/dev/generate-test-data", GenerateTestData(database))
	
	// Subscription plans seeding
	router.POST("/dev/seed-subscription-plans", SeedSubscriptionPlans(database))
	
	// Subscriptions and users data (dev endpoints — unauthenticated read-only)
	// Full CRUD is on the authenticated devProtected group via RegisterAdminSubscriptionRoutes.
	router.GET("/dev/users", GetDevUsers(database))
}

// ==================== DEV SETTINGS ====================

// RegisterDevCRMRoutes registers developer-accessible user and branch management routes.
// Must be called with a router group that uses DevAuthMiddleware.
func RegisterDevCRMRoutes(router *gin.RouterGroup, userService *service.UserService, branchService *service.BranchService) {
	// Users (full CRUD without user-context permission checks)
	users := router.Group("/dev/crm/users")
	users.GET("", listUsers(userService))
	users.GET("/:id", getUser(userService))
	users.PUT("/:id", devUpdateUser(userService))
	users.DELETE("/:id", devDeleteUser(userService))

	// Branches (reuse existing handlers — none require user context)
	branches := router.Group("/dev/crm/branches")
	branches.GET("", listBranches(branchService))
	branches.GET("/:id", getBranch(branchService))
	branches.POST("", createBranch(branchService))
	branches.PUT("/:id", updateBranch(branchService))
	branches.DELETE("/:id", deleteBranch(branchService))
}

func devUpdateUser(userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		user, err := userService.Update(c.Request.Context(), id, updates)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, user)
	}
}

func devDeleteUser(userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if err := userService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "user deleted"})
	}
}

// RegisterDevSettingsRoutes registers authenticated developer settings routes.
// Must be called with a router group that uses DevAuthMiddleware.
func RegisterDevSettingsRoutes(router *gin.RouterGroup, database *db.Database) {
	router.GET("/dev/settings", GetDevSettings(database))
	router.PUT("/dev/settings", UpdateDevSettings(database))
	// Notification-specific sub-routes (convenience wrappers around /dev/settings JSONB)
	router.GET("/dev/notifications/preferences", GetNotificationPreferences(database))
	router.PUT("/dev/notifications/preferences", UpdateNotificationPreferences(database))
	router.GET("/dev/notifications/channels", GetNotificationChannels(database))
	router.PUT("/dev/notifications/channels", UpdateNotificationChannels(database))
	router.GET("/dev/notifications/recent", GetRecentAlerts(database))
}

// GetDevSettings returns the authenticated developer's stored settings.
func GetDevSettings(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		developerID, _ := c.Get("developer_id")
		devID, ok := developerID.(string)
		if !ok || devID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "developer not authenticated"})
			return
		}

		var raw []byte
		err := database.GetConn().QueryRowContext(
			c.Request.Context(),
			"SELECT COALESCE(settings, '{}') FROM developers WHERE id = $1",
			devID,
		).Scan(&raw)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "developer not found"})
			return
		}
		if err != nil {
			log.Printf("[DEV SETTINGS] DB error reading settings: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read settings"})
			return
		}

		var settings map[string]interface{}
		if err := json.Unmarshal(raw, &settings); err != nil {
			settings = map[string]interface{}{}
		}

		c.JSON(http.StatusOK, settings)
	}
}

// UpdateDevSettings merges the request body into the developer's stored settings.
func UpdateDevSettings(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		developerID, _ := c.Get("developer_id")
		devID, ok := developerID.(string)
		if !ok || devID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "developer not authenticated"})
			return
		}

		var incoming map[string]interface{}
		if err := c.ShouldBindJSON(&incoming); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}

		// Read current settings
		var raw []byte
		err := database.GetConn().QueryRowContext(
			c.Request.Context(),
			"SELECT COALESCE(settings, '{}') FROM developers WHERE id = $1",
			devID,
		).Scan(&raw)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("[DEV SETTINGS] DB error reading settings: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read settings"})
			return
		}

		// Merge: existing + incoming (top-level merge)
		current := map[string]interface{}{}
		_ = json.Unmarshal(raw, &current)
		for k, v := range incoming {
			current[k] = v
		}

		merged, err := json.Marshal(current)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to serialize settings"})
			return
		}

		_, err = database.GetConn().ExecContext(
			c.Request.Context(),
			"UPDATE developers SET settings = $1, updated_at = $2 WHERE id = $3",
			string(merged), time.Now(), devID,
		)
		if err != nil {
			log.Printf("[DEV SETTINGS] DB error updating settings: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save settings"})
			return
		}

		log.Printf("[DEV SETTINGS] Saved settings for developer %s", devID)
		c.JSON(http.StatusOK, current)
	}
}

// ==================== DEV NOTIFICATIONS ====================

// readDevSettings reads the full JSONB settings blob for the authenticated developer.
func readDevSettings(c *gin.Context, database *db.Database) (string, map[string]interface{}, bool) {
	developerID, _ := c.Get("developer_id")
	devID, ok := developerID.(string)
	if !ok || devID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "developer not authenticated"})
		return "", nil, false
	}
	var raw []byte
	err := database.GetConn().QueryRowContext(
		c.Request.Context(),
		"SELECT COALESCE(settings, '{}') FROM developers WHERE id = $1",
		devID,
	).Scan(&raw)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read settings"})
		return "", nil, false
	}
	settings := map[string]interface{}{}
	_ = json.Unmarshal(raw, &settings)
	return devID, settings, true
}

// saveDevSettings persists the full settings blob for a developer.
func saveDevSettings(c *gin.Context, database *db.Database, devID string, settings map[string]interface{}) bool {
	merged, _ := json.Marshal(settings)
	_, err := database.GetConn().ExecContext(
		c.Request.Context(),
		"UPDATE developers SET settings = $1, updated_at = $2 WHERE id = $3",
		string(merged), time.Now(), devID,
	)
	if err != nil {
		log.Printf("[DEV NOTIFICATIONS] DB error saving settings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save settings"})
		return false
	}
	return true
}

// GetNotificationPreferences returns the per-event notification toggles.
func GetNotificationPreferences(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, settings, ok := readDevSettings(c, database)
		if !ok {
			return
		}
		prefs, _ := settings["notification_preferences"].(map[string]interface{})
		if prefs == nil {
			prefs = map[string]interface{}{}
		}
		c.JSON(http.StatusOK, prefs)
	}
}

// UpdateNotificationPreferences replaces the per-event notification toggles.
func UpdateNotificationPreferences(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		devID, settings, ok := readDevSettings(c, database)
		if !ok {
			return
		}
		var incoming map[string]interface{}
		if err := c.ShouldBindJSON(&incoming); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		settings["notification_preferences"] = incoming
		if !saveDevSettings(c, database, devID, settings) {
			return
		}
		c.JSON(http.StatusOK, incoming)
	}
}

// GetNotificationChannels returns the channel integration config (email, telegram, slack).
func GetNotificationChannels(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, settings, ok := readDevSettings(c, database)
		if !ok {
			return
		}
		channels, _ := settings["notification_channels"].(map[string]interface{})
		if channels == nil {
			channels = map[string]interface{}{}
		}
		c.JSON(http.StatusOK, channels)
	}
}

// UpdateNotificationChannels replaces the channel integration config.
func UpdateNotificationChannels(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		devID, settings, ok := readDevSettings(c, database)
		if !ok {
			return
		}
		var incoming map[string]interface{}
		if err := c.ShouldBindJSON(&incoming); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		settings["notification_channels"] = incoming
		if !saveDevSettings(c, database, devID, settings) {
			return
		}
		c.JSON(http.StatusOK, incoming)
	}
}

// GetRecentAlerts returns the 20 most recent error/warning log entries from the
// logs table to populate the "Recent Alerts" panel.
func GetRecentAlerts(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := database.GetConn().QueryContext(c.Request.Context(), `
			SELECT id, level, module, message, metadata, created_at
			FROM logs
			WHERE level IN ('error', 'warn', 'warning', 'critical', 'info')
			ORDER BY created_at DESC
			LIMIT 20
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type Alert struct {
			ID        string      `json:"id"`
			Level     string      `json:"level"`
			Module    string      `json:"module"`
			Message   string      `json:"message"`
			Metadata  interface{} `json:"metadata"`
			CreatedAt time.Time   `json:"createdAt"`
		}

		alerts := make([]Alert, 0)
		for rows.Next() {
			var a Alert
			var meta []byte
			if err := rows.Scan(&a.ID, &a.Level, &a.Module, &a.Message, &meta, &a.CreatedAt); err != nil {
				continue
			}
			if meta != nil {
				var m interface{}
				_ = json.Unmarshal(meta, &m)
				a.Metadata = m
			}
			alerts = append(alerts, a)
		}
		c.JSON(http.StatusOK, alerts)
	}
}
