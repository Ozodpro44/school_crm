# Quick Start - Backend Integration

## What Changed?
- **Students page** now uses backend API instead of local storage
- **Payments page** now uses backend API instead of local storage
- All CRUD operations (Create, Read, Update, Delete) go to backend

## Why?
✅ Real-time data sync across users  
✅ Data persists in database  
✅ Multi-user support  
✅ Single source of truth  

## How to Use

### Students Page
1. **Select a branch** (if not already selected)
2. **Add student:** Click "Add Student" button
3. **Edit student:** Click edit icon in list
4. **Delete student:** Click trash icon or select & delete
5. **Mark as left:** Click X icon to mark student as left
6. **Import CSV:** Use import button and upload CSV file

### Payments Page
1. **Select a branch** (if not already selected)
2. **Record payment:** Click "Add Payment" button, select student
3. **Edit payment:** Click edit icon (only amount, status, method, notes)
4. **Delete payment:** Click trash icon
5. **Bulk mark paid:** Click "Bulk Payment" to mark multiple students paid

## Error Messages

### "No Branch Selected"
**Solution:** Select a branch from the branch selector in header/sidebar

### "No Active Students Found"
**Solution:** Go to Students page, add new students with "Active" status

### "Failed to load data"
**Solution:** Check backend is running and accessible

### "Failed to save [operation]"
**Solution:** Check internet connection and backend availability

## Features by Page

### Students
- ✅ Create/Edit/Delete students
- ✅ Bulk delete multiple students
- ✅ Mark students as left
- ✅ CSV import with error reporting
- ✅ Branch filtering
- ✅ Real-time sync

### Payments
- ✅ Record/Edit/Delete payments
- ✅ Bulk mark students as paid
- ✅ Payment status tracking
- ✅ Branch filtering
- ✅ Real-time sync

## API Endpoints Used

**Students:**
- `GET /api/students?branchId={id}`
- `POST /api/students`
- `PATCH /api/students/{id}`
- `DELETE /api/students/{id}`

**Payments:**
- `GET /api/payments?branchId={id}`
- `POST /api/payments`
- `PATCH /api/payments/{id}`
- `DELETE /api/payments/{id}`

## Keyboard Shortcuts
- None added yet, but can be implemented

## Tips
- Changes are saved to backend immediately
- Page refreshes get latest data from server
- Errors don't lose your unsaved changes
- CSV import shows warnings for each failed row
- Bulk operations are atomic (all or nothing)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Students don't show | Select a branch first |
| Can't add payment | Add students to branch first |
| Changes not saved | Check internet & backend status |
| Duplicate students | Likely browser cache, refresh page |
| Import failed | Check CSV format, see warning messages |

## File Locations
- Students page: `/src/pages/students.tsx`
- Payments page: `/src/pages/payments.tsx`
- API functions: `/src/lib/api.ts`
- Types: `/src/types/index.ts`

## Support Documents
1. `BACKEND_INTEGRATION_SUMMARY.md` - Full overview
2. `STUDENTS_PAGE_BACKEND_INTEGRATION.md` - Students page details
3. `PAYMENTS_PAGE_BACKEND_INTEGRATION.md` - Payments page details
4. `PAYMENTS_PAGE_FIXES.md` - Why students don't show & fixes
