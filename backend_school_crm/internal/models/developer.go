package models

import "time"

// Developer represents a developer account for the dev dashboard
type Developer struct {
	ID        string     `json:"id" db:"id"`
	Email     string     `json:"email" db:"email"`
	Password  string     `json:"-" db:"password"` // Never expose password in JSON
	FullName  string     `json:"fullName" db:"full_name"`
	Role      string     `json:"role" db:"role"` // developer, admin
	IsActive  bool       `json:"isActive" db:"is_active"`
	LastLogin *time.Time `json:"lastLogin" db:"last_login"`
	CreatedAt time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time  `json:"updatedAt" db:"updated_at"`
}

// DeveloperLoginRequest DTO for developer login
type DeveloperLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// DeveloperLoginResponse DTO for developer login response
type DeveloperLoginResponse struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	FullName string `json:"fullName"`
	Role     string `json:"role"`
	Token    string `json:"token"`
}

// DeveloperRegisterRequest DTO for developer registration
type DeveloperRegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	FullName string `json:"fullName" binding:"required,min=2"`
}
