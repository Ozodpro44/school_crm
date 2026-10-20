package service

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
	"time"
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

func TestSummariseDayPairsInOut(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Tashkent")
	at := func(h, m int) time.Time { return time.Date(2026, 10, 19, h, m, 0, 0, loc).UTC() }

	// in 08:00, out 12:00, in 13:00, out 17:00 → 4h + 4h; the lunch hour is not counted.
	d := summariseDay("2026-10-19", []time.Time{at(17, 0), at(8, 0), at(13, 0), at(12, 0)}, 8*60+30, loc)
	if d.Minutes != 480 || d.Events != 4 || d.Late {
		t.Fatalf("got %+v", d)
	}
	if !d.FirstIn.Equal(at(8, 0)) || !d.LastOut.Equal(at(17, 0)) {
		t.Fatalf("first/last wrong: %+v", d)
	}

	// An unpaired trailing "in" counts nothing; arriving after the cut-off is late.
	d = summariseDay("2026-10-19", []time.Time{at(9, 0), at(12, 0), at(13, 0)}, 8*60+30, loc)
	if d.Minutes != 180 || !d.Late {
		t.Fatalf("got %+v", d)
	}

	// A double scan seconds apart is one visit, not in+out.
	d = summariseDay("2026-10-19", []time.Time{at(8, 0), at(8, 0).Add(10 * time.Second), at(16, 0)}, 8*60+30, loc)
	if d.Events != 2 || d.Minutes != 480 {
		t.Fatalf("got %+v", d)
	}
}

func TestMakeThumbnail(t *testing.T) {
	out, err := MakeThumbnail(encode(t, 1000, 500, false))
	if err != nil {
		t.Fatal(err)
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(out))
	if err != nil || format != "jpeg" || cfg.Width != 256 || cfg.Height != 128 {
		t.Fatalf("got %dx%d %s err=%v, want 256x128 jpeg", cfg.Width, cfg.Height, format, err)
	}
	small, err := MakeThumbnail(encode(t, 200, 200, true))
	if err != nil {
		t.Fatal(err)
	}
	if cfg, _, _ := image.DecodeConfig(bytes.NewReader(small)); cfg.Width != 200 {
		t.Fatalf("a small image must not be upscaled, got %d", cfg.Width)
	}
	if _, err := MakeThumbnail([]byte("nope")); err == nil {
		t.Fatal("expected an error for non-image data")
	}
}

// jpegWithOrientation inserts an EXIF APP1 segment carrying the orientation tag.
func jpegWithOrientation(t *testing.T, jpg []byte, o int) []byte {
	t.Helper()
	tiff := []byte{'M', 'M', 0, 0x2A, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, byte(o), 0, 0, 0, 0, 0, 0}
	seg := append([]byte("Exif\x00\x00"), tiff...)
	l := len(seg) + 2
	app1 := append([]byte{0xFF, 0xE1, byte(l >> 8), byte(l)}, seg...)
	out := append([]byte{}, jpg[:2]...)
	out = append(out, app1...)
	return append(out, jpg[2:]...)
}

func TestNormalizeFacePhotoAppliesExifOrientation(t *testing.T) {
	base := encode(t, 300, 200, false) // landscape
	if got := jpegOrientation(jpegWithOrientation(t, base, 6)); got != 6 {
		t.Fatalf("orientation read as %d, want 6", got)
	}
	out, err := NormalizeFacePhoto(jpegWithOrientation(t, base, 6))
	if err != nil {
		t.Fatal(err)
	}
	cfg, _, _ := image.DecodeConfig(bytes.NewReader(out))
	if cfg.Width != 200 || cfg.Height != 300 {
		t.Fatalf("a sideways photo must come out upright (200x300), got %dx%d", cfg.Width, cfg.Height)
	}
	// Orientation 1 / no tag: original bytes untouched.
	if kept, _ := NormalizeFacePhoto(base); !bytes.Equal(kept, base) {
		t.Fatal("an upright JPEG must pass through unchanged")
	}
	if kept, _ := NormalizeFacePhoto(jpegWithOrientation(t, base, 1)); cfgW(kept) != 300 {
		t.Fatal("orientation 1 must not rotate")
	}
}

func cfgW(b []byte) int {
	c, _, _ := image.DecodeConfig(bytes.NewReader(b))
	return c.Width
}

func TestApplyOrientationMovesPixels(t *testing.T) {
	// 2x1 image: left red, right blue. Rotating 90° CW puts red on top.
	src := image.NewRGBA(image.Rect(0, 0, 2, 1))
	src.Set(0, 0, color.RGBA{255, 0, 0, 255})
	src.Set(1, 0, color.RGBA{0, 0, 255, 255})
	out := applyOrientation(src, 6)
	if out.Bounds().Dx() != 1 || out.Bounds().Dy() != 2 {
		t.Fatalf("bounds %v", out.Bounds())
	}
	if r, _, _, _ := out.At(0, 0).RGBA(); r == 0 {
		t.Fatal("red should be on top after a 90° clockwise turn")
	}
}
