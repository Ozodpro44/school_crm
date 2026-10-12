package config

import "testing"

func TestValidateProduction(t *testing.T) {
	good := "0123456789abcdef0123456789abcdef"
	cases := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{"placeholder rejected", Config{Environment: "production", JWTSecret: PlaceholderJWTSecret, DatabaseURL: "x"}, true},
		{"short rejected", Config{Environment: "production", JWTSecret: "short", DatabaseURL: "x"}, true},
		{"good accepted", Config{Environment: "production", JWTSecret: good, DatabaseURL: "x"}, false},
		{"dev placeholder only warns", Config{Environment: "development", JWTSecret: PlaceholderJWTSecret, DatabaseURL: "x"}, false},
		{"missing secret", Config{Environment: "development", DatabaseURL: "x"}, true},
	}
	for _, c := range cases {
		_, err := c.cfg.Validate()
		if (err != nil) != c.wantErr {
			t.Errorf("%s: err=%v wantErr=%v", c.name, err, c.wantErr)
		}
	}
	w, _ := (&Config{Environment: "production", JWTSecret: good, DatabaseURL: "x"}).Validate()
	if len(w) != 1 {
		t.Errorf("expected LOGS_TOKEN warning, got %v", w)
	}
}
