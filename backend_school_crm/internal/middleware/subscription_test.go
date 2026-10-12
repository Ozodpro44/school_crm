package middleware

import "testing"

func TestGateFailsClosed(t *testing.T) {
	for _, m := range []string{"POST", "PUT", "PATCH", "DELETE"} {
		if !gateFailsClosed(m) {
			t.Errorf("%s should fail closed", m)
		}
	}
	for _, m := range []string{"GET", "HEAD", "OPTIONS"} {
		if gateFailsClosed(m) {
			t.Errorf("%s should fail open", m)
		}
	}
}
