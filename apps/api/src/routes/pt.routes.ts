// filepath: apps/api/src/routes/pt.routes.ts
/**
 * PT (personal-training) routes — HTTP boundary only.
 *
 * Validates, authorizes, and shapes responses. All `pt_collections` SQL lives
 * in PtRepository; receipt numbers come from PaymentRepository.
 */
import { Hono } from 'hono';
import type { SessionUser } from '@gymtech/shared';
import {
  RecordPtCollectionRequestSchema,
  SettlePtCommissionRequestSchema,
  CreatePtPackageRequestSchema,
  LogPtSessionRequestSchema,
} from '@gymtech/shared';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { isMemberSession, isPtTrainer } from '../lib/roles';
import { safeHandler, paramId } from '../middleware/params';
import { calculatePtCommission } from '../lib/calculations';
import { MemberRepository } from '../repositories/member.repository';
import { PtRepository } from '../repositories/pt.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { auditGymFromCtx } from '../services/audit.service';
import { jsonErr, jsonOk, jsonValidationErr } from './helpers';

export const ptRoutes = new Hono();

/**
 * `trainerId` filter for the PT ledger: a trainer only ever sees their own
 * collections, any other staff account may filter via `?trainerId=`.
 * (Members cannot reach the ledger routes at all — they require the
 * `pt_collections` permission, which no member holds.)
 */
function ledgerTrainerId(user: SessionUser, query?: string): number | null {
  if (isPtTrainer(user)) return user.id;
  return query ? parseInt(query, 10) : null;
}

ptRoutes.get('/collections', requireGym, requireFeature('pt_collections'), requirePermission('pt_collections'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const trainerId = ledgerTrainerId(ctx.user!, c.req.query('trainerId'));
  const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 500);

  const ptRepo = new PtRepository(ctx.env.DB);
  const collections = await ptRepo.listForGym(ctx.gymId!, trainerId, limit);
  return jsonOk({ collections });
}));

ptRoutes.get('/summary', requireGym, requireFeature('pt_collections'), requirePermission('pt_collections'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const isTrainer = isPtTrainer(ctx.user);
  const canSeeAll = ctx.user!.permissions?.includes('*') || ctx.user!.permissions?.includes('reports');
  if (!canSeeAll && !isTrainer) {
    return jsonOk({ totalCollected: 0, totalCommissionPending: 0, totalCommissionPaid: 0, byTrainer: [] });
  }
  // A trainer's summary always covers their own collections only.
  const trainerId = isTrainer ? ctx.user!.id : null;

  const ptRepo = new PtRepository(ctx.env.DB);
  const [totals, byTrainer] = await Promise.all([
    ptRepo.summaryFor(ctx.gymId!, trainerId),
    ptRepo.summaryByTrainer(ctx.gymId!, trainerId),
  ]);

  return jsonOk({
    totalCollected: totals.totalCollected,
    totalCommissionPending: totals.totalCommissionPending,
    totalCommissionPaid: totals.totalCommissionPaid,
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
    { after: { amountPaise: parsed.data.amountPaise, commissionPaise } }
  );

  return jsonOk({ id, receiptNumber, commissionPaise }, 201);
}));

ptRoutes.post('/collections/:id/settle', requireGym, requireFeature('pt_collections'), requirePermission('pt_collections'), safeHandler(async (c) => {
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

  // Member portal: the session's own id IS the member id, so the query is
  // pinned to it and `?memberId=`/`?trainerId=` are ignored. Without this the
  // member was treated as a trainer ("not an owner, no staff permission") and
  // their package list was filtered by trainerUserId — always empty.
  const packages = isMemberSession(ctx.user)
    ? await new PtRepository(ctx.env.DB).listPackages(ctx.gymId!, ctx.user!.id, undefined)
    : await new PtRepository(ctx.env.DB).listPackages(
        ctx.gymId!,
        c.req.query('memberId') ? parseInt(c.req.query('memberId')!, 10) : undefined,
        isPtTrainer(ctx.user)
          ? ctx.user!.id
          : (c.req.query('trainerId') ? parseInt(c.req.query('trainerId')!, 10) : undefined)
      );

  return jsonOk({ packages });
}));

ptRoutes.post('/packages', requireGym, requireFeature('pt_collections'), requirePermission('pt_collections'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreatePtPackageRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid PT package payload');

  // Tenant isolation: both member and trainer must belong to this gym (the
  // table FKs are single-column, so they cannot enforce this themselves).
  const memberRepo = new MemberRepository(ctx.env.DB, ctx.gymId!);
  const member = await memberRepo.findById(parsed.data.memberId);
  if (!member) return jsonErr('Member not found in this gym', 404);

  const ptRepo = new PtRepository(ctx.env.DB);
  const trainer = await ptRepo.findUserInGym(parsed.data.trainerId, ctx.gymId!);
  if (!trainer) return jsonErr('Trainer not found in this gym', 404);

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
  // Member portal sessions read only their own log — the session id is the
  // member id, and `?memberId=` cannot widen it to another member's history.
  const memberId = isMemberSession(ctx.user)
    ? ctx.user!.id
    : (c.req.query('memberId') ? parseInt(c.req.query('memberId')!, 10) : undefined);

  const ptRepo = new PtRepository(ctx.env.DB);
  const sessions = await ptRepo.listSessions(ctx.gymId!, packageId, memberId);
  return jsonOk({ sessions });
}));

ptRoutes.post('/sessions', requireGym, requireFeature('pt_collections'), requirePermission('pt_collections'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = LogPtSessionRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid PT session payload');

  const ptRepo = new PtRepository(ctx.env.DB);
  const pkg: any = await ptRepo.findPackageById(parsed.data.packageId, ctx.gymId!);
  if (!pkg) return jsonErr('PT package not found', 404);
  const completedSessions = Number(pkg.completedSessions ?? 0);
  const totalSessions = Number(pkg.totalSessions ?? 0);
  if (completedSessions >= totalSessions) {
    return jsonErr('This PT package has no remaining sessions', 400);
  }

  const id = await ptRepo.logSession({
    gymId: ctx.gymId!,
    packageId: pkg.id,
    memberId: pkg.memberId,
    trainerId: pkg.trainerUserId,
    sessionDate: parsed.data.sessionDate,
    sessionNotes: parsed.data.sessionNotes,
    feedback: parsed.data.feedback,
    recordedByUserId: ctx.user!.id,
  });

  await auditGymFromCtx(c, 'pt_session.log', 'pt_session', id, { after: parsed.data });
  return jsonOk({ id, remainingSessions: totalSessions - (completedSessions + 1) }, 201);
}));
