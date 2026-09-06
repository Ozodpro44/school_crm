// Command hikvision-cli manages Hikvision devices and employees for the
// attendance integration.
//
// Why this exists as a separate local tool instead of just using the REST
// endpoints in internal/handlers/attendance.go: the CRM backend is deployed
// on Railway (cloud), but the Hikvision terminal lives on the school's
// private LAN (e.g. 192.168.0.115) with no port forwarding set up — so the
// cloud backend cannot open a connection to the device.
//
// The reverse direction (device -> cloud webhook, set up by configure-push
// below) works for terminals whose network allows outbound internet access.
// Some don't — only an inbound port-forward exists (e.g. for the admin UI),
// with no outbound route at all — and pushed notifications then never
// arrive no matter how correctly configure-push is set up. This was
// confirmed on Wonder Kids' terminal: neither a direct HTTPS connection nor
// a raw TCP proxy to our backend ever reached the webhook. watch-events
// below is the fallback for exactly that case: instead of waiting for the
// device to push events out, it polls the device's own event log from a
// machine on its LAN and writes straight to the database — that machine has
// the internet access the terminal doesn't.
//
// This CLI reuses the exact same internal/service.AttendanceService used by
// the API, but you run it on a machine that IS on the device's network
// (e.g. this laptop, connected to the school's Wi-Fi), while it talks to
// the SAME production database over Railway's public Postgres proxy — so
// whatever it writes/changes is immediately visible to the cloud API and
// the attendance reports it serves.
//
// Usage (run from backend_school_crm/, with your .env in place):
//
//	go run ./cmd/hikvision-cli add-device      -branch <branchID> -name <name> -host <ip> -user <username> -pass <password>
//	go run ./cmd/hikvision-cli list-devices    -branch <branchID>
//	go run ./cmd/hikvision-cli configure-push  -device <deviceID> -host <publicHost> -port <port> [-https]
//	go run ./cmd/hikvision-cli add-employee    -device <deviceID> -no <employeeNo> -name <fullName> [-teacher <teacherID>]
//	go run ./cmd/hikvision-cli upload-face     -employee <employeeID> -photo <path-to.jpg>
//	go run ./cmd/hikvision-cli remove-employee -employee <employeeID>
//	go run ./cmd/hikvision-cli list-employees  -device <deviceID>
//	go run ./cmd/hikvision-cli watch-events    -device <deviceID> [-interval <seconds>]
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/service"
)

func main() {
	_ = godotenv.Load()

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL environment variable is required (check your .env)")
	}

	ctx := context.Background()
	database, err := db.New(ctx, dsn)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer database.Close()

	// NewStorageServiceFromEnv returns nil (not an error) when no bucket env
	// vars are set — fine here, this CLI's commands don't need it, but the
	// constructor now requires a *StorageService argument regardless.
	attendanceService := service.NewAttendanceService(database, service.NewStorageServiceFromEnv())

	switch os.Args[1] {
	case "add-device":
		cmdAddDevice(ctx, attendanceService, os.Args[2:])
	case "update-device":
		cmdUpdateDevice(ctx, attendanceService, os.Args[2:])
	case "list-devices":
		cmdListDevices(ctx, attendanceService, os.Args[2:])
	case "configure-push":
		cmdConfigurePush(ctx, attendanceService, os.Args[2:])
	case "add-employee":
		cmdAddEmployee(ctx, attendanceService, os.Args[2:])
	case "upload-face":
		cmdUploadFace(ctx, attendanceService, os.Args[2:])
	case "remove-employee":
		cmdRemoveEmployee(ctx, attendanceService, os.Args[2:])
	case "list-employees":
		cmdListEmployees(ctx, attendanceService, os.Args[2:])
	case "watch-events":
		cmdWatchEvents(ctx, attendanceService, os.Args[2:])
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`Hikvision attendance CLI — run this on the same network as the device.

Usage:
  go run ./cmd/hikvision-cli add-device      -branch <branchID> -name <name> -host <ip> -user <username> -pass <password>
  go run ./cmd/hikvision-cli update-device   -device <deviceID> -host <newIp> [-user <newUser> -pass <newPass>]
  go run ./cmd/hikvision-cli list-devices    -branch <branchID>
  go run ./cmd/hikvision-cli configure-push  -device <deviceID> -host <publicHost> -port <port> [-https]
  go run ./cmd/hikvision-cli add-employee    -device <deviceID> -no <employeeNo> -name <fullName> [-teacher <teacherID>]
  go run ./cmd/hikvision-cli upload-face     -employee <employeeID> -photo <path-to.jpg>
  go run ./cmd/hikvision-cli remove-employee -employee <employeeID>
  go run ./cmd/hikvision-cli list-employees  -device <deviceID>
  go run ./cmd/hikvision-cli watch-events    -device <deviceID> [-interval <seconds>]`)
}

