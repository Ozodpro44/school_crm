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
| 1.1 | Brand color tokens (`--primary`, semantic `success`/`warning`/`info`) | ⬜ | Still using default shadcn palette; inline gradient `from-indigo-600 to-purple-600` scattered in 6+ places |
| 1.2 | Typography scale (display / heading / body / caption) | ⬜ | Arbitrary sizes (`text-[10px]`, `text-3xl`) in use |
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
| 4.5 | Standardize toast variants (`success` / `destructive` + always include description) | 🟡 | Most pages consistent; a couple of places still pass bare `title` |

---

## Phase 5 — Key Page Overhauls

Shared components added: `StatCard`, `PaymentMethodBreakdown`, `PaymentStatusBadge`, `InitialsAvatar`, `PaymentTrendChart`, `AttendanceDonut`

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | **Dashboard** | | |
| 5.1.a | Top stat cards → `StatCard` | ✅ | 4 cards × ~20 lines each → 5-line calls |
| 5.1.b | Payment method cards → `PaymentMethodBreakdown` | ✅ | |
| 5.1.c | Dashboard skeleton loading via `StatCard loading` prop | ⬜ | Big `if (isLoading)` block still exists |
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
| 6.3 | Every empty list renders `<EmptyState>` with contextual CTA | 🟡 | DataTable handles its own empty state well; charts/non-list screens still show "No data" plain text |

---

## Phase 7 — Performance

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.1 | React Query `staleTime` per domain (classes/teachers 5 min, notifications 30 s, payments/students 60 s) | ✅ | `STALE` constants in `hooks/queries.ts` applied to all hooks |
| 7.2 | Code-split large pages — extract `QuickPayModal` / `BulkPayModal` / `PaymentForm` from `payments.tsx` | ⬜ | payments.tsx is still 2443 lines |
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

---

## Remaining Highest-Impact Items

1. **7.2** Split payments.tsx (still ~2440 lines → extract `QuickPayModal` / `BulkPayModal` / `PaymentForm`)
2. **5.1.c** Dashboard top-level loading skeleton via `StatCard.loading` (collapse the big `if (isLoading)` block)
3. **1.1–1.4** Design system tokenization (brand colors, typography scale, spacing rhythm, radius)
4. **4.5** Standardize remaining toast variants
5. **6.3** Empty states for non-list screens (charts, reports)
