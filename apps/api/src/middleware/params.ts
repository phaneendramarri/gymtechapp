// filepath: apps/api/src/middleware/params.ts
import type { Context } from 'hono';
import type { AppEnv } from '../app';
import type { RequestContext } from './context';

export function paramId(params: Record<string, string>): number {
  const raw = (params.id ?? '').trim();
  // Strict: reject "12abc", "0x10", "", "-3" — parseInt would silently
  // coerce trailing-garbage/hex strings into wrong ids.
  if (!/^\d+$/.test(raw)) {
    throw jsonError('Invalid id parameter', 400);
  }
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw jsonError('Invalid id parameter', 400);
  }
  return id;
}

import { jsonError } from '../lib/roles';
export { jsonError };

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
      // Never expose raw error internals (Drizzle/SQL messages, stacks) to
      // clients — log server-side and return a generic envelope instead.
      console.error('Handler error:', e);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}