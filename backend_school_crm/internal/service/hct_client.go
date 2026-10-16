package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Client for the Hik-Connect for Teams (HCT) OpenAPI ("hccgw"). The terminals
// are added to our Team account in the Hikvision cloud, and everything —
// enrolling people and faces, receiving face events — goes through this API,
// so no inbound access to a school network is needed.
//
// Auth: AK/SK -> POST /api/hccgw/platform/v1/token/get -> a token valid for 7
// days, sent in the "Token" header. The API allows at most 5 requests/second.

const (
	hctDefaultServer = "https://isgp-team.hikcentralconnect.com" // Singapore region
	hctMinInterval   = 250 * time.Millisecond                    // ≤ 4 req/s, under the 5 req/s cap
	hctTokenRefresh  = 12 * time.Hour                            // refresh when less than this is left
	hctDefaultTTL    = 7 * 24 * time.Hour
	hctMaxBody       = 8 << 20
)

// HCTError is a non-zero errorCode returned by the OpenAPI.
type HCTError struct {
	Code    string
	Message string
}

func (e *HCTError) Error() string {
	if e.Message == "" {
		return "hik-connect error " + e.Code
	}
	return fmt.Sprintf("hik-connect error %s: %s", e.Code, e.Message)
}

// HCTClient is safe for concurrent use.
type HCTClient struct {
	appKey string
	secret string
	server string
	http   *http.Client

	mu         sync.Mutex // guards token state and request pacing
	token      string
	tokenExp   time.Time
	areaDomain string
	lastCall   time.Time
}

// NewHCTClient builds a client for an explicit server (used by tests).
func NewHCTClient(appKey, secret, server string, httpClient *http.Client) *HCTClient {
	if server == "" {
		server = hctDefaultServer
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}
	return &HCTClient{appKey: appKey, secret: secret, server: strings.TrimRight(server, "/"), http: httpClient}
}

// NewHCTClientFromEnv returns nil when HCT_API_KEY / HCT_API_SECRET are not
// set, so the integration is simply off in environments without credentials.
func NewHCTClientFromEnv() *HCTClient {
	key := strings.TrimSpace(os.Getenv("HCT_API_KEY"))
	secret := strings.TrimSpace(os.Getenv("HCT_API_SECRET"))
	if key == "" || secret == "" {
		return nil
	}
	return NewHCTClient(key, secret, strings.TrimSpace(os.Getenv("HCT_SERVER")), nil)
}

// WebhookSecret is the key the cloud signs pushed messages with. We register
// it ourselves (HCT_WEBHOOK_SECRET); the platform defaults to the SecretKey
// when none is given.
func (c *HCTClient) WebhookSecret() string {
	if s := strings.TrimSpace(os.Getenv("HCT_WEBHOOK_SECRET")); s != "" {
		return s
	}
	return c.secret
}

type hctEnvelope struct {
	ErrorCode string          `json:"errorCode"`
	Message   string          `json:"message"`
	ErrorMsg  string          `json:"errorMsg"`
	Data      json.RawMessage `json:"data"`
}

func (e *hctEnvelope) err() error {
	if e.ErrorCode == "" || e.ErrorCode == "0" {
		return nil
	}
	msg := e.Message
	if msg == "" {
		msg = e.ErrorMsg
	}
	return &HCTError{Code: e.ErrorCode, Message: msg}
}

// pace blocks until at least hctMinInterval has passed since the last call.
// Callers hold c.mu.
func (c *HCTClient) paceLocked() {
	if wait := hctMinInterval - time.Since(c.lastCall); wait > 0 {
		time.Sleep(wait)
	}
	c.lastCall = time.Now()
}

func (c *HCTClient) rawPost(ctx context.Context, url, token string, body any) (*hctEnvelope, error) {
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			return nil, err
		}
	} else {
		buf.WriteString("{}")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, &buf)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Token", token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, hctMaxBody))
	if err != nil {
		return nil, err
	}
	var env hctEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, fmt.Errorf("hik-connect: HTTP %d, unreadable response", resp.StatusCode)
	}
	if env.ErrorCode == "" && resp.StatusCode >= 400 {
		return nil, fmt.Errorf("hik-connect: HTTP %d", resp.StatusCode)
	}
	return &env, nil
}

