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

staffRoutes.get('/', requireGym, requireFeature('staff'), requirePermission('staff'), safeHandler(async (c) => {
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

  // Enforce staff limit before creating
  const licenseService = new LicenseService(ctx.env.DB, ctx.gymId!);
  const staffLimit = await licenseService.checkStaffLimit();
  if (!staffLimit.allowed) return jsonErr(staffLimit.reason ?? 'Staff limit reached', 403);

  const passwordHash = await hashPassword(parsed.data.password);
  const id = await userRepo.create({
    gymId: ctx.gymId!, name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone,
    passwordHash, isOwner: false,
    // Role assignment is by id only — the role's name/permissions live in `roles`.
    roleId: parsed.data.roleId ?? null,
    status: 'ACTIVE',
  });

  await auditGym(ctx, 'staff.create', 'user', id, {
    after: { email: parsed.data.email, roleId: parsed.data.roleId ?? null },
  });
  const created = await userRepo.findById(id);
  return jsonOk(created, 201);
}));

staffRoutes.delete('/:id', requireGym, requireFeature('staff'), requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  if (ctx.user?.id === id) return jsonErr('You cannot archive your own user account', 400);
  const userRepo = new UserRepository(ctx.env.DB);
  const before = await userRepo.findById(id);
  if (!before || before.gymId !== ctx.gymId!) return jsonErr('Staff member not found in this gym', 404);
  await userRepo.softDelete(id, ctx.gymId!);
  await auditGym(ctx, 'staff.soft_delete', 'user', id, { before, after: { id, email: before.email, role: before.role, status: 'ARCHIVED' } });
  return jsonOk({ success: true, message: 'Staff member archived successfully.' });
}));

staffRoutes.post('/:id/restore', requireGym, requireFeature('staff'), requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const userRepo = new UserRepository(ctx.env.DB);
  const success = await userRepo.restore(id, ctx.gymId!);
  if (!success) return jsonErr('Staff member not found in archive', 404);
  const restored = await userRepo.findById(id);
  await auditGym(ctx, 'staff.restore', 'user', id, { after: restored ? { id, email: restored.email, role: restored.role, status: restored.status } : { id } });
  return jsonOk({ success: true, message: 'Staff member restored successfully.' });
}));

staffRoutes.patch('/:id', requireGym, requireFeature('staff'), requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const userRepo = new UserRepository(ctx.env.DB);
  const before = await userRepo.findById(id);
  if (!before || before.gymId !== ctx.gymId!) return jsonErr('Staff member not found in this gym', 404);

  const body = await c.req.json().catch(() => ({}));
  const { name, phone, roleId, status } = body;

  const updateData: any = {};
  if (name !== undefined) updateData.name = String(name).trim();
  if (phone !== undefined) updateData.phone = phone ? String(phone).trim() : null;
  // Role changes are by id; assigning a role never writes a name onto the user.
  if (roleId !== undefined) updateData.roleId = roleId ? Number(roleId) : null;
  if (status !== undefined) updateData.status = status === 'DISABLED' ? 'DISABLED' : 'ACTIVE';

  await userRepo.updateStaff(id, ctx.gymId!, updateData);

  const after = await userRepo.findById(id);
  await auditGym(ctx, 'staff.update', 'user', id, { before, after });
  return jsonOk(after);
}));
