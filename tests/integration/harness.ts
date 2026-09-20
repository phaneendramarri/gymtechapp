declare global {
  interface D1Database {
    prepare(query: string): any;
    batch(statements: any[]): Promise<any[]>;
    exec(query: string): Promise<any>;
    dump(): Promise<ArrayBuffer>;
  }
  interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
  }
  interface KVNamespace {
    get(key: string, options?: any): Promise<any>;
    put(key: string, value: any, options?: any): Promise<void>;
    delete(key: string): Promise<void>;
  }
}

/**
 * In-process API test harness.
 *
 * WHAT THIS IS
 * ------------
 * A real end-to-end driver for the GymTech API that needs no running server:
 * `wrangler`'s platform proxy hands us genuine bindings (D1, KV, R2, vars) from
 * `wrangler.jsonc`, and we invoke the actual Hono app with `app.fetch()`.
 *
 * That means these tests exercise the true stack —
 *   request → middleware (auth/CSRF/tenant) → route → repository → D1 → response
 * — including SQL constraints, which is exactly where the interesting bugs live.
 *
 * REQUIREMENTS
 * ------------
 * The local D1 database must be migrated and seeded first:
 *   pnpm db:migrate:local && pnpm db:seed:local
 * The harness fails fast with a clear message if it isn't.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll } from 'vitest';
import { app } from '../../apps/api/src/app';

const requireFromApi = createRequire(
  new URL('../../apps/api/package.json', import.meta.url)
);

/** Persist directory shared with the `wrangler d1 … --local` CLI commands. */
const PERSIST_PATH = '.wrangler/state/v3';
const BASE_URL = 'http://127.0.0.1';
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Parse `apps/api/.dev.vars` (the Wrangler equivalent of `.env`).
 *
 * `wrangler dev` resolves this next to its working directory, but the platform
 * proxy only reads the config's own directory — so we load it ourselves to pick
 * up `JWT_SECRET`. Without it, JWT signing fails with
 * "Zero-length key is not supported" and every login returns 401.
 */
function loadDevVars(): Record<string, string> {
  const file = join(REPO_ROOT, 'apps', 'api', '.dev.vars');
  if (!existsSync(file)) return {};

  const vars: Record<string, string> = {};
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

export interface TestEnv {
  DB: D1Database;
  [key: string]: unknown;
}

let cached: TestEnv | null = null;
let proxy: { env: Record<string, unknown>; dispose?: () => Promise<void> } | null = null;

/**
 * Boot the platform proxy once per test file and return a Worker-style env
 * object. `APP_ENV` is forced to `development` so cookies are not marked
 * `Secure` (they'd otherwise be undeliverable over plain http in tests).
 */
export async function getTestEnv(): Promise<TestEnv> {
  if (cached) return cached;

  const entry = requireFromApi.resolve('wrangler');
  const mod = (await import(pathToFileURL(entry).href)) as Record<string, unknown>;
  const getPlatformProxy =
    (mod.getPlatformProxy as ((o: unknown) => Promise<{ env: Record<string, unknown>; dispose?: () => Promise<void> }>) | undefined) ??
    ((mod.default as Record<string, unknown> | undefined)?.getPlatformProxy as
      | ((o: unknown) => Promise<{ env: Record<string, unknown>; dispose?: () => Promise<void> }>)
      | undefined);

  if (typeof getPlatformProxy !== 'function') {
    throw new Error('wrangler.getPlatformProxy is unavailable — cannot run integration tests.');
  }

  proxy = await getPlatformProxy({
    configPath: 'wrangler.jsonc',
    persist: { path: PERSIST_PATH },
  });
  const proxyRef = proxy;

  // .dev.vars wins over wrangler.jsonc vars, exactly as `wrangler dev` behaves.
  cached = {
    ...(proxyRef ? (proxyRef.env as Record<string, unknown>) : {}),
    ...loadDevVars(),
    APP_ENV: 'development',
  } as unknown as TestEnv;

  if (!cached.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET is empty — apps/api/.dev.vars is missing or has no JWT_SECRET.\n' +
        'Generate one with: openssl rand -base64 32'
    );
  }

  return cached;
}

/**
 * Tear down the platform proxy (its workerd child process) and all caches.
 *
 * The proxy spawns a real `workerd` process; without an explicit `dispose()`
 * every test run leaks one, and leaked instances hold locks on the shared D1
 * state directory — which then breaks subsequent `wrangler d1` CLI commands
 * and `pnpm db:*` scripts until the processes are killed by hand.
 */
let teardownRegistered = false;

/**
 * Tear down the platform proxy (its workerd child process) and all caches
 * after the file's tests run. Call once at the top level of each integration
 * spec — a leaked proxy holds locks on the shared D1 state directory and
 * breaks subsequent `wrangler d1` CLI and `pnpm db:*` commands.
 */
export function setupHarnessTeardown(): void {
  if (teardownRegistered) return;
  teardownRegistered = true;
  afterAll(async () => {
    sessionCache.clear();
    cached = null;
    const p = proxy;
    proxy = null;
    if (p?.dispose) await p.dispose();
  }, 30_000);
}

/** Minimal ExecutionContext stub — the app only calls waitUntil() defensively. */
const executionCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
} as unknown as ExecutionContext;

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
}

/**
 * Rate limiting is per IP, so every client gets its own address by default;
 * tests that exercise the limits pass an explicit IP to the constructor.
 *
 * The first two octets are randomised per run: limiter state lives in KV and
 * outlives the process, so a fixed address sequence would collide with the
 * buckets left behind by the previous run and fail with inherited 429s.
 */
