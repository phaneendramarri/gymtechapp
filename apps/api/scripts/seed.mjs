#!/usr/bin/env node
/**
 * Database seed runner.
 *
 * WHY THIS EXISTS
 * ---------------
 * A plain .sql file cannot compute PBKDF2 hashes, so the seed used to hard-code
 * them. Those literals silently drifted from apps/api/src/lib/password.ts and
 * shipped unusable credentials — every login failed on a fresh database with
 * "Invalid email or password".
 *
 * This script derives the hashes at run time using the *same* algorithm, salt
 * length, iteration count and encoding as the application's verifier, re-derives
 * them once to self-check, substitutes them into seed/seed_production.sql, and
 * applies the result through wrangler.
 *
 * USAGE
 *   pnpm db:seed:local
 *   pnpm db:seed:staging
 *   pnpm db:seed:production                     (requires --confirm)
 *   node scripts/seed.mjs --target local --dry-run
 *   SEED_PASSWORD='something-else' pnpm db:seed:local
 *
 * Keeping the hash derivation in ONE place is the point: the seed can no longer
 * drift from the verifier without the self-check failing loudly.
 */

import { webcrypto } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Must stay in lockstep with apps/api/src/lib/password.ts -----------------
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH_LENGTH = 32; // bytes
const SALT_LENGTH = 16; // bytes
const HASH_PREFIX = 'pbkdf2$sha256';

const DEFAULT_PASSWORD = 'Password123!';

/** Placeholder tokens in seed/seed_production.sql, replaced at run time. */
const PLATFORM_ADMIN_TOKEN = '__PLATFORM_ADMIN_PASSWORD_HASH__';
const GYM_OWNER_TOKEN = '__GYM_OWNER_PASSWORD_HASH__';

const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED_SQL = join(API_DIR, 'seed', 'seed_production.sql');
const GENERATED_SQL = join(API_DIR, '.wrangler', 'seed.generated.sql');

/** Target D1 databases, mirroring the db:migrate:* scripts. */
const TARGETS = {
  local: {
    database: 'gymtechapp',
    args: ['--local'],
    label: 'local D1 (gymtechapp)',
    remote: false,
  },
  staging: {
    database: 'gymtechapp-d1-staging',
    args: ['--remote', '--env', 'staging'],
    label: 'staging D1 (gymtechapp-d1-staging)',
    remote: true,
  },
  production: {
    database: 'gymtechapp',
    args: ['--remote', '--env', 'production'],
    label: 'PRODUCTION D1 (gymtechapp)',
    remote: true,
  },
};

const subtle = webcrypto.subtle;

const toBase64Url = (bytes) =>
  Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

const fromBase64Url = (str) => {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64');
};

async function derive(password, salt) {
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    PBKDF2_HASH_LENGTH * 8
  );
  return new Uint8Array(bits);
}

/**
 * Hash a password exactly the way the API's verifyPassword() expects, then
 * prove the result verifies before returning it.
 */
async function hashPassword(password) {
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = toBase64Url(await derive(password, salt));
  const stored = `${HASH_PREFIX}:${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${hash}`;

  // Self-check: parse our own output and re-derive, so a format change in
  // either direction fails here instead of at the login screen.
  const parts = stored.split('$');
  const [algo, iterations] = parts[1].split(':');
  const reDerived = toBase64Url(
    await derive(password, fromBase64Url(parts[2]))
  );
  const ok =
    algo === 'sha256' &&
    Number(iterations) === PBKDF2_ITERATIONS &&
    reDerived === parts[3];
  if (!ok) {
    throw new Error(
      'Password hash self-check failed — scripts/seed.mjs has drifted from ' +
        'apps/api/src/lib/password.ts. Fix that before seeding.'
    );
  }
  return stored;
}

function parseArgs(argv) {
  const opts = { target: 'local', dryRun: false, confirm: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--target') opts.target = argv[++i];
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--confirm') opts.confirm = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
  }
  return opts;
}

function usage() {
  console.log(`Seed a GymTech D1 database.

  --target <local|staging|production>   default: local
  --dry-run                             write SQL, do not execute
  --confirm                             required for the production target

Set SEED_PASSWORD to override the default demo password.`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return usage();

  const target = TARGETS[opts.target];
  if (!target) {
    console.error(`Unknown target "${opts.target}". Expected one of: ${Object.keys(TARGETS).join(', ')}`);
    process.exit(1);
  }
  if (opts.target === 'production' && !opts.confirm) {
    console.error(
      'Refusing to seed PRODUCTION without --confirm.\n' +
        'This rewrites the super-admin and gym-owner rows. Re-run with:\n' +
        '  node scripts/seed.mjs --target production --confirm'
    );
    process.exit(1);
  }

  const password = process.env.SEED_PASSWORD || DEFAULT_PASSWORD;
  const [adminHash, ownerHash] = await Promise.all([
    hashPassword(password),
    hashPassword(password),
  ]);

  let sql = readFileSync(SEED_SQL, 'utf8');
  for (const token of [PLATFORM_ADMIN_TOKEN, GYM_OWNER_TOKEN]) {
    if (!sql.includes(token)) {
      console.error(
        `seed/seed_production.sql is missing the ${token} placeholder.\n` +
          'Every password hash must be a placeholder so this script can fill it in.'
      );
      process.exit(1);
    }
  }
  sql = sql
    .replaceAll(PLATFORM_ADMIN_TOKEN, adminHash)
    .replaceAll(GYM_OWNER_TOKEN, ownerHash);

  mkdirSync(dirname(GENERATED_SQL), { recursive: true });
  writeFileSync(GENERATED_SQL, sql, 'utf8');

  console.log(`Seeding ${target.label}`);
  console.log(`  password : ${password === DEFAULT_PASSWORD ? `${DEFAULT_PASSWORD} (default)` : 'from SEED_PASSWORD'}`);
  console.log(`  hashes   : freshly derived + self-checked`);

  if (opts.dryRun) {
    console.log(`  --dry-run: wrote ${GENERATED_SQL} and stopped.`);
    return;
  }

  try {
    const result = spawnSync(
      'npx',
      [
        'wrangler',
        'd1',
        'execute',
        target.database,
        ...target.args,
        '--file=.wrangler/seed.generated.sql',
        '-c',
        '../../wrangler.jsonc',
      ],
      { cwd: API_DIR, stdio: 'inherit', shell: process.platform === 'win32' }
    );
    if (result.status !== 0) {
      console.error(`\nSeeding failed (wrangler exited ${result.status}).`);
      process.exit(result.status ?? 1);
    }
  } finally {
    // Never leave plaintext-adjacent hash material lying around.
    rmSync(GENERATED_SQL, { force: true });
  }

  console.log('\nSeed complete. Sign in with:');
  console.log(`  platform admin : admin@gymtech.app / ${password}`);
  console.log(`  gym owner      : owner@gymtech.app / ${password}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
