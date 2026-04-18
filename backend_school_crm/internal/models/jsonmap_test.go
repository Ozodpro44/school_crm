package models_test

import (
	"testing"

	"github.com/school-crm/backend/internal/models"
)

// ---- JSONMap.Value ----

func TestJSONMap_Value_NonEmpty(t *testing.T) {
	m := models.JSONMap{"key": "val", "count": float64(3)}
	v, err := m.Value()
	if err != nil {
		t.Fatalf("Value() error: %v", err)
	}
	if v == nil {
		t.Fatal("Value() should not return nil for non-empty map")
	}
}

func TestJSONMap_Value_Empty(t *testing.T) {
	m := models.JSONMap{}
	v, err := m.Value()
	if err != nil {
		t.Fatalf("Value() error: %v", err)
	}
	if v == nil {
		t.Fatal("Value() should not return nil for empty map")
	}
	// Empty map marshals to "{}"
	b, ok := v.([]byte)
	if !ok {
		t.Fatalf("Value() should return []byte, got %T", v)
	}
	if string(b) != "{}" {
		t.Errorf("empty map Value() = %q, want {}", string(b))
	}
}

func TestJSONMap_Value_NilMap(t *testing.T) {
	var m models.JSONMap // nil map
	v, err := m.Value()
	if err != nil {
		t.Fatalf("Value() on nil map error: %v", err)
	}
	_ = v // nil map marshals to "null"
}

// ---- JSONMap.Scan ----

func TestJSONMap_Scan_NonByteSlice(t *testing.T) {
	m := models.JSONMap{}
	// Passing a non-[]byte value should not error (falls back to empty object).
	err := m.Scan("not bytes")
	if err != nil {
		t.Errorf("Scan with non-[]byte should not error, got: %v", err)
	}
}

func TestJSONMap_Scan_ValidJSON(t *testing.T) {
	m := models.JSONMap{}
	// Valid JSON bytes — Scan should not error.
	err := m.Scan([]byte(`{"name":"test","value":42}`))
	if err != nil {
		t.Errorf("Scan with valid JSON should not error, got: %v", err)
	}
}

func TestJSONMap_Scan_InvalidJSON(t *testing.T) {
	m := models.JSONMap{}
	// Invalid JSON bytes — Scan should return an error.
	err := m.Scan([]byte(`{invalid`))
	if err == nil {
		t.Error("Scan with invalid JSON should return an error")
	}
}
