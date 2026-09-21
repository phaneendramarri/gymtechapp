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
 * Non-numeric input falls back to the tier default (parseInt('abc') is
 * NaN, which would otherwise propagate into the DB query as NaN).
 */
export function parsePageParams(
  rawLimit: string | undefined,
  rawOffset: string | undefined,
  tier = 'default',
): { limit: number; offset: number } {
  const defaultSize = DEFAULT_PAGE_SIZE[tier] ?? DEFAULT_PAGE_SIZE.default;
  const parsedLimit = parseInt(rawLimit || String(defaultSize), 10);
  const parsedOffset = parseInt(rawOffset || '0', 10);
  const limit = Math.min(Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : defaultSize), MAX_PAGE_SIZE);
  const offset = Math.max(0, Number.isFinite(parsedOffset) ? parsedOffset : 0);
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
  return jsonOk({ items, members: items, total, limit, offset, hasMore }, status);
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

/**
 * Strict-parse an optional integer query param (timestamps, limits).
 * Non-numeric input (including '' and '12abc', which parseInt would silently
 * coerce) falls back instead of propagating NaN into DB queries.
 */
export function parseQueryInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return fallback;
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Strict-parse an optional integer id query param (`?memberId=`, `?trainerId=`).
 * Returns undefined when absent; throws a 400 Response (caught by
 * safeHandler, same contract as paramId) when present but invalid — so a
 * garbage filter can never silently widen into an unfiltered query.
 */
export function queryId(raw: string | undefined, name: string): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw jsonErr(`Invalid ${name} parameter`, 400);
  }
  const parsed = parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw jsonErr(`Invalid ${name} parameter`, 400);
  }
  return parsed;
}

/**
 * Sanitize a caught error into a client-safe message.
 *
 * Service-layer business errors (validation, not-found, state conflicts)
 * are safe to surface; ORM/driver internals (Drizzle "Failed query …" +
 * SQL text, SQLITE_* codes, stack fragments) must never reach the browser.
 * Unknown errors are logged server-side and replaced with `fallback`.
 */
export function toSafeErrorMessage(e: unknown, fallback: string): string {
  const raw = e instanceof Error ? e.message : String(e ?? '');
  if (!raw) return fallback;
  if (
    /failed query|drizzle|sqlite|D1_ERROR|syntax error|database error|UNIQUE constraint failed|PRIMARY KEY|FOREIGN KEY|no such (table|column)|bind parameter/i.test(
      raw
    )
  ) {
    console.error('Sanitized internal error:', raw.slice(0, 500));
    if (/UNIQUE constraint failed|PRIMARY KEY.*exists|already exists/i.test(raw)) {
      return 'A record with these details already exists.';
    }
    return fallback;
  }
  return raw;
}

export function jsonOk(
  data: any,
  status = 200,
  extraHeaders?: HeadersInit | Record<string, string | string[]>,
  cookies?: string[]
): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (extraHeaders) {
    if (Array.isArray(extraHeaders)) {
      for (const [key, value] of extraHeaders) {
        headers.append(key, value);
      }
    } else if (extraHeaders instanceof Headers) {
      extraHeaders.forEach((value, key) => headers.append(key, value));
    } else {
      for (const [key, value] of Object.entries(extraHeaders)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            headers.append(key, v);
          }
        } else if (value !== undefined && value !== null) {
          headers.append(key, String(value));
        }
      }
    }
  }
  if (cookies) {
    for (const c of cookies) {
      headers.append('Set-Cookie', c);
    }
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