// ensureToken returns a valid token and the domain to call. Callers hold c.mu.
func (c *HCTClient) ensureTokenLocked(ctx context.Context, force bool) (string, string, error) {
	if !force && c.token != "" && time.Until(c.tokenExp) > hctTokenRefresh {
		return c.token, c.areaDomain, nil
	}
	c.paceLocked()
	env, err := c.rawPost(ctx, c.server+"/api/hccgw/platform/v1/token/get", "", map[string]string{
		"appKey": c.appKey, "secretKey": c.secret,
	})
	if err != nil {
		return "", "", err
	}
	if e := env.err(); e != nil {
		return "", "", e
	}
	var d struct {
		AccessToken string `json:"accessToken"`
		ExpireTime  int64  `json:"expireTime"`
		AreaDomain  string `json:"areaDomain"`
	}
	if err := json.Unmarshal(env.Data, &d); err != nil || d.AccessToken == "" {
		return "", "", errors.New("hik-connect: token response had no accessToken")
	}
	c.token = d.AccessToken
	c.tokenExp = time.Now().Add(hctDefaultTTL)
	if d.ExpireTime > 0 {
		// expireTime is a Unix timestamp (seconds); fall back to 7 days if it looks off.
		if t := time.Unix(d.ExpireTime, 0); t.After(time.Now()) && t.Before(time.Now().Add(30*24*time.Hour)) {
			c.tokenExp = t
		}
	}
	c.areaDomain = strings.TrimRight(d.AreaDomain, "/")
	if c.areaDomain == "" {
		c.areaDomain = c.server
	}
	return c.token, c.areaDomain, nil
}

// Call POSTs JSON to path (e.g. "/api/hccgw/person/v1/persons/add") and decodes
// the "data" object into out (which may be nil). A rejected token is refreshed
// once and the call retried.
func (c *HCTClient) Call(ctx context.Context, path string, body, out any) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	for attempt := 0; attempt < 2; attempt++ {
		token, domain, err := c.ensureTokenLocked(ctx, attempt == 1)
		if err != nil {
			return err
		}
		c.paceLocked()
		env, err := c.rawPost(ctx, domain+path, token, body)
		if err != nil {
			return err
		}
		if e := env.err(); e != nil {
			if attempt == 0 && strings.Contains(strings.ToLower(e.Error()), "token") {
				continue
			}
			return e
		}
		if out != nil && len(env.Data) > 0 && string(env.Data) != "null" {
			if err := json.Unmarshal(env.Data, out); err != nil {
				return fmt.Errorf("hik-connect: unexpected response shape: %w", err)
			}
		}
		return nil
	}
	return errors.New("hik-connect: request failed after token refresh")
}

// ----------------------------------------------------------- typed calls ----

// HCTDevice is a device in our Team account.
type HCTDevice struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	SerialNo     string `json:"serialNo"`
	Type         string `json:"type"`
	OnlineStatus int    `json:"onlineStatus"`
}

// FindDeviceBySerial returns the device with that serial, or nil when our
// account does not have it.
func (c *HCTClient) FindDeviceBySerial(ctx context.Context, serial string) (*HCTDevice, error) {
	var out struct {
		Device []HCTDevice `json:"device"`
	}
	err := c.Call(ctx, "/api/hccgw/resource/v1/devices/get", map[string]any{
		"pageIndex": 1, "pageSize": 20, "filter": map[string]any{"matchKey": serial},
	}, &out)
	if err != nil {
		return nil, err
	}
	for i := range out.Device {
		if strings.EqualFold(out.Device[i].SerialNo, serial) {
			return &out.Device[i], nil
		}
	}
	return nil, nil
}

// AddDevice adds a terminal to the Team account. Hikvision checks the
// verification code, which is our proof that whoever asks really holds the device.
func (c *HCTClient) AddDevice(ctx context.Context, name, serial, verifyCode string) error {
	var out struct {
		AddDeviceResponse struct {
			Failed     int `json:"failed"`
			DeviceList []struct {
				DeviceSerial string `json:"deviceSerial"`
				ErrorCode    string `json:"errorCode"`
			} `json:"deviceList"`
		} `json:"addDeviceResponse"`
	}
	err := c.Call(ctx, "/api/hccgw/resource/v1/devices/add", map[string]any{
		"deviceCategory": "accessControllerDevice",
		"deviceInfo": map[string]any{
			"name": name, "ezvizSerialNo": serial, "ezvizVerifyCode": verifyCode,
			"userName": "", "password": "", "streamSecretKey": "",
		},
		"importToArea": map[string]any{"areaID": "", "enable": "1"},
		"timeZone":     map[string]any{"id": "33", "applyToDevice": "0"}, // 33 = Uzbekistan
	}, &out)
	if err != nil {
		return err
	}
	if out.AddDeviceResponse.Failed > 0 {
		code := "unknown"
		if len(out.AddDeviceResponse.DeviceList) > 0 {
			code = out.AddDeviceResponse.DeviceList[0].ErrorCode
		}
		return &HCTError{Code: code, Message: "device was not added (check the serial number and verification code)"}
	}
	return nil
}

