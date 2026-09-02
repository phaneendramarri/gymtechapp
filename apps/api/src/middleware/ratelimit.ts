// filepath: apps/api/src/middleware/ratelimit.ts
/**
 * Rate limiting middleware for Hono / Cloudflare Workers.
 *
 * Uses a sliding-window log per IP address.
 * - In the Cloudflare Workers runtime: uses Workers KV ( DurableObject would
 *   be stronger but requires a separate DO deployment; KV is zero-config).
 * - In unit tests / non-KV environments: falls back to an in-memory Map.
 *
 * Route tiers:
 *   auth   – 5 attempts / 60 s   (login, forgot-password, reset-password)
 *   write  – 20 attempts / 60 s  (POST/PUT/PATCH on any endpoint)
 *   read   – 100 attempts / 60 s (GET / DELETE)
 */

import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../app';
import { createRateLimiter, type RateLimiterStore } from '../lib/ratelimit';

// ---------------------------------------------------------------------------
// Tier configuration
// ---------------------------------------------------------------------------

export type RateLimitTier = 'auth' | 'write' | 'read';

interface TierConfig {
  limit: number;        // max requests
  windowSecs: number;    // window length in seconds
}

const TIERS: Record<RateLimitTier, TierConfig> = {
  auth:  { limit: 5,  windowSecs: 60  },
  write: { limit: 20, windowSecs: 60  },
  read:  { limit: 100, windowSecs: 60 },
};

export const RATELIMIT_KV = '__ratelimit_kv__' as const;

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

type AppVars = {
  requestId: string;
  // deno-lint-ignore no-explicit-any
  ctx: any;
  // deno-lint-ignore no-explicit-any
  tenant?: any;
};

export function createRateLimitMiddleware(
  store: RateLimiterStore,
  getTier: (c: Context<{ Bindings: AppEnv; Variables: AppVars }>) => RateLimitTier = () => 'read',
) {
  return (async (c, next) => {
    const ip =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown';

    const tier = getTier(c);
    const { limit, windowSecs } = TIERS[tier];

    const { allowed, remaining, resetAt } = await store.check({
      key: `rl:${ip}`,
      limit,
      windowSecs,
    });

    // Always emit rate-limit headers so clients can adapt.
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, remaining)));
    c.header('X-RateLimit-Reset', String(resetAt));

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt * 1000 - Date.now()) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json(
        {
          error: 'Too Many Requests',
          code: 'RATE_LIMITED',
          retryAfter,
        },
        429
      );
    }

    await next();
  }) as MiddlewareHandler<{ Bindings: AppEnv; Variables: AppVars }>;
}

/** Pre-built middleware that auto-detects tier from HTTP method. */
export const rateLimitMiddleware = createRateLimitMiddleware(
  createRateLimiter(),
  (c) => {
    const path = c.req.path;
    // Auth endpoints get the strict tier.
    if (path.startsWith('/api/auth/login') || path.startsWith('/api/auth/forgot') || path.startsWith('/api/auth/reset')) {
      return 'auth';
    }
    const method = c.req.method;
    if (method === 'GET' || method === 'DELETE') return 'read';
    return 'write';
  }
);
