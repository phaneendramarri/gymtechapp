// filepath: apps/api/src/routes/staff.routes.ts
import { Hono } from 'hono';
import { CreateStaffRequestSchema } from '@gymtech/shared';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { hashPassword } from '../lib/session';
import { UserRepository } from '../repositories/user.repository';
import { LicenseService } from '../services/license.service';
import { auditGymFromCtx } from '../services/audit.service';
import { jsonErr, jsonOk, jsonValidationErr } from './helpers';

export const staffRoutes = new Hono();

const auditGym = auditGymFromCtx;

staffRoutes.get('/', requireGym, requireFeature('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const userRepo = new UserRepository(ctx.env.DB);
  return jsonOk({ staff: await userRepo.listGymStaff(ctx.gymId!) });
}));

staffRoutes.post('/', requireGym, requireFeature('staff'), requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateStaffRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid staff payload');

  const userRepo = new UserRepository(ctx.env.DB);
  const existing = await userRepo.findByEmail(parsed.data.email);
  if (existing) return jsonErr('A user with this email already exists', 409);

  const passwordHash = await hashPassword(parsed.data.password);
  const id = await userRepo.create({
    gym_id: ctx.gymId!, name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone,
    password_hash: passwordHash, role: 'OWNER', // stored for rollback compat only; app reads is_owner + user_permissions
    permissions: JSON.stringify(parsed.data.permissions ?? []), status: 'ACTIVE',
  });

  // Insert explicit permission rows for the new user
  const permissions: string[] = parsed.data.permissions ?? [];
  if (permissions.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    for (const perm of permissions) {
      await ctx.env.DB
        .prepare(`INSERT OR IGNORE INTO user_permissions (user_id, permission_key, granted_by, granted_at) VALUES (?, ?, ?, ?)`)
        .bind(id, perm, ctx.user!.id, now)
        .run();
    }
  }

  await auditGym(ctx, 'staff.create', 'user', id, { after: { email: parsed.data.email, permissions } });
  const created = await userRepo.findById(id);
  return jsonOk(created, 201);
}));

staffRoutes.delete('/:id', requireGym, requireFeature('staff'), requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  if (ctx.user?.id === id) return jsonErr('You cannot archive your own user account', 400);
  const userRepo = new UserRepository(ctx.env.DB);
  const before = await userRepo.findById(id);
  if (!before || before.gym_id !== ctx.gymId!) return jsonErr('Staff member not found in this gym', 404);
  await userRepo.softDelete(id, ctx.gymId!);
  await auditGym(ctx, 'staff.soft_delete', 'user', id, { before });
  return jsonOk({ success: true, message: 'Staff member archived successfully.' });
}));

staffRoutes.post('/:id/restore', requireGym, requireFeature('staff'), requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const userRepo = new UserRepository(ctx.env.DB);
  const success = await userRepo.restore(id, ctx.gymId!);
  if (!success) return jsonErr('Staff member not found in archive', 404);
  await auditGym(ctx, 'staff.restore', 'user', id, {});
  return jsonOk({ success: true, message: 'Staff member restored successfully.' });
}));
