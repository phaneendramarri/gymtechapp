# Gym SaaS Rebuild — Implementation Plan (v2, post-Phase-0)

> Phase 0 (schema/repository ownership fixes) is complete and verified:
> 201/201 unit, 21/21 integration, typecheck + build + FK-check clean.

---

## 1. Current-state inventory (verified on disk)

### Database — 19 tables, baseline `0000_init.sql` + `0001_menu_items.sql` (D1/SQLite)

| Domain | Tables |
|---|---|
| Tenancy & licensing | `gyms`, `licenses` (limits + `features` JSON), `platform_admins`, `platform_settings` |
| Identity & access | `users` (role_id FK, lockout counters), `roles`, `role_menus`, `menu_items`, `user_sessions`, `user_password_resets` |
| Core domain | `members` (face embedding, GDPR fields), `membership_plans`, `memberships` (dues ledger, freeze), `payments` (year-scoped receipts), `pt_collections` (trainer commissions), `attendance` |
| Infrastructure | `counters` (atomic sequences), `communication_logs` (GDPR basis + retention), `audit_events` (append-only) |

**Schema quality (post-Phase-0):** every table has a repository owner; composite FKs verified;
`PRAGMA foreign_key_check` clean; soft-delete + audit timestamps consistent.

### Backend — Hono on Cloudflare Workers

- **16 repositories** — one owner per table (Counter, Pt, PasswordReset, Settings added in Phase 0)
- **Auth:** staff JWT-cookie login, platform-admin login, member portal login (phone + member
  code), CSRF double-submit, forgot/reset password (opaque HMAC tokens), session revocation
  (DB + KV denylist), progressive lockout, Turnstile, rate limiting
- **Domain routes:** members (CRUD, bulk import, renew, freeze/unfreeze, GDPR erase/export),
  attendance (QR check-in), payments (single atomic batch path), plans, PT collections/commissions,
  custom roles + menu permissions, staff, notification settings + dispatch with credit metering,
  reports (revenue/membership/attendance/growth + CSV), dashboard, media upload, audit logs
- **Platform admin:** gym CRUD with owner provisioning + starter plans, license limits/features
  (real gating from `licenses.features`), communications gateway config, credit top-ups, audit
- **Cron (`scheduled.ts`):** hourly expiry sweep (licenses → memberships → members via repo
  methods), daily batch (invoices, attendance rollups)
- **Bindings:** D1, RATELIMIT_KV, DENYLIST_KV; R2 intentionally unused
- **Tests:** 201 unit (19 files) + 21 integration (real D1 harness driving the real app)

### Frontend — React 19 + Vite + Tailwind

16 pages: Login, Reset, Dashboard, Members (+new/detail/renew), Payments, PT Collections,
Attendance, Plans, Staff, Reports, Settings (+notifications tab), Audit Logs, Member Portal,
platform Admin (+platform Roles/Users). Permission-guarded routes; domain-grouped components;
face-matcher lib; menu-driven navigation from `menu_items`.

### Feature flags (GYM_FEATURES): 10 keys

`dashboard, members, attendance, payments, pt_collections, plans, staff, reports, settings, audit_logs`

---

## 2. Proposed architecture (same stack, strict layering)

Keep the monorepo — it fits the product: `apps/api` (Hono/D1/KV Workers), `apps/web`
(React/Vite/Tailwind), `packages/shared` (zod contracts, types, vocabularies). Keep the
baseline-migration + seed model, Drizzle-typed schema, license/feature gating, PBKDF2, cron triggers.

```
apps/api/src/
  routes/        HTTP only: validate → gate → delegate → shape (zero SQL)   done in Phase 0
  services/      business logic, orchestration (no HTTP)                      done
  repositories/  ONE per table — every SQL statement lives here               done (16 repos)
  lib/           pure policy & helpers: roles, features, notifications, calc, crypto
  middleware/    auth, csrf, ratelimit, context, params
  db/            schema.ts (source of truth) + client
  scheduled.ts   cron orchestration only
apps/web/src/
  features/<domain>/   domain components + hooks (NEW: scheduling, billing)
  pages/               thin route components composing features
  components/ui/       primitives
packages/shared/src/   contracts.ts (zod) · types.ts · constants.ts
```

Layer rules (enforced by convention + integration tests): routes never touch SQL; services own
transactions; repositories own tables; shared owns vocabulary.

---

## 3. Complete feature list

### Existing — ALL preserved (pinned by the E2E integration suite)

Staff/platform/member auth · CSRF, lockout, rate limits, session revocation · member lifecycle
(create → enroll → renew → freeze → expire → GDPR erase) · dues ledger + year-scoped receipts ·
QR attendance · PT commissions · plans · custom roles + menu permissions · feature gating ·
WhatsApp/SMS/email notifications with credit metering + GDPR audit trail · reports + CSV ·
dashboards · audit trail · platform gym/license admin · cron sweeps · member portal.

