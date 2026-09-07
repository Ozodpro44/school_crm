package handlers

import (
	"io"
	"log"
	"mime"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

// RegisterAttendanceRoutes registers the authenticated CRM-side endpoints
// for managing Hikvision devices, syncing employees onto them, and viewing
// attendance. Mount it on the same protected group as the other resources.
//
// The whole /hikvision group is admin-only: connecting a device (and every
// employee/attendance operation under it) exposes device credentials and
// building access, so only the "admin" role may reach it, same as
// /branches/:id/switch-month.
func RegisterAttendanceRoutes(router *gin.RouterGroup, attendanceService *service.AttendanceService, userService *service.UserService) {
	hikvision := router.Group("/hikvision")
	hikvision.Use(middleware.RoleChecker(userService, models.RoleAdmin))

	hikvision.POST("/devices", createDevice(attendanceService))
	hikvision.GET("/devices", listDevices(attendanceService))
	hikvision.POST("/devices/:id/configure-push", configurePush(attendanceService))

	hikvision.POST("/employees", addEmployee(attendanceService))
	hikvision.GET("/employees", listEmployees(attendanceService))
	hikvision.POST("/employees/:id/face", uploadEmployeeFace(attendanceService))
	hikvision.DELETE("/employees/:id", removeEmployee(attendanceService))

	hikvision.GET("/attendance", listAttendance(attendanceService))
}

// RegisterHikvisionWebhookRoutes registers the public endpoint the device
// itself calls — pass it a group created directly off the router (e.g.
// router.Group("/api")), the same way the ClickUz/Telegram webhooks are
// registered, so no JWT middleware is attached. The URL carries its own
// per-device secret token since the device can't log in like a CRM user.
func RegisterHikvisionWebhookRoutes(router *gin.RouterGroup, attendanceService *service.AttendanceService) {
	router.POST("/hikvision/webhook/:deviceId/:token", hikvisionWebhook(attendanceService))
}

// RegisterHikCentralWebhookRoutes registers a SEPARATE public endpoint for
// HikCentral Professional's own Open API event subscription
// (eventSubscriptionByEventTypes) to call — set up on Ozodbek's Windows PC,
// which sits on the SAME LAN as the terminal. That's the whole point of
// this route existing next to hikvisionWebhook above rather than reusing
// it: HikCentral only ever calls OUT to us (outbound HTTPS from the
// school's network), so it never runs into the ISP's inbound block that
// stopped the terminal's own direct push and stopped Railway from polling
// the terminal directly.
//
// Deliberately a distinct path (not just a query param on the existing
// one) so Railway's logs make it obvious which integration a given request
// came from while we're still figuring out HikCentral's exact payload
// shape. Reuses the same per-device WebhookToken as hikvisionWebhook —
// see cmd/hikvision-cli's show-webhook-url -hikcentral for how to fetch
// the full URL to paste into HikCentral's subscription config.
func RegisterHikCentralWebhookRoutes(router *gin.RouterGroup, attendanceService *service.AttendanceService) {
	router.POST("/hikvision/hikcentral-webhook/:deviceId/:token", hikCentralWebhook(attendanceService))
}

func createDevice(s *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req service.CreateDeviceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		device, err := s.CreateDevice(c.Request.Context(), &req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, device)
	}
}

func listDevices(s *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
			return
		}
		devices, err := s.ListDevicesByBranch(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, devices)
	}
}

type configurePushRequest struct {
	PublicHost string `json:"publicHost" binding:"required"`
	PublicPort int    `json:"publicPort" binding:"required"`
	UseHTTPS   bool   `json:"useHttps"`
}

func configurePush(s *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req configurePushRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := s.ConfigurePush(c.Request.Context(), id, req.PublicHost, req.PublicPort, req.UseHTTPS); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "push notifications configured"})
	}
}

func addEmployee(s *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req service.AddEmployeeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		emp, err := s.AddEmployee(c.Request.Context(), &req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, emp)
	}
}

func listEmployees(s *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		deviceID := c.Query("deviceId")
		if deviceID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "deviceId is required"})
			return
		}
		employees, err := s.ListEmployeesByDevice(c.Request.Context(), deviceID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, employees)
	}
}

