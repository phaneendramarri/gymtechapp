// filepath: apps/api/src/routes/helpers.ts
/** Shared Hono response helpers used across route modules. */

export function jsonErr(message: string, status = 400, extra?: object | string): Response {
  const body: Record<string, unknown> = { error: message };
  if (extra && typeof extra === 'object') Object.assign(body, extra);
  else if (typeof extra === 'string') body.details = extra;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonOk(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonCsv(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}