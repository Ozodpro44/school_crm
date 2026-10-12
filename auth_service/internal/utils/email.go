// Package utils holds small service-independent helpers. EmailSender here is
// a minimal port of backend_school_crm/internal/utils/email.go's
// Resend-backed sender — auth_service's config already carried unused
// ResendAPIKey/ResendFrom fields (see internal/config), wired for exactly
// this: emailing the login-time MFA OTP (internal/platformsettings'
// RequireMFA setting) from the service that actually issues tokens.
package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

type EmailSender struct {
	apiKey string
	from   string
}

func NewEmailSender(apiKey, from string) *EmailSender {
	return &EmailSender{apiKey: apiKey, from: from}
}

// SendLoginOTPEmail emails the 6-digit code required to complete a login
// when the platform-wide "Require MFA" setting is on.
func (es *EmailSender) SendLoginOTPEmail(to, otp string) error {
	subject := "Your sign-in code"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .otp-code { font-size: 32px; font-weight: bold; text-align: center; color: #4CAF50; letter-spacing: 5px; margin: 20px 0; }
        .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Sign-in Verification</h2>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Use the following code to finish signing in:</p>
            <div class="otp-code">%s</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not attempt to sign in, you can safely ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 School CRM. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
	`, otp)

	return es.sendEmail(to, subject, body, "login OTP")
}

// SendRegistrationOTPEmail emails the 6-digit code required to confirm
// ownership of the address given at signup before the account is fully
// activated (trial subscription + permissions granted).
func (es *EmailSender) SendRegistrationOTPEmail(to, otp string) error {
	subject := "Confirm your email — School CRM"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .otp-code { font-size: 32px; font-weight: bold; text-align: center; color: #4f46e5; letter-spacing: 5px; margin: 20px 0; }
        .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Welcome to School CRM</h2>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Use the following code to confirm your email and activate your account:</p>
            <div class="otp-code">%s</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not sign up for School CRM, you can safely ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 School CRM. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
	`, otp)

	return es.sendEmail(to, subject, body, "registration OTP")
}

func (es *EmailSender) sendEmail(to, subject, body, kind string) error {
	if es.apiKey == "" {
		return fmt.Errorf("resend API key not configured")
	}

	payload := map[string]interface{}{
		"from":    es.from,
		"to":      []string{to},
		"subject": subject,
		"html":    body,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal email payload: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to create HTTP request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", es.apiKey))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("resend API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	log.Printf("[EmailSender] %s sent to %s", kind, to)
	return nil
}
