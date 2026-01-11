# Cyrillic Search Implementation

## Overview
Added cross-script search functionality that allows searching in Cyrillic even when data is stored in Latin, and vice versa.

## Changes Made

### New Utility File
Created `/frontend_school_crm/src/lib/transliterate.ts`:
- `cyrillicToLatin()` - Converts Cyrillic text to Latin equivalent
- `normalizeSearchText()` - Normalizes text for cross-script matching
- `searchMatchesCrossScript()` - Main function for cross-script search matching
- `hasCyrillic()` - Checks if text contains Cyrillic characters

### Updated Pages with Search
The following pages now support Cyrillic/Latin search:

1. **Students** (`/frontend_school_crm/src/pages/students.tsx`)
   - Search by student name (fullName)
   - Search by class name

2. **Teachers** (`/frontend_school_crm/src/pages/teachers.tsx`)
   - Search by teacher name
   - Search by subjects

3. **Classes** (`/frontend_school_crm/src/pages/classes.tsx`)
   - Search by class name

4. **Class Details** (`/frontend_school_crm/src/pages/class-details.tsx`)
   - Search for students within a class

5. **Expenses** (`/frontend_school_crm/src/pages/expenses.tsx`)
   - Search by expense title
   - Search by category

6. **Salaries** (`/frontend_school_crm/src/pages/salaries.tsx`)
   - Search by teacher name

7. **Payments** (`/frontend_school_crm/src/pages/payments.tsx`)
   - Search by student name

## How It Works

### Transliteration Mapping
The implementation includes a comprehensive Russian Cyrillic to Latin mapping:
- Single characters: `а → a`, `б → b`, `в → v`, etc.
- Multi-character mappings: `ж → zh`, `ц → ts`, `ч → ch`, `щ → sch`
- Handles both uppercase and lowercase
- Removes hard signs (ъ) and soft signs (ь)

### Search Algorithm
1. User types a search query (Cyrillic or Latin)
2. Query is normalized: Cyrillic → Latin, then lowercased
3. Data in the list is also normalized the same way
4. Check if normalized data includes normalized query

### Example
- Data: `Иван Иванов` (Russian name)
- User types: `ivan`
- Process:
  - Data normalized: `ivan ivanov`
  - Query normalized: `ivan`
  - Result: ✓ Match found

- User types: `иван` (Cyrillic)
- Process:
  - Data normalized: `ivan ivanov`
  - Query normalized: `ivan` (from `иван`)
  - Result: ✓ Match found

## Usage

All updated pages use the search function automatically. Users can:
- Type in Cyrillic and find Latin records
- Type in Latin and find Cyrillic records
- Mix scripts as needed (search still works)

No backend changes required - all processing happens on the frontend.

## Testing

To test the functionality:
1. Add students/teachers with Cyrillic names
2. Try searching with Latin characters
3. Try searching with Cyrillic characters
4. Both should return the same results
