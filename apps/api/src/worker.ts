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
import scheduledHandlers, { type ScheduledEvent } from './scheduled';

export interface WorkerEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  APP_ENV?: string;
  CORS_ORIGINS?: string;
  /** @deprecated R2 binding — kept for backward compat, not used by current routes. */
  MEDIA_BUCKET?: R2Bucket;
  /** @deprecated Resend is legacy — MSG91 is the supported email provider. */
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  // MSG91 — Email + SMS + WhatsApp through one account.
  MSG91_AUTH_KEY?: string;
  MSG91_SENDER_ID?: string;
  MSG91_EMAIL_FROM?: string;
  MSG91_WA_NUMBER?: string;
  MSG91_SMS_FLOW_ID?: string;
  MSG91_WHATSAPP_TEMPLATE?: string;
  MSG91_WHATSAPP_LANGUAGE?: string;
  APP_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
  // Filebase (S3-compatible) — media storage
  FILEBASE_ENDPOINT?: string;
  FILEBASE_REGION?: string;
  FILEBASE_BUCKET?: string;
  FILEBASE_ACCESS_KEY_ID?: string;
  FILEBASE_SECRET_ACCESS_KEY?: string;
  // Workers KV bindings
  RATELIMIT_KV?: KVNamespace;
  DENYLIST_KV?: KVNamespace;
  // Biometric encryption key
  FACE_EMBEDDING_KEY?: string;
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
    // serves files directly. For SPA client-side routes (e.g. /login,
    // /dashboard), if the file isn't found (404), fall back to /index.html.
    if (env.ASSETS) {
      const res = await env.ASSETS.fetch(request);
      if (res.status === 404) {
        const indexUrl = new URL('/index.html', request.url);
        return env.ASSETS.fetch(new Request(indexUrl, request));
      }
      return res;
    }

    // Defensive fallback: if ASSETS somehow isn't bound (misconfigured
    // local dev), return a clear 503 instead of crashing.
    return new Response('Static assets are not configured.', { status: 503 });
  },

  // Cloudflare Workers Cron Trigger — runs hourly and daily jobs
  // (license expiry sweep, PT-freeze expiry, comms retention purge).
  async scheduled(event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    return scheduledHandlers.scheduled(event, env, ctx);
  },
};