package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
)

// The CRM's schools are in Uzbekistan; "a day" and "late" are judged on this clock.
const reportTimezone = "Asia/Tashkent"

// ReportDay is one employee's day: first scan = arrival, last scan = departure.
type ReportDay struct {
	Date    string    `json:"date"` // YYYY-MM-DD, school-local
	FirstIn time.Time `json:"firstIn"`
	LastOut time.Time `json:"lastOut"`
	Events  int       `json:"events"`
	Minutes int       `json:"minutes"` // LastOut - FirstIn; 0 with a single scan
	Late    bool      `json:"late"`
}

// EmployeeReport is the month summary for one enrolled person.
type EmployeeReport struct {
	EmployeeID   string      `json:"employeeId"`
	EmployeeNo   string      `json:"employeeNo"`
	FullName     string      `json:"fullName"`
	TeacherID    *string     `json:"teacherId"`
	TeacherName  *string     `json:"teacherName"`
	DeviceID     string      `json:"deviceId"`
	DeviceName   string      `json:"deviceName"`
	DaysPresent  int         `json:"daysPresent"`
	LateDays     int         `json:"lateDays"`
	TotalMinutes int         `json:"totalMinutes"`
	AvgInMinute  *int        `json:"avgInMinute"` // minutes after local midnight, nil without arrivals
	Days         []ReportDay `json:"days"`
}

// ParseReportMonth turns "2026-10" into the [from, to) UTC range of that month on the school clock.
func ParseReportMonth(month string) (from, to time.Time, err error) {
	loc, lerr := time.LoadLocation(reportTimezone)
	if lerr != nil {
		loc = time.FixedZone("UTC+5", 5*3600)
	}
	start, perr := time.ParseInLocation("2006-01", month, loc)
	if perr != nil {
		return time.Time{}, time.Time{}, errors.New("month must look like 2026-10")
	}
	return start.UTC(), start.AddDate(0, 1, 0).UTC(), nil
}

// ParseClockMinutes turns "08:30" into minutes after midnight.
func ParseClockMinutes(s string) (int, error) {
	parts := strings.Split(strings.TrimSpace(s), ":")
	if len(parts) != 2 {
		return 0, errors.New("time must look like 08:30")
	}
	h, e1 := strconv.Atoi(parts[0])
	m, e2 := strconv.Atoi(parts[1])
	if e1 != nil || e2 != nil || h < 0 || h > 23 || m < 0 || m > 59 {
		return 0, errors.New("time must look like 08:30")
	}
	return h*60 + m, nil
}

// AttendanceReport summarises a branch's Face ID attendance for one month,
// per enrolled person (people with no scans appear with zero days, so absence
// is visible). Late means the first scan of the day was after lateAfterMinute.
func (s *HikvisionService) AttendanceReport(ctx context.Context, branchID, month string, lateAfterMinute int) ([]EmployeeReport, error) {
	from, to, err := ParseReportMonth(month)
	if err != nil {
		return nil, err
	}
	loc, lerr := time.LoadLocation(reportTimezone)
	if lerr != nil {
		loc = time.FixedZone("UTC+5", 5*3600)
	}

	empRows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT e.id, e.device_id, e.employee_no, e.full_name, e.teacher_id, t.full_name, d.name
		FROM hikvision_employees e
		JOIN hikvision_devices d ON d.id = e.device_id
		JOIN branches b ON b.id = d.branch_id AND b.deleted_at IS NULL
		LEFT JOIN teachers t ON t.id = e.teacher_id AND t.branch_id = d.branch_id AND t.deleted_at IS NULL
		WHERE d.branch_id = $1 AND e.is_active = true
		ORDER BY e.full_name`, branchID)
	if err != nil {
		return nil, err
	}
	defer empRows.Close()

	byKey := map[string]*EmployeeReport{}
	var order []string
	for empRows.Next() {
		var r EmployeeReport
		if err := empRows.Scan(&r.EmployeeID, &r.DeviceID, &r.EmployeeNo, &r.FullName, &r.TeacherID, &r.TeacherName, &r.DeviceName); err != nil {
			return nil, err
		}
		r.Days = []ReportDay{}
		key := r.DeviceID + "|" + r.EmployeeNo
		byKey[key] = &r
		order = append(order, key)
	}
	if err := empRows.Err(); err != nil {
		return nil, err
	}

	// One row per (person, school-local day): first and last scan and the count.
	dayRows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT a.device_id, a.employee_no,
		       ((a.event_time AT TIME ZONE 'UTC') AT TIME ZONE $4)::date AS day,
		       MIN(a.event_time), MAX(a.event_time), COUNT(*)
		FROM attendance_records a
		JOIN hikvision_devices d ON d.id = a.device_id
		JOIN branches b ON b.id = d.branch_id AND b.deleted_at IS NULL
		WHERE d.branch_id = $1 AND a.event_time >= $2 AND a.event_time < $3
		GROUP BY a.device_id, a.employee_no, day
		ORDER BY day`, branchID, from, to, reportTimezone)
	if err != nil {
		return nil, err
	}
	defer dayRows.Close()

	arrivalSum := map[string]int{}
	for dayRows.Next() {
		var deviceID, employeeNo string
		var day time.Time
		var first, last time.Time
		var n int
		if err := dayRows.Scan(&deviceID, &employeeNo, &day, &first, &last, &n); err != nil {
			return nil, err
		}
		r := byKey[deviceID+"|"+employeeNo]
		if r == nil {
			continue // scans of someone since removed from the device
		}
		firstUTC, lastUTC := first.UTC(), last.UTC()
		d := ReportDay{Date: day.Format("2006-01-02"), FirstIn: firstUTC, LastOut: lastUTC, Events: n}
		if n >= 2 {
			d.Minutes = int(lastUTC.Sub(firstUTC).Minutes())
		}
		fl := firstUTC.In(loc)
		arrival := fl.Hour()*60 + fl.Minute()
		d.Late = arrival > lateAfterMinute
		r.Days = append(r.Days, d)
		r.DaysPresent++
		r.TotalMinutes += d.Minutes
		arrivalSum[deviceID+"|"+employeeNo] += arrival
		if d.Late {
			r.LateDays++
		}
	}
	if err := dayRows.Err(); err != nil {
		return nil, err
	}

	out := make([]EmployeeReport, 0, len(order))
	for _, key := range order {
		r := byKey[key]
		if r.DaysPresent > 0 {
			avg := arrivalSum[key] / r.DaysPresent
			r.AvgInMinute = &avg
		}
		out = append(out, *r)
	}
	// Teachers first, then by name — the page is a teachers' report.
	sort.SliceStable(out, func(i, j int) bool {
		ti, tj := out[i].TeacherID != nil, out[j].TeacherID != nil
		if ti != tj {
			return ti
		}
		return strings.ToLower(out[i].FullName) < strings.ToLower(out[j].FullName)
	})
	return out, nil
}

// FormatMinutes renders 95 as "1:35" (used in exports and logs).
func FormatMinutes(m int) string { return fmt.Sprintf("%d:%02d", m/60, m%60) }
