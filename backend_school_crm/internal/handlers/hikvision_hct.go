package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

// Hik-Connect for Teams (HCT) cloud integration. Two parts:
//   - public webhook the Hikvision cloud pushes face events to (authenticated by
//     an HMAC signature, not a CRM JWT);
//   - admin endpoints (under /hikvision, tenant-checked like the rest) to
//     register a cloud device for a branch.

const hctMaxWebhookBody = 4 << 20

// HCTBackend is the slice of HikvisionService the webhook needs.
type HCTBackend interface {
	ProcessHCTWebhook(ctx context.Context, body []byte) (int, error)
	HCTWebhookSecret() string
	HCTVerificationArmed() bool
}

// RegisterHikvisionHCTWebhookRoutes mounts GET+POST /hikvision/hct/webhook on a
// group with no JWT middleware (e.g. router.Group("/api")). The cloud requires
// both methods on the same URL: GET to verify the URL when the webhook is
// saved, POST for events.
func RegisterHikvisionHCTWebhookRoutes(router gin.IRoutes, backend HCTBackend) {
	h := &hctWebhookHandler{backend: backend}
	router.GET("/hikvision/hct/webhook", h.verify)
	router.POST("/hikvision/hct/webhook", h.receive)
}

type hctWebhookHandler struct{ backend HCTBackend }

// verify answers the cloud's URL-validation request by signing its
// (timestamp, batchId) — but only while we are actually registering the
// webhook; see service.armHCTVerification.
func (h *hctWebhookHandler) verify(c *gin.Context) {
	secret := h.backend.HCTWebhookSecret()
	ts, batch := c.GetHeader("X-Hook-Timestamp"), c.GetHeader("X-Hook-Batch-Id")
	if secret == "" || ts == "" || batch == "" || !h.backend.HCTVerificationArmed() {
		c.Status(http.StatusNotFound)
		return
	}
	c.Header("X-Hook-Signature", service.HCTSignature(secret, ts, batch))
	c.String(http.StatusOK, "ok")
}

func (h *hctWebhookHandler) receive(c *gin.Context) {
	secret := h.backend.HCTWebhookSecret()
	if secret == "" {
		c.Status(http.StatusNotFound)
		return
	}
	ts, batch, sig := c.GetHeader("X-Hook-Timestamp"), c.GetHeader("X-Hook-Batch-Id"), c.GetHeader("X-Hook-Signature")
	if err := service.VerifyHCTSignature(secret, ts, batch, sig, time.Now()); err != nil {
		log.Printf("hct webhook: rejected (%v) from %s", err, c.ClientIP())
		c.Status(http.StatusUnauthorized)
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, hctMaxWebhookBody))
	if err != nil {
		c.Status(http.StatusRequestEntityTooLarge)
		return
	}
	// The signature only covers timestamp+batchId, so tie the body to the signed id.
	var probe struct {
		BatchID string `json:"batchId"`
	}
	if err := json.Unmarshal(body, &probe); err != nil || probe.BatchID == "" || probe.BatchID != batch {
		log.Printf("hct webhook: body batchId does not match header from %s", c.ClientIP())
		c.Status(http.StatusBadRequest)
		return
	}

	n, err := h.backend.ProcessHCTWebhook(c.Request.Context(), body)
	if err != nil {
		log.Printf("hct webhook: processing failed: %v", err)
		c.Status(http.StatusInternalServerError) // non-2xx: the cloud retries the batch
		return
	}
	if n > 0 {
		log.Printf("hct webhook: recorded %d attendance event(s)", n)
	}
	c.Status(http.StatusOK)
}

// ---------------------------------------------------------------- admin ----

type createHCTDeviceRequest struct {
	BranchID   string `json:"branchId" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Serial     string `json:"serial" binding:"required"`
	VerifyCode string `json:"verifyCode" binding:"required"`
}

// createHCTDevice adds a terminal (by serial + verification code) to our
// Hik-Connect account and registers it for the caller's branch.
func (h *hikvisionHandler) createHCTDevice(c *gin.Context) {
	var req createHCTDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !h.callerBelongsToBranch(c, req.BranchID) {
		return
	}
	device, err := h.svc.CreateHCTDevice(c.Request.Context(), &service.CreateHCTDeviceRequest{
		BranchID: req.BranchID, Name: req.Name, Serial: req.Serial, VerifyCode: req.VerifyCode,
	})
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, service.ErrHCTNotConfigured) {
			status = http.StatusServiceUnavailable
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"device": device})
}

// hctStatus tells the UI whether the Hik-Connect option should be offered.
func (h *hikvisionHandler) hctStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"enabled": h.svc.HCTEnabled()})
}
