package service

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

type UserService struct {
	db            *db.Database
	branchService *BranchService
}

func NewUserService(database *db.Database) *UserService {
	return &UserService{
		db:            database,
		branchService: NewBranchService(database),
	}
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	FullName string `json:"fullName" binding:"required"`
	Role     string `json:"role" binding:"required"`
}

func (s *UserService) Login(ctx context.Context, email, password string) (*models.User, error) {
	log.Printf("[UserService.Login] Authenticating user: %s", email)
	
	user := &models.User{}
	query := `SELECT id, email, password, role, full_name, created_at, updated_at FROM users WHERE email = $1`

	err := s.db.GetConn().QueryRowContext(ctx, query, email).Scan(
		&user.ID, &user.Email, &user.Password, &user.Role, &user.FullName, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		log.Printf("[UserService.Login] User not found: %s", email)
		return nil, errors.New("user not found")
	}
	if err != nil {
		log.Printf("[UserService.Login] Database error for %s: %v", email, err)
		return nil, err
	}

	log.Printf("[UserService.Login] User found in database: %s (ID: %s, Role: %s)", email, user.ID, user.Role)

	// Check password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		log.Printf("[UserService.Login] Password mismatch for %s", email)
		return nil, errors.New("invalid password")
	}

	log.Printf("[UserService.Login] Password verified for %s", email)

	user.Password = ""
	return user, nil
}

func (s *UserService) Register(ctx context.Context, req *RegisterRequest) (*models.User, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		ID:        uuid.New().String(),
		Email:     req.Email,
		Password:  string(hashedPassword),
		Role:      models.UserRole(req.Role),
		FullName:  req.FullName,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Insert user
	query := `INSERT INTO users (id, email, password, role, full_name, created_at, updated_at) 
	         VALUES ($1, $2, $3, $4, $5, $6, $7)`

	_, err = s.db.GetConn().ExecContext(ctx, query, user.ID, user.Email, user.Password, user.Role, user.FullName, user.CreatedAt, user.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// For admin users, create a default branch after user is inserted
	if user.Role == models.RoleAdmin {
		log.Printf("[UserService.Register] Creating default branch for admin user: %s", req.Email)
		
		branchReq := &CreateBranchRequest{
			Name:           req.FullName + " Branch",
			Address:        "Default Address",
			Phone:          "N/A",
			MonthlyPayment: 0,
			AdminID:        &user.ID,
		}
		
		branch, err := s.branchService.Create(ctx, branchReq)
		if err != nil {
			log.Printf("[UserService.Register] Failed to create default branch for %s: %v", req.Email, err)
			return nil, err
		}
		
		log.Printf("[UserService.Register] Default branch created: %s (ID: %s)", branch.Name, branch.ID)
	}

	user.Password = ""
	return user, nil
}

func (s *UserService) GetByID(ctx context.Context, id string) (*models.User, error) {
	user := &models.User{}
	query := `SELECT id, email, password, role, full_name, created_at, updated_at FROM users WHERE id = $1`

	err := s.db.GetConn().QueryRowContext(ctx, query, id).Scan(
		&user.ID, &user.Email, &user.Password, &user.Role, &user.FullName, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("user not found")
	}
	if err != nil {
		return nil, err
	}

	user.Password = ""
	return user, nil
}

func (s *UserService) GetAll(ctx context.Context) ([]models.User, error) {
	query := `SELECT id, email, password, role, full_name, created_at, updated_at FROM users`

	rows, err := s.db.GetConn().QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		if err := rows.Scan(&user.ID, &user.Email, &user.Password, &user.Role, &user.FullName, &user.CreatedAt, &user.UpdatedAt); err != nil {
			return nil, err
		}
		user.Password = ""
		users = append(users, user)
	}

	return users, rows.Err()
}

func (s *UserService) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.User, error) {
	query := `UPDATE users SET `
	args := []interface{}{}
	argCount := 1

	for key, value := range updates {
		if argCount > 1 {
			query += ", "
		}
		query += key + " = $" + strconv.Itoa(argCount)
		args = append(args, value)
		argCount++
	}

	query += " WHERE id = $" + strconv.Itoa(argCount)
	args = append(args, id)

	_, err := s.db.GetConn().ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	return s.GetByID(ctx, id)
}

func (s *UserService) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM users WHERE id = $1`
	_, err := s.db.GetConn().ExecContext(ctx, query, id)
	return err
}
