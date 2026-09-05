// filepath: apps/api/src/routes/admin/users.routes.ts
/**
 * Platform Admin: manage users across all gyms.
 * Can list all users, update roles, disable/enable accounts.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { requireSuperAdminMiddleware } from '../../middleware/auth';
import { getCtx } from '../../middleware/context';
import { safeHandler, paramId } from '../../middleware/params';
import { UserRepository } from '../../repositories/user.repository';
import { RoleRepository } from '../../repositories/role.repository';
import { SessionRepository } from '../../repositories/session.repository';
import { jsonErr, jsonOk } from '../helpers';

const UpdateUserRoleSchema = z.object({
  roleId: z.number().int().positive().nullable(),
});

const CreateUserSchema = z.object({
  gymId: z.number().int().positive(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  roleId: z.number().int().positive().optional(),
  password: z.string().min(8).optional(),
});

export const adminUserRoutes = new Hono();

// GET /admin/users — list all users across all gyms
adminUserRoutes.get('/', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const page = Math.max(1, Number(c.req.query('page') ?? 1));
  const limit = Math.min(100, Math.max(10, Number(c.req.query('limit') ?? 25)));
  const search = c.req.query('search') ?? undefined;
  const gymId = c.req.query('gymId');

  const userRepo = new UserRepository(ctx.db);
  const result = await userRepo.listAllPlatformUsers({
    page, limit, search, gymId: gymId ? Number(gymId) : undefined,
  });

  return jsonOk(result);
}));

// GET /admin/users/:id — get a single user
adminUserRoutes.get('/:id', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const userRepo = new UserRepository(ctx.db);
  const user = await userRepo.findByIdFull(id);
  if (!user) return jsonErr('User not found', 404);
  return jsonOk(user);
}));

// POST /admin/users — create a new user in a specific gym
adminUserRoutes.post('/', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) return jsonErr(parsed.error.message, 400);

  const userRepo = new UserRepository(ctx.db);
  const existing = await userRepo.findByEmail(parsed.data.email);
  if (existing) return jsonErr('A user with this email already exists', 409);

  const { hashPassword } = await import('../../lib/password');
  const passwordHash = await hashPassword(parsed.data.password ?? 'ChangeMe123!');

  const id = await userRepo.create({
    gymId: parsed.data.gymId,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    passwordHash,
    roleId: parsed.data.roleId ?? null,
    role: 'STAFF',
    status: 'ACTIVE',
    isOwner: false,
    permissions: '[]',
  });

  return jsonOk({ id }, 201);
}));

// PUT /admin/users/:id/role — reassign a user's role
adminUserRoutes.put('/:id/role', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateUserRoleSchema.safeParse(body);
  if (!parsed.success) return jsonErr('Invalid payload', 400);

  const userRepo = new UserRepository(ctx.db);
  const user = await userRepo.findByIdFull(id);
  if (!user) return jsonErr('User not found', 404);

  if (parsed.data.roleId !== null) {
    const roleRepo = new RoleRepository(ctx.db);
    const role = await roleRepo.findById(parsed.data.roleId);
    if (!role) return jsonErr('Role not found', 404);
  }

  // M-5: Revoke all sessions for this user so the new role takes effect immediately
  // rather than waiting for the 15-minute access token TTL.
  await userRepo.update(id, { roleId: parsed.data.roleId });
  const sessionRepo = new SessionRepository(ctx.db);
  await sessionRepo.revokeAllForUser(user.gymId, id);

  return jsonOk({ success: true });
}));

// PUT /admin/users/:id/disable — disable a user account
adminUserRoutes.put('/:id/disable', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const userRepo = new UserRepository(ctx.db);
  const user = await userRepo.findByIdFull(id);
  if (!user) return jsonErr('User not found', 404);

  await userRepo.update(id, { status: 'DISABLED' });
  const sessionRepo = new SessionRepository(ctx.db);
  await sessionRepo.revokeAllForUser(user.gymId, id);

  return jsonOk({ success: true });
}));

// PUT /admin/users/:id/enable — re-enable a user account
adminUserRoutes.put('/:id/enable', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const userRepo = new UserRepository(ctx.db);
  const user = await userRepo.findByIdFull(id);
  if (!user) return jsonErr('User not found', 404);

  await userRepo.update(id, { status: 'ACTIVE' });
  return jsonOk({ success: true });
}));

// GET /admin/users/:id/roles — list all available roles for this user's gym
adminUserRoutes.get('/:id/available-roles', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const userRepo = new UserRepository(ctx.db);
  const user = await userRepo.findByIdFull(id);
  if (!user) return jsonErr('User not found', 404);

  const roleRepo = new RoleRepository(ctx.db);
  const roles = await roleRepo.findByGymId(user.gymId);
  return jsonOk({ roles: roles.map((r) => ({ ...r, permissions: JSON.parse(r.permissions) })) });
}));
