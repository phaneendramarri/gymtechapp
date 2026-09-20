# GymTech OS — Architecture

All-in-one operating system for gyms (India-first): members, attendance
(Face ID / QR / kiosk / manual), GST payments + invoices, PT commissions,
classes, POS retail, expenses + P&L, lockers, staff + granular roles,
reports, audit logs, member self-service portal, platform admin console.

Single Cloudflare Worker serves the Hono API (`/api/*`) and the React SPA
(`/*`) from one origin. D1 (SQLite) via Drizzle. JWT in httpOnly cookie +
CSRF double-submit. Deployed to Cloudflare; local dev via `wrangler dev`.

## Roles

| Role | Scope | Access |
|---|---|---|
| `PLATFORM_ADMIN` | platform | `/admin`, `/platform/*` — provision gyms, licenses, gateways, audit |
| `OWNER` | gym (`users.is_owner`, `roles.is_owner`) | everything in own gym, bypasses permission checks |
| Custom roles | gym (`roles` + `role_menus`) | menus/permissions granted explicitly, least-privilege |
| `MEMBER` | gym (`members`) | `/portal` only — plan, payments, attendance, PT sessions |

Permission keys = `GYM_FEATURES` in `packages/shared/src/constants.ts`
(`members`, `attendance`, `payments`, `pt_collections`, `plans`, `staff`,
`reports`, `settings`, `audit_logs`, `classes`, `pos`, `expenses`, `lockers`).
Route guard: `ProtectedRoute requiredPermissions` (frontend) +
`requirePermission` middleware (backend). Owner bypasses both.

### Session principals

Three kinds of session reach the API, and the policy for each lives in
`apps/api/src/lib/roles.ts` (`isPlatformAdmin`, `isMemberSession`,
`isPtTrainer`) so no route re-invents it:

| Principal | `id` refers to | May read | May write |
|---|---|---|---|
| gym user (owner / custom role) | `users.id` | everything its permissions allow | same |
| PT trainer (role `TRAINER`, or non-owner without `staff`) | `users.id` | own PT collections + packages | own collections |
| member portal (`MEMBER`) | `members.id` | own portal payload, own PT packages/sessions, gym timetable | own class bookings |

The two shared endpoints are the interesting ones: `GET /api/classes/schedules`
and `POST /api/classes/bookings` use `requirePermissionOrMember('classes')`, and
the booking handler forces `memberId` from the session — a member can never book
(or read) anyone else's row. Ledger, directory, attendance, invoices and the
staff console stay permission-gated; `POST /api/attendance/check-in` is a staff
surface (the SPA guards `/kiosk` the same way).

Rate limiting (`middleware/ratelimit.ts`) is per IP and per tier — auth 10/min,
write 120/min, read 600/min. Budgets are generous on purpose: a gym is one NAT'd
office plus member Wi-Fi, so tighter tiers 429'd ordinary daily use. Brute force
is handled per account by the progressive lockout in `lib/lockout.ts`.

## Tenant isolation

Every tenant table carries `gym_id`. Backend resolves gym from the session
JWT (`requireGym`), never from client input — except platform admin, which
passes `?gymId=`. Repositories are constructed per-gym
(`new MemberRepository(db, gymId)`) and scope every query. Licenses gate
features (`requireFeature`, resolved from `licenses.features`).

## Layers & data flow

