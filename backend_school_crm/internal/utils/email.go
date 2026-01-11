package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
)

type EmailSender struct {
	apiKey string
	from   string
}

// NewEmailSender creates a new email sender using Resend API
func NewEmailSender(apiKey, from string) *EmailSender {
	return &EmailSender{
		apiKey: apiKey,
		from:   from,
	}
}

// SendOTPEmail sends OTP to user's email
func (es *EmailSender) SendOTPEmail(to, otp string) error {
	subject := "Password Reset OTP"
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
            <h2>Password Reset Request</h2>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>You requested to reset your password. Please use the following OTP code:</p>
            <div class="otp-code">%s</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not request this reset, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Wonderkids' CRM. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
	`, otp)

	return es.sendEmail(to, subject, body)
}

// SendPasswordResetEmail sends password reset link to user's email
func (es *EmailSender) SendPasswordResetEmail(to, resetToken, resetLink string) error {
	subject := "Password Reset Link"
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
        .button { display: inline-block; margin: 20px 0; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
        .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Password Reset</h2>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>You requested to reset your password. Click the link below to reset it:</p>
            <a href="%s" class="button">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this reset, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Wonderkids' CRM. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
	`, resetLink)

	return es.sendEmail(to, subject, body)
}

// sendEmail is a helper function to send email via Resend API
func (es *EmailSender) sendEmail(to, subject, body string) error {
	if es.apiKey == "" {
		return fmt.Errorf("Resend API key not configured")
	}

	// Prepare the request payload
	payload := map[string]interface{}{
		"from":    es.from,
		"to":      []string{to},
		"subject": subject,
		"html":    body,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[EmailSender] Failed to marshal payload: %v", err)
		return fmt.Errorf("failed to marshal email payload: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(payloadBytes))
	if err != nil {
		log.Printf("[EmailSender] Failed to create request: %v", err)
		return fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", es.apiKey))

	// Send the request
	client := &http.Client{}
	log.Printf("[EmailSender] Sending email to %s via Resend API", to)
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[EmailSender] Failed to send request: %v", err)
		return fmt.Errorf("failed to send email: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[EmailSender] Failed to read response: %v", err)
		return fmt.Errorf("failed to read response: %w", err)
	}

	// Check response status
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("[EmailSender] API error (status %d): %s", resp.StatusCode, string(respBody))
		return fmt.Errorf("Resend API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	log.Printf("[EmailSender] Email sent successfully to %s via Resend API", to)
	return nil
}

// IsValidEmail checks if the email format is valid
func IsValidEmail(email string) bool {
	return strings.Contains(email, "@") && strings.Contains(email, ".")
}
