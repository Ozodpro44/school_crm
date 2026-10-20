package service

import (
	"bytes"
	"encoding/base64"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png" // register the PNG decoder
)

// thumbMaxSide is the longest edge of the stored profile thumbnail.
const thumbMaxSide = 256

// MakeThumbnail decodes a JPEG/PNG and returns a JPEG whose longest side is at
// most thumbMaxSide (smaller images are re-encoded unchanged in size). It uses
// area averaging, which keeps faces crisp without an imaging dependency.
func MakeThumbnail(data []byte) ([]byte, error) {
	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, errors.New("the photo could not be read")
	}
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w == 0 || h == 0 {
		return nil, errors.New("the photo is empty")
	}
	nw, nh := w, h
	if max(w, h) > thumbMaxSide {
		if w >= h {
			nw, nh = thumbMaxSide, max(1, h*thumbMaxSide/w)
		} else {
			nw, nh = max(1, w*thumbMaxSide/h), thumbMaxSide
		}
	}

	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	for y := 0; y < nh; y++ {
		y0, y1 := b.Min.Y+y*h/nh, b.Min.Y+(y+1)*h/nh
		if y1 <= y0 {
			y1 = y0 + 1
		}
		for x := 0; x < nw; x++ {
			x0, x1 := b.Min.X+x*w/nw, b.Min.X+(x+1)*w/nw
			if x1 <= x0 {
				x1 = x0 + 1
			}
			var r, g, bl, n uint64
			for yy := y0; yy < y1; yy++ {
				for xx := x0; xx < x1; xx++ {
					cr, cg, cb, _ := src.At(xx, yy).RGBA()
					r, g, bl, n = r+uint64(cr), g+uint64(cg), bl+uint64(cb), n+1
				}
			}
			dst.Set(x, y, color.RGBA{uint8(r / n >> 8), uint8(g / n >> 8), uint8(bl / n >> 8), 255})
		}
	}

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 80}); err != nil {
		return nil, errors.New("the photo could not be converted")
	}
	return buf.Bytes(), nil
}

// thumbDataURL renders stored thumbnail bytes as an inline image URL.
func thumbDataURL(thumb []byte) string {
	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(thumb)
}
