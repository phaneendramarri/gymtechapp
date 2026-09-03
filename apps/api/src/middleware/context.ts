// filepath: apps/api/src/middleware/context.ts
/**
 * Hono-native request context.
 *
 * Mirrors the existing `RequestContext` shape from the legacy NativeRouter
 * so existing services and repositories work without modification.
 */
import type { Context, MiddlewareHandler } from 'hono';
import type { SessionUser } from '@gymtech/shared';
import type { AppEnv } from '../app';
import type { Database } from '../db/client';

export interface RequestContext {
  env: AppEnv;
  /** Lazily-created Drizzle client backed by ctx.env.DB. Cached per request. */
  get db(): Database;
  user?: SessionUser;
  gymId?: number;
  params: Record<string, string>;
  query: URLSearchParams;
  url: URL;
  executionCtx?: ExecutionContext;
  requestId: string;
}

/**
 * Attach a RequestContext-compatible object to `c.var.ctx` so legacy
 * service classes can be invoked without modification.
 */
export const contextMiddleware: MiddlewareHandler<{
  Bindings: AppEnv;
  Variables: { requestId: string; ctx: RequestContext };
}> = async (c, next) => {
  // Lazy Drizzle client cached on env so it is created once per request.
  if (!c.env.drizzle) {
    const { createDatabase } = await import('../db/client');
    c.env.drizzle = createDatabase(c.env.DB);
  }

  // Use Object.create to satisfy the getter without a visible property
  const ctx = Object.create(Object.prototype, {
    env: { value: c.env, enumerable: true },
    params: { value: c.req.param() as Record<string, string>, enumerable: true },
    query: { value: c.req.queries() ? new URL(c.req.url).searchParams : new URLSearchParams(), enumerable: true },
    url: { value: new URL(c.req.url), enumerable: true },
    requestId: { value: c.get('requestId'), enumerable: true },
    db: { get() { return c.env.drizzle!; }, enumerable: true },
  }) as RequestContext;

  c.set('ctx', ctx);
  await next();
};

export function getCtx(c: Context): RequestContext {
  return c.get('ctx') as RequestContext;
}

export function setUser(c: Context, user: SessionUser, gymId?: number) {
  const ctx = getCtx(c);
  ctx.user = user;
  ctx.gymId = gymId;
}