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
	PhotoURL     *string     `json:"photoUrl,omitempty"`
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
		SELECT e.id, e.device_id, e.employee_no, e.full_name, e.teacher_id, t.full_name, d.name, e.photo_thumb
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
		var thumb []byte
		if err := empRows.Scan(&r.EmployeeID, &r.DeviceID, &r.EmployeeNo, &r.FullName, &r.TeacherID, &r.TeacherName, &r.DeviceName, &thumb); err != nil {
			return nil, err
		}
		if len(thumb) > 0 {
			u := thumbDataURL(thumb)
			r.PhotoURL = &u
		}
		r.Days = []ReportDay{}
		key := r.DeviceID + "|" + r.EmployeeNo
		byKey[key] = &r
		order = append(order, key)
	}
	if err := empRows.Err(); err != nil {
		return nil, err
	}

	// Raw scans, oldest first; grouped per person and school-local day in Go
	// so the pairing rules live in one testable function (summariseDay).
	scanRows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT a.device_id, a.employee_no, a.event_time
		FROM attendance_records a
		JOIN hikvision_devices d ON d.id = a.device_id
		JOIN branches b ON b.id = d.branch_id AND b.deleted_at IS NULL
		WHERE d.branch_id = $1 AND a.event_time >= $2 AND a.event_time < $3
		ORDER BY a.event_time`, branchID, from, to)
	if err != nil {
		return nil, err
	}
	defer scanRows.Close()

	type dayKey struct{ person, date string }
	scans := map[dayKey][]time.Time{}
	for scanRows.Next() {
		var deviceID, employeeNo string
		var at time.Time
		if err := scanRows.Scan(&deviceID, &employeeNo, &at); err != nil {
			return nil, err
		}
		person := deviceID + "|" + employeeNo
		if byKey[person] == nil {
			continue // scans of someone since removed from the device
		}
		k := dayKey{person, at.In(loc).Format("2006-01-02")}
		scans[k] = append(scans[k], at.UTC())
	}
	if err := scanRows.Err(); err != nil {
		return nil, err
	}

	arrivalSum := map[string]int{}
	for k, times := range scans {
		r := byKey[k.person]
		d := summariseDay(k.date, times, lateAfterMinute, loc)
		r.Days = append(r.Days, d)
		r.DaysPresent++
		r.TotalMinutes += d.Minutes
		fl := d.FirstIn.In(loc)
		arrivalSum[k.person] += fl.Hour()*60 + fl.Minute()
		if d.Late {
			r.LateDays++
		}
	}
	for _, r := range byKey {
		sort.Slice(r.Days, func(i, j int) bool { return r.Days[i].Date < r.Days[j].Date })
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

// scanDebounce: a second scan this soon after the previous one is the same
// visit (the person lingered in front of the terminal), not an exit.
const scanDebounce = time.Minute

// summariseDay turns one person's scans of one day (any order) into a
// ReportDay. Scans alternate in/out: 1st = in, 2nd = out, 3rd = in, ... Worked
// time is the sum of the completed in→out pairs, so a break between an "out"
// and the next "in" is not counted; a trailing unpaired "in" adds nothing.
func summariseDay(date string, times []time.Time, lateAfterMinute int, loc *time.Location) ReportDay {
	sort.Slice(times, func(i, j int) bool { return times[i].Before(times[j]) })
	kept := make([]time.Time, 0, len(times))
	for _, t := range times {
		if len(kept) > 0 && t.Sub(kept[len(kept)-1]) < scanDebounce {
			continue
		}
		kept = append(kept, t)
	}
	d := ReportDay{Date: date, FirstIn: kept[0], LastOut: kept[len(kept)-1], Events: len(kept)}
	for i := 0; i+1 < len(kept); i += 2 {
		d.Minutes += int(kept[i+1].Sub(kept[i]).Minutes())
	}
	fl := kept[0].In(loc)
	d.Late = fl.Hour()*60+fl.Minute() > lateAfterMinute
	return d
}

// FormatMinutes renders 95 as "1:35" (used in exports and logs).
func FormatMinutes(m int) string { return fmt.Sprintf("%d:%02d", m/60, m%60) }
