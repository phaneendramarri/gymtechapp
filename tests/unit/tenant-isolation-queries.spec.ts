import { describe, it, expect } from 'vitest';

/**
 * Static-grep tests: lock down that every db.prepare() in route files that
 * targets a tenant-owned table includes a `gym_id` predicate.
 *
 * If a future contributor adds a query without `gym_id`, this test fails.
 */

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.resolve(__dirname, '../../apps/api/src/routes');

interface QueryHit {
  file: string;
  line: number;
  sql: string;
}

function collectQueries(): QueryHit[] {
  const hits: QueryHit[] = [];
  const files = fs.readdirSync(ROUTES_DIR).filter((f: string) => f.endsWith('.ts') && f !== 'helpers.ts');
  for (const f of files) {
    const full = path.join(ROUTES_DIR, f);
    const src = fs.readFileSync(full, 'utf8');
    const re = /env\.DB\.prepare\(`([^`]+)`\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const lineNo = src.substring(0, m.index).split('\n').length;
      hits.push({ file: f, line: lineNo, sql: m[1] });
    }
  }
  return hits;
}

const TENANT_TABLES = [
  'gyms', 'licenses', 'users', 'gym_settings', 'membership_plans',
  'members', 'memberships', 'payments', 'pt_collections', 'attendance',
  'user_sessions', 'user_password_resets', 'audit_events', 'gym_features',
  'communication_logs',
];
const NON_TENANT_QUERIES: Array<{ file: string; line: number; reason: string }> = [
  // The `gyms` table is its own tenant — gyms.id == gyms.gym_id, so a
  // `WHERE id = ctx.gymId` predicate is sufficient tenant isolation.
  { file: 'settings.routes.ts', line: 62, reason: 'updates the current gym by primary key (id == gym_id)' },
  // Platform admin routes look up gyms across tenants by primary key — they
  // are guarded by `requireSuperAdminMiddleware` upstream.
  { file: 'admin.routes.ts', line: 96, reason: 'platform-admin cross-tenant lookup of a gym by primary key' },
];

describe('Multi-tenant safety — raw SQL in routes', () => {
  const queries = collectQueries();

  it('no raw SQL targets a tenant table without a gym_id filter', () => {
    const violations: string[] = [];
    for (const q of queries) {
      const upper = q.sql.toUpperCase();
      for (const table of TENANT_TABLES) {
        if (!new RegExp(`\\b(?:FROM|INTO|UPDATE)\\s+${table}\\b`, 'i').test(q.sql)) continue;
        if (new RegExp(`\\b${table}\\.gym_id\\b`, 'i').test(q.sql)) continue;
        if (new RegExp(`\\bgym_id\\b`, 'i').test(q.sql)) continue;
        if (NON_TENANT_QUERIES.some((e) => e.file === q.file && e.line === q.line)) continue;
        violations.push(`${q.file}:${q.line} → ${q.sql.substring(0, 90)}…`);
      }
    }
    expect(violations).toEqual([]);
  });
});