// RootPersonGroupID returns the first top-level person group (department).
func (c *HCTClient) RootPersonGroupID(ctx context.Context) (string, error) {
	var out struct {
		PersonGroupList []struct {
			GroupID string `json:"groupId"`
		} `json:"personGroupList"`
	}
	if err := c.Call(ctx, "/api/hccgw/person/v1/groups/search", map[string]any{}, &out); err != nil {
		return "", err
	}
	if len(out.PersonGroupList) == 0 || out.PersonGroupList[0].GroupID == "" {
		return "", errors.New("hik-connect: no person group exists — create one in the Hik-Connect portal first")
	}
	return out.PersonGroupList[0].GroupID, nil
}

// HCTAccessLevel is a door-permission group; they can only be created in the portal.
type HCTAccessLevel struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func (c *HCTClient) ListAccessLevels(ctx context.Context) ([]HCTAccessLevel, error) {
	var out struct {
		AccessLevelResponse struct {
			AccessLevelList []HCTAccessLevel `json:"accessLevelList"`
		} `json:"accessLevelResponse"`
	}
	err := c.Call(ctx, "/api/hccgw/acspm/v1/accesslevel/list", map[string]any{
		"accessLevelSearchRequest": map[string]any{
			"pageIndex": 1, "pageSize": 100,
			"searchCriteria": map[string]any{"accessLevelName": "", "associateResInfoList": []any{}},
		},
	}, &out)
	return out.AccessLevelResponse.AccessLevelList, err
}

// AddPerson creates a person (employeeNo ≤ 16 letters/digits) and returns the platform person id.
func (c *HCTClient) AddPerson(ctx context.Context, groupID, employeeNo, fullName string) (string, error) {
	now := time.Now().UTC()
	// The platform rejects end dates after 2037.
	end := time.Date(2036, 12, 31, 23, 59, 59, 0, time.UTC)
	var out struct {
		PersonID string `json:"personId"`
	}
	err := c.Call(ctx, "/api/hccgw/person/v1/persons/add", map[string]any{
		"groupId":    groupID,
		"personCode": employeeNo,
		"firstName":  fullName,
		"lastName":   "",
		"gender":     2,
		"startDate":  now.Format(time.RFC3339),
		"endDate":    end.Format(time.RFC3339),
	}, &out)
	if err != nil {
		return "", err
	}
	if out.PersonID == "" {
		return "", errors.New("hik-connect: person was created but no personId was returned")
	}
	return out.PersonID, nil
}

// SetPersonPhoto uploads the face picture; if the person is on a device the face is pushed to it.
func (c *HCTClient) SetPersonPhoto(ctx context.Context, personID string, jpeg []byte) error {
	return c.Call(ctx, "/api/hccgw/person/v1/persons/photo", map[string]any{
		"personId": personID, "photoData": base64.StdEncoding.EncodeToString(jpeg),
	}, nil)
}

func (c *HCTClient) DeletePerson(ctx context.Context, personID string) error {
	return c.Call(ctx, "/api/hccgw/person/v1/persons/delete", map[string]any{"personId": personID}, nil)
}

// AssignAccessLevels lets the person open the doors in those access levels (which applies them to the device).
func (c *HCTClient) AssignAccessLevels(ctx context.Context, personID string, levelIDs []string) error {
	return c.Call(ctx, "/api/hccgw/acspm/v1/accesslevel/person/add", map[string]any{
		"personList": []map[string]any{{"personId": personID, "accessLevelIdList": levelIDs}},
	}, nil)
}

// SaveWebhook registers the single webhook this account may have.
func (c *HCTClient) SaveWebhook(ctx context.Context, callbackURL, signSecret string) error {
	return c.Call(ctx, "/api/hccgw/webhook/v1/config/save", map[string]any{
		"callbackUrl": callbackURL, "retryTimes": 3, "retryDelay": 1000, "signSecret": signSecret,
	}, nil)
}

// SubscribeEvents subscribes to message types (e.g. "Msg110013" = access granted by face).
func (c *HCTClient) SubscribeEvents(ctx context.Context, msgTypes []string) error {
	return c.Call(ctx, "/api/hccgw/rawmsg/v1/mq/subscribe", map[string]any{
		"subscribeType": 1, "msgType": msgTypes,
	}, nil)
}
