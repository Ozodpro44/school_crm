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
	db                   *db.Database
	branchService        *BranchService
	subscriptionService  *SubscriptionService
	redisClient          *utils.RedisClient
	emailSender          *utils.EmailSender
}

func NewUserService(database *db.Database) *UserService {
	return &UserService{
		db:                  database,
		branchService:       NewBranchService(database),
		subscriptionService: NewSubscriptionService(database),
		redisClient:         nil,
		emailSender:         nil,
	}
}

// SetRedisClient sets the Redis client for the service
func (s *UserService) SetRedisClient(redisClient *utils.RedisClient) {
	s.redisClient = redisClient
}

// SetEmailSender sets the email sender for the service
func (s *UserService) SetEmailSender(emailSender *utils.EmailSender) {
	s.emailSender = emailSender
}

// GetDB returns the database connection
func (s *UserService) GetDB() *db.Database {
	return s.db
}

// GetUserPermissions retrieves permissions for a specific user
func (s *UserService) GetUserPermissions(ctx context.Context, userID string) (*models.Permission, error) {
	permissionService := NewPermissionService(s.db)
	return permissionService.GetByUserID(ctx, userID)
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
	var branchID *string
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
		branchID = &branch.ID
	}

	// Create free trial subscription for new user
	log.Printf("[UserService.Register] Creating free trial subscription for user: %s", req.Email)
	trialPlan, err := s.subscriptionService.GetOrCreateFreeTrial(ctx)
	if err != nil {
		log.Printf("[UserService.Register] Warning: Failed to create free trial subscription: %v", err)
		// Don't fail the registration if subscription creation fails
	} else {
		now := utils.GetLocalTime()
		endDate := now.AddDate(0, 0, 14) // 14 days from now
		paymentMethod := "free_trial"
		notes := "Automatic free trial subscription"
		subscription := &models.Subscription{
			UserID:        user.ID,
			PlanID:        trialPlan.ID,
			BranchID:      branchID,
			Status:        "active",
			StartDate:     now,
			RenewalDate:   &endDate,
			AutoRenew:     false,
			PaymentMethod: &paymentMethod,
			Notes:         &notes,
		}

		err = s.subscriptionService.CreateSubscription(ctx, subscription)
		if err != nil {
			log.Printf("[UserService.Register] Warning: Failed to create subscription for user %s: %v", user.ID, err)
		} else {
			log.Printf("[UserService.Register] Free trial subscription created for user: %s (Plan: %s)", user.ID, trialPlan.Name)
		}
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
	// Validate and sanitize input fields
	allowedFields := map[string]bool{
		"full_name":           true,
		"email":               true,
		"password":            true,
		"current_password":    true,
	}

	query := `UPDATE users SET `
	args := []interface{}{}
	argCount := 1
	hasUpdates := false

	// Hash password if provided
	var currentPassword string
	if pwd, exists := updates["current_password"]; exists {
		if pwdStr, ok := pwd.(string); ok {
			currentPassword = pwdStr
		}
		delete(updates, "current_password")
	}

	if newPwd, exists := updates["password"]; exists {
		if pwdStr, ok := newPwd.(string); ok {
			// If current_password is provided, verify it
			if currentPassword != "" {
				// Note: user.Password is cleared in GetByID, need to fetch separately
				userRow := &models.User{}
				userQuery := `SELECT password FROM users WHERE id = $1`
				err := s.db.GetConn().QueryRowContext(ctx, userQuery, id).Scan(&userRow.Password)
				if err != nil {
					log.Printf("[UserService.Update] Failed to fetch current password: %v", err)
					return nil, errors.New("failed to verify current password")
				}

				if err := bcrypt.CompareHashAndPassword([]byte(userRow.Password), []byte(currentPassword)); err != nil {
					return nil, errors.New("current password is incorrect")
				}
			}

			// Hash the new password
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(pwdStr), bcrypt.DefaultCost)
			if err != nil {
				log.Printf("[UserService.Update] Failed to hash password: %v", err)
				return nil, errors.New("failed to update password")
			}
			updates["password"] = string(hashedPassword)
		}
	}

	for key, value := range updates {
		if !allowedFields[key] {
			continue
		}
		if hasUpdates {
			query += ", "
		}
		query += key + " = $" + strconv.Itoa(argCount)
		args = append(args, value)
		argCount++
		hasUpdates = true
	}

	if !hasUpdates {
		log.Printf("[UserService.Update] No valid fields to update for user %s", id)
		return s.GetByID(ctx, id)
	}

	query += " WHERE id = $" + strconv.Itoa(argCount)
	args = append(args, id)

	log.Printf("[UserService.Update] Executing query: %s with args: %v", query, args)

	result, err := s.db.GetConn().ExecContext(ctx, query, args...)
	if err != nil {
		log.Printf("[UserService.Update] Database error: %v", err)
		return nil, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Printf("[UserService.Update] Error getting rows affected: %v", err)
	} else {
		log.Printf("[UserService.Update] Rows affected: %d", rowsAffected)
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

// ForgotPasswordRequest initiates password reset by sending OTP to email
// Only admin users can reset their password
func (s *UserService) ForgotPasswordRequest(ctx context.Context, email string) error {
	if s.redisClient == nil || s.emailSender == nil {
		return errors.New("redis or email service not configured")
	}

	// Verify user exists and is an admin
	user := &models.User{}
	query := `SELECT id, email, role FROM users WHERE email = $1`
	err := s.db.GetConn().QueryRowContext(ctx, query, email).Scan(&user.ID, &user.Email, &user.Role)
	if err == sql.ErrNoRows {
		log.Printf("[UserService.ForgotPasswordRequest] User not found: %s", email)
		return errors.New("user not found")
	}
	if err != nil {
		log.Printf("[UserService.ForgotPasswordRequest] Database error: %v", err)
		return err
	}

	// Check if user is admin
	if user.Role != models.RoleAdmin {
		log.Printf("[UserService.ForgotPasswordRequest] Non-admin user attempted password reset: %s (Role: %s)", email, user.Role)
		return errors.New("only admin users can reset password")
	}

	// Generate and store OTP
	otp := utils.GenerateOTP()
	if err := s.redisClient.SetOTP(ctx, email, otp); err != nil {
		log.Printf("[UserService.ForgotPasswordRequest] Failed to store OTP: %v", err)
		return errors.New("failed to generate OTP")
	}

	// Send OTP via email
	if err := s.emailSender.SendOTPEmail(email, otp); err != nil {
		log.Printf("[UserService.ForgotPasswordRequest] Failed to send email: %v", err)
		return errors.New("failed to send OTP email")
	}

	log.Printf("[UserService.ForgotPasswordRequest] OTP sent successfully to %s", email)
	return nil
}

// VerifyOTPRequest verifies the OTP and generates reset token
func (s *UserService) VerifyOTPRequest(ctx context.Context, email, otp string) (string, error) {
	if s.redisClient == nil {
		return "", errors.New("redis service not configured")
	}

	// Verify OTP exists and matches
	storedOTP, err := s.redisClient.GetOTP(ctx, email)
	if err != nil {
		log.Printf("[UserService.VerifyOTPRequest] OTP not found or expired: %v", err)
		return "", errors.New("OTP expired or invalid")
	}

	if storedOTP != otp {
		log.Printf("[UserService.VerifyOTPRequest] OTP mismatch for email: %s", email)
		return "", errors.New("invalid OTP")
	}

	// Delete OTP after verification
	s.redisClient.DeleteOTP(ctx, email)

	// Generate reset token
	resetToken := uuid.New().String()
	if err := s.redisClient.SetPasswordReset(ctx, email, resetToken); err != nil {
		log.Printf("[UserService.VerifyOTPRequest] Failed to store reset token: %v", err)
		return "", errors.New("failed to generate reset token")
	}

	log.Printf("[UserService.VerifyOTPRequest] OTP verified successfully for %s", email)
	return resetToken, nil
}

// ResetPasswordWithToken resets the password using the reset token
func (s *UserService) ResetPasswordWithToken(ctx context.Context, email, resetToken, newPassword string) error {
	if s.redisClient == nil {
		return errors.New("redis service not configured")
	}

	// Verify reset token
	storedToken, err := s.redisClient.GetPasswordReset(ctx, email)
	if err != nil {
		log.Printf("[UserService.ResetPasswordWithToken] Reset token not found or expired: %v", err)
		return errors.New("reset token expired or invalid")
	}

	if storedToken != resetToken {
		log.Printf("[UserService.ResetPasswordWithToken] Reset token mismatch for email: %s", email)
		return errors.New("invalid reset token")
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("[UserService.ResetPasswordWithToken] Failed to hash password: %v", err)
		return errors.New("failed to reset password")
	}

	// Update password in database
	query := `UPDATE users SET password = $1, updated_at = $2 WHERE email = $3`
	_, err = s.db.GetConn().ExecContext(ctx, query, string(hashedPassword), utils.GetLocalTime(), email)
	if err != nil {
		log.Printf("[UserService.ResetPasswordWithToken] Failed to update password: %v", err)
		return errors.New("failed to reset password")
	}

	// Delete reset token
	s.redisClient.DeletePasswordReset(ctx, email)

	log.Printf("[UserService.ResetPasswordWithToken] Password reset successfully for %s", email)
	return nil
}

// ResendOTP resends OTP to the user's email
// Only admin users can request password reset
func (s *UserService) ResendOTP(ctx context.Context, email string) error {
	if s.redisClient == nil || s.emailSender == nil {
		return errors.New("redis or email service not configured")
	}

	// Verify user exists and is an admin
	user := &models.User{}
	query := `SELECT id, email, role FROM users WHERE email = $1`
	err := s.db.GetConn().QueryRowContext(ctx, query, email).Scan(&user.ID, &user.Email, &user.Role)
	if err == sql.ErrNoRows {
		log.Printf("[UserService.ResendOTP] User not found: %s", email)
		return errors.New("user not found")
	}
	if err != nil {
		return err
	}

	// Check if user is admin
	if user.Role != models.RoleAdmin {
		log.Printf("[UserService.ResendOTP] Non-admin user attempted password reset: %s (Role: %s)", email, user.Role)
		return errors.New("only admin users can reset password")
	}

	// Generate and store new OTP
	otp := utils.GenerateOTP()
	if err := s.redisClient.SetOTP(ctx, email, otp); err != nil {
		log.Printf("[UserService.ResendOTP] Failed to store OTP: %v", err)
		return errors.New("failed to generate OTP")
	}

	// Send OTP via email
	if err := s.emailSender.SendOTPEmail(email, otp); err != nil {
		log.Printf("[UserService.ResendOTP] Failed to send email: %v", err)
		return errors.New("failed to send OTP email")
	}

	log.Printf("[UserService.ResendOTP] OTP resent successfully to %s", email)
	return nil
}