// uploadEmployeeFace expects a multipart/form-data POST with a "photo"
// field containing a JPEG image of the person's face.
func uploadEmployeeFace(s *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		file, _, err := c.Request.FormFile("photo")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": `photo file is required (multipart field "photo")`})
			return
		}
		defer file.Close()

		data, err := io.ReadAll(file)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := s.UploadEmployeeFace(c.Request.Context(), id, data); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "face uploaded"})
	}
}

func removeEmployee(s *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if err := s.RemoveEmployee(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "employee removed"})
	}
}

func listAttendance(s *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		filter := service.AttendanceFilter{
			DeviceID:   c.Query("deviceId"),
			EmployeeID: c.Query("employeeId"),
		}
		if from := c.Query("from"); from != "" {
			if t, err := time.Parse("2006-01-02", from); err == nil {
				filter.From = &t
			}
		}
		if to := c.Query("to"); to != "" {
			if t, err := time.Parse("2006-01-02", to); err == nil {
				t = t.Add(24 * time.Hour)
				filter.To = &t
			}
		}

		records, err := s.ListAttendance(c.Request.Context(), filter)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, records)
	}
}

// hikvisionWebhook receives the device's push notification: multipart/form-data
// with an XML or JSON part describing the access-control event (and
// sometimes a captured face image, which we ignore here — our devices are
// configured with parameterFormatType=XML, but JSON is accepted too in case
// a different device model is added later). It always replies 200 so the
// device doesn't endlessly retry, even when the token doesn't match or the
// event turns out not to be a recordable one.
func hikvisionWebhook(s *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		deviceID := c.Param("deviceId")
		token := c.Param("token")

		device, err := s.GetDevice(c.Request.Context(), deviceID)
		if err != nil || device.WebhookToken != token {
			c.Status(http.StatusOK)
			return
		}

		contentType := c.GetHeader("Content-Type")
		mediaType, params, parseErr := mime.ParseMediaType(contentType)

		if parseErr == nil && strings.HasPrefix(mediaType, "multipart/") {
			reader := multipart.NewReader(c.Request.Body, params["boundary"])
			for {
				part, err := reader.NextPart()
				if err == io.EOF {
					break
				}
				if err != nil {
					break
				}
				partType := part.Header.Get("Content-Type")
				if strings.Contains(partType, "json") || strings.Contains(partType, "xml") {
					data, _ := io.ReadAll(part)
					_ = s.ProcessWebhookEvent(c.Request.Context(), deviceID, data)
				}
				part.Close()
			}
		} else {
			// Some events may arrive as a plain XML or JSON body instead of multipart.
			data, _ := io.ReadAll(c.Request.Body)
			_ = s.ProcessWebhookEvent(c.Request.Context(), deviceID, data)
		}

		c.Status(http.StatusOK)
	}
}

// hikCentralWebhook receives events HikCentral Professional's Open API
// pushes after an eventSubscriptionByEventTypes subscription is registered
// for this device. We haven't captured a real payload from it yet, so this
// deliberately does NOT try to parse it into an attendance record — doing
// that from a guessed field layout risks silently writing wrong check-in
// times/names, which is worse than writing nothing. It authenticates the
// call and logs the raw body in full so the first real delivery can be
// read straight out of Railway's logs; once we've seen one, the parsing
// (and the write into attendance records, mirroring recordFaceEvent) gets
// filled in against the real shape instead of documentation guesses.
func hikCentralWebhook(s *service.AttendanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		deviceID := c.Param("deviceId")
		token := c.Param("token")

		device, err := s.GetDevice(c.Request.Context(), deviceID)
		if err != nil || device.WebhookToken != token {
			c.Status(http.StatusOK)
			return
		}

		body, _ := io.ReadAll(c.Request.Body)
		log.Printf("hikcentral webhook: device=%s content-type=%s body=%s",
			deviceID, c.GetHeader("Content-Type"), string(body))

		c.Status(http.StatusOK)
	}
}
