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

export interface RequestContext {
  env: AppEnv;
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
  const ctx: RequestContext = {
    env: c.env,
    params: c.req.param() as Record<string, string>,
    query: c.req.queries() ? new URL(c.req.url).searchParams : new URLSearchParams(),
    url: new URL(c.req.url),
    requestId: c.get('requestId'),
  };
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