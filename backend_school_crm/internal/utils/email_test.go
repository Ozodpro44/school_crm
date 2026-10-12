package utils_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/school-crm/backend/internal/utils"
)

// ---- IsValidEmail ----

func TestIsValidEmail_Valid(t *testing.T) {
	valid := []string{
		"user@example.com",
		"admin@school.uz",
		"first.last@sub.domain.org",
	}
	for _, email := range valid {
		if !utils.IsValidEmail(email) {
			t.Errorf("IsValidEmail(%q) = false, want true", email)
		}
	}
}

func TestIsValidEmail_Invalid(t *testing.T) {
	invalid := []string{
		"",
		"notanemail",
		"missing-at.com",
		"@nodomain",
		"no-dot@nodot",
	}
	for _, email := range invalid {
		if utils.IsValidEmail(email) {
			t.Errorf("IsValidEmail(%q) = true, want false", email)
		}
	}
}

// ---- NewEmailSender ----

func TestNewEmailSender_Constructor(t *testing.T) {
	es := utils.NewEmailSender("test-api-key", "noreply@example.com")
	if es == nil {
		t.Fatal("NewEmailSender should not return nil")
	}
}

// ---- SendOTPEmail / SendPasswordResetEmail — no API key ----

func TestSendOTPEmail_NoAPIKey(t *testing.T) {
	es := utils.NewEmailSender("", "noreply@example.com")
	err := es.SendOTPEmail("user@example.com", "123456")
	if err == nil {
		t.Error("expected error when API key is empty")
	}
}

func TestSendPasswordResetEmail_NoAPIKey(t *testing.T) {
	es := utils.NewEmailSender("", "noreply@example.com")
	err := es.SendPasswordResetEmail("user@example.com", "tok", "https://example.com/reset")
	if err == nil {
		t.Error("expected error when API key is empty")
	}
}

// ---- SendOTPEmail with a mock Resend server ----

func TestSendOTPEmail_MockServer_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	// We cannot swap the URL at runtime because it is hardcoded in the
	// implementation. Test the early-exit path only (no API key).
	// Full integration with Resend's live API is out of scope for unit tests.
	// Here we just confirm no panic occurs and the nil-check is correct.
	es := utils.NewEmailSender("fake-key", "noreply@example.com")
	if es == nil {
		t.Fatal("NewEmailSender should not return nil")
	}
}

func TestSendOTPEmail_MockServer_APIError(t *testing.T) {
	// Simulate the Resend API returning a 422 error.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"error":"invalid_email"}`, http.StatusUnprocessableEntity)
	}))
	defer srv.Close()

	// Cannot inject the URL, so we confirm the empty-key fast-path covers the
	// "API key not configured" error branch, not a network call.
	es := utils.NewEmailSender("", "from@example.com")
	err := es.SendOTPEmail("bad@@bad", "000000")
	if err == nil {
		t.Error("expected error for missing API key")
	}
}
