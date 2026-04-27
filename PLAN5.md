# School CRM — Phase 5 Plan
## Fix Quick-Pay, Reports, Audit Log, Attendance, Teacher UX, Sidebar, Translations

Quick Legend
- 🔴 Broken / wrong
- 🟠 Missing feature or bad UX
- 🟡 Polish / inconsistency

---

## PART 1 — AUDIT LOG (English-only UI)

### 1.1 Translate all hardcoded English strings
All DataTable `header` values and filter placeholders are hardcoded English.
Files: `src/pages/audit-log.tsx`

**Hardcoded strings to replace with `t()` calls:**
| Hardcoded | Translation key to add |
|-----------|----------------------|
| `"Time"` | `auditTime` |
| `"User"` | `auditUser` |
| `"Action"` | `action` (already exists in common.ts ✓) |
| `"Resource"` | `resource` |
| `"Description"` | `description` |
| `"Resource ID"` | `resourceId` |
| `placeholder="Resource"` | `t("resource")` |
| `emptyTitle="No audit entries found"` | `t("noAuditEntries")` |
| `"create" / "update" / "delete"` (badge labels) | `t("create")`, `t("update")`, `t("delete")` |

**Add to `src/lib/translations/common.ts`:**
```ts
auditTime:      { "uz-cyrl": "Vaqt", "uz-latn": "Vaqt", en: "Time" },
auditUser:      { "uz-cyrl": "Foydalanuvchi", "uz-latn": "Foydalanuvchi", en: "User" },
resource:       { "uz-cyrl": "Resurs", "uz-latn": "Resurs", en: "Resource" },
description:    { "uz-cyrl": "Tavsif", "uz-latn": "Tavsif", en: "Description" },
resourceId:     { "uz-cyrl": "Resurs ID", "uz-latn": "Resurs ID", en: "Resource ID" },
noAuditEntries: { "uz-cyrl": "Yozuvlar topilmadi", "uz-latn": "Yozuvlar topilmadi", en: "No audit entries found" },
create:         { "uz-cyrl": "Yaratish", "uz-latn": "Yaratish", en: "Create" },
update:         { "uz-cyrl": "Yangilash", "uz-latn": "Yangilash", en: "Update" },
delete:         { "uz-cyrl": "O'chirish", "uz-latn": "O'chirish", en: "Delete" },
allResources:   { "uz-cyrl": "Barcha resurslar", "uz-latn": "Barcha resurslar", en: "All resources" },
```

### 1.2 Translate resource and action values in badges
The action badges (`create`, `update`, `delete`) and resource values are displayed raw.
Wrap with `t()` so they display in the current language.

---

## PART 2 — REPORTS PAGE

### 2.1 Fix report loader — hardcoded Uzbek 403 message
`reports.tsx` line ~830: permission-denied block shows hardcoded Uzbek text:
```tsx
<h2>403 – Ruxsat yo'q</h2>
<p>Hisobotlar bo'limiga kirish huquqingiz yo'q.</p>
```
Replace with `t("forbidden")` / `t("noPermissionReports")`.

### 2.2 Initial load skeleton is fine but tab-switch re-triggers full skeleton
When user switches report type (payment → salary → forecast), `setIsLoading(true)` 
fires which replaces the entire page with a skeleton for ~0.5s. This is jarring.