```
apps/web/src (React 18 + Vite + TanStack Query + Tailwind v4)
  pages/          one route per file, data via hooks, no SQL, no auth policy
  components/     ui/ (design system) · layout/ (AppShell/AdminShell) ·
                  shared/ (EmptyState/ErrorState/StatCard) · feature folders
  lib/api.ts      single ApiClient facade (cookie session + CSRF retry +
                  401 refresh). Split into modules, re-exported as `api`.
  lib/auth.tsx    session state via GET /api/auth/me, never reads the JWT.
        │ fetch + CSRF cookie (same origin)
        ▼
apps/api/src/routes/   HTTP boundary only: zod validate → requireGym /
                       requireFeature / requirePermission → repository or
                       service call → helpers.ts envelope → audit. No SQL here.
        ▼
services/ + lib/       business policy, no Hono, no column plumbing.
  member.service / reports.service / dashboard.service / auth.service /
  license.service / audit.service · lib/roles (permission policy) ·
  lib/session, password, cookies, calculations (pure, unit-tested).
        ▼
repositories/          ONLY layer that touches its table(s). One file per
                       aggregate (member, membership, payment, attendance,
                       pt, class, pos, expense, locker, plan, user, role,
                       menu, license, admin, settings, session, …).
        ▼
D1 (apps/api/migrations/*.sql, mirrored by db/schema.ts)
  0000_init.sql  core: gyms, licenses, roles, users, plans, members,
                 memberships, payments, pt_collections, attendance,
                 sessions, resets, audit, counters, settings, comms, menus
  0001_menu_items.sql  menu catalog seed
  0002_new_modules.sql classes, pt_packages/sessions, products/pos,
                 expenses, lockers, referrals
  0003_feature_backfill.sql  enables classes/pos/expenses/lockers on
                 licenses written before those feature flags existed
```

Rules: routes never contain SQL (move queries to repositories/services);
services never contain column plumbing; repositories never contain
authorization policy; role/feature vocabulary lives only in
`packages/shared` (`constants.ts` + `contracts.ts` zod schemas).

## Key flows

- Auth: `POST /api/auth/login` → httpOnly session + CSRF cookies →
  `GET /api/auth/me` hydrates `AuthProvider`. Refresh rotates sliding-window
  tokens. Forgot/reset via opaque HMAC tokens (`user_password_resets`).
- Member lifecycle: `POST /api/members` (allocates `MEM-####` via atomic
  `counters` upsert, creates membership + optional payment in one batch) →
  profile → renew → freeze/unfreeze → archive/restore (soft delete).
- Payment: `POST /api/payments` (`recordAndApplyToMembership`: payment +
  dues update in one D1 batch, year-scoped `RCP-YYYY-####` receipt) →
  GST invoice dialog + WhatsApp share.
- Attendance: `POST /api/attendance/check-in` (manual/QR/face/kiosk, one
  row per member per day) → live floor feed.
- PT: packages → sessions → collections → commission settle.
- POS: products (stock) → sale (decrements) → receipt.
- Platform: `POST /api/admin/gyms` provisions gym + license + owner user.

## Frontend routes

`/login` · `/reset-password` · `/dashboard` · `/members`, `/members/new`,
`/members/:id`, `/members/:id/renew` · `/payments` · `/pt-collections` ·
`/attendance` · `/kiosk` · `/classes` · `/pos` · `/expenses` · `/lockers` ·
`/plans` · `/staff` (team + roles) · `/reports` · `/settings` ·
`/audit-logs` · `/portal` (member) · `/admin`, `/platform/roles`,
`/platform/users` (platform admin).

## Commands

- `pnpm db:migrate:local && pnpm db:seed:local` — rebuild local D1
  (seed hashes derived at runtime by `apps/api/scripts/seed.mjs`).
- `pnpm build:web` then `npx wrangler dev -c wrangler.jsonc --port 8787`.
- `pnpm typecheck` · `pnpm test` (unit, pure logic) ·
  `pnpm test:integration` (real Hono app + D1 through the wrangler platform
  proxy: lifecycle, auth, tenant isolation, member-portal scoping) ·
  `pnpm test:e2e` (Playwright live against the built Worker on :8787, one spec
  per module + `11-fresh-walkthrough` / `12-entire-app-lifecycle` /
  `13-entire-app-sweep`). Live specs enroll their own members — never hardcode
  a `MEM-…` code, codes come from a counter and the local DB outlives the run.
- Remote D1s (prod + staging) — never touch without explicit instruction.
