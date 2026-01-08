package utils

import (
	"fmt"
	"log"
	"net/smtp"
	"strconv"
	"strings"
)

type EmailSender struct {
	host     string
	port     int
	username string
	password string
	from     string
}

// NewEmailSender creates a new email sender
func NewEmailSender(smtpHost string, smtpPort string, smtpUser, smtpPass, smtpFrom string) *EmailSender {
	port, _ := strconv.Atoi(smtpPort)
	return &EmailSender{
		host:     smtpHost,
		port:     port,
		username: smtpUser,
		password: smtpPass,
		from:     smtpFrom,
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
            <p>&copy; 2024 School CRM. All rights reserved.</p>
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
            <p>&copy; 2024 School CRM. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
	`, resetLink)

	return es.sendEmail(to, subject, body)
}

// sendEmail is a helper function to send email
func (es *EmailSender) sendEmail(to, subject, body string) error {
	addr := fmt.Sprintf("%s:%d", es.host, es.port)

	// Create message
	headers := map[string]string{
		"From":         es.from,
		"To":           to,
		"Subject":      subject,
		"MIME-Version": "1.0",
		"Content-Type": "text/html; charset=UTF-8",
	}

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + body

	// Use STARTTLS (port 587) - most reliable method across cloud providers
	auth := smtp.PlainAuth("", es.username, es.password, es.host)

	log.Printf("[EmailSender] Connecting to %s:%d", es.host, es.port)
	if err := smtp.SendMail(addr, auth, es.from, []string{to}, []byte(message)); err != nil {
		log.Printf("[EmailSender] Failed to send email to %s: %v", to, err)
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("[EmailSender] Email sent successfully to %s", to)
	return nil
}

// IsValidEmail checks if the email format is valid
func IsValidEmail(email string) bool {
	return strings.Contains(email, "@") && strings.Contains(email, ".")
}
