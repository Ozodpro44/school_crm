package service_test

import (
	"context"
	"strings"
	"testing"

	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
	"github.com/school-crm/backend/internal/testhelpers"
)

func TestUserService_Register_Teacher(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	svc := service.NewUserService(database)

	req := &service.RegisterRequest{
		Email:    "teacher@test.example",
		Password: "password123",
		FullName: "Test Teacher",
		Role:     "teacher",
	}

	user, err := svc.Register(ctx, req)
	if err != nil {
		t.Fatalf("Register (teacher): %v", err)
	}
	if user.ID == "" {
		t.Error("registered user should have a non-empty ID")
	}
	if user.Email != req.Email {
		t.Errorf("email = %q, want %q", user.Email, req.Email)
	}
	if user.Role != models.RoleTeacher {
		t.Errorf("role = %q, want %q", user.Role, models.RoleTeacher)
	}
}

func TestUserService_Login_Success(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	svc := service.NewUserService(database)

	// Register first.
	_, err := svc.Register(ctx, &service.RegisterRequest{
		Email:    "login@test.example",
		Password: "securepass",
		FullName: "Login Test",
		Role:     "teacher",
	})
	if err != nil {
		t.Fatalf("Register: %v", err)
	}

	// Login with correct credentials.
	user, err := svc.Login(ctx, "login@test.example", "securepass")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	if user.Email != "login@test.example" {
		t.Errorf("logged-in email = %q, want login@test.example", user.Email)
	}
}

func TestUserService_Login_WrongPassword(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	svc := service.NewUserService(database)

	_, err := svc.Register(ctx, &service.RegisterRequest{
		Email:    "badpw@test.example",
		Password: "correctpass",
		FullName: "Bad PW Test",
		Role:     "teacher",
	})
	if err != nil {
		t.Fatalf("Register: %v", err)
	}

	_, err = svc.Login(ctx, "badpw@test.example", "wrongpass")
	if err == nil {
		t.Error("expected error for wrong password")
	}
}

func TestUserService_Login_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	svc := service.NewUserService(database)

	_, err := svc.Login(ctx, "nobody@test.example", "pass")
	if err == nil {
		t.Error("expected error for non-existent email")
	}
}

func TestUserService_Register_DuplicateEmail(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	svc := service.NewUserService(database)

	req := &service.RegisterRequest{
		Email:    "dup@test.example",
		Password: "pass123",
		FullName: "Dup User",
		Role:     "teacher",
	}
	if _, err := svc.Register(ctx, req); err != nil {
		t.Fatalf("first Register: %v", err)
	}

	_, err := svc.Register(ctx, req)
	if err == nil {
		t.Error("expected error on duplicate email registration")
	}
	if !strings.Contains(err.Error(), "insert user") && !strings.Contains(err.Error(), "duplicate") {
		t.Logf("duplicate error message: %v", err)
	}
}

func TestUserService_GetByID(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — skipped in short mode")
	}

	database, cleanup := testhelpers.NewTestDB(t)
	defer cleanup()

	ctx := context.Background()
	svc := service.NewUserService(database)

	created, err := svc.Register(ctx, &service.RegisterRequest{
		Email:    "getbyid@test.example",
		Password: "pass123",
		FullName: "Get By ID",
		Role:     "teacher",
	})
	if err != nil {
		t.Fatalf("Register: %v", err)
	}

	got, err := svc.GetByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("GetByID ID = %q, want %q", got.ID, created.ID)
	}
	if got.Email != created.Email {
		t.Errorf("GetByID email = %q, want %q", got.Email, created.Email)
	}
}
