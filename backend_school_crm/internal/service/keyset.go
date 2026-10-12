package service

import (
	"encoding/base64"
	"fmt"
	"strings"
	"time"
)

// monthKey formats a date's month the way payments.month / salaries.month
// store it: zero-padded "01".."12" (NOT the English month name).
func monthKey(t time.Time) string { return fmt.Sprintf("%02d", int(t.Month())) }

// escapeLike escapes %, _ and \ so user input matches literally. Queries must
// use it with an explicit ESCAPE '\' clause.
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// encodeStudentCursor packs the last row's (full_name, id) into an opaque
// keyset token; equal names are disambiguated by id.
func encodeStudentCursor(fullName, id string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(id + "\x00" + fullName))
}

// decodeStudentCursor reverses encodeStudentCursor; ok=false for garbage.
func decodeStudentCursor(tok string) (fullName, id string, ok bool) {
	b, err := base64.RawURLEncoding.DecodeString(tok)
	if err != nil {
		return "", "", false
	}
	i := strings.IndexByte(string(b), 0)
	if i <= 0 {
		return "", "", false
	}
	return string(b[i+1:]), string(b[:i]), true
}

// studentListCacheKey includes every input that changes the result,
// notably the cursor (without it, page 2+ of a cursor walk returned page 1).
func studentListCacheKey(in StudentFilterInput) string {
	return fmt.Sprintf("crm:students:%s:%s:%s:%s:%s:%s:%s:%s:%s:%s",
		in.BranchID, in.Page, in.Limit, in.Cursor, in.Search, in.Status, in.ClassID, in.PaymentStatus, in.Month, in.Year)
}