func printJSON(v interface{}) {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		log.Fatalf("failed to encode result: %v", err)
	}
	fmt.Println(string(b))
}

func cmdAddDevice(ctx context.Context, s *service.AttendanceService, args []string) {
	fs := flag.NewFlagSet("add-device", flag.ExitOnError)
	branch := fs.String("branch", "", "branch ID")
	name := fs.String("name", "", "device name")
	host := fs.String("host", "", "device LAN IP, e.g. 192.168.0.115")
	user := fs.String("user", "admin", "device username")
	pass := fs.String("pass", "", "device password")
	_ = fs.Parse(args)

	if *branch == "" || *name == "" || *host == "" || *pass == "" {
		log.Fatal("branch, name, host and pass are required")
	}

	device, err := s.CreateDevice(ctx, &service.CreateDeviceRequest{
		BranchID: *branch,
		Name:     *name,
		Host:     *host,
		Username: *user,
		Password: *pass,
	})
	if err != nil {
		log.Fatalf("failed to add device: %v", err)
	}
	printJSON(device)
}

// cmdUpdateDevice re-points an existing device record at a new host/IP —
// needed when a terminal behind a router with a dynamic public IP gets a
// new one (e.g. after a power cycle). Validates the new address against the
// device with its existing credentials before saving.
//
// If -pass is also given, it validates and saves new credentials at the
// same time (via UpdateDeviceCredentials instead of UpdateDeviceHost) —
// needed because a device can come back up reachable at its new host but
// answering to a DIFFERENT admin password than what's on file (seen on
// Wonder Kids' terminal: same disruption that changed the IP also left it
// on an older password). Every other command's 401 is the symptom to
// watch for — re-run this with -pass once you've confirmed, by logging
// into the device's own web UI, which password it currently accepts.
func cmdUpdateDevice(ctx context.Context, s *service.AttendanceService, args []string) {
	fs := flag.NewFlagSet("update-device", flag.ExitOnError)
	device := fs.String("device", "", "device ID")
	host := fs.String("host", "", "new device IP (or IP:port), e.g. 185.213.230.149:8081")
	user := fs.String("user", "", "new device username — only needed if it changed too (defaults to admin when -pass is set)")
	pass := fs.String("pass", "", "new device password — set this whenever the device's live admin password no longer matches what's on file (401 errors from other commands are the symptom)")
	_ = fs.Parse(args)
	if *device == "" || *host == "" {
		log.Fatal("device and host are required")
	}
	if *pass != "" {
		u := *user
		if u == "" {
			u = "admin"
		}
		if err := s.UpdateDeviceCredentials(ctx, *device, *host, u, *pass); err != nil {
			log.Fatalf("failed to update device: %v", err)
		}
		fmt.Println("device host and credentials updated successfully")
		return
	}
	if err := s.UpdateDeviceHost(ctx, *device, *host); err != nil {
		log.Fatalf("failed to update device: %v", err)
	}
	fmt.Println("device host updated successfully")
}

func cmdListDevices(ctx context.Context, s *service.AttendanceService, args []string) {
	fs := flag.NewFlagSet("list-devices", flag.ExitOnError)
	branch := fs.String("branch", "", "branch ID")
	_ = fs.Parse(args)
	if *branch == "" {
		log.Fatal("branch is required")
	}
	devices, err := s.ListDevicesByBranch(ctx, *branch)
	if err != nil {
		log.Fatalf("failed to list devices: %v", err)
	}
	printJSON(devices)
}

func cmdConfigurePush(ctx context.Context, s *service.AttendanceService, args []string) {
	fs := flag.NewFlagSet("configure-push", flag.ExitOnError)
	device := fs.String("device", "", "device ID")
	host := fs.String("host", "", "public host/domain the device should push events to")
	port := fs.Int("port", 443, "public port")
	useHTTPS := fs.Bool("https", true, "use HTTPS")
	_ = fs.Parse(args)
	if *device == "" || *host == "" {
		log.Fatal("device and host are required")
	}
	if err := s.ConfigurePush(ctx, *device, *host, *port, *useHTTPS); err != nil {
		log.Fatalf("failed to configure push: %v", err)
	}
	fmt.Println("push notifications configured successfully")
}

