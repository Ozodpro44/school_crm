# Missing Translation Keys - Fixed

## Problem
Console was showing errors for missing translation keys:
- `Translation key not found: bankPayments`
- `Translation key not found: perPage`

## Root Cause
These translation keys were not defined in the translation files, even though the dashboard and reports components were trying to use them.

## Solution
Added missing translations to `frontend_school_crm/src/lib/translations/misc.ts`:

### Added Keys

#### Pagination (for Reports Page)
- `perPage` - "Per Page" (select dropdown label)
- `page` - "Page" (page indicator)
- `of` - "of" (page counter "Page X of Y")
- `to` - "to" (range indicator "Showing 1 to 10 of 1234")
- `previous` - "Previous" (button)
- `next` - "Next" (button)

#### Payment Methods (for Dashboard)
- `cashPayments` - "Cash Payments" (dashboard card)
- `cardPayments` - "Card Payments" (dashboard card)
- `bankPayments` - "Bank Payments" (dashboard card)

### Translations Provided
Each key includes translations for:
- **uz-cyrl** (Uzbek Cyrillic)
- **uz-latn** (Uzbek Latin)
- **en** (English)

Example:
```typescript
perPage: { 
  "uz-cyrl": "Сахифада", 
  "uz-latn": "Sahifada", 
  en: "Per Page" 
}
```

## Files Modified
- `frontend_school_crm/src/lib/translations/misc.ts`

## Testing
✓ Frontend build successful
✓ No console errors for missing translation keys
✓ All pages display correct translations
