package utils

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"
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

	// Use SMTPS (port 465) or STARTTLS (port 587)
	var err error
	if es.port == 465 {
		// SMTPS - TLS from the start
		err = es.sendMailSMTPS(addr, to, []byte(message))
	} else {
		// STARTTLS (port 587) or other
		auth := smtp.PlainAuth("", es.username, es.password, es.host)
		err = smtp.SendMail(addr, auth, es.from, []string{to}, []byte(message))
	}

	if err != nil {
		log.Printf("[EmailSender] Failed to send email to %s: %v", to, err)
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("[EmailSender] Email sent successfully to %s", to)
	return nil
}

// sendMailSMTPS sends email using SMTPS (TLS from the start on port 465)
func (es *EmailSender) sendMailSMTPS(addr string, to string, message []byte) error {
	// Create TLS connection
	tlsConfig := &tls.Config{
		ServerName: es.host,
	}

	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("failed to connect to SMTP server: %w", err)
	}
	defer conn.Close()

	// Create SMTP client
	client, err := smtp.NewClient(conn, es.host)
	if err != nil {
		return fmt.Errorf("failed to create SMTP client: %w", err)
	}
	defer client.Close()

	// Authenticate
	auth := smtp.PlainAuth("", es.username, es.password, es.host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("failed to authenticate: %w", err)
	}

	// Send email
	if err := client.Mail(es.from); err != nil {
		return fmt.Errorf("failed to set sender: %w", err)
	}

	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("failed to set recipient: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("failed to open data channel: %w", err)
	}

	_, err = w.Write(message)
	if err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("failed to close data channel: %w", err)
	}

	client.Quit()
	return nil
}

// IsValidEmail checks if the email format is valid
func IsValidEmail(email string) bool {
	return strings.Contains(email, "@") && strings.Contains(email, ".")
}