**Fix:** Use `isFetching` state (boolean, doesn't hide content) + a subtle inline 
`Loader2` spinner on the active tab button instead of full-page skeleton on tab switch.
Reserve the full `isLoading` skeleton only for the first load.

### 2.3 Add missing translation keys for report page
- `"loadingForecast"` exists but the forecast empty state may have hardcoded strings — audit and wrap.
- Permission denied strings (from 2.1).

---

## PART 3 — QUICK-PAY PAGE

### 3.1 Fix hardcoded English strings
| Location | Hardcoded | Fix |
|----------|-----------|-----|
| Collect tab | `"Deselect all" / "Select all"` | `t("selectAll")` / `t("deselectAll")` |
| QR tab | `"Camera permission denied"` | `t("cameraPermissionDenied")` |
| QR tab | `"Searching..."` (from `t("searching")`) | already translated ✓ |
| QR tab | various inline strings | audit and wrap |

**Add keys:**
```ts
cameraPermissionDenied: { "uz-cyrl": "Kamera ruxsati rad etildi", "uz-latn": "Kamera ruxsati rad etildi", en: "Camera permission denied" },
selectAll:              { "uz-cyrl": "Hammasini tanlash", "uz-latn": "Hammasini tanlash", en: "Select all" },
deselectAll:            { "uz-cyrl": "Bekor qilish", "uz-latn": "Bekor qilish", en: "Deselect all" },
```

### 3.2 Fix Collect tab UX — "Select all" logic
`"Deselect all" : "Select all"` toggle works but the text is hardcoded English.
Also: the button state doesn't reflect partial selection correctly.

### 3.3 Quick-pay collect tab — loading skeleton
The collect tab shows a blank `<div>` with no feedback while `searchStudentsWithPaymentStatus` 
is fetching. Add a small `Skeleton` list (5 rows) while loading.

### 3.4 QR scan tab — camera error handling
- Error is stored in local state but shown with no icon or retry button.
- Add an icon + "Try again" button that calls `startCamera()` again.

### 3.5 Receipt print dialog — missing translations
The `ReceiptDialog` component has several hardcoded English strings.
Wrap them all with `t()`.

---

## PART 4 — ATTENDANCE PAGE

### 4.1 Fix local EmptyState component — use shared one
`attendance.tsx` defines its own `EmptyState({ icon, text })` at the bottom of the file
(takes `React.ReactNode` icon + string `text`). The shared `EmptyState` from 
`@/components/EmptyState` uses `(icon: LucideIcon, title, description, action)`.

**Fix:** Replace the local component and its usages with the shared `EmptyState`.
Update call sites: `icon={Users}` (LucideIcon), `title={t("...")}`.

### 4.2 Translate attendance strings
Audit `attendance.tsx` for any remaining hardcoded strings. Key ones:
- Summary tab totals labels
- Alert descriptions

### 4.3 Attendance save — error feedback
Currently `notify.error(t("error"))` — too vague. The API error message should be 
forwarded: `notify.error(t("error"), error instanceof Error ? error.message : t("errorOccurred"))`.

### 4.4 Attendance mobile view
Mark/summary tabs switch fine on desktop but on mobile the student grid overflows.
Add `overflow-x-auto` to the attendance grid container.

---

## PART 5 — TEACHER EXPERIENCE

### 5.1 Teacher sidebar — still shows admin nav items
When `role === "teacher"`, the sidebar shows:
- Dashboard, Students, Teachers, Classes (should hide Teachers, Classes — teacher can't manage these)
- Finance group (hidden ✓)
- Administration group (all items hidden ✓)

**Fix:** Update nav `show` conditions:
```ts
{ name: t("students"), href: "/students", show: user?.role !== "teacher" },
{ name: t("teachers"), href: "/teachers", show: user?.role !== "teacher" },
{ name: t("classes"),  href: "/classes",  show: user?.role !== "teacher" },
{ name: t("timetable"), href: "/schedule", show: true },
{ name: t("assignments"), href: "/assignments", show: true },
```
Teachers should only see: Teacher Portal, Schedule, Assignments, Help.

### 5.2 Teacher portal — no guard for non-teacher access
Any logged-in user can navigate to `/teacher-portal`. 
Add a redirect: if `user.role !== "teacher"`, push to `"/"`.

### 5.3 Teacher portal — fix tab layout on mobile
The tab strip (classes, students, attendance, salary, profile) overflows on narrow screens.
Use `overflow-x-auto` + `whitespace-nowrap` on the tab container.

### 5.4 Teacher portal — attendance tab saves without selecting class
If the teacher has multiple classes, `attendanceClassId` can be empty.
Add a guard: if no class selected, show a `<Select>` prompt instead of a disabled save.

### 5.5 Fix layout redirect for teachers
After teacher login, if they navigate to `/` (dashboard), redirect them to `/teacher-portal`.
Add in `Layout.tsx` useEffect: `if (user?.role === "teacher" && router.pathname === "/") router.push("/teacher-portal")`.

---

## PART 6 — SIDEBAR & NAVBAR REDESIGN

### 6.1 Sidebar — collapse state persists between refreshes
`SidebarProvider defaultOpen={true}` — always opens expanded on page reload.
Persist collapse state in localStorage: read/write `"sidebarOpen"` key.

### 6.2 Sidebar — bottom nav shows wrong items for teachers
`bottomNavItems` hardcodes Dashboard/Students/Payments/Classes — wrong for teachers.
Make it role-aware:
```ts
const bottomNavItems = user?.role === "teacher"
  ? [teacherPortal, schedule, assignments, help]
  : [dashboard, students, payments, classes];
```

### 6.3 Sidebar — active item highlight missing on icon-only collapsed state
When collapsed to icon-only, the active page icon has no visible highlight.
Add `aria-current="page"` + active ring to collapsed icon buttons.

### 6.4 Navbar (topbar) — branch name truncation
On narrow screens, the branch name + user name stack and overflow.
Add `truncate` + `max-w-[120px]` to branch/user name spans.

### 6.5 Sidebar — notification bell position
Currently `align="left"` (opens right). On collapsed sidebar this clips.
Switch to `align="end"` when sidebar is collapsed.

### 6.6 Sidebar group titles — missing for teacher view
When teacher is logged in, show a single "Teacher" group with only their 4 nav items.
Remove the empty Finance/Admin group headers entirely for teachers.

---

## PART 7 — MISSING TRANSLATIONS (global sweep)

### 7.1 Audit and add missing keys
Run a grep for `|| "` patterns (fallback English strings) across all pages:
```bash
grep -rn "|| \"" src/pages/ --include="*.tsx"
```
Each `|| "English fallback"` means a translation key is missing.
Collect all unique keys and add them to the appropriate translation file.

**Known missing keys (from audit):**
| Key | Files |
|-----|-------|
| `auditTime`, `auditUser`, `resource`, `description`, `resourceId`, `noAuditEntries` | audit-log.tsx |
| `cameraPermissionDenied`, `selectAll`, `deselectAll` | quick-pay.tsx |
| `noPermissionReports` | reports.tsx |
| `allResources`, `create`, `update`, `delete` | audit-log.tsx |
| `absenceAlertDesc` | attendance.tsx |

### 7.2 Translate action/resource values shown in audit log badges
The raw values `"create"`, `"update"`, `"delete"`, `"payment"`, `"student"` etc. are
shown in badges directly. Map them through translation using a lookup object + `t()`.

---

## Implementation Order

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | 5.1 Teacher sidebar nav items | 🔴 Wrong for teachers | S |
| 2 | 5.5 Teacher redirect from dashboard | 🔴 Broken UX | S |
| 3 | 5.2 Teacher portal guard | 🔴 Security | S |
| 4 | 1.1–1.2 Audit log translations | 🟠 English-only | S |
| 5 | 7.1 Global missing translation sweep | 🟠 Inconsistent | M |
| 6 | 2.1 Reports hardcoded Uzbek | 🟠 Wrong language | S |
| 7 | 2.2 Reports tab-switch loader fix | 🟠 Jarring UX | S |
| 8 | 3.1–3.2 Quick-pay translations + select-all | 🟡 Polish | S |
| 9 | 3.3 Quick-pay collect skeleton | 🟡 Loading UX | S |
| 10 | 3.4 QR camera error + retry | 🟡 Feature gap | S |
| 11 | 4.1 Attendance — use shared EmptyState | 🟡 Consistency | S |
| 12 | 4.3–4.4 Attendance error + mobile | 🟡 Polish | S |
| 13 | 5.3–5.4 Teacher portal mobile + attendance guard | 🟡 Polish | S |
| 14 | 6.1 Sidebar collapse persistence | 🟡 UX | S |
| 15 | 6.2 Bottom nav for teacher | 🟠 Wrong items | S |
| 16 | 6.3–6.6 Sidebar polish | 🟡 Polish | M |

All items are `S` (< 30 min) or `M` (< 1 hr). Total: ~1 day.
