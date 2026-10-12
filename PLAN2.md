# School CRM — Phase 2 Plan
## Fix: Auth, Role Logic, User Flows, Data Fetching, Developer Tools

Quick Legend
- 🔴 Critical / Broken in production
- 🟠 High impact — wrong or missing behavior
- 🟡 Medium — inconsistent or poor UX
- 🟢 Polish / nice-to-have

---

## PART 1 — AUTH & IDENTITY (Critical)

### 1.1 Remove storage.ts from auth.ts ✅ DONE

`src/lib/auth.ts` still imports `branchesDB, usersDB` from `./storage` even though
storage.ts was removed in the previous plan (task 4.3). Any call to these functions
silently fails or returns stale data.

Affected functions in auth.ts:
- `getUserBranches()` — returns `branchesDB.getAll()` (localStorage)
- `getAllUsers()` / `getUsersByBranch()` — returns `usersDB.getAll()` (localStorage)
- `createUser()` — calls `usersDB.create()` (localStorage)
- `deleteUser()` — calls `usersDB.delete()` (localStorage)
- `updateUserPermissions()` — calls `usersDB.update()` (localStorage)
- `updateUserPassword()` — calls `usersDB.getById()` / `usersDB.update()` (localStorage)
- Local `login()` function — does localStorage-based auth (dead code)

Fix:
- Delete the localStorage functions that are no longer called by any page
- For `updateUserPassword()`: replace with an `apiRequest` call to the new
  `PUT /api/v1/users/:id/change-password` endpoint (see 1.4)
- Remove the `import { branchesDB, usersDB }` import entirely
- Verify no pages import `createUser`, `deleteUser`, `updateUserPermissions`
  from auth.ts (they should import from api.ts)

---

### 1.2 Profile page for all roles ✅ DONE

`src/pages/admin-profile.tsx` redirects all non-admin users to "/" on mount:
```ts
if (!currentUser || currentUser.role !== "admin") {
  router.push("/");
}
```
This means branch_admin, manager, and teacher cannot view or update their own profile.

Fix:
- Remove the `role !== "admin"` guard — any authenticated user should access their profile
- Rename the page to `src/pages/profile.tsx` and update all sidebar links
- Show a role badge next to the user's name (Admin / Branch Admin / Manager / Teacher)
- Keep edit-profile and change-password dialogs working for all roles
- Teachers: after saving, sync both `current_user` and `school_auth_user` in localStorage
  (currently only `school_auth_user` is updated at line 199)

---

### 1.3 JWT claims: embed role ✅ DONE

`internal/middleware/auth.go` — `CustomClaims` only stores `UserID`.
Every request that needs the user's role calls `userService.GetByID()` — a DB round-trip
for every protected endpoint.

Fix in `auth.go` (Login handler):
```go
type CustomClaims struct {
    UserID string `json:"user_id"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}
