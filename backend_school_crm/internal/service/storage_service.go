package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

// StorageService uploads files to (and generates temporary view links for) an
// S3-compatible object storage bucket — e.g. a Railway "Bucket" service
// backed by Tigris. It talks to the bucket over plain HTTP using a
// hand-rolled AWS Signature Version 4 signer instead of an SDK, so adding
// this feature doesn't pull in any new Go module dependency.
//
// Employee face photos are stored here (in addition to being enrolled on the
// physical device) so the CRM can display them even after the device's own
// copy is gone or the device is replaced.
type StorageService struct {
	endpoint  string // scheme://host[:port], no trailing slash
	host      string // host[:port] only, used in canonical signing
	region    string
	bucket    string
	accessKey string
	secretKey string
	http      *http.Client
}

// NewStorageServiceFromEnv builds a StorageService from environment
// variables, trying several plausible names since Railway's "Add to Service"
// button and different bucket providers don't all use the same convention.
// If no credentials are found at all, it returns nil — storing employee
// photos is treated as an optional feature, never a hard requirement for the
// rest of the attendance integration to work.
//
// Recognized variables (first non-empty one wins for each):
//
//	Endpoint:   BUCKET_ENDPOINT, ENDPOINT, AWS_ENDPOINT_URL_S3, S3_ENDPOINT
//	Region:     BUCKET_REGION, REGION, AWS_REGION, S3_REGION (default "auto")
//	Bucket:     BUCKET_NAME, BUCKET, RAILWAY_BUCKET_NAME, S3_BUCKET
//	Access key: BUCKET_ACCESS_KEY_ID, ACCESS_KEY_ID, AWS_ACCESS_KEY_ID, S3_ACCESS_KEY_ID
//	Secret key: BUCKET_SECRET_ACCESS_KEY, SECRET_ACCESS_KEY, AWS_SECRET_ACCESS_KEY, S3_SECRET_ACCESS_KEY
//
// If your Railway project ends up naming these differently, set the S3_*
// variables explicitly on the backend service to override.
func NewStorageServiceFromEnv() *StorageService {
	rawEndpoint := firstEnv("BUCKET_ENDPOINT", "ENDPOINT", "AWS_ENDPOINT_URL_S3", "S3_ENDPOINT")
	region := firstEnv("BUCKET_REGION", "REGION", "AWS_REGION", "S3_REGION")
	bucket := firstEnv("BUCKET_NAME", "BUCKET", "RAILWAY_BUCKET_NAME", "S3_BUCKET")
	accessKey := firstEnv("BUCKET_ACCESS_KEY_ID", "ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID", "S3_ACCESS_KEY_ID")
	secretKey := firstEnv("BUCKET_SECRET_ACCESS_KEY", "SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY", "S3_SECRET_ACCESS_KEY")

	if rawEndpoint == "" || bucket == "" || accessKey == "" || secretKey == "" {
		log.Println("Storage bucket not configured (missing endpoint/bucket/access key/secret key) — employee photos will only be stored on the device, not in a bucket")
		return nil
	}
	if region == "" {
		region = "auto"
	}

	endpoint := strings.TrimRight(rawEndpoint, "/")
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		endpoint = "https://" + endpoint
	}
	u, err := url.Parse(endpoint)
	if err != nil || u.Host == "" {
		log.Printf("Storage bucket endpoint %q is not a valid URL — employee photos will only be stored on the device", rawEndpoint)
		return nil
	}

	log.Printf("Storage bucket configured: endpoint=%s bucket=%s region=%s", endpoint, bucket, region)
	return &StorageService{
		endpoint:  endpoint,
		host:      u.Host,
		region:    region,
		bucket:    bucket,
		accessKey: accessKey,
		secretKey: secretKey,
		http:      &http.Client{Timeout: 30 * time.Second},
	}
}

func firstEnv(names ...string) string {
	for _, n := range names {
		if v := strings.TrimSpace(os.Getenv(n)); v != "" {
			return v
		}
	}
	return ""
}

// UploadObject PUTs data to the bucket under key (path-style addressing:
// <endpoint>/<bucket>/<key>), signed with SigV4.
func (s *StorageService) UploadObject(ctx context.Context, key, contentType string, data []byte) error {
	canonicalURI := "/" + s.bucket + "/" + encodePath(key)
	payloadHash := sha256Hex(data)
	now := time.Now().UTC()

	headers := map[string]string{
		"content-type":         contentType,
		"host":                 s.host,
		"x-amz-content-sha256": payloadHash,
		"x-amz-date":           now.Format("20060102T150405Z"),
	}

	authHeader, amzDate := s.signRequest(http.MethodPut, canonicalURI, "", headers, payloadHash, now)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, s.endpoint+canonicalURI, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)
	req.Header.Set("X-Amz-Date", amzDate)
	req.Header.Set("Authorization", authHeader)
	req.ContentLength = int64(len(data))

	resp, err := s.http.Do(req)
	if err != nil {
		return fmt.Errorf("uploading to storage bucket: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("storage bucket rejected upload (HTTP %d): %s", resp.StatusCode, string(body))
	}
	return nil
}

