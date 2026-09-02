// filepath: apps/api/src/middleware/params.ts
import type { Context } from 'hono';
import type { AppEnv } from '../app';
import type { RequestContext } from './context';

export function paramId(params: Record<string, string>): number {
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw jsonError('Invalid id parameter', 400);
  }
  return id;
}

export function jsonError(message: string, status = 400, extra?: object | string): Response {
  const body: Record<string, unknown> = { error: message };
  if (extra && typeof extra === 'object') Object.assign(body, extra);
  else if (typeof extra === 'string') body.details = extra;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export type ApiContext = Context<{ Bindings: AppEnv; Variables: { requestId: string; ctx: RequestContext } }>;

/**
 * Wrap a route handler so thrown `Response` objects (e.g. from `paramId`)
 * are caught and returned, instead of crashing the worker. Typed against
 * the Hono `Context` so route code gets full type inference.
 */
export function safeHandler(
  handler: (c: ApiContext) => Promise<Response>
): (c: Context) => Promise<Response> {
  return async (c) => {
    try {
      return await handler(c as unknown as ApiContext);
    } catch (e: any) {
      if (e instanceof Response) return e;
      console.error('Handler error:', e);
      return new Response(JSON.stringify({ error: e?.message || 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}