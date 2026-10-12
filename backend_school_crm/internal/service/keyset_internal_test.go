package service

import (
	"errors"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestMonthKeyZeroPadded(t *testing.T) {
	want := []string{"01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"}
	for m := 1; m <= 12; m++ {
		if got := monthKey(time.Date(2026, time.Month(m), 15, 0, 0, 0, 0, time.UTC)); got != want[m-1] {
			t.Errorf("month %d: got %q want %q", m, got, want[m-1])
		}
	}
}

func TestEscapeLike(t *testing.T) {
	if got := escapeLike(`50%_\x`); got != `50\%\_\\x` {
		t.Fatalf("got %q", got)
	}
}

func TestStudentCursorRoundTrip(t *testing.T) {
	tok := encodeStudentCursor("Ali Valiyev", "id-1")
	n, i, ok := decodeStudentCursor(tok)
	if !ok || n != "Ali Valiyev" || i != "id-1" {
		t.Fatalf("got %q %q %v", n, i, ok)
	}
	if _, _, ok := decodeStudentCursor("Ali Valiyev"); ok {
		t.Fatal("raw name must not decode as cursor")
	}
	if encodeStudentCursor("A", "1") == encodeStudentCursor("A", "2") {
		t.Fatal("id must tiebreak equal names")
	}
}

func TestStudentListCacheKeyIncludesCursor(t *testing.T) {
	a := studentListCacheKey(StudentFilterInput{BranchID: "b", Page: "1", Limit: "10", Cursor: "c1"})
	b := studentListCacheKey(StudentFilterInput{BranchID: "b", Page: "1", Limit: "10", Cursor: "c2"})
	if a == b {
		t.Fatal("different cursors must not share a cache key")
	}
}

func TestRenderMessageEscapesName(t *testing.T) {
	got := renderMessage("Hi <b>{name}</b>", "A<i>&Co")
	if got != "Hi <b>A&lt;i&gt;&amp;Co</b>" {
		t.Fatalf("got %q", got)
	}
}

func TestRedactTelegramErr(t *testing.T) {
	ue := &url.Error{Op: "Post", URL: "https://api.telegram.org/botSECRET:TOKEN/sendMessage", Err: errors.New("timeout")}
	got := redactTelegramErr(ue)
	if strings.Contains(got.Error(), "SECRET") || !strings.Contains(got.Error(), "timeout") {
		t.Fatalf("bad redaction: %v", got)
	}
}

func TestDeviceLocation(t *testing.T) {
	if deviceLocation("") != time.UTC || deviceLocation("Not/AZone") != time.UTC {
		t.Fatal("empty/unknown must fall back to UTC")
	}
	if deviceLocation("Asia/Tashkent").String() != "Asia/Tashkent" {
		t.Skip("tzdata unavailable")
	}
}