### Improved (no scope change, better mechanics)

- Repository-per-table ownership — done (Phase 0)
- Single payment path (route + service share one atomic batch) — done (Phase 0)
- Freeze/unfreeze as service transactions — done
- Automated dues/expiry reminders via cron-driven queue (replaces ad-hoc dispatch)
- Member portal self-service: profile, renew, measurement history, my bookings
- Notification dispatch abstraction: deep links today, pluggable gateways later

### New (standard gym SaaS gaps)

1. **Billing:** `invoices` generated by the daily cron (code promises this today; not
   implemented), due dates, payment linking, OPEN/PAID/OFFSET/OVERDUE lifecycle; offline
   payment-gateway interface (Razorpay-ready stub)
2. **Scheduling:** classes + recurring schedules + bookings (capacity, waitlist); desk UI;
   member portal booking; booking → attendance link
3. **Check-ins:** kiosk-friendly check-in screen; complete the existing face-match flow
   (embedding infrastructure already exists)
4. **Notifications:** `notification_queue` with retries, credit checks, scheduled sends
5. **Expenses & P&L:** expense categories + entries feeding a P&L report
6. **Member fitness data:** measurements (weight/inches/body-fat history) + trainer notes,
   surfaced on the portal
7. **Reporting additions:** trainer performance, retention/churn, P&L, exports

### Deliberately out (zombie scope, not standard-core)

Workout/diet plan builders, equipment, inventory/shop, multi-location per tenant (each gym row
is one location), referrals. Can be later phases if asked.

---

## 4. Schema changes (all tenant-scoped: gym_id FK, indexes, soft-delete + audit columns)

Retain all 19 tables. Add:

| Table | Purpose / key columns |
|---|---|
| `invoices` | member, membership, amount, due_date, status OPEN/PAID/OVERDUE/OFFSET, paid_payment_id; index (gym, status, due_date) for the cron |
| `notification_queue` | gym, member, channel, template, payload JSON, status PENDING/SENT/FAILED, attempts, scheduled_for, last_error, sent_log_id → communication_logs |
| `classes` | name, category, duration_min, trainer_id nullable, capacity, is_active |
| `class_schedules` | class_id, weekday/time OR one-off datetime, recurrence, effective_from/to |
| `class_bookings` | schedule_id, member_id, status BOOKED/ATTENDED/CANCELLED/WAITLISTED; UNIQUE (gym, schedule, member) |
| `expenses` / `expense_categories` | amount, date, category, notes; parent tables get `UNIQUE (gym_id, id)` (lesson from the 0008 FK bug) |
| `member_measurements` | member, date, weight_kg, height_cm, body_fat_pct, custom JSON |
| `member_notes` | member, author_user_id, body |
| `payments` + `gateway_ref` | gateway idempotency key for the offline-stub interface |

Baseline migration regenerated (0000 stays the single source); existing DBs are rebuildable
from seed + tenant setup, so no data-migration shims.

---

## 5. Phased build plan

| Phase | Milestone | Contents | Verification gate |
|---|---|---|---|
| **0. Hygiene** done | Debt = 0 | Ownership fixes (done this session) | 201+21 green, FK check clean |
| **1. Core proven** | Existing product E2E-tested | Integration tests per flow (auth, member lifecycle incl. freeze/GDPR, payments, attendance, roles, PT); make the daily invoice-generation + rollup cron jobs real; UI walkthrough in preview | full battery + preview of every page |
| **2. Billing** | Invoices & reminders live | `invoices` + cron generation; `notification_queue` + dues/expiry reminders; expenses + P&L; gateway interface (offline stub) | new unit + integration tests; reminder E2E in preview |
| **3. Scheduling** | Classes bookable | classes/schedules/bookings; capacity + waitlist rules; desk UI; portal booking; attendance link | flow tests incl. overbooking + cross-gym probes |
| **4. Check-ins & portal** | Kiosk + self-service | kiosk screen; face-match completion; portal profile/renew/measurements/preferences | E2E portal flows |
| **5. Reporting & platform** | Ops complete | trainer performance, retention, P&L dashboards; CSV exports; platform admin polish | report math unit tests; CSV snapshots |
| **6. Hardening** | Production-ready | security pass, N+1/index sweep, docs, deploy runbook (prod/staging D1), CI wiring | full battery + deploy rehearsal |

Each phase ends green (typecheck + unit + integration + build) and demonstrable in preview
before the next begins. No existing feature is lost at any point — Phase 1's contract is
"every current page and endpoint works, now pinned by tests."
