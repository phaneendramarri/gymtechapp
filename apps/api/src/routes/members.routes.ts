// filepath: apps/api/src/routes/members.routes.ts
import { Hono } from 'hono';
import {
  CreateMemberRequestSchema,
  UpdateMemberRequestSchema,
  BulkImportMembersRequestSchema,
  RenewMembershipRequestSchema,
  FreezeMemberRequestSchema,
} from '@gymtech/shared';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';

import { MemberRepository } from '../repositories/member.repository';
import { PlanRepository } from '../repositories/plan.repository';
import { MemberService } from '../services/member.service';
import { LicenseService } from '../services/license.service';
import { EmailService } from '../services/email.service';
import { auditGymFromCtx } from '../services/audit.service';
import { encryptFaceEmbedding, decryptFaceEmbedding } from '../lib/crypto';
import { jsonErr, jsonOk, jsonValidationErr, parsePageParams, jsonPaginated, toSafeErrorMessage } from './helpers';
import { loadPlatformMsg91 } from '../lib/msg91';

export const memberRoutes = new Hono();

const auditGym = auditGymFromCtx;

// ----- List members -----
memberRoutes.get('/', requireGym, requireFeature('members'), requirePermission('members'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const search = c.req.query('search') || undefined;
  const status = c.req.query('status') || undefined;
  const summaryOnly = c.req.query('summary') === 'true';
  const { limit, offset } = parsePageParams(c.req.query('limit'), c.req.query('offset'), 'members');
  const memberRepo = new MemberRepository(ctx.env.DB, ctx.gymId!);

  if (summaryOnly) {
    // L8: Return only summary counts — single query instead of double-fetch
    const now = Math.floor(Date.now() / 1000);
    const sevenDays = now + 7 * 24 * 3600;
    const counts = await memberRepo.countSummary({ now, sevenDays });
    return jsonOk({ counts });
  }

  const [members, total] = await Promise.all([
    memberRepo.list({ search, status, limit, offset }),
    memberRepo.countTotal({ search, status }),
  ]);

  if (ctx.env.FACE_EMBEDDING_KEY) {
    for (const m of members) {
      if (m.faceEmbedding) {
        try {
          m.faceEmbedding = await decryptFaceEmbedding(m.faceEmbedding, ctx.env as unknown as Record<string, string | undefined>);
        } catch {
          // Fall back to stored value if unencrypted or legacy
        }
      }
    }
  }

  return jsonPaginated(members, total, limit, offset);
}));

// ----- Create member -----
memberRoutes.post('/', requireGym, requireFeature('members'), requirePermission('members'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: { name: string } };
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateMemberRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid member data');

  const memberService = new MemberService(ctx.env.DB, ctx.gymId!, ctx.user!.id, tenant.gym.name, ctx.env as unknown as Record<string, string | undefined>);
  try {
    // Phase 4.2: encrypt face embedding before storing
    let encryptedFaceEmbedding: string | undefined;
    if (parsed.data.faceEmbedding) {
      if (ctx.env.FACE_EMBEDDING_KEY) {
        encryptedFaceEmbedding = await encryptFaceEmbedding(parsed.data.faceEmbedding, ctx.env as unknown as Record<string, string | undefined>);
      } else {
        encryptedFaceEmbedding = parsed.data.faceEmbedding;
      }
    }
    const result = await memberService.createMemberWithPlan({
      firstName: parsed.data.firstName, lastName: parsed.data.lastName, phone: parsed.data.phone,
      email: parsed.data.email && parsed.data.email.length > 0 ? parsed.data.email : undefined,
      gender: parsed.data.gender,
      dateOfBirth: parsed.data.dateOfBirth ? Math.floor(new Date(parsed.data.dateOfBirth).getTime() / 1000) : undefined,
      joinedDate: parsed.data.joinedDate ? Math.floor(new Date(parsed.data.joinedDate).getTime() / 1000) : undefined,
      photoUrl: parsed.data.photoUrl, faceEmbedding: encryptedFaceEmbedding,
      address: parsed.data.address, city: parsed.data.city, pincode: parsed.data.pincode,
      emergencyContactName: parsed.data.emergencyContactName, emergencyContactPhone: parsed.data.emergencyContactPhone,
      healthNotes: parsed.data.healthNotes, planId: parsed.data.planId,
      discountPaise: parsed.data.discountPaise, initialPaymentPaise: parsed.data.initialPaymentPaise,
      paymentMode: parsed.data.paymentMode, referenceId: parsed.data.referenceId,
    });

    if (parsed.data.email) {
      try {
        const planRepo = new PlanRepository(ctx.env.DB, ctx.gymId!);
        const plan = parsed.data.planId ? await planRepo.findById(parsed.data.planId) : null;
        const emailService = new EmailService(ctx.env, await loadPlatformMsg91(ctx.env.DB));
        await emailService.sendWelcomeEmail({
          to: parsed.data.email,
          name: `${result.member.firstName} ${result.member.lastName || ''}`.trim(),
          gymName: tenant.gym.name, memberCode: result.member.memberCode,
          planName: plan?.name ?? 'Active Membership',
        });
      } catch (e: any) { console.warn('Welcome email failed:', e.message); }
    }

    return jsonOk(result, 201);
  } catch (e: any) { return jsonErr(toSafeErrorMessage(e, 'Could not complete the member operation.'), 400); }
}));

