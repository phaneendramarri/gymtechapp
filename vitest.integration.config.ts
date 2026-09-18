import { defineConfig } from 'vitest/config';

/**
 * Integration tests boot real Cloudflare bindings (D1 via wrangler's platform
 * proxy), so they run in a single fork — concurrent forks would contend for the
 * same local SQLite file — and get a longer timeout for the first boot.
 *
 * Unit tests stay in `vitest.config.ts`; this suite is opt-in via
 * `pnpm test:integration`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.{test,spec}.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
