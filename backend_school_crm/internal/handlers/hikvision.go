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

// hikvisionHandler carries the services the management endpoints need. Every
// endpoint resolves whatever device/employee it was pointed at back to its
// branch and checks the caller belongs to that branch — the role check alone
// only says "is an admin", and this is a multi-tenant platform: without the
// ownership check any admin could read, enroll people on, or delete from
// another school's terminal by UUID.
type hikvisionHandler struct {
	svc   *service.HikvisionService
	users *service.UserService
}

// RegisterHikvisionRoutes registers the authenticated CRM-side endpoints
// for managing Hikvision devices, syncing employees onto them, and viewing
// attendance. Mount it on the same protected group as the other resources.
//
// The whole /hikvision group is admin-only: connecting a device (and every
// employee/attendance operation under it) exposes device credentials and
// building access, so only the "admin" role may reach it, same as
// /branches/:id/switch-month.
func RegisterHikvisionRoutes(router *gin.RouterGroup, hikvisionService *service.HikvisionService, userService *service.UserService) {
	h := &hikvisionHandler{svc: hikvisionService, users: userService}

	hikvision := router.Group("/hikvision")
	hikvision.Use(middleware.RoleChecker(userService, models.RoleAdmin))

	hikvision.POST("/devices", h.createDevice)
	hikvision.GET("/devices", h.listDevices)
	hikvision.POST("/devices/:id/configure-push", h.configurePush)

	hikvision.POST("/employees", h.addEmployee)
	hikvision.GET("/employees", h.listEmployees)
	hikvision.POST("/employees/:id/face", h.uploadEmployeeFace)
	hikvision.DELETE("/employees/:id", h.removeEmployee)

	hikvision.GET("/attendance", h.listAttendance)
}

// RegisterHikvisionWebhookRoutes registers the public endpoint the device
// itself calls — pass it a group created directly off the router (e.g.
// router.Group("/api")), the same way the ClickUz/Telegram webhooks are
// registered, so no JWT middleware is attached. The URL carries its own
// per-device secret token since the device can't log in like a CRM user.
func RegisterHikvisionWebhookRoutes(router *gin.RouterGroup, attendanceService *service.HikvisionService) {
	router.POST("/hikvision/webhook/:deviceId/:token", hikvisionWebhook(attendanceService))
}

// RegisterHikCentralWebhookRoutes registers a SEPARATE public endpoint for
// HikCentral Professional's own Open API event subscription
// (eventSubscriptionByEventTypes) to call — set up on a PC that sits on the
// SAME LAN as the terminal. That's the whole point of this route existing
// next to hikvisionWebhook above rather than reusing it: HikCentral only
// ever calls OUT to us (outbound HTTPS from the school's network), so it
// never runs into an ISP's inbound block that can stop the terminal's own
// direct push and stop the server from polling the terminal directly.
//
// Deliberately a distinct path (not just a query param on the existing
// one) so logs make it obvious which integration a given request came from
// while HikCentral's exact payload shape is still being confirmed. Reuses
// the same per-device WebhookToken as hikvisionWebhook — see
// cmd/hikvision-cli's show-webhook-url -hikcentral for how to fetch the
// full URL to paste into HikCentral's subscription config.
func RegisterHikCentralWebhookRoutes(router *gin.RouterGroup, attendanceService *service.HikvisionService) {
	router.POST("/hikvision/hikcentral-webhook/:deviceId/:token", hikCentralWebhook(attendanceService))
}

// callerBelongsToBranch writes the error response and returns false unless
// the authenticated caller owns/manages/works in branchID.
func (h *hikvisionHandler) callerBelongsToBranch(c *gin.Context, branchID string) bool {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return false
	}
	ok, err := h.users.BelongsToBranch(c.Request.Context(), userID, branchID)
	if err != nil {
		log.Printf("hikvision: BelongsToBranch user=%s branch=%s: %v", userID, branchID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error verifying branch access"})
		return false
	}
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied: you do not belong to this branch"})
		return false
	}
	return true
}

// loadDevice returns the device only if the caller may manage it. A missing
// device and one belonging to someone else both answer 404, so UUIDs can't
// be probed for existence across tenants.
func (h *hikvisionHandler) loadDevice(c *gin.Context, deviceID string) (*models.HikvisionDevice, bool) {
	device, err := h.svc.GetDevice(c.Request.Context(), deviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
		return nil, false
	}
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return nil, false
	}
	ok, err := h.users.BelongsToBranch(c.Request.Context(), userID, device.BranchID)
	if err != nil {
		log.Printf("hikvision: BelongsToBranch user=%s branch=%s: %v", userID, device.BranchID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error verifying branch access"})
		return nil, false
	}
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
		return nil, false
	}
	return device, true
}

