// filepath: apps/api/src/routes/pt.routes.ts
/**
 * PT (personal-training) routes — HTTP boundary only.
 *
 * Validates, authorizes, and shapes responses. All `pt_collections` SQL lives
 * in PtRepository; receipt numbers come from PaymentRepository.
 */
import { Hono } from 'hono';
import {
  RecordPtCollectionRequestSchema,
  SettlePtCommissionRequestSchema,
  CreatePtPackageRequestSchema,
  LogPtSessionRequestSchema,
} from '@gymtech/shared';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { calculatePtCommission } from '../lib/calculations';
import { MemberRepository } from '../repositories/member.repository';
import { PtRepository } from '../repositories/pt.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { auditGymFromCtx } from '../services/audit.service';
import { jsonErr, jsonOk, jsonValidationErr } from './helpers';

export const ptRoutes = new Hono();

ptRoutes.get('/collections', requireGym, requireFeature('pt_collections'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const isTrainer = !ctx.user!.isOwner && !ctx.user!.permissions?.includes('staff');
  const trainerId = isTrainer
    ? ctx.user!.id
    : (c.req.query('trainerId') ? parseInt(c.req.query('trainerId')!, 10) : null);
  const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 500);

  const ptRepo = new PtRepository(ctx.env.DB);
  const collections = await ptRepo.listForGym(ctx.gymId!, trainerId, limit);
  return jsonOk({ collections });
}));

ptRoutes.get('/summary', requireGym, requireFeature('pt_collections'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const canSeeAll = ctx.user!.permissions?.includes('*') || ctx.user!.permissions?.includes('reports');
  if (!canSeeAll) {
    return jsonOk({ totalCollected: 0, totalCommissionPending: 0, totalCommissionPaid: 0, byTrainer: [] });
  }
  const isTrainer = !ctx.user!.isOwner && !ctx.user!.permissions?.includes('staff');
  const trainerId = isTrainer ? ctx.user!.id : null;

  const ptRepo = new PtRepository(ctx.env.DB);
  const [totals, byTrainer] = await Promise.all([
    ptRepo.summaryFor(ctx.gymId!, trainerId),
    ptRepo.summaryByTrainer(ctx.gymId!, trainerId),
  ]);

  return jsonOk({
    totalCollected: totals.totalCollected,
    totalCommissionPending: totals.commissionPending,
    totalCommissionPaid: totals.commissionPaid,
    byTrainer,
  });
}));

ptRoutes.post('/collections', requireGym, requireFeature('pt_collections'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = RecordPtCollectionRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid PT collection payload');

  const memberRepo = new MemberRepository(ctx.env.DB, ctx.gymId!);
  const member = await memberRepo.findById(parsed.data.memberId);
  if (!member) return jsonErr('Member not found', 404);

  const trainerId = (!ctx.user!.permissions?.includes('*') && !ctx.user!.permissions?.includes('staff'))
    ? ctx.user!.id
    : parsed.data.trainerId;
  const ptRepo = new PtRepository(ctx.env.DB);
  const trainer = await ptRepo.findUserInGym(trainerId, ctx.gymId!);
  if (!trainer) return jsonErr('Trainer not found in this gym', 404);

  const commissionPaise = calculatePtCommission(parsed.data.amountPaise, parsed.data.commissionPercentage);
  const paymentDate = parsed.data.paymentDate
    ? Math.floor(new Date(parsed.data.paymentDate).getTime() / 1000)
    : Math.floor(Date.now() / 1000);
  const receiptNumber = await new PaymentRepository(ctx.env.DB, ctx.gymId!).getNextReceiptNumber();

  const id = await ptRepo.create({
    gymId: ctx.gymId!,
    memberId: parsed.data.memberId,
    trainerId,
    sessions: parsed.data.sessions,
    amountPaise: parsed.data.amountPaise,
    commissionPercentage: parsed.data.commissionPercentage,
    commissionPaise,
    paymentMode: parsed.data.paymentMode,
    paymentDate,
    receiptNumber,
    notes: parsed.data.notes ?? null,
    recordedByUserId: ctx.user!.id,
  });

  await auditGymFromCtx(
    c,
    'pt_collection.create',
    'pt_collection',
    id,
    { after: { amount_paise: parsed.data.amountPaise, commission_paise: commissionPaise } }
  );

  return jsonOk({ id, receiptNumber, commissionPaise }, 201);
}));

