package service

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"strings"
	"testing"
)

func clickSig(txn, service, invoice, secret string, amount float64, signTime string) string {
	str := fmt.Sprintf("%s;%s;%s;%s;%.2f", txn, service, invoice, secret, amount)
	if signTime != "" {
		str += ";" + signTime
	}
	h := md5.Sum([]byte(str))
	return hex.EncodeToString(h[:])
}

func TestClickVerifyPaymentSignature(t *testing.T) {
	s := NewClickUzService(nil, "m1", "svc", "secret")

	good := clickSig("t1", "svc", "INV-1", "secret", 100, "")
	if !s.VerifyPaymentSignature("t1", "INV-1", 100, "", good) {
		t.Fatal("valid signature rejected")
	}
	if !s.VerifyPaymentSignature("t1", "INV-1", 100, "", strings.ToUpper(good)) {
		t.Fatal("uppercase hex should be accepted")
	}
	if s.VerifyPaymentSignature("t1", "INV-2", 100, "", good) {
		t.Fatal("signature replayed on other invoice accepted")
	}
	if s.VerifyPaymentSignature("t1", "INV-1", 101, "", good) {
		t.Fatal("amount tampering accepted")
	}
	if s.VerifyPaymentSignature("t1", "INV-1", 100, "", "") {
		t.Fatal("empty sign accepted")
	}

	withTime := clickSig("t1", "svc", "INV-1", "secret", 100, "2026-01-01 10:00:00")
	if !s.VerifyPaymentSignature("t1", "INV-1", 100, "2026-01-01 10:00:00", withTime) {
		t.Fatal("sign_time signature rejected")
	}
	if s.VerifyPaymentSignature("t1", "INV-1", 100, "2026-01-01 10:00:01", withTime) {
		t.Fatal("sign_time tampering accepted")
	}
}

func TestClickVerifyPaymentSignature_UnconfiguredFailsClosed(t *testing.T) {
	// With an empty secret, the "valid" signature is computable by anyone.
	noSecret := NewClickUzService(nil, "m1", "svc", "")
	if noSecret.VerifyPaymentSignature("t1", "INV-1", 100, "", clickSig("t1", "svc", "INV-1", "", 100, "")) {
		t.Fatal("empty secret must fail closed")
	}
	noService := NewClickUzService(nil, "m1", "", "secret")
	if noService.VerifyPaymentSignature("t1", "INV-1", 100, "", clickSig("t1", "", "INV-1", "secret", 100, "")) {
		t.Fatal("empty service id must fail closed")
	}
	if noSecret.Configured() || noService.Configured() {
		t.Fatal("Configured must be false")
	}
	if !NewClickUzService(nil, "m", "s", "k").Configured() {
		t.Fatal("Configured must be true")
	}
}

func TestNewInvoiceNumberUnique(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 1000; i++ {
		n := newInvoiceNumber("12345678-aaaa-bbbb-cccc-1234567890ab")
		if seen[n] {
			t.Fatalf("collision: %s", n)
		}
		seen[n] = true
		if !strings.HasPrefix(n, "SUB-12345678-") {
			t.Fatalf("unexpected format %s", n)
		}
	}
}

func TestTelegramWebhookSecret(t *testing.T) {
	empty := NewTelegramPaymentService(nil, "")
	if empty.WebhookEnabled() || empty.VerifyWebhookSecret("") || empty.VerifyWebhookSecret("anything") {
		t.Fatal("empty secret must disable webhook and never verify")
	}
	s := NewTelegramPaymentService(nil, "whsec")
	if !s.WebhookEnabled() || !s.VerifyWebhookSecret("whsec") {
		t.Fatal("correct secret rejected")
	}
	if s.VerifyWebhookSecret("whsec2") || s.VerifyWebhookSecret("") || s.VerifyWebhookSecret("WHSEC") {
		t.Fatal("wrong secret accepted")
	}
}

func TestTelegramLinkHasNoSecrets(t *testing.T) {
	link := telegramPaymentLink("SUB-12345678-1-abcd")
	if link != "https://t.me/CLICKtest?start=SUB-12345678-1-abcd" {
		t.Fatalf("link = %s", link)
	}
	if strings.Contains(link, ":") && strings.Count(link, ":") > 1 {
		t.Fatal("link must not carry colon-separated credentials")
	}
}