// ----- Bulk import -----
memberRoutes.post('/bulk-import', requireGym, requireFeature('members'), requirePermission('members'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = BulkImportMembersRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid bulk import payload');
  const memberRepo = new MemberRepository(ctx.env.DB, ctx.gymId!);
  const result = await memberRepo.bulkCreateMembers(parsed.data.members, ctx.user!.id, parsed.data.defaultPlanId);
  return jsonOk({
    success: true,
    totalProcessed: parsed.data.members.length,
    importedCount: result.importedCount, skippedCount: result.skippedCount, errors: result.errors,
  }, 201);
}));

// ----- Get by id -----
// GET /api/members/lookup?identifier=MEM-1001 — code/phone/email → id for client-side pickers.
// Exact-match over the whole table (not a capped list page), so lookups work regardless
// of member count. Case-insensitive on member_code.
memberRoutes.get('/lookup', requireGym, requireFeature('members'), requirePermission('members'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const identifier = (c.req.query('identifier') || '').trim();
  if (!identifier) return jsonErr('identifier is required', 400);

  const memberRepo = new MemberRepository(ctx.env.DB, ctx.gymId!);
  let member = await memberRepo.findByIdentifier(identifier);
  if (!member && !/^\d+$/.test(identifier)) {
    member = await memberRepo.findByIdentifier(identifier.toUpperCase());
  }
  if (!member) return jsonErr('Member not found', 404);
  return jsonOk({ member: { id: member.id, memberCode: member.memberCode, firstName: member.firstName, lastName: member.lastName } });
}));

memberRoutes.get('/:id', requireGym, requireFeature('members'), requirePermission('members'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: { name: string } };
  const id = paramId(c.req.param() as Record<string, string>);
  const memberService = new MemberService(ctx.env.DB, ctx.gymId!, ctx.user!.id, tenant.gym.name, ctx.env as unknown as Record<string, string | undefined>);
  try {
    return jsonOk(await memberService.getMemberDetails(id));
  } catch (e: any) { return jsonErr(toSafeErrorMessage(e, 'Member not found.'), 404); }
}));

