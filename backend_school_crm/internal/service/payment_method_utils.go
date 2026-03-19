package service

import "strings"

const (
	studentPaymentMethodCash     = "cash"
	studentPaymentMethodBank     = "bank"
	studentPaymentMethodClick    = "click"
	studentPaymentMethodCard     = "card"
	studentPaymentMethodTerminal = "terminal"
)

func normalizeStudentPaymentMethod(method string) string {
	switch strings.ToLower(strings.TrimSpace(method)) {
	case studentPaymentMethodCard, studentPaymentMethodClick:
		return studentPaymentMethodClick
	case studentPaymentMethodCash:
		return studentPaymentMethodCash
	case studentPaymentMethodBank:
		return studentPaymentMethodBank
	case studentPaymentMethodTerminal:
		return studentPaymentMethodTerminal
	default:
		return strings.ToLower(strings.TrimSpace(method))
	}
}

func studentPaymentMethodFilterValues(method string) []string {
	switch normalizeStudentPaymentMethod(method) {
	case studentPaymentMethodClick:
		return []string{studentPaymentMethodClick, studentPaymentMethodCard}
	case studentPaymentMethodCash:
		return []string{studentPaymentMethodCash}
	case studentPaymentMethodBank:
		return []string{studentPaymentMethodBank}
	case studentPaymentMethodTerminal:
		return []string{studentPaymentMethodTerminal}
	default:
		normalized := normalizeStudentPaymentMethod(method)
		if normalized == "" {
			return nil
		}
		return []string{normalized}
	}
}

func newStudentPaymentMethodTotals() map[string]float64 {
	return map[string]float64{
		studentPaymentMethodClick:    0,
		studentPaymentMethodCash:     0,
		studentPaymentMethodBank:     0,
		studentPaymentMethodTerminal: 0,
	}
}

func addStudentPaymentAmountByMethod(totals map[string]float64, method string, amount float64) {
	normalized := normalizeStudentPaymentMethod(method)
	if normalized == "" {
		return
	}

	totals[normalized] += amount
}
