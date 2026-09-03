/**
 * Drizzle client factory for Cloudflare Workers D1.
 *
 * Uses drizzle-orm's D1 driver to wrap the raw D1Database binding. This gives:
 *   - Type-safe query building with Drizzle's chainable API
 *   - Full schema inference from schema.ts
 *   - Parameterized queries (SQL injection safe)
 *   - Raw SQL escape hatch via `sql` template tag for complex queries
 *     (e.g. correlated subqueries, window functions) that the builder
 *     cannot express cleanly.
 *
 * NOTE: Drizzle is used as a **query builder only** — migrations remain
 * hand-written SQL files under migrations/. This keeps the DB schema
 * source-of-truth in SQL while giving us ORM-like ergonomics.
 */
import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema';

// Re-export D1Database so repositories can import it
export type { D1Database };
export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Create a Drizzle client from a D1Database binding.
 * Call this once per request (Drizzle clients are lightweight).
 */
export function createDatabase(d1: D1Database): Database {
  return drizzle(d1, { schema });
}
