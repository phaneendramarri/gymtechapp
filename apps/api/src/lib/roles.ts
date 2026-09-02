// filepath: apps/api/src/lib/roles.ts
/**
 * Pure role check helpers — kept outside `middleware/auth.ts` so unit tests
 * can import them without triggering the Hono/Vite-node module export quirk
 * that silently drops `export function` declarations matching a certain
 * pattern.
 */
import type { SessionUser, UserRole } from '@gymtech/shared';

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  const body: Record<string, unknown> = { error: message };
  if (extra) Object.assign(body, extra);
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function checkRole(
  ctx: { user?: SessionUser | null },
  allowed: UserRole[]
) {
  if (!ctx.user) return jsonError('Authentication required', 401);
  if (ctx.user.role === 'PLATFORM_ADMIN') return null;
  if (!allowed.includes(ctx.user.role)) {
    return jsonError(
      `Access denied. Role "${ctx.user.role}" does not have permission for this action.`,
      403
    );
  }
  return null;
}