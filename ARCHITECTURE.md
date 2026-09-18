# Architecture Record

What each concern owns, who owns each piece of state, and the direction data
flows. Later passes should build **with** this structure; changes to ownership
belong in this file.

## Layers & data flow

```
web (React, apps/web)            — presentation only; derives nothing
  │  fetch + CSRF cookie
  ▼
routes (apps/api/src/routes)     — HTTP boundary: validate (zod), gate (auth),
  │                                call service/repository, shape response
  ▼
lib + services (pure policy)     — lib/roles, lib/features, lib/notifications:
  │                                no DB, no Hono → unit-testable alone
  ▼
repositories (one per table)     — the ONLY writers/readers of their table;
  │                                one projection function per DTO shape
  ▼
D1 (migrations/0000_init.sql)    — hand-written SQL; schema.ts mirrors it
```

Rules of thumb: routes never contain SQL; services never contain column
plumbing; repositories never contain authorization policy; shared vocabulary
(role names, feature keys) lives only in `packages/shared`.

## Single owners (do not duplicate)

| Concern | Owner | Notes |
|---|---|---|
| Role vocabulary | `USER_ROLES` in `packages/shared/src/constants.ts` | The only role-name list |
| Authorization policy | `apps/api/src/lib/roles.ts` | `deriveCoarseRole`, `resolvePermissions`, `hasAllowedRole`, `checkRole` — pure functions |
| Token/session mechanics | `apps/api/src/lib/session.ts` | Signing + cookies only; no policy |
| User row → API shape | `projectUserRow` in `apps/api/src/repositories/user.repository.ts` | Every read joins `roles` once; no per-row follow-ups |
| `communication_logs` writes | `CommunicationRepository` | `recordDispatch` for sends, `purgeForMember` for GDPR erasure |
| Receipt numbering | `PaymentRepository.getNextReceiptNumber` | Atomic year-scoped counter (`receipt:<YYYY>`), `ON CONFLICT … RETURNING` |
| `counters` table | `CounterRepository.nextValue` | The single atomic upsert; member codes + receipts both allocate through it |
| `pt_collections` | `PtRepository` | All PT SQL (list/summary/create/settle); routes only validate + audit |
| `user_password_resets` | `PasswordResetRepository` | Issue, validate, and atomically consume reset tokens |
| `platform_settings` + gym notification settings | `SettingsRepository` | Key/value platform config and `gyms.notification_settings_json` |
| Credit consumption | `LicenseRepository.consumeCredits` | Conditional atomic UPDATE — 0 rows changed means insufficient credits |
| Membership-linked payments | `PaymentRepository.recordAndApplyToMembership` | One D1 batch: payment insert + dues update; used by both the payments route and MemberService |
| Expiry sweeps | `LicenseService.sweepExpiries` → repo `expireIfDue`/`expireMembersWithoutActiveMembership` | Service orchestrates; each UPDATE lives in its table's repository |
| Feature gating | `lib/features.ts` + `requireFeature` middleware | Resolved from `licenses.features`, not hardcoded |
| CSRF double-submit | `middleware/csrf.ts` + `GET /api/auth/csrf` | Cookies always emitted as separate `Set-Cookie` headers |

## Schema invariants (enforced, and guarded by tests)

- `users.role_id` (FK → `roles`) is the single role source of truth. The old
  denormalized `users.role` TEXT column is **gone** — role names are derived,
  never stored (a stored CHECK'd name could not represent custom roles).
- Every composite FK parent has `UNIQUE (gym_id, id)`; `PRAGMA
  foreign_key_check` must stay clean.
- `communication_logs` rows carry `member_id` + GDPR basis so member erasure
  can find and purge them.
- Receipt counter is year-scoped: sequences restart each calendar year.
- Counters mutate via atomic upsert-returning only (no read-then-write).

Guard tests: `tests/unit/schema-integrity.spec.ts`,
`tests/integration/auth.spec.ts`, `tests/integration/e2e-flows.spec.ts`
(member → membership → payment → receipt; custom role → staff; tenant-isolation
probes).

## Test harness structure

`tests/integration/harness.ts` boots the real Hono app with wrangler's
platform proxy (real D1/KV bindings) — no HTTP server, no mocks. Sessions are
cached per identity (the auth tier is 5/min), each client gets its own
spoofed IP, and `setupHarnessTeardown()` **must** be called in every
integration spec: without it the proxy leaks a `workerd` process that locks
the shared D1 state directory and breaks subsequent `pnpm db:*` commands.

Integration tests run in a single fork (`vitest.integration.config.ts`) so
concurrent forks never contend for the same SQLite file.

## Commands

- `pnpm db:migrate:local && pnpm db:seed:local` — rebuild local D1 from
  baseline + reproducible seed (hashes derived in `scripts/seed.mjs`).
- `pnpm test` / `pnpm test:integration` / `pnpm typecheck` / `pnpm build`.
- Remote D1s exist (prod + staging, configured in `wrangler.jsonc`) — never
  touch without explicit instruction.
