package service

import "testing"

func TestExceedsMonthlyFee(t *testing.T) {
	cases := []struct {
		name               string
		fee, other, amount float64
		wantExceeds        bool
		wantRemaining      float64
	}{
		{"no fee configured", 0, 0, 999999, false, 0},
		{"negative fee ignored", -5, 0, 10, false, 0},
		{"exact fit", 500000, 200000, 300000, false, 300000},
		{"one over", 500000, 200000, 300001, true, 300000},
		{"first payment within fee", 500000, 0, 500000, false, 500000},
		{"already overpaid, remaining clamps to 0", 500000, 600000, 1, true, 0},
		{"partial then rest", 500000, 250000, 250000, false, 250000},
	}
	for _, c := range cases {
		gotE, gotR := exceedsMonthlyFee(c.fee, c.other, c.amount)
		if gotE != c.wantExceeds || gotR != c.wantRemaining {
			t.Errorf("%s: got (%v,%v) want (%v,%v)", c.name, gotE, gotR, c.wantExceeds, c.wantRemaining)
		}
	}
}