const RUN_PREFIX = Math.floor(Math.random() * 0xffff);
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.${(RUN_PREFIX >> 8) & 0xff}.${RUN_PREFIX & 0xff}.${ipCounter & 0xff}`;
}

/**
 * A cookie-aware HTTP client for the Hono app, mimicking a browser session:
 * cookies persist across calls and the CSRF token is echoed automatically.
 */
export class ApiClient {
  private cookies = new Map<string, string>();
  private ip: string;

  constructor(private env: TestEnv, ip?: string) {
    this.ip = ip ?? nextIp();
  }

  /** Replace the cookie jar with a previously captured session. */
  useCookies(cookies: ReadonlyArray<readonly [string, string]>): this {
    if (this.cookies.size === 0) {
      for (const [name, value] of cookies) this.cookies.set(name, value);
    }
    return this;
  }

  get csrfToken(): string | undefined {
    return this.cookies.get('gym_csrf');
  }

  get cookieHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  /** Seed the jar directly (e.g. to simulate a stolen/absent CSRF cookie). */
  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  /** Snapshot the jar so another client can impersonate this session. */
  cookieEntries(): Array<[string, string]> {
    return [...this.cookies.entries()];
  }

  clearCookies(): void {
    this.cookies.clear();
  }

  private captureCookies(res: Response): void {
    const setCookies: string[] =
      typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
        ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie') as string] : []);

    for (const raw of setCookies) {
      const parts = raw.split(';');
      const pair = parts[0];
      if (!pair) continue;
      const idx = pair.indexOf('=');
      if (idx < 0) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options: { body?: unknown; headers?: Record<string, string>; withCsrf?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    const { body, headers = {}, withCsrf = true } = options;
    const init: RequestInit = { method, headers: { ...headers } };
    const h = init.headers as Record<string, string>;

    h['CF-Connecting-IP'] = this.ip;
    if (this.cookies.size > 0) h['Cookie'] = this.cookieHeader;
    if (body !== undefined) {
      h['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    // Double-submit CSRF: echo the cookie value as the header on unsafe methods.
    if (withCsrf && !['GET', 'HEAD', 'OPTIONS'].includes(method) && this.csrfToken) {
      h['X-CSRF-Token'] = this.csrfToken;
    }

    const res = await app.fetch(
      new Request(`${BASE_URL}${path}`, init),
      this.env as never,
      executionCtx
    );
    this.captureCookies(res);

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: res.status, body: parsed as T, headers: res.headers };
  }

  get = <T = unknown>(path: string) => this.request<T>('GET', path);
  post = <T = unknown>(path: string, body?: unknown) => this.request<T>('POST', path, { body });
}

/** Credentials created by `apps/api/seed/seed_production.sql`. */
export const SEED = {
  owner: { email: 'owner@gymtech.app', password: 'Password123!' },
  platformAdmin: { email: 'admin@gymtech.app', password: 'Password123!' },
} as const;

interface Session {
  client: ApiClient;
  env: TestEnv;
}

type CookieSnapshot = ReadonlyArray<readonly [string, string]>;

const sessionCache = new Map<string, CookieSnapshot>();

/**
 * Perform a real login once per identity and reuse the resulting cookies.
 *
 * The auth tier allows only 5 attempts/minute per IP, so re-authenticating for
 * every test would trip the limiter (and mask genuine failures behind 429s).
 */
async function signIn(
  path: string,
  credentials: { email: string; password: string },
  label: string
): Promise<Session> {
  const env = await getTestEnv();

  let cookies = sessionCache.get(label);
  if (!cookies) {
    const seedClient = new ApiClient(env);
    const res = await seedClient.post(path, credentials);
    if (res.status !== 200) {
      throw new Error(
        `${label} login failed (${res.status}): ${JSON.stringify(res.body)}\n` +
          'The local database is probably not migrated/seeded. Run:\n' +
          '  pnpm db:migrate:local && pnpm db:seed:local'
      );
    }
    cookies = [...seedClient.cookieEntries()];
    sessionCache.set(label, cookies);
  }

  return { client: new ApiClient(env).useCookies(cookies), env };
}

/** Sign in as a gym owner and return a CSRF-ready client. */
export const loginAsOwner = (): Promise<Session> =>
  signIn('/api/auth/login', SEED.owner, 'gym owner');

/** Sign in as the platform super admin and return a CSRF-ready client. */
export const loginAsPlatformAdmin = (): Promise<Session> =>
  signIn('/api/auth/platform-login', SEED.platformAdmin, 'platform admin');

/** Unique-per-run suffix so reruns don't collide with unique constraints. */
export const uniqueSuffix = (): string => Date.now().toString(36).slice(-6);

/**
 * Clear a rate-limit bucket.
 *
 * The limiter is KV-backed and therefore *persists between test runs* — the
 * sliding window survives process restarts for its full TTL. Tests that
 * deliberately exhaust a bucket must start from a known-clean slate, otherwise
 * a rerun within the window fails with leftover 429s instead of testing
 * behaviour.
 */
export async function resetRateLimit(
  env: TestEnv,
  tier: 'auth' | 'read' | 'write',
  ip: string
): Promise<void> {
  const kv = (env as { RATELIMIT_KV?: KVNamespace }).RATELIMIT_KV;
  if (kv) await kv.delete(`rl:${tier}:${ip}`);
}
