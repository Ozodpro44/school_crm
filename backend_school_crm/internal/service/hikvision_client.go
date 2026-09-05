package service

import (
	"bytes"
	"crypto/md5"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// HikvisionClient talks to a single Hikvision ISAPI-compliant access control
// terminal (tested against a DS-K1T343MWX) over its local HTTP interface.
//
// The device authenticates with HTTP Digest (RFC 2617) and, on this
// firmware, always answers with XML regardless of "?format=json" — so this
// client speaks XML natively rather than assuming JSON support.
type HikvisionClient struct {
	baseURL  string
	username string
	password string
	http     *http.Client
}

// MinorEventFaceSuccess is the ISAPI minorEvent code for a successful face
// recognition match on AccessControllerEvent notifications (0x4b = 75).
const MinorEventFaceSuccess = 75

func NewHikvisionClient(host, username, password string) *HikvisionClient {
	base := strings.TrimSpace(host)
	if !strings.HasPrefix(base, "http://") && !strings.HasPrefix(base, "https://") {
		base = "http://" + base
	}
	return &HikvisionClient{
		baseURL:  strings.TrimRight(base, "/"),
		username: username,
		password: password,
		http:     &http.Client{Timeout: 20 * time.Second},
	}
}

// ---- Digest authentication -------------------------------------------------

func parseDigestChallenge(header string) map[string]string {
	parts := map[string]string{}
	header = strings.TrimPrefix(header, "Digest ")
	for _, kv := range strings.Split(header, ",") {
		kv = strings.TrimSpace(kv)
		idx := strings.Index(kv, "=")
		if idx < 0 {
			continue
		}
		key := strings.TrimSpace(kv[:idx])
		val := strings.Trim(strings.TrimSpace(kv[idx+1:]), `"`)
		parts[key] = val
	}
	return parts
}

func md5Hex(s string) string {
	sum := md5.Sum([]byte(s))
	return hex.EncodeToString(sum[:])
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (c *HikvisionClient) buildDigestHeader(method, uriPath, wwwAuthenticate string) (string, error) {
	challenge := parseDigestChallenge(wwwAuthenticate)
	realm := challenge["realm"]
	nonce := challenge["nonce"]
	qop := challenge["qop"]
	opaque := challenge["opaque"]

	if realm == "" || nonce == "" {
		return "", fmt.Errorf("unrecognized WWW-Authenticate header: %s", wwwAuthenticate)
	}

	ha1 := md5Hex(fmt.Sprintf("%s:%s:%s", c.username, realm, c.password))
	ha2 := md5Hex(fmt.Sprintf("%s:%s", method, uriPath))

	nc := "00000001"
	cnonce := randomHex(8)

	var response string
	// qop can be a comma-separated list (e.g. "auth,auth-int"); we only
	// implement plain "auth".
	if strings.Contains(qop, "auth") {
		response = md5Hex(fmt.Sprintf("%s:%s:%s:%s:auth:%s", ha1, nonce, nc, cnonce, ha2))
	} else {
		response = md5Hex(fmt.Sprintf("%s:%s:%s", ha1, nonce, ha2))
	}

	header := fmt.Sprintf(`Digest username="%s", realm="%s", nonce="%s", uri="%s", response="%s"`,
		c.username, realm, nonce, uriPath, response)
	if strings.Contains(qop, "auth") {
		header += fmt.Sprintf(`, qop=auth, nc=%s, cnonce="%s"`, nc, cnonce)
	}
	if opaque != "" {
		header += fmt.Sprintf(`, opaque="%s"`, opaque)
	}
	return header, nil
}

// request performs one ISAPI call, transparently completing the Digest
// challenge on a first 401. Returns the final status code and body bytes.
func (c *HikvisionClient) request(method, path string, body []byte, contentType string) (int, []byte, error) {
	fullURL := c.baseURL + path

	newReq := func() (*http.Request, error) {
		var reader io.Reader
		if body != nil {
			reader = bytes.NewReader(body)
		}
		req, err := http.NewRequest(method, fullURL, reader)
		if err != nil {
			return nil, err
		}
		if contentType != "" {
			req.Header.Set("Content-Type", contentType)
		}
		return req, nil
	}

	req, err := newReq()
	if err != nil {
		return 0, nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("connecting to device at %s: %w", c.baseURL, err)
	}

	if resp.StatusCode != http.StatusUnauthorized {
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, respBody, nil
	}

	wwwAuth := resp.Header.Get("WWW-Authenticate")
	resp.Body.Close()
	if wwwAuth == "" {
		return http.StatusUnauthorized, nil, fmt.Errorf("device returned 401 without WWW-Authenticate header (unexpected auth scheme)")
	}

	u, err := url.Parse(fullURL)
	if err != nil {
		return 0, nil, err
	}

	authHeader, err := c.buildDigestHeader(method, u.RequestURI(), wwwAuth)
	if err != nil {
		return 0, nil, err
	}

	req2, err := newReq()
	if err != nil {
		return 0, nil, err
	}
	req2.Header.Set("Authorization", authHeader)

	resp2, err := c.http.Do(req2)
	if err != nil {
		return 0, nil, fmt.Errorf("connecting to device at %s: %w", c.baseURL, err)
	}
	defer resp2.Body.Close()
	respBody, _ := io.ReadAll(resp2.Body)
	return resp2.StatusCode, respBody, nil
}

// isapiError mirrors the generic error envelope ISAPI devices return, e.g.
// {"statusCode":4,"statusString":"Invalid Operation","errorMsg":"invalidOperation"}
// or the XML equivalent <ResponseStatus>...</ResponseStatus>.
type isapiError struct {
	XMLName      xml.Name `xml:"ResponseStatus" json:"-"`
	StatusCode   int      `xml:"statusCode" json:"statusCode"`
	StatusString string   `xml:"statusString" json:"statusString"`
	SubStatus    string   `xml:"subStatusCode" json:"subStatusCode"`
	ErrorMsg     string   `xml:"errorMsg" json:"errorMsg"`
}

// checkOK returns a helpful error if the HTTP status or ISAPI status body
// indicates failure. statusCode 1 means OK on ISAPI "put/post" responses.
//
// Different endpoints (and error vs. success paths) on this firmware have
// been observed to answer in either XML or JSON regardless of the request's
// own content type, so both are tried here.
func checkOK(httpStatus int, body []byte) error {
	if httpStatus == http.StatusUnauthorized {
		return fmt.Errorf("authentication failed (401) - check device username/password")
	}
	if httpStatus >= 400 {
		return fmt.Errorf("device returned HTTP %d: %s", httpStatus, string(body))
	}

	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 {
		return nil
	}

	var parsed isapiError
	var parseErr error
	if trimmed[0] == '{' {
		parseErr = json.Unmarshal(trimmed, &parsed)
	} else {
		parseErr = xml.Unmarshal(trimmed, &parsed)
	}

	if parseErr == nil && parsed.StatusString != "" && parsed.StatusCode != 1 {
		return fmt.Errorf("device rejected request: %s (%s)", parsed.StatusString, parsed.ErrorMsg)
	}
	return nil
}

// ---- Device info ------------------------------------------------------------

type DeviceInfo struct {
	XMLName      xml.Name `xml:"DeviceInfo"`
	DeviceName   string   `xml:"deviceName"`
	Model        string   `xml:"model"`
	SerialNumber string   `xml:"serialNumber"`
	MacAddress   string   `xml:"macAddress"`
	Firmware     string   `xml:"firmwareVersion"`
}

// GetDeviceInfo confirms the device is reachable with the given credentials
// and returns its identity — used both to validate a newly-registered
// device and as a lightweight health check.
func (c *HikvisionClient) GetDeviceInfo() (*DeviceInfo, error) {
	status, body, err := c.request(http.MethodGet, "/ISAPI/System/deviceInfo", nil, "")
	if err != nil {
		return nil, err
	}
	if err := checkOK(status, body); err != nil {
		return nil, err
	}
	var info DeviceInfo
	if err := xml.Unmarshal(body, &info); err != nil {
		return nil, fmt.Errorf("parsing deviceInfo response: %w", err)
	}
	return &info, nil
}

// ---- Push (HTTP Listening) configuration ------------------------------------

// ConfigureHTTPHost registers our webhook as notification target #hostID
// (the device supports at least 2 slots) so that every access-control event
// (face recognition, user changes) is POSTed there in real time.
//
// targetHost may be an IP address or a DNS hostname; the device is told
// which addressing scheme to use accordingly.
func (c *HikvisionClient) ConfigureHTTPHost(hostID int, targetHost string, port int, urlPath string, useHTTPS bool) error {
	addressingType := "hostname"
	hostField := fmt.Sprintf("<hostName>%s</hostName>", xmlEscape(targetHost))
	if isIPAddress(targetHost) {
		addressingType = "ipaddress"
		hostField = fmt.Sprintf("<ipAddress>%s</ipAddress>", xmlEscape(targetHost))
	}

	protocol := "HTTP"
	if useHTTPS {
		protocol = "HTTPS"
	}

	// This device's capabilities (GET .../httpHosts/capabilities) don't
	// advertise JSON as a push payload format at all, matching the fact
	// that its own HTTP API always answers in XML regardless of what's
	// requested (see the client-level comment above) — so the event push
	// body must be XML too, and the webhook side parses XML accordingly
	// (see ProcessWebhookEvent). The capabilities also list <heartbeat>
	// as a required sibling of <eventMode>, which the previous body omitted.
	body := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotification version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <id>%d</id>
  <url>%s</url>
  <protocolType>%s</protocolType>
  <parameterFormatType>XML</parameterFormatType>
  <addressingFormatType>%s</addressingFormatType>
  %s
  <portNo>%d</portNo>
  <httpAuthenticationMethod>none</httpAuthenticationMethod>
  <SubscribeEvent>
    <heartbeat>15</heartbeat>
    <eventMode>list</eventMode>
    <EventList>
      <Event>
        <type>AccessControllerEvent</type>
      </Event>
      <Event>
        <type>LocalUserChange</type>
      </Event>
    </EventList>
  </SubscribeEvent>
</HttpHostNotification>`, hostID, xmlEscape(urlPath), protocol, addressingType, hostField, port)

	status, respBody, err := c.request(http.MethodPut,
		fmt.Sprintf("/ISAPI/Event/notification/httpHosts/%d", hostID), []byte(body), "application/xml")
	if err != nil {
		return err
	}
	return checkOK(status, respBody)
}

// ---- Employee (user) management ---------------------------------------------

// CreateUser enrolls a person on the device under employeeNo, without a
// face template yet — call UploadFace afterwards to attach their photo.
func (c *HikvisionClient) CreateUser(employeeNo, fullName string) error {
	now := time.Now()
	tenYears := now.AddDate(10, 0, 0)

	body := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<UserInfo>
  <employeeNo>%s</employeeNo>
  <name>%s</name>
  <userType>normal</userType>
  <Valid>
    <enable>true</enable>
    <beginTime>%s</beginTime>
    <endTime>%s</endTime>
  </Valid>
</UserInfo>`, xmlEscape(employeeNo), xmlEscape(fullName),
		now.Format("2006-01-02T15:04:05"), tenYears.Format("2006-01-02T15:04:05"))

	status, respBody, err := c.request(http.MethodPost, "/ISAPI/AccessControl/UserInfo/Record", []byte(body), "application/xml")
	if err != nil {
		return err
	}
	return checkOK(status, respBody)
}

// DeleteUser removes a person (and, per ISAPI semantics, their enrolled
// face/card credentials) from the device.
func (c *HikvisionClient) DeleteUser(employeeNo string) error {
	body := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<UserInfoDetail>
  <mode>byEmployeeNo</mode>
  <EmployeeNoList>
    <EmployeeNo>%s</EmployeeNo>
  </EmployeeNoList>
</UserInfoDetail>`, xmlEscape(employeeNo))

	status, respBody, err := c.request(http.MethodPut, "/ISAPI/AccessControl/UserInfoDetail/Delete", []byte(body), "application/xml")
	if err != nil {
		return err
	}
	return checkOK(status, respBody)
}

// UploadFace attaches a face photo (JPEG, ideally <=200KB, a clear frontal
// shot) to an already-created employeeNo so the terminal can recognize them.
func (c *HikvisionClient) UploadFace(employeeNo string, jpegData []byte) error {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	metaPart, err := writer.CreatePart(map[string][]string{
		"Content-Disposition": {`form-data; name="FaceDataRecord"`},
		"Content-Type":        {"application/json"},
	})
	if err != nil {
		return err
	}
	meta := fmt.Sprintf(`{"faceLibType":"blackFD","FDID":"1","FPID":"%s"}`, employeeNo)
	if _, err := metaPart.Write([]byte(meta)); err != nil {
		return err
	}

	imgPart, err := writer.CreatePart(map[string][]string{
		"Content-Disposition": {`form-data; name="img"; filename="face.jpg"`},
		"Content-Type":        {"image/jpeg"},
	})
	if err != nil {
		return err
	}
	if _, err := imgPart.Write(jpegData); err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}

	status, respBody, err := c.request(http.MethodPost, "/ISAPI/Intelligent/FDLib/FaceDataRecord", buf.Bytes(), writer.FormDataContentType())
	if err != nil {
		return err
	}
	return checkOK(status, respBody)
}

// ---- Event polling (fallback / backfill) ------------------------------------

type AccessEvent struct {
	Time             time.Time
	EmployeeNoString string
	Name             string
	Major            int
	Minor            int
}

type acsEventSearchResponse struct {
	XMLName      xml.Name `xml:"AcsEvent"`
	NumOfMatches int      `xml:"numOfMatches"`
	TotalMatches int      `xml:"totalMatches"`
	InfoList     []struct {
		Time             string `xml:"time"`
		EmployeeNoString string `xml:"employeeNoString"`
		Name             string `xml:"name"`
		Major            int    `xml:"major"`
		Minor            int    `xml:"minor"`
	} `xml:"InfoList>AcsEventInfo"`
}

// SearchAccessEvents fetches access-control events in [start,end). Used as a
// once-in-a-while backfill/fallback in case a push notification is ever
// missed (e.g. brief network outage) — the primary path is the webhook.
func (c *HikvisionClient) SearchAccessEvents(start, end time.Time, maxResults int) ([]AccessEvent, error) {
	if maxResults <= 0 {
		maxResults = 200
	}
	body := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond>
  <searchID>%s</searchID>
  <searchResultPosition>0</searchResultPosition>
  <maxResults>%d</maxResults>
  <major>5</major>
  <minor>0</minor>
  <startTime>%s</startTime>
  <endTime>%s</endTime>
</AcsEventCond>`, randomHex(8), maxResults, start.Format("2006-01-02T15:04:05"), end.Format("2006-01-02T15:04:05"))

	status, respBody, err := c.request(http.MethodPost, "/ISAPI/AccessControl/AcsEvent", []byte(body), "application/xml")
	if err != nil {
		return nil, err
	}
	if err := checkOK(status, respBody); err != nil {
		return nil, err
	}

	var parsed acsEventSearchResponse
	if err := xml.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("parsing AcsEvent response: %w", err)
	}

	events := make([]AccessEvent, 0, len(parsed.InfoList))
	for _, item := range parsed.InfoList {
		t, err := time.Parse("2006-01-02T15:04:05", strings.SplitN(item.Time, "+", 2)[0])
		if err != nil {
			t, _ = time.Parse(time.RFC3339, item.Time)
		}
		events = append(events, AccessEvent{
			Time:             t,
			EmployeeNoString: item.EmployeeNoString,
			Name:             item.Name,
			Major:            item.Major,
			Minor:            item.Minor,
		})
	}
	return events, nil
}

// ---- small helpers -----------------------------------------------------------

func xmlEscape(s string) string {
	var buf bytes.Buffer
	_ = xml.EscapeText(&buf, []byte(s))
	return buf.String()
}

func isIPAddress(s string) bool {
	parts := strings.Split(s, ".")
	if len(parts) != 4 {
		return false
	}
	for _, p := range parts {
		if n, err := strconv.Atoi(p); err != nil || n < 0 || n > 255 {
			return false
		}
	}
	return true
}
