# Claude — Project Guide

## Before any task, read the Obsidian knowledge base

Vault location: `/home/ozod/Documents/Obsidian Vault/School CRM/`

**Start here every session:**
1. Read `index.md` — navigation map
2. Read the relevant section note (backend/, api/, database/, tasks/)
3. Only scan the actual codebase for specifics not covered in the vault

## Vault structure

```
index.md                  ← entry point, read first
architecture/overview.md  ← system diagram, data flow, deployment
backend/
  structure.md            ← Go package layout, handler→service map
  auth.md                 ← JWT, roles, teacher login flow
  middleware.md           ← full middleware stack
  deploy.md               ← Railway setup, env vars, Dockerfile notes
database/
  schema.md               ← all tables, columns, indexes, relationships
  migrations.md           ← migration history
api/
  auth.md                 ← login, register endpoints
  students.md             ← student CRUD
  payments.md             ← payment CRUD + summary
  teachers.md             ← teacher CRUD + portal
  classes.md              ← class CRUD
  branches.md             ← branch CRUD + isolation
  salaries.md             ← salary CRUD
  expenses.md             ← expense CRUD
tasks/
  plan.md                 ← full improvement plan with status
  pending.md              ← actionable todo list with file hints
```

## Key facts (memorize)

- Every resource is scoped to `branch_id` — always pass it
- Teacher = `users` row (login) + `teachers` row (profile), linked by `teachers.user_id`
- Frontend API calls go through `src/lib/api.ts` — all functions are named exports
- Layout wraps all pages via `_app.tsx` — pages must NOT add their own `<Layout>`
- `Select.Item` value must never be `""` — use `"none"` or `"all"` as sentinel
- Notification bell in sidebar uses `align="left"` (panel opens rightward)
- Docker base image: `golang:1.23-alpine` (`golang:1.25` does not exist)

## Project paths

```
/home/ozod/Documents/New-Project/
├── backend_school_crm/     ← Go REST API (Gin, PostgreSQL, Redis)
├── frontend_school_crm/    ← Next.js 14 admin panel (Pages Router)
├── PLAN.md                 ← improvement plan (also mirrored in vault)
└── CLAUDE.md               ← this file
```
