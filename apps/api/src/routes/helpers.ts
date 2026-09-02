// filepath: apps/api/src/routes/helpers.ts
/** Shared Hono response helpers used across route modules. */

import type { ZodError, ZodTypeAny, z } from 'zod';

// ============================================================
// Pagination
// ============================================================

/** Absolute maximum page size — protects DB from unbounded queries. */
export const MAX_PAGE_SIZE = 100;

/** Default page sizes by route tier. */
export const DEFAULT_PAGE_SIZE: Record<string, number> = {
  members: 50,
  payments: 50,
  audit: 50,
  default: 50,
};

/**
 * Parse and cap pagination query params.
 * - `limit`  → capped at MAX_PAGE_SIZE (100), minimum 1
 * - `offset` → minimum 0
 */
export function parsePageParams(
  rawLimit: string | undefined,
  rawOffset: string | undefined,
  tier = 'default',
): { limit: number; offset: number } {
  const defaultSize = DEFAULT_PAGE_SIZE[tier] ?? DEFAULT_PAGE_SIZE.default;
  const limit = Math.min(Math.max(1, parseInt(rawLimit || String(defaultSize), 10)), MAX_PAGE_SIZE);
  const offset = Math.max(0, parseInt(rawOffset || '0', 10));
  return { limit, offset };
}

/**
 * Build a paginated response envelope with `total` and `hasMore`.
 *
 * Usage in a route handler:
 *   const { limit, offset } = parsePageParams(limitRaw, offsetRaw, 'members');
 *   const { items, total } = await repo.list({ ..., limit, offset });
 *   return jsonPaginated(items, total, limit, offset);
 */
export function jsonPaginated<T>(
  items: T[],
  total: number,
  limit: number,
  offset: number,
  status = 200,
): Response {
  const hasMore = offset + items.length < total;
  return jsonOk({ items, total, limit, offset, hasMore }, status);
}

// ============================================================
// Zod validation helpers
// ============================================================

/**
 * Format a ZodError as a structured JSON body that surfaces every issue
 * (not just the first one) so clients can render field-level errors.
 */
export function jsonValidationErr(
  result: { success: false; error: ZodError },
  fallbackMessage = 'Invalid request payload'
): Response {
  const issues = result.error.issues.map((i) => ({
    path: i.path.join('.'),
    code: i.code,
    message: i.message,
  }));
  const firstMessage = issues[0]?.message ?? fallbackMessage;
  return new Response(
    JSON.stringify({
      error: firstMessage,
      code: 'VALIDATION_ERROR',
      issues,
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Convenience: parse-and-respond. Returns either the parsed data or a
 * pre-built 400 response. Use this in routes to drop a single line.
 *
 *   const parsed = parseOrFail(MySchema, body, c);
 *   if (parsed instanceof Response) return parsed;
 *   // use parsed.data
 */
export function parseOrFail<S extends ZodTypeAny>(
  schema: S,
  input: unknown,
  _c?: unknown,
  fallbackMessage?: string
): { success: true; data: z.infer<S> } | Response {
  const result = schema.safeParse(input);
  if (!result.success) return jsonValidationErr(result, fallbackMessage);
  return { success: true, data: result.data };
}

// ============================================================
// JSON responses
// ============================================================

export function jsonErr(message: string, status = 400, extra?: object | string): Response {
  const body: Record<string, unknown> = { error: message };
  if (extra && typeof extra === 'object') Object.assign(body, extra);
  else if (typeof extra === 'string') body.details = extra;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonOk(data: any, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (extraHeaders) {
    const extra = new Headers(extraHeaders);
    extra.forEach((value, key) => headers.append(key, value));
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function jsonCsv(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
