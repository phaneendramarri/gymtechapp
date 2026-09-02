// filepath: apps/api/src/lib/ratelimit.ts
/**
 * Rate limiter store — Cloudflare Workers KV + in-memory fallback.
 *
 * The KV implementation uses a sliding window log stored as a compact
 * JSON array in a KV key. This avoids the "reset storm" problem of
 * fixed windows at the cost of a small read-modify-write per request.
 *
 * Key format: `rl:<identifier>` (e.g. `rl:192.168.1.1`)
 * Value: JSON `number[]` — unix-timestamp array of request times in the
 *        current sliding window.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;   // unix seconds when the oldest entry expires
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSecs: number;
}

// ---------------------------------------------------------------------------
// In-memory store (unit tests / local dev without KV)
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, { ts: number[]; windowSecs: number }>();

export const inMemoryStore: RateLimiterStore = {
  async check({ key, limit, windowSecs }) {
    const now = Date.now();
    const windowMs = windowSecs * 1000;
    const windowStart = now - windowMs;

    const existing = memoryStore.get(key);
    const timestamps: number[] = existing
      ? existing.ts.filter((t) => t > windowStart)
      : [];

    timestamps.push(now);
    memoryStore.set(key, { ts: timestamps, windowSecs });

    const allowed = timestamps.length <= limit;
    const remaining = Math.max(0, limit - timestamps.length);
    // resetAt = when the oldest entry in the window will expire
    const resetAt = timestamps.length > 0
      ? Math.floor((timestamps[0] + windowMs) / 1000)
      : Math.floor(now / 1000) + windowSecs;

    return { allowed, remaining, resetAt };
  },
};

// ---------------------------------------------------------------------------
// KV store (Cloudflare Workers production)
// ---------------------------------------------------------------------------

/**
 * Build a KV-backed rate limiter store.
 *
 * @param kv  - The Workers KV namespace bound to the Worker.
 *              In app.ts the binding is named `RATELIMIT_KV`.
 */
export function kvRateLimiterStore(kv: KVNamespace): RateLimiterStore {
  return {
    async check({ key, limit, windowSecs }) {
      const now = Date.now();
      const windowMs = windowSecs * 1000;
      const windowStart = now - windowMs;
      const resetAt = Math.floor(now / 1000) + windowSecs;

      const raw = await kv.get(key, 'text');
      let timestamps: number[] = raw ? JSON.parse(raw) : [];

      // Prune entries outside the window.
      timestamps = timestamps.filter((t) => t > windowStart);

      timestamps.push(now);

      const allowed = timestamps.length <= limit;
      const remaining = Math.max(0, limit - timestamps.length);

      // Write back pruned + new entry.
      // expirationTtl ensures the key self-expires shortly after the window
      // closes, keeping KV storage bounded.
      await kv.put(key, JSON.stringify(timestamps), {
        expirationTtl: windowSecs * 2,
        metadata: { limit, windowSecs },
      });

      return { allowed, remaining, resetAt };
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface RateLimiterStore {
  check(opts: RateLimitOptions): Promise<RateLimitResult>;
}

/**
 * Create a store instance.
 *
 * When `kv` is supplied (Workers production) the KV-backed store is used.
 * Otherwise the in-memory Map is used — appropriate for unit tests.
 */
export function createRateLimiter(kv?: KVNamespace): RateLimiterStore {
  if (kv) return kvRateLimiterStore(kv);
  return inMemoryStore;
}
