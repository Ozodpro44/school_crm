package service

import (
	"database/sql"
	"testing"
)

func TestLimitExceeded(t *testing.T) {
	five := sql.NullInt64{Int64: 5, Valid: true}
	cases := []struct {
		name    string
		current int
		max     sql.NullInt64
		want    bool
	}{
		{"unlimited", 500, sql.NullInt64{}, false},
		{"below", 4, five, false},
		{"at limit blocks", 5, five, true},
		{"above", 7, five, true},
		{"zero max", 0, sql.NullInt64{Int64: 0, Valid: true}, true},
	}
	for _, c := range cases {
		if got := limitExceeded(c.current, c.max); got != c.want {
			t.Errorf("%s: got %v want %v", c.name, got, c.want)
		}
	}
}
