package service

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"strconv"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/utils"
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

// GetDB returns the database connection
func (s *UserService) GetDB() *db.Database {
	return s.db
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

	// Fetch branches for managers, branch admins, and admins
	var branches []models.Branch

	if user.Role == models.RoleAdmin {
		// For admins, get branches they created (admin_id = user.ID)
		query := `
			SELECT id, name, address, phone, monthly_payment, currency, admin_id, created_at, updated_at
			FROM branches
			WHERE admin_id = $1
			ORDER BY name
		`
		rows, branchErr := s.db.GetConn().QueryContext(ctx, query, user.ID)
		if branchErr != nil {
			log.Printf("[UserService.Login] Error fetching admin branches for user %s: %v", user.ID, branchErr)
			return nil, branchErr
		}
		defer rows.Close()

		for rows.Next() {
			branch := models.Branch{}
			if scanErr := rows.Scan(&branch.ID, &branch.Name, &branch.Address, &branch.Phone, &branch.MonthlyPayment, &branch.Currency, &branch.AdminID, &branch.CreatedAt, &branch.UpdatedAt); scanErr != nil {
				return nil, scanErr
			}
			branches = append(branches, branch)
		}
	} else if user.Role == models.RoleManager || user.Role == models.RoleBranchAdmin {
		// For managers and branch admins, get branches via branch_managers table
		var managerErr error
		branches, managerErr = s.GetUserBranches(ctx, user.ID)
		if managerErr != nil {
			log.Printf("[UserService.Login] Error fetching branches for user %s: %v", user.ID, managerErr)
			return nil, managerErr
		}
	}

	for _, branch := range branches {
		user.BranchIDs = append(user.BranchIDs, branch.ID)
	}

	if len(user.BranchIDs) > 0 {
		user.BranchID = &user.BranchIDs[0]
		log.Printf("[UserService.Login] Branches loaded for user %s: %v", user.ID, user.BranchIDs)
	}

	user.Password = ""

	// Fetch permissions for the user
	permissionService := NewPermissionService(s.db)
	permissions, err := permissionService.GetByUserID(ctx, user.ID)
	if err != nil {
		log.Printf("[UserService.Login] Failed to fetch permissions for user %s: %v", user.ID, err)
	} else {
		user.Permissions = permissions
	}

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
		CreatedAt: utils.GetLocalTime(),
		UpdatedAt: utils.GetLocalTime(),
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

	// Fetch permissions for the user
	permissionService := NewPermissionService(s.db)
	permissions, err := permissionService.GetByUserID(ctx, user.ID)
	if err != nil {
		log.Printf("[UserService.Register] Failed to fetch permissions for user %s: %v", user.ID, err)
	} else {
		user.Permissions = permissions
	}

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

	// Fetch permissions for the user
	permissionService := NewPermissionService(s.db)
	permissions, err := permissionService.GetByUserID(ctx, id)
	if err != nil {
		log.Printf("[UserService.GetByID] Failed to fetch permissions for user %s: %v", id, err)
	} else {
		user.Permissions = permissions
	}

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
	permissionService := NewPermissionService(s.db)

	for rows.Next() {
		var user models.User
		if err := rows.Scan(&user.ID, &user.Email, &user.Password, &user.Role, &user.FullName, &user.CreatedAt, &user.UpdatedAt); err != nil {
			return nil, err
		}
		user.Password = ""

		// Fetch permissions for the user
		permissions, err := permissionService.GetByUserID(ctx, user.ID)
		if err == nil {
			user.Permissions = permissions
		}

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

// GetUserBranches returns all branches managed by a user
func (s *UserService) GetUserBranches(ctx context.Context, userID string) ([]models.Branch, error) {
	branches := []models.Branch{}
	query := `
		SELECT b.id, b.name, b.address, b.phone, b.monthly_payment, b.currency, b.admin_id, b.created_at, b.updated_at
		FROM branches b
		INNER JOIN branch_managers bm ON b.id = bm.branch_id
		WHERE bm.manager_id = $1
		ORDER BY b.name
	`

	rows, err := s.db.GetConn().QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		branch := models.Branch{}
		if err := rows.Scan(&branch.ID, &branch.Name, &branch.Address, &branch.Phone, &branch.MonthlyPayment, &branch.Currency, &branch.AdminID, &branch.CreatedAt, &branch.UpdatedAt); err != nil {
			return nil, err
		}
		branches = append(branches, branch)
	}

	return branches, nil
}

// AddBranchManager associates a manager with a branch
func (s *UserService) AddBranchManager(ctx context.Context, branchID, managerID string) (*models.BranchManager, error) {
	id := uuid.New().String()
	query := `
		INSERT INTO branch_managers (id, branch_id, manager_id)
		VALUES ($1, $2, $3)
		RETURNING id, branch_id, manager_id, created_at
	`

	bm := &models.BranchManager{}
	err := s.db.GetConn().QueryRowContext(ctx, query, id, branchID, managerID).Scan(&bm.ID, &bm.BranchID, &bm.ManagerID, &bm.CreatedAt)
	if err != nil {
		return nil, err
	}

	return bm, nil
}

// RemoveBranchManager removes a manager from a branch
func (s *UserService) RemoveBranchManager(ctx context.Context, branchID, managerID string) error {
	query := `DELETE FROM branch_managers WHERE branch_id = $1 AND manager_id = $2`
	_, err := s.db.GetConn().ExecContext(ctx, query, branchID, managerID)
	return err
}

// GetBranchManagers returns all managers for a branch
func (s *UserService) GetBranchManagers(ctx context.Context, branchID string) ([]models.User, error) {
	managers := []models.User{}
	query := `
		SELECT u.id, u.email, u.role, u.full_name, u.created_at, u.updated_at
		FROM users u
		INNER JOIN branch_managers bm ON u.id = bm.manager_id
		WHERE bm.branch_id = $1
		ORDER BY u.full_name
	`

	rows, err := s.db.GetConn().QueryContext(ctx, query, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		user := models.User{}
		if err := rows.Scan(&user.ID, &user.Email, &user.Role, &user.FullName, &user.CreatedAt, &user.UpdatedAt); err != nil {
			return nil, err
		}
		managers = append(managers, user)
	}

	return managers, nil
}

// GetManagersByBranch returns all managers (and branch_admins) assigned to a specific branch with their branch assignments
func (s *UserService) GetManagersByBranch(ctx context.Context, branchID string) ([]models.User, error) {
	managers := []models.User{}
	query := `
		SELECT DISTINCT u.id, u.email, u.role, u.full_name, u.created_at, u.updated_at
		FROM users u
		INNER JOIN branch_managers bm ON u.id = bm.manager_id
		WHERE bm.branch_id = $1
		ORDER BY u.full_name
	`

	rows, err := s.db.GetConn().QueryContext(ctx, query, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	permissionService := NewPermissionService(s.db)

	for rows.Next() {
		user := models.User{}
		if err := rows.Scan(&user.ID, &user.Email, &user.Role, &user.FullName, &user.CreatedAt, &user.UpdatedAt); err != nil {
			return nil, err
		}

		// Fetch permissions for the user
		permissions, err := permissionService.GetByUserID(ctx, user.ID)
		if err == nil {
			user.Permissions = permissions
		}

		// Fetch the branches this manager is assigned to
		branches, err := s.GetUserBranches(ctx, user.ID)
		if err != nil {
			return nil, err
		}

		for _, branch := range branches {
			user.BranchIDs = append(user.BranchIDs, branch.ID)
		}

		if len(user.BranchIDs) > 0 {
			user.BranchID = &user.BranchIDs[0]
		}

		managers = append(managers, user)
	}

	return managers, nil
}
