# School CRM — Phase 4 Plan
## Frontend UI/UX Redesign

Quick Legend
- ✅ Done
- 🟡 Partially done — some pages migrated, rest pending
- ⬜ Not started

---

## Phase 1 — Design System Tightening

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Brand color tokens (`--primary`, semantic `success`/`warning`/`info`) | 🟡 | 21 gradient strings consolidated into `.bg-brand` / `.hover:bg-brand-hover` / `.bg-brand-square` / `.text-brand-gradient` utilities in `globals.css`. Semantic success/warning/info tokens still pending. |
| 1.2 | Typography scale (display / heading / body / caption) | 🟡 | `.text-display`, `.text-heading`, `.text-body`, `.text-caption`, `.text-overline` utilities in `globals.css`. **9 page h1s** migrated (dashboard, branches, branches-overview, audit-log, profile, class-details, reports, teacher-portal, assignments, messaging, attendance). Card titles still use raw classes. |
| 1.3 | Spacing rhythm (standardize table / card / form padding to 4-unit grid) | ⬜ | `p-4 sm:p-6`, `px-4 py-3`, `pt-4 pb-4` all mixed |
| 1.4 | Border-radius token consistency | ⬜ | `rounded-lg` vs `rounded-xl` mixed |

---

## Phase 2 — Layout & Navigation

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Sidebar active state + mobile swipe-to-close + z-index | ⬜ | |
| 2.2 | `PageHeader` enforced on every page (with Actions slot) | 🟡 | Used on ~7 pages; a few still roll their own `<h1>` |
| 2.3 | Breadcrumbs on all detail pages (student-details, class-details, teacher-portal) | ✅ | `PageBreadcrumbs.tsx` added to student-details + class-details. teacher-portal is the teacher's own home — N/A. |

---

## Phase 3 — Data Tables ✅

Shared component: `src/components/DataTable.tsx`

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Extract `<DataTable>` with selection, sortable, skeleton, empty state | ✅ | |
| 3.2 | Mobile card view (auto-switch under `sm:`) | ✅ | `renderCard` prop |
| 3.3 | Consistent pagination via shared `TablePagination` | ✅ | |
| 3.4 | Migrate all list pages | ✅ | teachers, salaries, expenses, students, managers, branches, audit-log, payments — **−1428 lines total** |

---

## Phase 4 — Forms & Validation ✅

Shared components: `src/components/FormDialog.tsx`, `src/components/Field.tsx`

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | `<FormDialog>` wrapper (sticky header, scrollable body, sticky Cancel/Save footer) | ✅ | |
| 4.2 | `<Field>` component (Label + Input/Textarea + inline error) | ✅ | |
| 4.3 | Migrate all create/edit dialogs | ✅ | teachers, students, payments, managers, expenses, salaries |
| 4.4 | Single validation pattern (keep existing `formErrors` state — no `react-hook-form` migration) | ✅ | |
| 4.5 | Standardize toast variants (`success` / `destructive` + always include description) | 🟡 | `useNotify()` hook ready. **teachers.tsx fully migrated** (12 calls). 25 toasts remain across other pages. |

---

## Phase 5 — Key Page Overhauls

