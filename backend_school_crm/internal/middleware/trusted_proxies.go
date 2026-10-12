package middleware

import "strings"

// ParseTrustedProxies turns a comma-separated list of IPs/CIDRs (the
// TRUSTED_PROXIES env var) into the slice gin.Engine.SetTrustedProxies wants.
// An empty value yields a non-nil empty slice, meaning "trust no proxy"
// (gin's nil default would trust every proxy).
func ParseTrustedProxies(raw string) []string {
	out := []string{}
	for _, p := range strings.Split(raw, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
