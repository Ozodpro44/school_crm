package models

import "time"

// HikvisionDevice represents one Hikvision face-recognition access control
// terminal (e.g. DS-K1T343MWX) registered for a branch. The backend talks to
// it over its local ISAPI HTTP interface using Digest authentication.
type HikvisionDevice struct {
	ID           string    `json:"id" db:"id"`
	BranchID     string    `json:"branchId" db:"branch_id"`
	Name         string    `json:"name" db:"name"`
	Host         string    `json:"host" db:"host"` // device LAN IP or hostname, e.g. "192.168.0.115"
	Username     string    `json:"username" db:"username"`
	Password     string    `json:"-" db:"password"` // never serialized to JSON
	WebhookToken string    `json:"-" db:"webhook_token"`
	IsActive     bool      `json:"isActive" db:"is_active"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

// HikvisionEmployee links a person enrolled on a device (by its own
// employeeNo) to an optional Teacher record in the CRM, so attendance
// records can be attributed to a real person even for staff who aren't
// teachers.
type HikvisionEmployee struct {
	ID         string    `json:"id" db:"id"`
	DeviceID   string    `json:"deviceId" db:"device_id"`
	EmployeeNo string    `json:"employeeNo" db:"employee_no"`
	FullName   string    `json:"fullName" db:"full_name"`
	TeacherID  *string   `json:"teacherId" db:"teacher_id"`
	IsActive   bool      `json:"isActive" db:"is_active"`
	CreatedAt  time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt  time.Time `json:"updatedAt" db:"updated_at"`
}

type AttendanceEventType string

const (
	AttendanceCheckIn  AttendanceEventType = "check_in"
	AttendanceCheckOut AttendanceEventType = "check_out"
)

// AttendanceRecord is one face-recognition event reported by a device,
// classified as a check-in or check-out.
type AttendanceRecord struct {
	ID           string              `json:"id" db:"id"`
	DeviceID     string              `json:"deviceId" db:"device_id"`
	EmployeeID   *string             `json:"employeeId" db:"employee_id"`
	EmployeeNo   string              `json:"employeeNo" db:"employee_no"`
	EmployeeName string              `json:"employeeName" db:"-"` // populated via JOIN when listing
	EventTime    time.Time           `json:"eventTime" db:"event_time"`
	EventType    AttendanceEventType `json:"eventType" db:"event_type"`
	MinorEvent   *int                `json:"minorEvent" db:"minor_event"`
	Source       string              `json:"source" db:"source"` // "push" | "poll"
	CreatedAt    time.Time           `json:"createdAt" db:"created_at"`
}
