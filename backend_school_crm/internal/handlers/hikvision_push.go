package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

// OTAP HTTPS PUSH endpoint (Hikvision "Push SDK" for access control
// terminals): the terminal connects out to /iot/{DEVID}/global/0-global/model/
// service/operate/PUSH/{AuthInfo|Login|CommandRequest|CommandResult|Event|Logout}.
// No inbound access to the device is needed, which is the point.
//
// Public route — devices can't use a CRM JWT. Authentication is the
// challenge/response in service/hikvision_push_auth.go, keyed to a per-device
// credential an admin issues when registering the terminal.

// PushBackend is the slice of HikvisionService the PUSH endpoint needs;
// an interface so the protocol can be tested without a database.
type PushBackend interface {
	GetPushDevice(ctx context.Context, devID string) (*service.PushDevice, error)
	TouchPushDevice(ctx context.Context, deviceID string) error
	ProcessPushEvent(ctx context.Context, deviceID string, raw []byte) (string, error)
}

const (
	pushCommandIntervalSeconds = 10
	pushErrorDelaySeconds      = 30
	pushMaxBodyBytes           = 8 << 20 // events can carry a captured face picture
	pushTouchEvery             = 60 * time.Second
	pushCodeOK                 = "0x00000000"
	pushCodeUnauthorized       = "0x0020000f"
)

type pushEntry struct {
	session   *service.PushSession
	touchedAt time.Time
}

type pushHandler struct {
	backend PushBackend
	lockout *service.PushLockout

	mu      sync.Mutex
	entries map[string]*pushEntry // keyed by DEVID
}

// RegisterHikvisionPushRoutes mounts the device-facing PUSH endpoint. Pass a
// group created directly off the router so no JWT middleware is attached.
func RegisterHikvisionPushRoutes(router gin.IRoutes, backend PushBackend) {
	h := &pushHandler{
		backend: backend,
		lockout: service.NewPushLockout(),
		entries: map[string]*pushEntry{},
	}
	// The spec's examples spell the service segment both "PUSH" and "PUSHSDK".
	router.POST("/iot/:devId/global/0-global/model/service/operate/:svc/:action", h.dispatch)
}

func pushStatus(extra gin.H) gin.H {
	out := gin.H{"status": http.StatusOK, "code": pushCodeOK, "errorMsg": "Succeeded."}
	for k, v := range extra {
		out[k] = v
	}
	return out
}

func (h *pushHandler) dispatch(c *gin.Context) {
	svc := strings.ToUpper(c.Param("svc"))
	if svc != "PUSH" && svc != "PUSHSDK" {
		c.Status(http.StatusNotFound)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, pushMaxBodyBytes)

	devID := c.Param("devId")
	switch c.Param("action") {
	case "AuthInfo":
		h.authInfo(c, devID)
	case "Login":
		h.login(c, devID)
	case "Logout", "CommandRequest", "CommandResult", "Event":
		h.authenticated(c, devID, c.Param("action"))
	default:
		c.Status(http.StatusNotFound)
	}
}

func (h *pushHandler) authInfo(c *gin.Context, devID string) {
	// The body is optional (it only lists supported encryption versions);
	// we don't use PUSH-level payload encryption — TLS carries the traffic.
	dev, err := h.backend.GetPushDevice(c.Request.Context(), devID)
	if err != nil {
		if errors.Is(err, service.ErrPushDeviceNotFound) {
			c.Status(http.StatusNotFound)
		} else {
			log.Printf("hikvision push: lookup %s: %v", devID, err)
			c.Status(http.StatusInternalServerError)
		}
		return
	}

	session, challenge, salt, iterations := service.NewPushSession(dev.ID, dev.Username, dev.Password)
	h.mu.Lock()
	h.entries[devID] = &pushEntry{session: session}
	h.mu.Unlock()

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"challenge":     challenge,
		"salt":          salt,
		"iterations":    iterations,
		"isDataEncrypt": false,
	}})
}

