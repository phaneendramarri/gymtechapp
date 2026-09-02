# GymTech OS

The all-in-one operating system for modern gyms, fitness centers, and strength clubs across India.

Manage members, automated Face ID + QR attendance, GST invoices, PT commissions, and trainer payouts — in one place your staff will actually open every morning.

Built on Cloudflare Workers (Hono), D1 SQLite, React 18, and Tailwind CSS v4.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | Cloudflare Workers + Hono |
| Database | D1 (SQLite) + Drizzle ORM |
| Auth | JWT + CSRF double-submit |
| Frontend | React 18 + Vite + TanStack Query |
| Styling | Tailwind CSS v4 |
| Testing | Vitest (unit) + Playwright (e2e) |
| Deploy | Cloudflare Pages + Workers |

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Wrangler CLI (`npm i -g wrangler`)

### Setup

```bash
# 1. Clone and install
git clone https://github.com/gymtech/os.git gymtechapp
cd gymtechapp
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your values

# 3. Start development
pnpm dev
```

This starts:
- **Web app** at `http://localhost:5173`
- **API** at `http://localhost:8787`

### Database Migrations

```bash
# Push schema to local D1
pnpm --filter=@gymtech/api db:push

# Apply migrations (production)
pnpm --filter=@gymtech/api db:migrate
```

### Build

```bash
# Build all packages
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint

# Unit tests
pnpm test

# E2E tests
pnpm test:e2e
```

---

## Project Structure

```
gymtechapp/
├── apps/
│   ├── api/          # Cloudflare Worker API
│   │   ├── src/
│   │   │   ├── db/           # Drizzle schema + migrations
│   │   │   ├── lib/           # Utilities (auth, crypto, media, etc.)
│   │   │   ├── middleware/    # Auth, CSRF, rate-limit
│   │   │   ├── repositories/  # Data access layer
│   │   │   ├── routes/        # API endpoints
│   │   │   └── services/      # Business logic
│   │   └── wrangler.jsonc     # Cloudflare config
│   └── web/           # React SPA
│       └── src/
│           ├── components/    # UI components
│           ├── hooks/         # Custom React hooks
│           ├── lib/           # Utilities
│           └── pages/         # Route pages
├── packages/
│   └── shared/       # Shared types, contracts, constants
├── tests/
│   ├── e2e/          # Playwright e2e tests
│   └── unit/          # Vitest unit tests
└── wrangler.jsonc     # Root Cloudflare config
```

---

## Environment Variables

See [`.env.example`](.env.example) for all required variables.

---

## License

Proprietary — All rights reserved.
