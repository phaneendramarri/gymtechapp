// filepath: apps/api/src/routes/payments.routes.ts
import { Hono } from 'hono';
import { RecordPaymentRequestSchema } from '@gymtech/shared';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { splitGstInclusiveAmount } from '../lib/calculations';
import { PaymentRepository } from '../repositories/payment.repository';
import { MemberRepository } from '../repositories/member.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { NotificationService } from '../lib/notifications';
import { auditGymFromCtx } from '../services/audit.service';
import { jsonErr, jsonOk, jsonValidationErr, parsePageParams, jsonPaginated } from './helpers';

export const paymentRoutes = new Hono();

// List payments
paymentRoutes.get('/', requireGym, requireFeature('payments'), requirePermission('payments'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const { limit, offset } = parsePageParams(c.req.query('limit'), c.req.query('offset'), 'payments');
  const memberId = c.req.query('memberId');
  const paymentRepo = new PaymentRepository(ctx.env.DB, ctx.gymId!);
  const memberIdNum = memberId ? parseInt(memberId, 10) : undefined;
  const [payments, total, summary] = await Promise.all([
    paymentRepo.list({ limit, offset, memberId: memberIdNum }),
    paymentRepo.count({ memberId: memberIdNum }),
    paymentRepo.getSummaryMetrics(),
  ]);
  return jsonOk({ items: payments, total, limit, offset, hasMore: offset + payments.length < total, summary });
}));

// Record payment
paymentRoutes.post('/', requireGym, requireFeature('payments'), requirePermission('payments'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: { name: string } };
  const body = await c.req.json().catch(() => ({}));
  const parsed = RecordPaymentRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid payment payload');

  const paymentRepo = new PaymentRepository(ctx.env.DB, ctx.gymId!);
  const memberRepo = new MemberRepository(ctx.env.DB, ctx.gymId!);
  const member = await memberRepo.findById(parsed.data.memberId);
  if (!member || member.deletedAt !== null || member.status === 'BLOCKED') {
    return jsonErr('Cannot record payment for an inactive, archived, or blocked member', 400);
  }

  const receiptNumber = await paymentRepo.getNextReceiptNumber();
  const paymentDate = parsed.data.paymentDate ? Math.floor(new Date(parsed.data.paymentDate).getTime() / 1000) : Math.floor(Date.now() / 1000);

  // Single atomic path: payment insert + membership dues update are batched
  // inside the repository. No orphaned payment or stale dues on failure.
  // When the caller doesn't name a membership (dues desk flow), settle the
  // member's outstanding dues-bearing membership automatically; otherwise
  // the payment would silently leave Pending Dues unchanged.
  const membershipId =
    parsed.data.membershipId ??
    (await new MembershipRepository(ctx.env.DB, ctx.gymId!).findDueMembershipId(member.id));
  const paymentId = membershipId
    ? await paymentRepo.recordAndApplyToMembership({
        memberId: parsed.data.memberId,
        membershipId,
        receiptNumber,
        amountPaise: parsed.data.amountPaise,
        paymentDate,
        paymentMode: parsed.data.paymentMode,
        referenceId: parsed.data.referenceId ?? null,
        recordedByUserId: ctx.user!.id,
        notes: parsed.data.notes ?? null,
      })
    : await paymentRepo.record({
        memberId: parsed.data.memberId,
        membershipId: null,
        receiptNumber,
        amountPaise: parsed.data.amountPaise,
        paymentDate,
        paymentMode: parsed.data.paymentMode,
        referenceId: parsed.data.referenceId ?? null,
        recordedByUserId: ctx.user!.id,
        notes: parsed.data.notes ?? null,
      });

  const notif = new NotificationService(tenant.gym.name);
  const whatsappUrl = notif.generateWhatsAppUrl({
    recipientPhone: member.phone, recipientName: `${member.firstName} ${member.lastName || ''}`.trim(),
    type: 'PAYMENT_RECEIPT',
    params: { amount: parsed.data.amountPaise / 100, paymentMode: parsed.data.paymentMode, receiptNumber },
  });

  await auditGymFromCtx(
    c,
    'payment.create',
    'payment',
    paymentId,
    { after: { amountPaise: parsed.data.amountPaise, receiptNumber, memberId: member.id } }
  );

  return jsonOk({ paymentId, receiptNumber, whatsappUrl }, 201);
}));