Shared components added: `StatCard`, `PaymentMethodBreakdown`, `PaymentStatusBadge`, `InitialsAvatar`, `PaymentTrendChart`, `AttendanceDonut`

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | **Dashboard** | | |
| 5.1.a | Top stat cards → `StatCard` | ✅ | 4 cards × ~20 lines each → 5-line calls |
| 5.1.b | Payment method cards → `PaymentMethodBreakdown` | ✅ | |
| 5.1.c | Dashboard skeleton loading via `StatCard loading` prop | ✅ | 67-line `if (isLoading)` block collapsed; only `!isMounted` early-return remains. `loading={isLoading}` flows into all StatCards in place. |
| 5.1.d | Recent activity feed (last 5 `audit_logs`) | ✅ | `RecentActivityFeed.tsx`, wired into dashboard |
| 5.1.e | Overdue payments widget | 🟡 | Already in pending-payments card (debtorsCount) |
| 5.2 | **Payments page** | | |
| 5.2.a | Stats cards — proper loading skeleton (no more "UZS 0" flash) | ✅ | All 6 stat cards use `StatCard` with `loading` prop |
| 5.2.b | Search/filter bar stacks vertically on mobile | ✅ | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` |
| 5.2.c | Unified `PaymentStatusBadge` | ✅ | Both desktop table + mobile card |
| 5.2.d | `InitialsAvatar` on student name column | ✅ | |
| 5.3 | **Students page** | | |
| 5.3.a | Unified `PaymentStatusBadge` | ✅ | |
| 5.3.b | `InitialsAvatar` next to name | ✅ | |
| 5.3.c | "Bulk change class" dialog needs search input | ✅ | Custom searchable list with autofocus and "no classes found" empty state |
| 5.4 | **Student details** | | |
| 5.4.a | `AttendanceDonut` in Overview tab | ✅ | With empty-state + legend + center % |
| 5.4.b | `PaymentTrendChart` (6-month history, target-colored bars) | ✅ | Green ≥ target, amber partial, slate none |
| 5.4.c | Header avatar | ✅ | `InitialsAvatar size="lg"` |
| 5.5 | **Class details** | | |
| 5.5.a | Unified `PaymentStatusBadge` on student cards | ✅ | |
| 5.5.b | Avatars on student cards | ✅ | |
| 5.6 | **Teachers page** | | |
| 5.6.a | `InitialsAvatar` on name column + mobile card | ✅ | |

---

## Phase 6 — Loading & Error States

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Every page uses `PageSkeleton` on initial load | 🟡 | Most list pages now delegate loading to DataTable; full-page skeletons (dashboard, reports, student-details) still hand-rolled |
| 6.2 | Per-section `ErrorBoundary` instead of one at the app root | ✅ | `SectionErrorBoundary.tsx` built; wraps dashboard chart + recent activity, student-details charts |
| 6.3 | Every empty list renders `<EmptyState>` with contextual CTA | 🟡 | DataTable handles its own empty state well; reports page no-data block now uses `<EmptyState>`. Other ad-hoc "No data" strings in chart screens still pending. |

---

## Phase 7 — Performance

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.1 | React Query `staleTime` per domain (classes/teachers 5 min, notifications 30 s, payments/students 60 s) | ✅ | `STALE` constants in `hooks/queries.ts` applied to all hooks |
| 7.2 | Code-split large pages — extract `QuickPayModal` / `BulkPayModal` / `PaymentForm` from `payments.tsx` | 🟡 | `PosReceiptDialog` (−104) + `BulkPaymentDialog` (−423) extracted. payments.tsx now **1882 lines** (was 2721 — total **−839 lines**). Main `PaymentForm` create/edit FormDialog still inline. |
| 7.3 | `next/image` for any user-uploaded avatars/logos | ⬜ | Not needed until avatars upgrade beyond initials |

---

## Summary of Shared Components Built

| File | Purpose | Used by |
|---|---|---|
| `DataTable.tsx` | Table + selection + skeleton + empty + mobile cards + pagination | 8 list pages |
| `Field.tsx` | Label + Input/Textarea + inline error | 6 forms |
| `FormDialog.tsx` | Dialog shell with scrollable body + sticky footer | 6 forms |
| `StatCard.tsx` | Metric tile (tone accent, icon, value, hint, loading, trend, onClick) | Dashboard |
| `PaymentMethodBreakdown.tsx` | Cash/card/bank income-expenses-profit card | Dashboard |
| `PaymentStatusBadge.tsx` | Paid/partial/unpaid pill with icon | students, payments, class-details |
| `InitialsAvatar.tsx` | Deterministic colored initials (same name → same color everywhere) | students, teachers, payments, class-details, student-details |
| `PaymentTrendChart.tsx` | 6-month bar chart, bars colored against `targetAmount` | student-details Overview |
| `AttendanceDonut.tsx` | Donut with center % + legend | student-details Overview |
| `RecentActivityFeed.tsx` | Recent audit log entries with avatar + action icon + relative time | dashboard |
| `PageBreadcrumbs.tsx` | Crumb trail for nested pages | student-details, class-details |
| `SectionErrorBoundary.tsx` | Per-section error boundary (compact, doesn't take over the page) | dashboard chart + recent activity, student-details charts |
| `PosReceiptDialog.tsx` | Print-friendly receipt preview, extracted from payments.tsx | payments |
| `BulkPaymentDialog.tsx` | Self-contained "mark multiple students as paid" dialog | payments |
| `hooks/use-notify.ts` | Typed shorthand `notify.success/.error/.warning/.info(title, desc?)` | (available for new code) |

---

## Remaining Highest-Impact Items

1. **7.2 (rest)** payments.tsx is now **1882 lines** (was 2721). Last big extraction: the main create/edit `PaymentForm` inside the FormDialog (~340 lines).
2. **1.3** Spacing rhythm — pick one of `p-4 sm:p-6` / `px-4 py-3` / `pt-4 pb-4` and standardize
3. **1.4** Border-radius — current scale (md/lg/xl/2xl/full) is logical; documenting it as design tokens may suffice
4. **4.5 (migration)** Migrate 37 `toast({title…})` calls to `useNotify().*`
5. **1.2 (migration)** Spread `.text-display`/`.text-heading`/`.text-caption`/`.text-overline` into existing pages
6. **6.3** Empty states for remaining ad-hoc "No data" strings on chart screens