// PresignedGetURL returns a temporary URL that lets anyone with the link
// view/download the object directly from the bucket for the given duration,
// without needing our own credentials.
func (s *StorageService) PresignedGetURL(key string, expiry time.Duration) (string, error) {
	if key == "" {
		return "", nil
	}
	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	credentialScope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, s.region)

	query := map[string]string{
		"X-Amz-Algorithm":     "AWS4-HMAC-SHA256",
		"X-Amz-Credential":    s.accessKey + "/" + credentialScope,
		"X-Amz-Date":          amzDate,
		"X-Amz-Expires":       strconv.Itoa(int(expiry.Seconds())),
		"X-Amz-SignedHeaders": "host",
	}

	canonicalURI := "/" + s.bucket + "/" + encodePath(key)
	canonicalQuery := buildCanonicalQuery(query)
	canonicalHeaders := "host:" + s.host + "\n"
	canonicalRequest := strings.Join([]string{
		http.MethodGet,
		canonicalURI,
		canonicalQuery,
		canonicalHeaders,
		"host",
		"UNSIGNED-PAYLOAD",
	}, "\n")

	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	signature := hex.EncodeToString(s.signingKey(dateStamp, stringToSign))

	return s.endpoint + canonicalURI + "?" + canonicalQuery + "&X-Amz-Signature=" + signature, nil
}

// signRequest builds the Authorization header for a header-signed (as
// opposed to presigned/query-signed) request such as our PUT upload.
func (s *StorageService) signRequest(method, canonicalURI, canonicalQuery string, headers map[string]string, payloadHash string, now time.Time) (authHeader, amzDate string) {
	amzDate = headers["x-amz-date"]
	dateStamp := now.Format("20060102")
	credentialScope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, s.region)

	names := make([]string, 0, len(headers))
	for k := range headers {
		names = append(names, k)
	}
	sort.Strings(names)

	var canonicalHeaders strings.Builder
	for _, k := range names {
		canonicalHeaders.WriteString(k)
		canonicalHeaders.WriteString(":")
		canonicalHeaders.WriteString(strings.TrimSpace(headers[k]))
		canonicalHeaders.WriteString("\n")
	}
	signedHeaders := strings.Join(names, ";")

	canonicalRequest := strings.Join([]string{
		method,
		canonicalURI,
		canonicalQuery,
		canonicalHeaders.String(),
		signedHeaders,
		payloadHash,
	}, "\n")

	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	signature := hex.EncodeToString(s.signingKey(dateStamp, stringToSign))

	authHeader = fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		s.accessKey, credentialScope, signedHeaders, signature)
	return authHeader, amzDate
}

// signingKey derives the final HMAC key for the day/region/service and signs
// stringToSign with it, per the SigV4 key-derivation chain.
func (s *StorageService) signingKey(dateStamp, stringToSign string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+s.secretKey), dateStamp)
	kRegion := hmacSHA256(kDate, s.region)
	kService := hmacSHA256(kRegion, "s3")
	kSigning := hmacSHA256(kService, "aws4_request")
	return hmacSHA256(kSigning, stringToSign)
}

func hmacSHA256(key []byte, data string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(data))
	return h.Sum(nil)
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// encodePath URI-encodes each path segment (leaving the "/" separators
// alone), which is what S3's canonical-URI signing expects.
func encodePath(key string) string {
	segments := strings.Split(key, "/")
	for i, seg := range segments {
		segments[i] = awsURIEncode(seg, false)
	}
	return strings.Join(segments, "/")
}

func buildCanonicalQuery(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	pairs := make([]string, 0, len(keys))
	for _, k := range keys {
		pairs = append(pairs, awsURIEncode(k, true)+"="+awsURIEncode(params[k], true))
	}
	return strings.Join(pairs, "&")
}

// awsURIEncode implements the exact percent-encoding AWS's SigV4 spec
// requires: unreserved characters pass through unescaped, "/" is either
// preserved (path segments) or escaped as %2F (query keys/values), and
// everything else is escaped as uppercase-hex "%XX".
func awsURIEncode(s string, encodeSlash bool) string {
	var buf strings.Builder
	for i := 0; i < len(s); i++ {
		b := s[i]
		switch {
		case (b >= 'A' && b <= 'Z') || (b >= 'a' && b <= 'z') || (b >= '0' && b <= '9') || b == '-' || b == '_' || b == '.' || b == '~':
			buf.WriteByte(b)
		case b == '/' && !encodeSlash:
			buf.WriteByte(b)
		default:
			fmt.Fprintf(&buf, "%%%02X", b)
		}
	}
	return buf.String()
}
