package handlers

import (
	"io"
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
