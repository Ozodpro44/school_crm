package service

import (
	"bytes"
	"image"
	"image/jpeg"
	"image/png"
	"testing"
)

func encode(t *testing.T, w, h int, asPNG bool) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	var buf bytes.Buffer
	var err error
	if asPNG {
		err = png.Encode(&buf, img)
	} else {
		err = jpeg.Encode(&buf, img, nil)
	}
	if err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestNormalizeFacePhoto(t *testing.T) {
	jpg := encode(t, 300, 300, false)
	if out, err := NormalizeFacePhoto(jpg); err != nil || !bytes.Equal(out, jpg) {
		t.Fatalf("jpeg should pass through untouched, err=%v", err)
	}
	out, err := NormalizeFacePhoto(encode(t, 300, 300, true))
	if err != nil {
		t.Fatalf("png: %v", err)
	}
	if _, format, err := image.DecodeConfig(bytes.NewReader(out)); err != nil || format != "jpeg" {
		t.Fatalf("png should become jpeg, got %q err=%v", format, err)
	}
	for name, data := range map[string][]byte{
		"empty":     nil,
		"not image": []byte("hello"),
		"tiny":      encode(t, 50, 50, false),
	} {
		if _, err := NormalizeFacePhoto(data); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestParseClockMinutes(t *testing.T) {
	if m, err := ParseClockMinutes("08:30"); err != nil || m != 510 {
		t.Fatalf("got %d, %v", m, err)
	}
	for _, bad := range []string{"", "8", "25:00", "08:61", "ab:cd"} {
		if _, err := ParseClockMinutes(bad); err == nil {
			t.Errorf("%q should be rejected", bad)
		}
	}
}

func TestParseReportMonth(t *testing.T) {
	from, to, err := ParseReportMonth("2026-10")
	if err != nil {
		t.Fatal(err)
	}
	// Tashkent is UTC+5: the month starts at 19:00 UTC on the previous day.
	if from.Format("2006-01-02T15:04") != "2026-09-30T19:00" || to.Format("2006-01-02T15:04") != "2026-10-31T19:00" {
		t.Fatalf("unexpected range %v – %v", from, to)
	}
	if _, _, err := ParseReportMonth("October"); err == nil {
		t.Fatal("bad month should fail")
	}
}