func cmdAddEmployee(ctx context.Context, s *service.AttendanceService, args []string) {
	fs := flag.NewFlagSet("add-employee", flag.ExitOnError)
	device := fs.String("device", "", "device ID")
	no := fs.String("no", "", "employee number (used on the device)")
	name := fs.String("name", "", "employee full name")
	teacher := fs.String("teacher", "", "optional linked teacher ID")
	_ = fs.Parse(args)
	if *device == "" || *no == "" || *name == "" {
		log.Fatal("device, no and name are required")
	}
	var teacherID *string
	if *teacher != "" {
		teacherID = teacher
	}
	emp, err := s.AddEmployee(ctx, &service.AddEmployeeRequest{
		DeviceID:   *device,
		EmployeeNo: *no,
		FullName:   *name,
		TeacherID:  teacherID,
	})
	if err != nil {
		log.Fatalf("failed to add employee: %v", err)
	}
	printJSON(emp)
}

func cmdUploadFace(ctx context.Context, s *service.AttendanceService, args []string) {
	fs := flag.NewFlagSet("upload-face", flag.ExitOnError)
	employee := fs.String("employee", "", "employee ID")
	photo := fs.String("photo", "", "path to a JPEG photo")
	_ = fs.Parse(args)
	if *employee == "" || *photo == "" {
		log.Fatal("employee and photo are required")
	}
	data, err := os.ReadFile(*photo)
	if err != nil {
		log.Fatalf("failed to read photo: %v", err)
	}
	if err := s.UploadEmployeeFace(ctx, *employee, data); err != nil {
		log.Fatalf("failed to upload face: %v", err)
	}
	fmt.Println("face uploaded successfully")
}

func cmdRemoveEmployee(ctx context.Context, s *service.AttendanceService, args []string) {
	fs := flag.NewFlagSet("remove-employee", flag.ExitOnError)
	employee := fs.String("employee", "", "employee ID")
	_ = fs.Parse(args)
	if *employee == "" {
		log.Fatal("employee is required")
	}
	if err := s.RemoveEmployee(ctx, *employee); err != nil {
		log.Fatalf("failed to remove employee: %v", err)
	}
	fmt.Println("employee removed successfully")
}

func cmdListEmployees(ctx context.Context, s *service.AttendanceService, args []string) {
	fs := flag.NewFlagSet("list-employees", flag.ExitOnError)
	device := fs.String("device", "", "device ID")
	_ = fs.Parse(args)
	if *device == "" {
		log.Fatal("device is required")
	}
	employees, err := s.ListEmployeesByDevice(ctx, *device)
	if err != nil {
		log.Fatalf("failed to list employees: %v", err)
	}
	printJSON(employees)
}

// cmdWatchEvents runs forever, polling the device's own event log and
// writing any new successful face scans straight to the database. Leave
// this running (e.g. in a terminal window, or as a background service) on a
// machine that stays on the same LAN as the terminal — this is the only way
// attendance events reach the CRM for terminals that can't push events out
// over the internet themselves (see the doc comment at the top of this
// file).
func cmdWatchEvents(ctx context.Context, s *service.AttendanceService, args []string) {
	fs := flag.NewFlagSet("watch-events", flag.ExitOnError)
	device := fs.String("device", "", "device ID")
	interval := fs.Int("interval", 15, "seconds between polls")
	_ = fs.Parse(args)
	if *device == "" {
		log.Fatal("device is required")
	}
	if *interval < 3 {
		log.Fatal("interval must be at least 3 seconds (don't hammer the device)")
	}

	fmt.Printf("watching device %s for new attendance events every %ds — leave this running; press Ctrl+C to stop\n", *device, *interval)
	for {
		n, err := s.PollAndRecordEvents(ctx, *device)
		if err != nil {
			log.Printf("poll error (will retry): %v", err)
		} else if n > 0 {
			log.Printf("recorded %d new attendance event(s)", n)
		}
		time.Sleep(time.Duration(*interval) * time.Second)
	}
}