// embed role when signing:
token := jwt.NewWithClaims(jwt.SigningMethodHS256, &middleware.CustomClaims{
    UserID: user.ID,
    Role:   user.Role,
    ...
})
```

Fix in `AuthMiddleware`: set `c.Set("role", claims.Role)` so handlers can read it
without a DB lookup. Update handlers that do `userService.GetByID` just to check role
to read `c.GetString("role")` instead.

---

### 1.4 Change-password API endpoint ✅ DONE

`PUT /api/v1/users/:id` accepts a raw `map[string]interface{}` — no current_password
verification. Anyone with a valid JWT can change another user's password to anything.

Fix in `internal/handlers/user.go`:
- Add `PUT /api/v1/users/:id/change-password` handler
- Body: `{ current_password, new_password }`
- Handler: fetch user, `bcrypt.CompareHashAndPassword(user.Password, current_password)`,
  hash new_password, UPDATE users SET password = $1
- Return 403 if current_password is wrong
- Protect: user can only change their own password (admin can change anyone's)

Fix on frontend (`src/pages/profile.tsx`):
- `handleChangePassword` calls `apiRequest("/users/:id/change-password", { method: "PUT", body })`
  instead of the current raw `fetch()` + `PUT /users/:id`

---

## PART 2 — SCHOOL OWNER (Admin / Branch Admin)

### 2.1 Branch admin can't access Settings ✅ DONE

`src/lib/auth.ts` DEFAULT_PERMISSIONS for `branch_admin`:
```ts
canViewSettings: false,
canEditSettings: false,
```
`src/pages/settings.tsx` checks `hasPermission("canViewSettings")` and redirects if
false. Branch admins are completely locked out of branch settings.

Fix:
- In `DEFAULT_PERMISSIONS`, set `branch_admin.canViewSettings = true` and
  `branch_admin.canEditSettings = true`
- While there: verify that the backend `permission_service.go` defaults match — if they
  differ, the frontend defaults will be overridden by the API response on login

---

### 2.2 Profile page: raw fetch + debug console.logs ✅ DONE

`src/pages/admin-profile.tsx` `handleUpdateProfile()` and `handleChangePassword()` both:
- Use raw `fetch(process.env.NEXT_PUBLIC_API_URL + "/users/" + user.id, ...)` instead
  of `apiRequest()` from api.ts — bypasses the timeout, auth headers helper, and
  error normalization
- Have 4 `console.log` / `console.error` statements that expose payloads in production

Fix:
- Replace raw `fetch` calls with `apiRequest("/users/${user.id}", ...)`
- Remove all `console.log` / `console.error` debug statements
- Move to `profile.tsx` (see 1.2)

---

### 2.3 Admin can see all branches; branch_admin sees wrong branches ✅ DONE

In `src/pages/managers.tsx`:
```ts
} else if (user?.role === "branch_admin") {
  const branch = transformedBranches.find(b => b.id === branchId);
  setBranches(branch ? [branch] : []);
}
```
The `transformedBranches` come from `listBranches()` which returns all branches.
A branch_admin should only be shown their own branches, not all.

Fix:
- For `branch_admin`, filter `listBranches()` results to only include branches
  where `admin_id === currentUser.id` (or rely on the backend to scope it)
- Backend: `GET /branches` should return only the calling user's branches when
  role is `branch_admin` (currently it may return all branches for all admin roles)

---

## PART 3 — MANAGER

### 3.1 Manager password update uses localStorage ✅ DONE

`src/pages/managers.tsx` imports `updateUserPassword` from `@/lib/auth`:
```ts
import { updateUserPassword } from "@/lib/auth";
```
This is the old localStorage-based function — it writes to `usersDB` in storage.ts,
NOT to the backend API. Password changes for managers are silently lost on page refresh.

Fix:
- Remove the import of `updateUserPassword` from `@/lib/auth`
- Call the new `PUT /api/v1/users/:id/change-password` backend endpoint instead
- Wire in the manager's `isPasswordDialogOpen` submit handler to call `apiRequest`

---

### 3.2 Manager creation form: missing validation ✅ DONE

`src/pages/managers.tsx` `handleSubmit()` for new managers checks:
```ts
if (!formData.fullName || !formData.email || !formData.password || !formData.branchId) {
  toast({ title: "Error", description: "Please fill in all required fields..." });
  return;
}
```
No inline `formErrors` state, no per-field error messages, no email format check,
no phone format validation. Inconsistent with students.tsx and teachers.tsx.

Fix:
- Add `formErrors` state + `clearFieldError` helper (same pattern as teachers.tsx)
- Validate: fullName required, email format, password ≥ 6 chars, branchId required
- Show inline error beneath each field on submit failure

---

### 3.3 Manager form: no role selector ✅ DONE

There is no role field in the create-manager form — all users are created with role
`manager` implicitly. Branch admins cannot be created from the UI.

Fix:
- Add a Role `<Select>` to the create-manager form with options:
  `manager` (default) and `branch_admin`
- When role changes to `branch_admin`, reset permissions to branch_admin defaults
- Include role in the `createUser` API payload

---

### 3.4 Backend createUser: branch_admin blocked ✅ DONE

`internal/handlers/user.go` `createUser`:
```go
if err != nil || currentUser.Role != "admin" {
    c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
    return
}
```
A `branch_admin` cannot create managers for their own branch from the UI.

Fix:
- Allow `branch_admin` to create users with role `manager` within their branch:
```go
if currentUser.Role != "admin" && currentUser.Role != "branch_admin" {
    c.JSON(http.StatusForbidden, ...)
}
// branch_admin can only create managers, not other admins
if currentUser.Role == "branch_admin" && req.Role == "admin" {
    c.JSON(http.StatusForbidden, ...)
}
```
- Similarly update `deleteUser` and `updateUserPermissions` to allow `branch_admin`
  to manage users within their branch

---

## PART 4 — TEACHER

### 4.1 Teacher portal: no profile/settings tab ✅ DONE

Teachers have no way to view or change their own profile (name, phone, password).
The teacher portal has 4 tabs: classes, students, attendance, salary — but no profile.

Fix:
- Add a 5th tab "My Profile" to `src/pages/teacher-portal.tsx`
- Show: full name, email, phone (read from `data.teacher`)
- Edit dialog: fullName, phone fields — call `PUT /api/v1/users/:id` (own profile)
- Change password sub-dialog — call new `PUT /api/v1/users/:id/change-password`

---

### 4.2 Teacher portal: manual data fetch (no React Query) ✅ DONE

`src/pages/teacher-portal.tsx` uses manual `useState + useEffect` fetch:
```ts
const [isLoading, setIsLoading] = useState(true);
const [data, setData] = useState<TeacherPortalData | null>(null);
useEffect(() => { loadPortalData(); }, []);
```
No background refresh, no auto-retry, no cache. Inconsistent with teachers.tsx.

Fix:
- Add `useTeacherPortalQuery()` to `src/hooks/queries.ts`
- Replace `loadPortalData` + state management with `useQuery`
- Add `useUpdateAttendanceMutation()` for the attendance save

---

### 4.3 Teacher portal: X-Branch-ID header may be missing ✅ DONE

After teacher login, `selectedBranchId` is never written to localStorage
(that only happens in `BranchContext` for admin users). When `apiRequest()` is called
from teacher-portal.tsx, the X-Branch-ID header is empty — the backend's
`TenantBranchMiddleware` may reject the request with 403.

Verify: check if teacher attendance save ever succeeds in production.

Fix:
- After successful teacher login, write the teacher's `branchId` to
  `localStorage.setItem("selectedBranchId", user.branchId)` in the login handler
- OR: in `apiRequest()` fallback — if `selectedBranchId` is missing, look at the
  JWT-decoded `branchId` field as a fallback

---

## PART 5 — DATA FETCHING CONSISTENCY

### 5.1 Students page: still uses manual fetch ✅ DONE

`src/pages/students.tsx` uses manual data fetching with:
- `waitForSelectedBranchId()` — polling loop for localStorage
- `loadData()` — manual async function + `setIsLoading`
- `filterChangeInProgressRef` — race condition guard
- Manual URL query param sync

React Query hooks already exist for students (`useStudentsQuery` is referenced in
queries.ts). The page just never migrated.

Fix:
- Add `useStudentsQuery(branchId, params)` to queries.ts (already has the shape from
  `getStudentsConsolidatedData`)
- Replace the manual fetch + state in students.tsx with `useQuery`
- Use `useCreateStudentMutation`, `useUpdateStudentMutation`, `useDeleteStudentMutation`
- Remove `waitForSelectedBranchId`, `loadData`, `filterChangeInProgressRef`,
  `currentLoadIdRef`, `initialLoadDoneRef`

---

### 5.2 Payments page: still uses manual fetch ✅ DONE

Same problem as students.tsx — `src/pages/payments.tsx` has the same pattern:
manual `useState + useEffect + loadData()`, polling for selectedBranchId, etc.

Fix:
- Add `usePaymentsQuery(branchId, params)` to queries.ts
- Add `useCreatePaymentMutation`, `useUpdatePaymentMutation`, `useDeletePaymentMutation`
- Migrate payments.tsx to React Query

---

## PART 6 — DEVELOPER TOOLS

### 6.1 Developer logs page: no real-time updates ✅ DONE

`src/pages/developer-logs.tsx` polls logs on an interval with `autoRefresh`.
The log viewer has good filtering but:
- No log detail expansion (clicking a row should expand `details` + `stack` fields)
- No "copy to clipboard" for full log entry (only for log ID)
- No log count summary per level in the header
- The auth flow: dev logs require a developer JWT but the page uses the same
  `auth_token` from localStorage — dev login and admin login are different tokens,
  so the page may silently show "no logs" for regular admins

Fix:
- Add expandable row: clicking a log row opens a detail panel showing `details`,
  `stack`, `requestId`, `userId` in a readable format
- Add per-level count badge row at the top (e.g., ERROR: 3, WARN: 12, INFO: 45)
- Fix auth: the logs page should detect if the user is not a developer and show
  a clear "Developer access required" message instead of silently failing

---

### 6.2 Developer panel: no API health check UI ✅ DONE

The `/health` endpoint returns rich status (DB connections, Redis status, uptime)
but there is no UI that displays it. Developers have to curl it manually.

Fix:
- Add a `/developer-dashboard` page (developer-auth-gated) with:
  - Health card: DB status, Redis status, uptime
  - Environment indicator (production / development)
  - Quick links: Swagger docs, logs, CRM management

---

## PART 7 — BACKEND LOGIC

### 7.1 updateUser: no current_password verification ✅ DONE

`internal/handlers/user.go` `updateUser()` accepts `current_password` from body but
`userService.Update()` doesn't verify it before hashing and saving `password`.
Anyone with a valid JWT can change any user's password (if they are admin) without
knowing the current password.

Fix:
- In `userService.Update()`, if payload contains `password`, require and verify
  `current_password` (unless the caller is admin updating someone else's account)
- Or: remove password update from `PUT /users/:id` entirely and use the new
  `/change-password` endpoint exclusively (cleaner separation)

---

### 7.2 Teacher creation: no atomicity guarantee ✅ DONE (already transactional)

Creating a teacher from teachers.tsx sends a single request to `POST /api/v1/teachers`.
Inside `teacher_service.go`, this should atomically:
1. Create a `users` row (login account)
2. Create a `teachers` row (profile)
3. Link them via `teachers.user_id`

Verify that all three steps happen in a single DB transaction. If step 2 or 3 fails,
the orphaned `users` row leaks and the teacher cannot be created again (duplicate email).

Fix:
- Wrap the three INSERTs in `BEGIN / COMMIT` in `teacher_service.go`
- If any step fails, ROLLBACK and return a descriptive error

---

### 7.3 Permission defaults mismatch: frontend vs backend ✅ DONE

`src/lib/auth.ts` DEFAULT_PERMISSIONS (frontend) and `internal/service/permission_service.go`
(backend) define default permissions per role independently. They can drift.

Example found: `branch_admin` in auth.ts has `canViewSettings: false` but likely
the backend permission_service sets it to `true` for branch_admin. After login,
the API's user object overwrites the frontend defaults — but if the backend is wrong,
the wrong permissions are silently applied.

Fix:
- Read `internal/service/permission_service.go` defaults and compare with auth.ts
- Make them match exactly — the backend is source of truth
- Frontend should trust the permissions returned in the login response, not its own defaults
- In `getCurrentUser()`, remove the fallback `DEFAULT_PERMISSIONS[user.role]` override:
  if the API returned permissions, use them; only apply defaults if permissions field
  is completely absent (new account before permissions record created)

---

## PART 8 — DESIGN & UX

### 8.1 Login: mode switcher has no functional effect ✅ DONE

The Admin/Teacher tab switcher in `src/pages/login.tsx` is purely visual:
both tabs call `apiLogin({ email, password })` with the same backend endpoint.
The redirect after login is based on `response.user.role === "teacher"`, not on
the selected tab. A manager logging in on the Teacher tab still gets redirected
to the dashboard — the tab does nothing.

Fix option A (simpler): Remove the tab switcher entirely. After login, always
redirect based on role returned from API: `teacher` → `/teacher-portal`, else → `/`.

Fix option B (better UX): Keep the visual distinction but clarify the labels:
"Staff Login" and "Teacher Login" — make it clear that managers/admins also use
"Staff Login". Show appropriate placeholder text per mode.

---

### 8.2 Empty states: missing or generic ✅ DONE

Several pages show generic "No data" text instead of helpful empty states:
- managers.tsx: "No managers yet" with no call-to-action
- teacher-portal.tsx classes tab: bare empty div
- developer-logs.tsx: "No logs found" with no suggestion

Fix:
- Each list/table should have a meaningful empty state: icon + title + description
  + action button where appropriate (e.g. "Add your first manager" button)
- Use a shared `<EmptyState icon={...} title={...} description={...} action={...} />`
  component to keep these consistent

---

### 8.3 Inconsistent page header structure ✅ DONE

Some pages have:
```tsx
<h1 className="text-3xl font-bold">{t("title")}</h1>
<p className="text-slate-600">{t("subtitle")}</p>
```
Others have no subtitle, or use different font sizes, or put the button inline
vs in a separate row. Makes the app feel assembled rather than designed.

Fix:
- Create a `<PageHeader title={...} subtitle={...} action={...} />` component
- Apply to: students.tsx, teachers.tsx, managers.tsx, payments.tsx, salaries.tsx,
  expenses.tsx, classes.tsx, settings.tsx

---

### 8.4 Error boundaries: missing ✅ DONE

No React error boundaries exist. If any page crashes (uncaught JS error), the entire
app goes blank with no message.

Fix:
- Add `src/components/ErrorBoundary.tsx` — class component that catches render errors
- Wrap `<Component {...pageProps} />` in `_app.tsx` with `<ErrorBoundary>`
- Show: "Something went wrong" card with a "Reload page" button

---

## Priority Order

| Priority | Item | Impact |
|----------|------|--------|
| 1 | 1.1 Remove storage.ts from auth.ts | Data integrity |
| 2 | 1.4 Change-password API endpoint | Security |
| 3 | 7.1 updateUser: current_password check | Security |
| 4 | 1.2 Profile page for all roles | UX broken |
| 5 | 2.1 Branch admin settings access | Feature broken |
| 6 | 3.1 Manager password uses localStorage | Data integrity |
| 7 | 4.3 Teacher X-Branch-ID header | Feature possibly broken |
| 8 | 3.4 Backend createUser: allow branch_admin | Feature gap |
| 9 | 1.3 JWT role embedding | Performance |
| 10 | 2.2 Profile page: raw fetch + console.logs | Code quality |
| 11 | 3.2 Manager form validation | UX |
| 12 | 3.3 Manager form: role selector | Missing feature |
| 13 | 4.1 Teacher profile tab | Missing feature |
| 14 | 4.2 Teacher portal: React Query | Consistency |
| 15 | 5.1 Students page: React Query | Consistency |
| 16 | 5.2 Payments page: React Query | Consistency |
| 17 | 7.2 Teacher creation: atomicity | Data integrity |
| 18 | 7.3 Permission defaults mismatch | Correctness |
| 19 | 6.1 Developer logs: expand rows | DX |
| 20 | 6.2 Developer health check UI | DX |
| 21 | 8.1 Login: mode switcher fix | UX |
| 22 | 8.2 Empty states | Polish |
| 23 | 8.3 Page header component | Polish |
| 24 | 8.4 Error boundaries | Resilience |
