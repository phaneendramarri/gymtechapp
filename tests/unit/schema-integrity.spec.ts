import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Schema integrity guards.
 *
 * These are static checks over the hand-written SQL baseline. They exist
 * because of a real production-incident class:
 *
 *   SQLite requires the PARENT of a composite foreign key (gym_id, id) to
 *   expose a UNIQUE index over exactly those columns. When it doesn't, every
 *   write to the CHILD table fails with "foreign key mismatch" — which broke
 *   member enrollment and renewal (memberships → membership_plans) after a
 *   table rebuild silently dropped the parent's UNIQUE constraint.
 *
 * These tests fail loudly if that ever happens again.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, '../../apps/api/migrations');
const SCHEMA_FILE = path.resolve(__dirname, '../../apps/api/src/db/schema.ts');

function readMigrations(): { name: string; sql: string }[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8') }));
}

function allSql(): string {
  return readMigrations()
    .map((m) => m.sql)
    .join('\n');
}

/** Strip SQL comments so commented-out DDL can never satisfy a check. */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

interface CompositeFk {
  child: string;
  childCols: [string, string];
  parent: string;
  parentCols: [string, string];
}

/** Parse every `FOREIGN KEY (a, b) REFERENCES parent(x, y)` in the baseline. */
function parseCompositeForeignKeys(sql: string): CompositeFk[] {
  const clean = stripComments(sql);
  const fks: CompositeFk[] = [];
  const tableRe = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"?(\w+)"?\s*\(([\s\S]*?)\n\);/g;

  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(clean))) {
    const child = tableMatch[1];
    const body = tableMatch[2];
    if (!child || !body) continue;
    const fkRe = /FOREIGN KEY\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*REFERENCES\s+"?(\w+)"?\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/g;
    let fkMatch: RegExpExecArray | null;
    while ((fkMatch = fkRe.exec(body))) {
      const childCol1 = fkMatch[1];
      const childCol2 = fkMatch[2];
      const parent = fkMatch[3];
      const parentCol1 = fkMatch[4];
      const parentCol2 = fkMatch[5];
      if (childCol1 && childCol2 && parent && parentCol1 && parentCol2) {
        fks.push({
          child,
          childCols: [childCol1, childCol2],
          parent,
          parentCols: [parentCol1, parentCol2],
        });
      }
    }
  }
  return fks;
}

/**
 * Collect every UNIQUE index a table provides, as a set of comma-joined
 * column lists — covering named `CREATE UNIQUE INDEX` statements, inline
 * `UNIQUE (a, b)` table constraints, and column-level `PRIMARY KEY`.
 */
function uniqueKeysByTable(sql: string): Map<string, Set<string>> {
  const clean = stripComments(sql);
  const keys = new Map<string, Set<string>>();
  const add = (table: string, cols: string[]) => {
    const key = cols.map((c) => c.trim()).join(',');
    if (!keys.has(table)) keys.set(table, new Set());
    keys.get(table)!.add(key);
  };

  // Named unique indexes.
  const idxRe = /CREATE UNIQUE INDEX\s+(?:IF NOT EXISTS\s+)?"?(\w+)"?\s+ON\s+"?(\w+)"?\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = idxRe.exec(clean))) {
    const table = m[2];
    const cols = m[3];
    if (table && cols) {
      add(table, cols.split(',').map((c) => c.trim().replace(/\s+(ASC|DESC)$/i, '')));
    }
  }

  // Inline table constraints inside CREATE TABLE bodies.
  const tableRe = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"?(\w+)"?\s*\(([\s\S]*?)\n\);/g;
  while ((m = tableRe.exec(clean))) {
    const table = m[1];
    const body = m[2];
    if (!table || !body) continue;
    const inlineRe = /UNIQUE\s*\(([^)]*)\)/g;
    let u: RegExpExecArray | null;
    while ((u = inlineRe.exec(body))) {
      const cols = u[1];
      if (cols) {
        add(table, cols.split(',').map((c) => c.trim()));
      }
    }
    const pk = /PRIMARY KEY\s*\(([^)]*)\)/.exec(body);
    if (pk && pk[1]) add(table, pk[1].split(',').map((c) => c.trim()));
  }

  return keys;
}

describe('Schema integrity — composite foreign keys', () => {
  const sql = allSql();
  const foreignKeys = parseCompositeForeignKeys(sql);
  const uniqueKeys = uniqueKeysByTable(sql);

  it('finds composite foreign keys to check', () => {
    expect(foreignKeys.length).toBeGreaterThan(0);
  });

  it('every composite FK parent exposes a UNIQUE index over its referenced columns', () => {
    const violations: string[] = [];
    for (const fk of foreignKeys) {
      const key = fk.parentCols.join(',');
      if (!uniqueKeys.get(fk.parent)?.has(key)) {
        violations.push(
          `${fk.child}(${fk.childCols.join(', ')}) → ${fk.parent}(${key}): parent has no UNIQUE index on (${key})`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  it('memberships → membershipPlans keeps its parent unique key (regression)', () => {
    // The exact defect that broke member enrollment.
    expect(uniqueKeys.get('membershipPlans')?.has('gymId,id')).toBe(true);
  });
});

describe('Schema integrity — table parity with the Drizzle schema', () => {
  const migrationTables = new Set(
    [...stripComments(allSql()).matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"?(\w+)"?\s*\(/g)]
      .map((m) => m[1])
      .filter((name): name is string => typeof name === 'string'),
  );

  const schemaTables = new Set(
    [...fs.readFileSync(SCHEMA_FILE, 'utf8').matchAll(/sqliteTable\(\s*'(\w+)'/g)]
      .map((m) => m[1])
      .filter((name): name is string => typeof name === 'string'),
  );

  it('every table in the SQL baseline is described in schema.ts', () => {
    const missing = [...migrationTables].filter((t) => !schemaTables.has(t));
    expect(missing).toEqual([]);
  });

  it('every table in schema.ts exists in the SQL baseline', () => {
    const orphaned = [...schemaTables].filter((t) => !migrationTables.has(t));
    expect(orphaned).toEqual([]);
  });

  it('dropped legacy dead tables are gone for good', () => {
    const removed = [
      'gym_features',
      'gym_settings',
      'user_permissions',
      'saas_audit_events',
      'member_referrals',
    ];
    for (const table of removed) {
      expect(migrationTables.has(table), `${table} should not exist`).toBe(false);
      expect(schemaTables.has(table), `${table} should not exist in schema.ts`).toBe(false);
    }
  });
});

describe('Schema integrity — tenant isolation', () => {
  it('every tenant-owned table carries gymId', () => {
    const sql = stripComments(allSql());
    // Global/platform tables legitimately have no gymId.
    const globalTables = new Set(['gyms', 'platformAdmins', 'platformSettings', 'menuItems']);
    const tableRe = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"?(\w+)"?\s*\(([\s\S]*?)\n\);/g;

    const violations: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = tableRe.exec(sql))) {
      const table = m[1];
      const body = m[2];
      if (!table || !body) continue;
      if (globalTables.has(table)) continue;
      if (!/\bgymId\b/.test(body)) violations.push(table);
    }
    expect(violations).toEqual([]);
  });
});
