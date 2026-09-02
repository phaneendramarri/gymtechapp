// filepath: apps/api/src/routes/plans.routes.ts
import { Hono } from 'hono';
import { CreatePlanRequestSchema, GymMembershipPlan } from '@gymtech/shared';
import { requireGym, requireFeature, requireRole } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { PlanRepository } from '../repositories/plan.repository';
import { auditGymFromCtx } from '../services/audit.service';
import { jsonErr, jsonOk } from './helpers';

export const planRoutes = new Hono();

const auditGym = auditGymFromCtx;

planRoutes.get('/', requireGym, requireFeature('plans'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const planRepo = new PlanRepository(ctx.env.DB, ctx.gymId!);
  return jsonOk({ plans: await planRepo.listAll() });
}));

planRoutes.post('/', requireGym, requireFeature('plans'), requireRole('OWNER'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreatePlanRequestSchema.safeParse(body);
  if (!parsed.success) return jsonErr(parsed.error.errors[0]?.message || 'Invalid plan payload', 400);

  const planRepo = new PlanRepository(ctx.env.DB, ctx.gymId!);
  const id = await planRepo.create({
    name: parsed.data.name, description: parsed.data.description ?? null,
    duration_months: parsed.data.durationMonths, price_paise: parsed.data.pricePaise,
    admission_fee_paise: parsed.data.admissionFeePaise, tax_percentage: parsed.data.taxPercentage,
    is_active: 1, deleted_at: null,
  });
  const created = await planRepo.findById(id);
  await auditGym(ctx, 'plan.create', 'membership_plan', id, { after: created });
  return jsonOk(created, 201);
}));

planRoutes.put('/:id', requireGym, requireFeature('plans'), requireRole('OWNER'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const planRepo = new PlanRepository(ctx.env.DB, ctx.gymId!);
  const before = await planRepo.findById(id);
  if (!before) return jsonErr('Plan not found', 404);
  await planRepo.update(id, body as Partial<GymMembershipPlan>);
  const after = await planRepo.findById(id);
  await auditGym(ctx, 'plan.update', 'membership_plan', id, { before, after });
  return jsonOk(after);
}));

planRoutes.delete('/:id', requireGym, requireFeature('plans'), requireRole('OWNER'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const planRepo = new PlanRepository(ctx.env.DB, ctx.gymId!);
  const before = await planRepo.findById(id);
  if (!before) return jsonErr('Plan not found or already archived', 404);
  await planRepo.softDelete(id);
  await auditGym(ctx, 'plan.soft_delete', 'membership_plan', id, { before });
  return jsonOk({ success: true, message: 'Plan archived successfully.' });
}));

planRoutes.post('/:id/restore', requireGym, requireFeature('plans'), requireRole('OWNER'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const planRepo = new PlanRepository(ctx.env.DB, ctx.gymId!);
  const success = await planRepo.restore(id);
  if (!success) return jsonErr('Plan not found in archive', 404);
  await auditGym(ctx, 'plan.restore', 'membership_plan', id, {});
  return jsonOk({ success: true, message: 'Plan restored successfully.' });
}));