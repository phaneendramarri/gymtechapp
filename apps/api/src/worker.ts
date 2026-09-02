// filepath: apps/api/src/worker.ts
/**
 * Cloudflare Worker entry point — single Worker for the whole product.
 *
 *   React/Vite  ──►  Cloudflare Worker
 *                       ├── /api/*  → Hono (this app)
 *                       └── /*      → env.ASSETS (Workers Static Assets)
 *
 * The Hono app handles every `/api/*` request. Anything else falls through
 * to the static assets binding (the React SPA). For unknown non-API routes
 * we explicitly fetch `/index.html` so client-side routing continues to work
 * — Hono's `notFound` only fires for paths that don't match any route AND
 * have no asset to serve, but Workers Static Assets already serves index.html
 * for any unmatched path by default when `assets` is configured, so we only
 * need to wire the fallback here.
 */
import { app } from './app';

export interface WorkerEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  APP_ENV?: string;
  CORS_ORIGINS?: string;
  MEDIA_BUCKET?: R2Bucket;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // API traffic is owned by Hono, full stop. We hand it the original
    // Request, env, and ctx — Hono knows about /api/health, /api/auth, etc.
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }

    // Everything else is a static asset request. Workers Static Assets
    // automatically returns index.html for unknown paths (SPA fallback),
    // so a missing file on disk is exactly what we want for client-side
    // routes like /dashboard, /members, /members/123, etc.
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Defensive fallback: if ASSETS somehow isn't bound (misconfigured
    // local dev), return a clear 503 instead of crashing.
    return new Response('Static assets are not configured.', { status: 503 });
  },
};