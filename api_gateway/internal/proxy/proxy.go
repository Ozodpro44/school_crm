// Package proxy provides HTTP reverse proxy helpers for the api_gateway.
// Each upstream service gets its own ReverseProxy instance.
package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
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
		if clientIP := req.Header.Get("X-Real-IP"); clientIP == "" {
			req.Header.Set("X-Real-IP", strings.Split(req.RemoteAddr, ":")[0])
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
