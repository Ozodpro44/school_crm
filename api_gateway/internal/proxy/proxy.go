// Package proxy provides HTTP reverse proxy helpers for the api_gateway.
// Each upstream service gets its own ReverseProxy instance.
package proxy

import (
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"
)

// New creates a reverse proxy that forwards requests to target.
// The path prefix strip is NOT applied here — route grouping handles that.
func New(target string) (*httputil.ReverseProxy, error) {
	u, err := url.Parse(target)
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(u)
	proxy.Transport = &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	// Enrich forwarded headers so upstreams know the real client IP.
	director := proxy.Director
	proxy.Director = func(req *http.Request) {
		director(req)
		req.Header.Set("X-Forwarded-Host", req.Host)
		// Always overwrite from RemoteAddr — never trust a client-supplied
		// X-Real-IP, or a client could spoof the IP that downstream
		// audit/rate-limit logic sees. net.SplitHostPort (not strings.Split
		// on ":") is required here: an IPv6 RemoteAddr like "[::1]:1234"
		// contains colons in the address itself.
		if host, _, err := net.SplitHostPort(req.RemoteAddr); err == nil {
			req.Header.Set("X-Real-IP", host)
		} else {
			req.Header.Set("X-Real-IP", req.RemoteAddr)
		}
	}

	// Strip CORS headers from upstream responses so the api_gateway's own
	// corsMiddleware is the single source of truth. Without this, ReverseProxy
	// copies upstream CORS headers with Header.Add(), producing ", *" duplicates.
	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Del("Access-Control-Allow-Origin")
		resp.Header.Del("Access-Control-Allow-Credentials")
		resp.Header.Del("Access-Control-Allow-Headers")
		resp.Header.Del("Access-Control-Allow-Methods")
		resp.Header.Del("Access-Control-Expose-Headers")
		resp.Header.Del("Access-Control-Max-Age")
		return nil
	}

	return proxy, nil
}

// Handler wraps a ReverseProxy into a standard http.HandlerFunc.
func Handler(p *httputil.ReverseProxy) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p.ServeHTTP(w, r)
	}
}