// Invoice details. Gated on the `payments` permission — an invoice carries the
// member's name, phone and payment history, so a member-portal session must
// not be able to read another member's by id.
paymentRoutes.get('/:id/invoice', requireGym, requireFeature('payments'), requirePermission('payments'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: any };
  const id = paramId(c.req.param() as Record<string, string>);
  const payment: any = await ctx.env.DB.prepare(`
    SELECT p.*, m.firstName, m.lastName, m.phone as memberPhone, m.memberCode,
           mp.name as planName, mp.taxPercentage as planTaxPercentage
    FROM payments p
    JOIN members m ON m.id = p.memberId
    LEFT JOIN memberships ms ON ms.id = p.membershipId
    LEFT JOIN membershipPlans mp ON mp.id = ms.membershipPlanId
    WHERE p.id = ? AND p.gymId = ?
  `).bind(id, ctx.gymId!).first();
  if (!payment) return jsonErr('Payment not found', 404);

  const taxPercentage = Number(payment.planTaxPercentage || 0);
  const amountPaise = Number(payment.amountPaise ?? 0);
  const { taxableAmount, taxAmount, cgst, sgst } = splitGstInclusiveAmount(amountPaise, taxPercentage);

  return jsonOk({
    receiptNumber: payment.receiptNumber,
    paymentDate: payment.paymentDate,
    paymentMode: payment.paymentMode,
    referenceId: payment.referenceId,
    status: payment.status,
    gym: {
      name: tenant.gym.name, address: tenant.gym.address, city: tenant.gym.city,
      state: tenant.gym.state, pincode: tenant.gym.pincode, phone: tenant.gym.phone,
      email: tenant.gym.email, gstNumber: tenant.gym.gstNumber,
    },
    member: {
      name: `${payment.firstName} ${payment.lastName || ''}`.trim(),
      memberCode: payment.memberCode,
      phone: payment.memberPhone,
    },
    planName: payment.planName ?? null, sacCode: '999723', amount: amountPaise,
    taxPercentage, taxableAmount, taxAmount,
    cgst: Math.round(taxAmount / 2), sgst: taxAmount - Math.round(taxAmount / 2),
    notes: payment.notes,
  });
}));

// Add receipt endpoint at end of file before export
paymentRoutes.get('/:id/receipt', requireGym, requireFeature('payments'), requirePermission('payments'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: any };
  const id = paramId(c.req.param() as Record<string, string>);
  const payment: any = await ctx.env.DB.prepare(`
    SELECT p.*, m.firstName, m.lastName, m.phone, m.memberCode, mp.name as planName
    FROM payments p JOIN members m ON m.id = p.memberId
    LEFT JOIN memberships ms ON ms.id = p.membershipId
    LEFT JOIN membershipPlans mp ON mp.id = ms.membershipPlanId
    WHERE p.id = ? AND p.gymId = ?`).bind(id, ctx.gymId!).first();
  if (!payment) return jsonErr('Payment not found', 404);
  const { generateReceiptHTML } = await import('../lib/receipt-generator');
  const amountPaise = Number(payment.amountPaise ?? 0);
  const html = generateReceiptHTML({
    receiptNumber: payment.receiptNumber,
    paymentDate: payment.paymentDate,
    memberName: `${payment.firstName} ${payment.lastName || ''}`.trim(),
    memberCode: payment.memberCode,
    phone: payment.phone,
    amountPaise,
    paymentMode: payment.paymentMode,
    referenceId: payment.referenceId,
    planName: payment.planName,
    notes: payment.notes,
    gymName: tenant.gym.name, gymPhone: tenant.gym.phone, gymAddress: tenant.gym.address,
    gymEmail: tenant.gym.email, gstNumber: tenant.gym.gstNumber,
  });
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}));