func (h *pushHandler) login(c *gin.Context, devID string) {
	key := c.ClientIP() + "|" + devID
	if locked, secs := h.lockout.Locked(key); locked {
		c.JSON(http.StatusUnauthorized, gin.H{
			"status": http.StatusUnauthorized, "code": pushCodeUnauthorized,
			"errorMsg": "Too many failed attempts.",
			"data":     gin.H{"lockStatus": "lock", "unlockTime": secs, "retryLoginTime": 0},
		})
		return
	}

	h.mu.Lock()
	entry := h.entries[devID]
	h.mu.Unlock()
	if entry == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "authenticate first"})
		return
	}

	var req struct {
		Data struct {
			Username      string `json:"username"`
			LoginPassword string `json:"loginPassword"`
		} `json:"data"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid login request"})
		return
	}

	challenge, ok := entry.session.Login(req.Data.Username, req.Data.LoginPassword)
	if !ok {
		justLocked, remaining := h.lockout.Fail(key)
		lockStatus, unlockTime := "unlock", 0
		if justLocked {
			lockStatus, unlockTime = "lock", 60
		}
		log.Printf("hikvision push: failed login device=%s ip=%s remaining=%d", devID, c.ClientIP(), remaining)
		c.JSON(http.StatusUnauthorized, gin.H{
			"status": http.StatusUnauthorized, "code": pushCodeUnauthorized,
			"errorMsg": "Invalid SessionID.",
			"data":     gin.H{"lockStatus": lockStatus, "unlockTime": unlockTime, "retryLoginTime": remaining},
		})
		return
	}
	h.lockout.Reset(key)
	h.touch(c.Request.Context(), devID, entry, true)
	log.Printf("hikvision push: device %s logged in (%s) from %s", devID, entry.session.AuthType(), c.ClientIP())

	c.Header("My-Custom-Challenge", challenge)
	body := pushStatus(gin.H{"data": gin.H{
		"commandInterval": pushCommandIntervalSeconds,
		"errorDelay":      pushErrorDelaySeconds,
	}})
	body["errorMsg"] = "Succeeded"
	c.JSON(http.StatusOK, body)
}

// authenticated runs the post-login requests, each of which must carry a valid
// My-Custom-Auth and gets a fresh My-Custom-Challenge back.
func (h *pushHandler) authenticated(c *gin.Context, devID, action string) {
	customAuth := c.GetHeader("My-Custom-Auth")
	if customAuth == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing My-Custom-Auth header"})
		return
	}
	h.mu.Lock()
	entry := h.entries[devID]
	h.mu.Unlock()
	if entry == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"status": 401, "code": pushCodeUnauthorized, "errorMsg": "Invalid SessionID."})
		return
	}
	next, ok := entry.session.Verify(customAuth)
	if !ok {
		log.Printf("hikvision push: bad My-Custom-Auth device=%s action=%s ip=%s", devID, action, c.ClientIP())
		c.JSON(http.StatusUnauthorized, gin.H{"status": 401, "code": pushCodeUnauthorized, "errorMsg": "Invalid SessionID."})
		return
	}
	c.Header("My-Custom-Challenge", next)

	// We never advertise payload encryption, so an encrypted request means the
	// device negotiated something we don't speak. Say so loudly instead of
	// misreading ciphertext as JSON.
	if c.Query("security") != "" || c.Query("iv") != "" {
		log.Printf("hikvision push: device %s sent an encrypted payload (security=%s) — not supported", devID, c.Query("security"))
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "code": "0x00000001", "errorMsg": "Encrypted payloads are not supported."})
		return
	}

	switch action {
	case "CommandRequest":
		h.touch(c.Request.Context(), devID, entry, false)
		// Heartbeat. Queued commands (remote enrollment) are not implemented yet.
		c.JSON(http.StatusOK, pushStatus(gin.H{"commandNum": 0}))
	case "CommandResult":
		io.Copy(io.Discard, c.Request.Body)
		c.JSON(http.StatusOK, pushStatus(gin.H{"isPendingCommand": false}))
	case "Event":
		h.event(c, devID, entry)
	case "Logout":
		entry.session.Logout()
		h.touch(c.Request.Context(), devID, entry, true)
		log.Printf("hikvision push: device %s logged out", devID)
		c.JSON(http.StatusOK, pushStatus(nil))
	}
}

type pushEventUpload struct {
	EventNum  int `json:"eventNum"`
	EventList []struct {
		UUID       string `json:"UUID"`
		DataFormat string `json:"dataFormat"`
		Data       string `json:"data"`
	} `json:"eventList"`
}

func (h *pushHandler) event(c *gin.Context, devID string, entry *pushEntry) {
	var up pushEventUpload
	if err := json.NewDecoder(c.Request.Body).Decode(&up); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "code": "0x00000001", "errorMsg": "invalid event upload"})
		return
	}
	h.touch(c.Request.Context(), devID, entry, false)

	acks := make([]gin.H, 0, len(up.EventList))
	for _, ev := range up.EventList {
		payload := service.ExtractPushEventPayload(service.DecodePushEventData(ev.Data))
		outcome, err := h.backend.ProcessPushEvent(c.Request.Context(), entry.session.DeviceUUID, payload)

		preview := string(payload)
		if len(preview) > 400 {
			preview = preview[:400] + "…"
		}
		log.Printf("hikvision push: event device=%s format=%s outcome=%s err=%v payload=%s",
			devID, ev.DataFormat, outcome, err, preview)

		status, code, msg := http.StatusOK, pushCodeOK, "Succeeded."
		// A transient failure (database) gets a non-200 so the device re-sends
		// the event; unparseable or irrelevant events are acknowledged so the
		// device doesn't retry them forever.
		if outcome == "db-error" {
			status, code, msg = http.StatusInternalServerError, "0x00000002", "Temporary failure."
		}
		acks = append(acks, gin.H{"UUID": ev.UUID, "status": status, "code": code, "errorMsg": msg})
	}
	c.JSON(http.StatusOK, acks)
}

// touch records activity, but not on every 10-second heartbeat.
func (h *pushHandler) touch(ctx context.Context, devID string, entry *pushEntry, force bool) {
	h.mu.Lock()
	due := force || time.Since(entry.touchedAt) >= pushTouchEvery
	if due {
		entry.touchedAt = time.Now()
	}
	h.mu.Unlock()
	if due {
		if err := h.backend.TouchPushDevice(ctx, entry.session.DeviceUUID); err != nil {
			log.Printf("hikvision push: touch %s: %v", devID, err)
		}
	}
}
