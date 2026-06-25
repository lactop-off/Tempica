# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Tempica is a self-hosted, single-tenant attendance/time-tracking system (汎用勤怠管理システム). It covers the full flow: punch (打刻) → daily/monthly aggregation (集計) → request & approval workflow (申請承認) → monthly close (月次締め) → generic CSV export for payroll systems. The codebase and most comments/docs are in Japanese.

The repo is split into `backend/` (NestJS API + business logic, the bulk of the system) and `frontend/` (Next.js). The authoritative spec lives in `docs/design.md` (v1.0); `docs/implementation-notes.md` records decisions made beyond the spec and the known MVP simplifications (read it before extending overtime calc, leave accrual, holiday/calendar logic, or shift generation — these are deliberately stubbed).

## Commands

### Backend (`cd backend`)
```bash
npm run start:dev          # watch-mode dev server → http://localhost:3000/api/v1 (Swagger at /api/docs)
npm run build              # nest build → dist/
npm run lint               # eslint, --max-warnings 0
npm run format             # prettier write
npm test                   # unit tests (jest, *.spec.ts under src/, no DB needed)
npm test -- punch-state    # run a single test file by name pattern
npm run test:e2e           # E2E (test/*.e2e-spec.ts, REQUIRES a running PostgreSQL)
npm run prisma:generate    # regenerate Prisma client after schema.prisma changes
npm run prisma:deploy      # apply migrations (prod); prisma:migrate for dev (creates migrations)
npm run seed               # demo data (org/roles/depts/users); no-op if an org already exists
npm run worker             # run pg-boss job consumer (src/worker.ts) as a separate process
```

### Frontend (`cd frontend`)
```bash
npm run dev                # next dev on :8080 (proxies /api/v1 → backend, see next.config.mjs)
npm run build              # next build (output: standalone)
npm run lint               # next lint
npm run typecheck          # tsc --noEmit
```

### Full stack (Docker, recommended)
```bash
cp .env.example .env       # set DB_PASSWORD / SESSION_SECRET etc.
docker compose up -d --build   # migrations + seed run automatically on backend start
```
The backend image uses `docker-entrypoint.sh`, which runs `prisma migrate deploy` then the seed (idempotent) before `node dist/main.js`. Disable with `AUTO_MIGRATE=false` / `AUTO_SEED=false`. The seed lives at `src/seed.ts` (compiled to `dist/seed.js` so it runs in the prod image, which has no ts-node); `npm run seed` uses ts-node for local dev. Minimal stack is `db + backend + frontend`; `worker` and `proxy` are optional compose services.

## Architecture

### Auth & sessions
Authentication is **HttpOnly session cookies**, not JWT. Sessions are stored **in PostgreSQL** via `connect-pg-simple` (table `user_sessions`, auto-created) — there is no Redis. Passport local strategy + `express-session` are wired in `backend/src/main.ts`. The frontend always calls the API with `credentials: 'include'`; in dev, `next.config.mjs` rewrites `/api/v1/*` to the backend so the cookie is same-origin.

### Custom RBAC (the core access model)
Permission = **feature × action × scope**. Definitions in `backend/src/common/constants.ts` (`Feature`, `Action`, `Scope`). Scope widens `self < department < location < org`.

- `PermissionsGuard` (`src/common/permissions.guard.ts`) is registered as a global `APP_GUARD`. It runs on every endpoint: `@Public()` skips it; unauthenticated → 401; with no `@RequirePermission(feature, action)` it only requires auth.
- When a permission *is* required, the guard resolves the user's widest matching scope and attaches `req.resolvedScope` and `req.accessibleDeptIds` (the department subtree the user can see). Controllers read these via the `@ResolvedScope()` / `@CurrentUser()` param decorators (`src/common/decorators.ts`).
- Pure RBAC logic (scope resolution, `isVisible` row-level checks, dept-tree expansion) lives in `src/common/rbac.ts` and is unit-tested independently of NestJS. Role permission templates are in `src/rbac/role-templates.ts`.

When adding an endpoint that touches owned/departmental data, annotate it with `@RequirePermission`, then use `ResolvedScope` + `isVisible`/`accessibleDeptIds` to filter rows — don't reimplement scope checks ad hoc.

### Module layout
Standard NestJS feature modules under `backend/src/<domain>/`, all imported in `app.module.ts`. Infrastructure modules (`prisma`, `rbac`, `jobs`, `mail`, `audit`) load first; domain modules (`auth`, `setup`, `organization`, `departments`, `users`, `roles`, `work-patterns`, `time-records`, `summaries`, `requests`, `approvals`, `approval-routes`, `leave`, `shifts`, `closings`, `csv`, `notifications`, `health`) follow. `shifts` and reports are scaffold/stubs. Complex business math is isolated in pure, separately-tested modules — e.g. `summaries/attendance-calc.ts`, `time-records/punch-state.ts`.

### Errors
Throw `BusinessException` (`src/common/business-exception.ts`) for business-rule violations; use its static helpers (`.validation`, `.conflict`, `.forbidden`, `.notFound`). All responses are normalized to `{ error: { code, message, details } }` by `AllExceptionsFilter`. Machine-readable codes are enumerated as `ErrorCode` in `constants.ts`.

### Async jobs
`JobsService` (`src/jobs/jobs.service.ts`) wraps **pg-boss** (job queue on PostgreSQL, no Redis). `enqueue()` is a no-op when `ENABLE_JOBS=false` (used in tests/CI). Producers run inside the backend; consumers are registered in `src/worker.ts` and can run either inside the backend or as the standalone `worker` process sharing the same DB. Queues: `notify`, `csv-export`, `recalc-summary`.

### Data layer
Prisma + PostgreSQL 16; schema in `backend/prisma/schema.prisma`. Note domain-specific constraints from `implementation-notes.md`: work-pattern assignment period overlap is guarded both in app code and by a **GiST EXCLUDE constraint** (`btree_gist`); daily summaries recompute on each punch but **closed (`closed`) days are never recomputed**; CSV export rejects unclosed periods with 409 unless `organization.settings.csvAllowUnclosed = true`.

### Frontend
Next.js 14 App Router (`frontend/app/`), Tailwind, no data-fetching library. Authenticated pages live under `app/(app)/` wrapped by `AppShell`; `app/setup` and `app/login` are outside it. The typed API client is `lib/api.ts` (`api.get/post/patch/del`, throws `ApiException` carrying the backend error shape). Auth context in `lib/auth.tsx`. The UI was built to "Claude Design" specs in `frontend/design/`; `scripts/screenshots.mjs` (driven by `.github/workflows/screenshots.yml`) captures every screen.

## CI
`.github/workflows/ci.yml` runs the backend build + tests against a Postgres 16 service with `ENABLE_JOBS=false`. `screenshots.yml` captures UI screenshots on frontend changes.
