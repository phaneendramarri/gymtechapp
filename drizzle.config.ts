// filepath: drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit config.
 *
 * We treat the existing 4 SQL migrations under apps/api/migrations as the
 * canonical schema. drizzle-kit is used ONLY for:
 *   - `drizzle-kit pull` — read D1 schema → emit TS types (one-way, read-only).
 *   - `drizzle-kit generate` — optional, for future SQL migrations.
 *
 * Never run `drizzle-kit push` against D1 directly. Always edit the SQL files
 * by hand and let Drizzle mirror them in `apps/api/src/db/schema.ts`.
 */
export default defineConfig({
  schema: './apps/api/src/db/schema.ts',
  out: './apps/api/migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: '46bf7b9d-0284-4f4d-b91e-2caafe5289cf',
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
  verbose: true,
  strict: true,
});