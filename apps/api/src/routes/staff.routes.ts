// filepath: apps/api/src/routes/staff.routes.ts
import { Hono } from 'hono';
import { CreateStaffRequestSchema } from '@gymtech/shared';
import { requireGym, requireFeature, requireRole } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { hashPassword } from '../lib/session';
import { UserRepository } from '../repositories/user.repository';
import { LicenseService } from '../services/license.service';
import { auditGymFromCtx } from '../services/audit.service';
import { jsonErr, jsonOk } from './helpers';

export const staffRoutes = new Hono();

const auditGym = auditGymFromCtx;

staffRoutes.get('/', requireGym, requireFeature('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const userRepo = new UserRepository(ctx.env.DB);
  return jsonOk({ staff: await userRepo.listGymStaff(ctx.gymId!) });
}));

staffRoutes.post('/', requireGym, requireFeature('staff'), requireRole('OWNER'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateStaffRequestSchema.safeParse(body);
  if (!parsed.success) return jsonErr(parsed.error.errors[0]?.message || 'Invalid staff payload', 400);

  const userRepo = new UserRepository(ctx.env.DB);
  const existing = await userRepo.findByEmail(parsed.data.email);
  if (existing) return jsonErr('A user with this email already exists', 409);

  const licenseService = new LicenseService(ctx.env.DB, ctx.gymId!);
  if (parsed.data.role === 'MANAGER') {
    const limitCheck = await licenseService.checkManagerLimit();
    if (!limitCheck.allowed) return jsonErr(limitCheck.reason || 'Manager limit reached', 403);
  } else {
    const limitCheck = await licenseService.checkStaffLimit();
    if (!limitCheck.allowed) return jsonErr(limitCheck.reason || 'Staff limit reached', 403);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const id = await userRepo.create({
    gym_id: ctx.gymId!, name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone,
    password_hash: passwordHash, role: parsed.data.role,
    permissions: JSON.stringify(parsed.data.permissions ?? []), status: 'ACTIVE',
  });
  await auditGym(ctx, 'staff.create', 'user', id, { after: { role: parsed.data.role, email: parsed.data.email } });
  const created = await userRepo.findById(id);
  return jsonOk(created, 201);
}));

staffRoutes.delete('/:id', requireGym, requireFeature('staff'), requireRole('OWNER'), safeHandler(async (c) => {
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

staffRoutes.post('/:id/restore', requireGym, requireFeature('staff'), requireRole('OWNER'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const userRepo = new UserRepository(ctx.env.DB);
  const licenseService = new LicenseService(ctx.env.DB, ctx.gymId!);
  const limitCheck = await licenseService.checkStaffLimit();
  if (!limitCheck.allowed) return jsonErr(`Cannot restore staff member: ${limitCheck.reason}`, 403);
  const success = await userRepo.restore(id, ctx.gymId!);
  if (!success) return jsonErr('Staff member not found in archive', 404);
  await auditGym(ctx, 'staff.restore', 'user', id, {});
  return jsonOk({ success: true, message: 'Staff member restored successfully.' });
}));