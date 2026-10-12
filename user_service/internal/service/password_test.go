package service

import (
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestValidateNewPassword(t *testing.T) {
	if err := ValidateNewPassword("short"); err != ErrPasswordTooShort {
		t.Fatalf("expected too short, got %v", err)
	}
	if err := ValidateNewPassword("longenough1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := ValidateNewPassword(strings.Repeat("a", 73)); err != ErrPasswordTooLong {
		t.Fatalf("expected too long, got %v", err)
	}
}

func TestVerifyPassword(t *testing.T) {
	h, _ := bcrypt.GenerateFromPassword([]byte("correct-horse"), bcrypt.MinCost)
	if !VerifyPassword(string(h), "correct-horse") {
		t.Fatal("expected match")
	}
	if VerifyPassword(string(h), "wrong") || VerifyPassword("", "x") {
		t.Fatal("expected mismatch")
	}
}
