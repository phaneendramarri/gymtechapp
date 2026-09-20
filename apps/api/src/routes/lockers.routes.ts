import { Hono } from 'hono';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { jsonOk, jsonErr, jsonValidationErr } from './helpers';
import { LockerRepository } from '../repositories/locker.repository';
import { CreateLockerRequestSchema, AllocateLockerRequestSchema } from '@gymtech/shared';

export const lockersRoutes = new Hono();

// GET /api/lockers — list all lockers with allocation status
lockersRoutes.get('/', requireGym, requireFeature('lockers'), requirePermission('lockers'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const repo = new LockerRepository(ctx.env.DB);
  const items = await repo.listLockers(ctx.gymId!);
  return jsonOk({ lockers: items });
}));

// POST /api/lockers — add a physical locker unit
lockersRoutes.post('/', requireGym, requireFeature('lockers'), requirePermission('lockers'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateLockerRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid locker payload');

  const repo = new LockerRepository(ctx.env.DB);
  const id = await repo.createLocker(ctx.gymId!, parsed.data);
  return jsonOk({ id, ...parsed.data }, 201);
}));

// DELETE /api/lockers/:id — delete locker
lockersRoutes.delete('/:id', requireGym, requireFeature('lockers'), requirePermission('lockers'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const repo = new LockerRepository(ctx.env.DB);
  await repo.deleteLocker(ctx.gymId!, id);
  return jsonOk({ success: true });
}));

// POST /api/lockers/allocate — rent locker to a member
lockersRoutes.post('/allocate', requireGym, requireFeature('lockers'), requirePermission('lockers'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = AllocateLockerRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid allocation payload');

  const repo = new LockerRepository(ctx.env.DB);
  let id: number;
  try {
    id = await repo.allocateLocker(ctx.gymId!, parsed.data);
  } catch (e: any) {
    if (e.message === 'Locker is already occupied') return jsonErr('This locker is already occupied', 409);
    throw e;
  }
  return jsonOk({ id, ...parsed.data }, 201);
}));

// POST /api/lockers/allocations/:id/terminate — release locker
lockersRoutes.post('/allocations/:id/terminate', requireGym, requireFeature('lockers'), requirePermission('lockers'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const allocationId = paramId(c.req.param() as Record<string, string>);
  const repo = new LockerRepository(ctx.env.DB);
  await repo.terminateAllocation(ctx.gymId!, allocationId);
  return jsonOk({ success: true });
}));