// loadEmployee is loadDevice for an employee, via the device it's enrolled on.
func (h *hikvisionHandler) loadEmployee(c *gin.Context, employeeID string) (*models.HikvisionEmployee, bool) {
	emp, err := h.svc.GetEmployee(c.Request.Context(), employeeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "employee not found"})
		return nil, false
	}
	if _, ok := h.loadDevice(c, emp.DeviceID); !ok {
		return nil, false
	}
	return emp, true
}

func (h *hikvisionHandler) createDevice(c *gin.Context) {
	var req service.CreateDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !h.callerBelongsToBranch(c, req.BranchID) {
		return
	}
	device, err := h.svc.CreateDevice(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, device)
}

func (h *hikvisionHandler) listDevices(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.callerBelongsToBranch(c, branchID) {
		return
	}
	devices, err := h.svc.ListDevicesByBranch(c.Request.Context(), branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if devices == nil {
		devices = []models.HikvisionDevice{}
	}
	c.JSON(http.StatusOK, devices)
}

type configurePushRequest struct {
	PublicHost string `json:"publicHost" binding:"required"`
	PublicPort int    `json:"publicPort" binding:"required"`
	UseHTTPS   bool   `json:"useHttps"`
}

func (h *hikvisionHandler) configurePush(c *gin.Context) {
	device, ok := h.loadDevice(c, c.Param("id"))
	if !ok {
		return
	}
	var req configurePushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.ConfigurePush(c.Request.Context(), device.ID, req.PublicHost, req.PublicPort, req.UseHTTPS); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "push notifications configured"})
}

func (h *hikvisionHandler) addEmployee(c *gin.Context) {
	var req service.AddEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, ok := h.loadDevice(c, req.DeviceID); !ok {
		return
	}
	emp, err := h.svc.AddEmployee(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, emp)
}

func (h *hikvisionHandler) listEmployees(c *gin.Context) {
	deviceID := c.Query("deviceId")
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "deviceId is required"})
		return
	}
	if _, ok := h.loadDevice(c, deviceID); !ok {
		return
	}
	employees, err := h.svc.ListEmployeesByDevice(c.Request.Context(), deviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if employees == nil {
		employees = []models.HikvisionEmployee{}
	}
	c.JSON(http.StatusOK, employees)
}

// maxFacePhotoBytes caps the uploaded photo; terminals accept far smaller
// images, and an unbounded io.ReadAll is a memory-exhaustion vector.
const maxFacePhotoBytes = 5 << 20

// uploadEmployeeFace expects a multipart/form-data POST with a "photo"
// field containing a JPEG image of the person's face.
func (h *hikvisionHandler) uploadEmployeeFace(c *gin.Context) {
	emp, ok := h.loadEmployee(c, c.Param("id"))
	if !ok {
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxFacePhotoBytes+(1<<20))
	file, _, err := c.Request.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `photo file is required (multipart field "photo", max 5 MB)`})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxFacePhotoBytes+1))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if len(data) > maxFacePhotoBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "photo exceeds 5 MB"})
		return
	}

	if err := h.svc.UploadEmployeeFace(c.Request.Context(), emp.ID, data); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "face uploaded"})
}

func (h *hikvisionHandler) removeEmployee(c *gin.Context) {
	emp, ok := h.loadEmployee(c, c.Param("id"))
	if !ok {
		return
	}
	if err := h.svc.RemoveEmployee(c.Request.Context(), emp.ID); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "employee removed"})
}

// listAttendance requires either a deviceId or a branchId: that's what ties
// the query to a branch the caller was just verified against. (An unscoped
// query would return every tenant's records.) employeeId only narrows
// further — the service ANDs the filters, so an employee from another device
// simply matches nothing.
func (h *hikvisionHandler) listAttendance(c *gin.Context) {
	filter := service.AttendanceFilter{EmployeeID: c.Query("employeeId")}

	if deviceID := c.Query("deviceId"); deviceID != "" {
		device, ok := h.loadDevice(c, deviceID)
		if !ok {
			return
		}
		filter.DeviceID = device.ID
		filter.BranchID = device.BranchID
	} else {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "deviceId or branchId is required"})
			return
		}
		if !h.callerBelongsToBranch(c, branchID) {
			return
		}
		filter.BranchID = branchID
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

	records, err := h.svc.ListAttendance(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if records == nil {
		records = []models.AttendanceRecord{}
	}
	c.JSON(http.StatusOK, records)
}

// hikvisionWebhook receives the device's push notification: multipart/form-data
// with an XML or JSON part describing the access-control event (and
// sometimes a captured face image, which we ignore here — our devices are
// configured with parameterFormatType=XML, but JSON is accepted too in case
// a different device model is added later). It always replies 200 so the
// device doesn't endlessly retry, even when the token doesn't match or the
// event turns out not to be a recordable one.
func hikvisionWebhook(s *service.HikvisionService) gin.HandlerFunc {
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
func hikCentralWebhook(s *service.HikvisionService) gin.HandlerFunc {
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