// ----- Update -----
memberRoutes.put('/:id', requireGym, requireFeature('members'), requirePermission('members'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateMemberRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid update payload');

  const memberRepo = new MemberRepository(ctx.env.DB, ctx.gymId!);
  const before = await memberRepo.findById(id);
  if (!before) return jsonErr('Member not found', 404);

  // Phase 4.2: encrypt face embedding before storing
  let encryptedFaceEmbedding: string | undefined | null = undefined; // undefined = no change, null = clear
  if ('faceEmbedding' in parsed.data) {
    if (parsed.data.faceEmbedding === null) {
      encryptedFaceEmbedding = null; // clear the embedding
    } else if (parsed.data.faceEmbedding) {
      if (ctx.env.FACE_EMBEDDING_KEY) {
        encryptedFaceEmbedding = await encryptFaceEmbedding(parsed.data.faceEmbedding, ctx.env as unknown as Record<string, string | undefined>);
      } else {
        encryptedFaceEmbedding = parsed.data.faceEmbedding;
      }
    }
  }

  await memberRepo.update(id, {
    firstName: parsed.data.firstName, lastName: parsed.data.lastName, phone: parsed.data.phone,
    email: parsed.data.email, gender: parsed.data.gender,
    dateOfBirth: parsed.data.dateOfBirth ? Math.floor(new Date(parsed.data.dateOfBirth).getTime() / 1000) : undefined,
    photoUrl: parsed.data.photoUrl, faceEmbedding: encryptedFaceEmbedding,
    address: parsed.data.address, emergencyContactName: parsed.data.emergencyContactName,
    emergencyContactPhone: parsed.data.emergencyContactPhone, healthNotes: parsed.data.healthNotes,
    status: parsed.data.status,
  });
  const after = await memberRepo.findById(id);
  await auditGym(ctx, 'member.update', 'member', id, { before, after });
  return jsonOk(after);
}));

// ----- Soft delete / Archive -----
const handleArchive = safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const memberRepo = new MemberRepository(ctx.env.DB, ctx.gymId!);
  const before = await memberRepo.findById(id);
  if (!before) return jsonErr('Member not found or already archived', 404);
  await memberRepo.softDelete(id);
  await auditGym(ctx, 'member.soft_delete', 'member', id, {
    before, after: { ...before, deletedAt: Math.floor(Date.now() / 1000), status: 'INACTIVE' },
  });
  return jsonOk({ success: true, message: 'Member archived successfully. Historical records preserved.' });
});

memberRoutes.delete('/:id', requireGym, requireFeature('members'), requirePermission('members'), handleArchive);
memberRoutes.post('/:id/archive', requireGym, requireFeature('members'), requirePermission('members'), handleArchive);

// ----- GDPR Article 17 erasure (right to be forgotten) -----
// DELETE /members/:id/personal-data — wipes all personal data, deletes comms logs, clears biometric
memberRoutes.delete('/:id/personal-data', requireGym, requireFeature('members'), requirePermission('members'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const memberRepo = new MemberRepository(ctx.env.DB, ctx.gymId!);
  const member = await memberRepo.findById(id);
  if (!member) return jsonErr('Member not found', 404);

  // Verify biometric consent was previously given (audit trail)
  if (member.biometricConsentGiven) {
    await auditGym(ctx, 'member.gdpr_erasure', 'member', id, {
      before: { firstName: member.firstName, email: member.email, faceEmbedding: '[ENCRYPTED]' },
      after: { firstName: '[ERASED]', email: null, faceEmbedding: null },
      metadata: 'GDPR erasure: all personal data wiped, communication logs deleted',
    });
  }

  await memberRepo.erasePersonalData(id);
  return jsonOk({ success: true, message: 'All personal data has been permanently erased. Retaining minimal audit record.' });
}));

// ----- Data portability export (GDPR Article 20) -----
// GET /members/:id/export — returns all personal data for the member
memberRoutes.get('/:id/export', requireGym, requireFeature('members'), requirePermission('members'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: { name: string } };
  const id = paramId(c.req.param() as Record<string, string>);
  const memberService = new MemberService(ctx.env.DB, ctx.gymId!, ctx.user!.id, tenant.gym.name, ctx.env as unknown as Record<string, string | undefined>);
  try {
    const details = await memberService.getMemberDetails(id);
    // GDPR Article 20: provide data in machine-readable format
    const exportData = {
      exportedAt: new Date().toISOString(),
      gym: { id: ctx.gymId, name: tenant.gym.name },
      member: {
        ...details.member,
        // Never include face embedding in export for privacy
        faceEmbedding: details.member.faceEmbedding ? '[REDACTED - biometric data]' : null,
      },
      activeMembership: details.activeMembership,
      memberships: details.memberships,
      payments: details.payments,
      attendance: details.attendance,
    };
    return c.json(exportData, 200);
  } catch (e: any) { return jsonErr(toSafeErrorMessage(e, 'Member not found.'), 404); }
}));