ptRoutes.post('/collections/:id/settle', requireGym, requirePermission('pt_collections'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = SettlePtCommissionRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid settlement payload');

  const ptRepo = new PtRepository(ctx.env.DB);
  const existing = await ptRepo.findByIdInGym(id, ctx.gymId!);
  if (!existing) return jsonErr('PT collection not found', 404);

  await ptRepo.settleCommission(id, ctx.gymId!, parsed.data.status);

  await auditGymFromCtx(
    c,
    'pt_collection.settle',
    'pt_collection',
    id,
    { after: { status: parsed.data.status } }
  );

  return jsonOk({ success: true, id, status: parsed.data.status });
}));

// --- Packages & Sessions ---

ptRoutes.get('/packages', requireGym, requireFeature('pt_collections'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const memberId = c.req.query('memberId') ? parseInt(c.req.query('memberId')!, 10) : undefined;
  const isTrainer = !ctx.user!.isOwner && !ctx.user!.permissions?.includes('staff');
  const trainerId = isTrainer
    ? ctx.user!.id
    : (c.req.query('trainerId') ? parseInt(c.req.query('trainerId')!, 10) : undefined);

  const ptRepo = new PtRepository(ctx.env.DB);
  const packages = await ptRepo.listPackages(ctx.gymId!, memberId, trainerId);
  return jsonOk({ packages });
}));

ptRoutes.post('/packages', requireGym, requirePermission('pt_collections'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreatePtPackageRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid PT package payload');

  const ptRepo = new PtRepository(ctx.env.DB);
  const id = await ptRepo.createPackage({
    gymId: ctx.gymId!,
    memberId: parsed.data.memberId,
    trainerId: parsed.data.trainerId,
    packageName: parsed.data.packageName,
    totalSessions: parsed.data.totalSessions,
    amountPaise: parsed.data.amountPaise,
    startDate: parsed.data.startDate,
    expiryDate: parsed.data.expiryDate,
    notes: parsed.data.notes,
  });

  await auditGymFromCtx(c, 'pt_package.create', 'pt_package', id, { after: parsed.data });
  return jsonOk({ id }, 201);
}));

ptRoutes.get('/sessions', requireGym, requireFeature('pt_collections'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const packageId = c.req.query('packageId') ? parseInt(c.req.query('packageId')!, 10) : undefined;
  const memberId = c.req.query('memberId') ? parseInt(c.req.query('memberId')!, 10) : undefined;

  const ptRepo = new PtRepository(ctx.env.DB);
  const sessions = await ptRepo.listSessions(ctx.gymId!, packageId, memberId);
  return jsonOk({ sessions });
}));

ptRoutes.post('/sessions', requireGym, requirePermission('pt_collections'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = LogPtSessionRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid PT session payload');

  const ptRepo = new PtRepository(ctx.env.DB);
  const pkg = await ptRepo.findPackageById(parsed.data.packageId, ctx.gymId!);
  if (!pkg) return jsonErr('PT package not found', 404);
  if (pkg.used_sessions >= pkg.total_sessions) {
    return jsonErr('This PT package has no remaining sessions', 400);
  }

  const id = await ptRepo.logSession({
    gymId: ctx.gymId!,
    packageId: pkg.id,
    memberId: pkg.member_id,
    trainerId: pkg.trainer_id,
    sessionDate: parsed.data.sessionDate,
    sessionNotes: parsed.data.sessionNotes,
    feedback: parsed.data.feedback,
    recordedByUserId: ctx.user!.id,
  });

  await auditGymFromCtx(c, 'pt_session.log', 'pt_session', id, { after: parsed.data });
  return jsonOk({ id, remainingSessions: pkg.total_sessions - (pkg.used_sessions + 1) }, 201);
}));
