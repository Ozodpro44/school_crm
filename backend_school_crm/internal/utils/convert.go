package utils

import (
	// "regexp"
	"strings"
	"time"
	"unicode"
)

// ToSnakeCase converts camelCase to snake_case
func ToSnakeCase(s string) string {
	var result strings.Builder
	for i, r := range s {
		if unicode.IsUpper(r) && i > 0 {
			result.WriteByte('_')
			result.WriteRune(unicode.ToLower(r))
		} else {
			result.WriteRune(r)
		}
	}
	return result.String()
}

// ConvertKeysToSnakeCase converts all keys in a map from camelCase to snake_case
func ConvertKeysToSnakeCase(updates map[string]interface{}) map[string]interface{} {
	converted := make(map[string]interface{})
	for key, value := range updates {
		converted[ToSnakeCase(key)] = value
	}
	return converted
}

// GetLocalTime returns the current time in Asia/Tashkent timezone (UTC+5)
func GetLocalTime() time.Time {
	loc, err := time.LoadLocation("Asia/Tashkent")
	if err != nil {
		// Fallback to UTC if timezone cannot be loaded
		return time.Now().UTC()
	}
	return time.Now().In(loc)
}