// ----- Restore -----
memberRoutes.post('/:id/restore', requireGym, requireFeature('members'), requirePermission('members'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const licenseService = new LicenseService(ctx.env.DB, ctx.gymId!);
  const limitCheck = await licenseService.checkMemberLimit();
  if (!limitCheck.allowed) return jsonErr(`Cannot restore member: ${limitCheck.reason}`, 403);
  const memberRepo = new MemberRepository(ctx.env.DB, ctx.gymId!);
  const success = await memberRepo.restore(id);
  if (!success) return jsonErr('Member not found in archive', 404);
  const restored = await memberRepo.findById(id);
  await auditGym(ctx, 'member.restore', 'member', id, { after: restored });
  return jsonOk({ success: true, member: restored, message: 'Member restored to active roster.' });
}));

// ----- Renew -----
memberRoutes.post('/:id/renew', requireGym, requireFeature('members'), requirePermission('members'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: { name: string } };
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = RenewMembershipRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid renewal payload');
  const memberRepo = new MemberRepository(ctx.env.DB, ctx.gymId!);
  const member = await memberRepo.findById(id);
  if (!member || member.status === 'BLOCKED') return jsonErr('Cannot renew membership for an archived or blocked member', 400);
  const planRepo = new PlanRepository(ctx.env.DB, ctx.gymId!);
  const plan = await planRepo.findById(parsed.data.planId);
  if (!plan || plan.isActive !== 1) return jsonErr('Selected plan is inactive or no longer available', 400);
  const memberService = new MemberService(ctx.env.DB, ctx.gymId!, ctx.user!.id, tenant.gym.name);
  try {
    const result = await memberService.renewMembership({
      memberId: id, planId: parsed.data.planId,
      startDate: parsed.data.startDate ? Math.floor(new Date(parsed.data.startDate).getTime() / 1000) : undefined,
      discountPaise: parsed.data.discountPaise, paymentPaise: parsed.data.paymentPaise,
      paymentMode: parsed.data.paymentMode, referenceId: parsed.data.referenceId, notes: parsed.data.notes,
    });
    await auditGym(ctx, 'membership.renew', 'membership', result.membershipId, { after: { planId: parsed.data.planId, memberId: id } });
    return jsonOk(result);
  } catch (e: any) { return jsonErr(toSafeErrorMessage(e, 'Could not complete the member operation.'), 400); }
}));

// ----- Freeze -----
memberRoutes.post('/:id/freeze', requireGym, requireFeature('members'), requirePermission('members'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = FreezeMemberRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid freeze payload');

  const memberService = new MemberService(ctx.env.DB, ctx.gymId!, ctx.user!.id);
  try {
    const { membershipId } = await memberService.freezeMember(id, parsed.data?.reason);
    return jsonOk({ success: true, status: 'FROZEN', membershipId, message: 'Membership paused. Remaining days are preserved.' });
  } catch (e: any) {
    if (e.message === 'Member not found') return jsonErr('Member not found', 404);
    if (e.message === 'Membership is already frozen') return jsonErr('Membership is already frozen', 409);
    if (e.message === 'Cancelled memberships cannot be frozen') return jsonErr('Cancelled memberships cannot be frozen', 409);
    if (e.message === 'Only members with an active membership can be frozen') return jsonErr('Only members with an active membership can be frozen', 409);
    return jsonErr(toSafeErrorMessage(e, 'Could not complete the member operation.'), 400);
  }
}));

// ----- Unfreeze -----
memberRoutes.post('/:id/unfreeze', requireGym, requireFeature('members'), requirePermission('members'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);

  const memberService = new MemberService(ctx.env.DB, ctx.gymId!, ctx.user!.id);
  try {
    const { membershipId, extendedTo } = await memberService.unfreezeMember(id);
    return jsonOk({
      success: true, status: 'ACTIVE', membershipId, extendedTo,
      message: extendedTo ? `Membership reactivated. New expiry: ${new Date(extendedTo * 1000).toLocaleDateString('en-IN')}.` : 'Member reactivated.',
    });
  } catch (e: any) {
    if (e.message === 'Member not found') return jsonErr('Member not found', 404);
    if (e.message === 'Membership is not currently frozen') return jsonErr('Membership is not currently frozen', 409);
    return jsonErr(toSafeErrorMessage(e, 'Could not complete the member operation.'), 400);
  }
}));
