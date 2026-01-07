package db

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// SeedData initializes the database with default data
func (db *Database) SeedData(ctx context.Context) error {
	// Check if admin user already exists
	var adminExists int
	err := db.conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&adminExists)
	if err != nil {
		return fmt.Errorf("failed to check admin user: %w", err)
	}

	// If admin exists, skip seeding
	if adminExists > 0 {
		log.Println("Database already seeded, skipping...")
		return nil
	}

	log.Println("Seeding database with initial data...")

	// Create admin user
	adminID := uuid.New().String()
	adminPassword, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash admin password: %w", err)
	}

	_, err = db.conn.ExecContext(ctx, `
		INSERT INTO users (id, email, password, role, full_name)
		VALUES ($1, $2, $3, $4, $5)
	`, adminID, "admin@school.com", string(adminPassword), "admin", "Admin User")
	if err != nil {
		return fmt.Errorf("failed to insert admin user: %w", err)
	}

	// Create sample branches
	branch1ID := uuid.New().String()
	branch2ID := uuid.New().String()

	_, err = db.conn.ExecContext(ctx, `
		INSERT INTO branches (id, name, address, phone, monthly_payment, admin_id, currency)
		VALUES ($1, $2, $3, $4, $5, $6, $7), ($8, $9, $10, $11, $12, $13, $14)
	`,
		branch1ID, "Марказий филиал", "Тошкент ш., Чилонзор т., 12-кв, 34-уй", "+998 90 123 45 67", 500000.00, adminID, "UZS",
		branch2ID, "Яшнобод филиали", "Тошкент ш., Яшнобод т., 5-кв, 12-уй", "+998 90 234 56 78", 450000.00, adminID, "UZS",
	)
	if err != nil {
		return fmt.Errorf("failed to insert branches: %w", err)
	}

	// Create financial months for branches
	for _, branchID := range []string{branch1ID, branch2ID} {
		financialMonthID := uuid.New().String()
		_, err = db.conn.ExecContext(ctx, `
			INSERT INTO financial_months (id, branch_id, year, month, status, payment_amount)
			VALUES ($1, $2, 2024, 1, 'OPEN', 500000)
		`, financialMonthID, branchID)
		if err != nil {
			log.Printf("Warning: failed to insert financial month for branch %s: %v", branchID, err)
		}

		// Update branch current_financial_month_id
		_, err = db.conn.ExecContext(ctx, `
			UPDATE branches SET current_financial_month_id = $1 WHERE id = $2
		`, financialMonthID, branchID)
		if err != nil {
			log.Printf("Warning: failed to update branch financial month: %v", err)
		}
	}

	// Create settings for branches
	_, err = db.conn.ExecContext(ctx, `
		INSERT INTO settings (id, branch_id, default_monthly_payment, default_teacher_salary, currency, language, school_name)
		VALUES ($1, $2, $3, $4, $5, $6, $7), ($8, $9, $10, $11, $12, $13, $14)
	`,
		uuid.New().String(), branch1ID, 500000.00, 1000000.00, "UZS", "uz", "Марказий филиал",
		uuid.New().String(), branch2ID, 450000.00, 900000.00, "UZS", "uz", "Яшнобод филиали",
	)
	if err != nil {
		return fmt.Errorf("failed to insert settings: %w", err)
	}

	// Set admin permissions
	_, err = db.conn.ExecContext(ctx, `
		INSERT INTO permissions (id, user_id, 
			can_view_students, can_edit_students, can_delete_students,
			can_view_teachers, can_edit_teachers, can_delete_teachers,
			can_view_classes, can_edit_classes, can_delete_classes,
			can_view_payments, can_edit_payments,
			can_view_salaries, can_edit_salaries,
			can_view_expenses, can_edit_expenses, can_delete_expenses,
			can_view_reports,
			can_view_settings, can_edit_settings)
		VALUES ($1, $2, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true)
	`, uuid.New().String(), adminID)
	if err != nil {
		return fmt.Errorf("failed to insert admin permissions: %w", err)
	}

	// Create sample teachers for branch 1
	teacher1ID := uuid.New().String()
	teacher2ID := uuid.New().String()

	_, err = db.conn.ExecContext(ctx, `
		INSERT INTO teachers (id, full_name, subjects, monthly_salary, phone, email, branch_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7), ($8, $9, $10, $11, $12, $13, $14)
	`,
		teacher1ID, "Алиева Фарида", pq.Array{"Математика", "Физика"}, 1000000.00, "+998 90 111 11 11", "farida@school.com", branch1ID,
		teacher2ID, "Хасимов Рустам", pq.Array{"Англий тили", "Адаб"}, 900000.00, "+998 90 222 22 22", "rustam@school.com", branch1ID,
	)
	if err != nil {
		return fmt.Errorf("failed to insert teachers: %w", err)
	}

	// Create sample classes for branch 1
	class1ID := uuid.New().String()
	class2ID := uuid.New().String()

	_, err = db.conn.ExecContext(ctx, `
		INSERT INTO classes (id, name, teacher_id, branch_id)
		VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
	`,
		class1ID, "A класс", teacher1ID, branch1ID,
		class2ID, "B класс", teacher2ID, branch1ID,
	)
	if err != nil {
		return fmt.Errorf("failed to insert classes: %w", err)
	}

	// Create sample students for classes
	student1ID := uuid.New().String()
	student2ID := uuid.New().String()
	student3ID := uuid.New().String()

	_, err = db.conn.ExecContext(ctx, `
		INSERT INTO students (id, full_name, class_id, phone, parent_phone, monthly_payment, status, branch_id, enrollment_date, class_confirmed)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), true),
		       ($9, $10, $11, $12, $13, $14, $15, $16, NOW(), true),
		       ($17, $18, $19, $20, $21, $22, $23, $24, NOW(), true)
	`,
		student1ID, "Раҳимов Икрам", class1ID, "+998 90 333 33 33", "+998 90 555 55 55", 500000.00, "active", branch1ID,
		student2ID, "Комилова Нозима", class1ID, "+998 90 444 44 44", "+998 90 666 66 66", 500000.00, "active", branch1ID,
		student3ID, "Сафаров Ғайрат", class2ID, "+998 90 777 77 77", "+998 90 888 88 88", 500000.00, "active", branch1ID,
	)
	if err != nil {
		return fmt.Errorf("failed to insert students: %w", err)
	}

	log.Println("Database seeding completed successfully")
	return nil
}
