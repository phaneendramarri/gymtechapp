// filepath: apps/api/src/routes/payments.routes.ts
import { Hono } from 'hono';
import { RecordPaymentRequestSchema } from '@gymtech/shared';
import { requireGym, requireFeature } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { splitGstInclusiveAmount } from '../lib/calculations';
import { PaymentRepository } from '../repositories/payment.repository';
import { MemberRepository } from '../repositories/member.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { NotificationService } from '../lib/notifications';
import { auditGymFromCtx } from '../services/audit.service';
import { jsonErr, jsonOk } from './helpers';

export const paymentRoutes = new Hono();

// List payments
paymentRoutes.get('/', requireGym, requireFeature('payments'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const memberId = c.req.query('memberId');
  const paymentRepo = new PaymentRepository(ctx.env.DB, ctx.gymId!);
  const [payments, summary] = await Promise.all([
    paymentRepo.list({ limit, memberId: memberId ? parseInt(memberId, 10) : undefined }),
    ctx.user?.role === 'MANAGER'
      ? Promise.resolve({ monthlyRevenue: 0, pendingDues: 0 })
      : paymentRepo.getSummaryMetrics(),
  ]);
  return jsonOk({ payments, summary });
}));

// Record payment
paymentRoutes.post('/', requireGym, requireFeature('payments'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: { name: string } };
  const body = await c.req.json().catch(() => ({}));
  const parsed = RecordPaymentRequestSchema.safeParse(body);
  if (!parsed.success) return jsonErr(parsed.error.errors[0]?.message || 'Invalid payment payload', 400);

  const paymentRepo = new PaymentRepository(ctx.env.DB, ctx.gymId!);
  const memberRepo = new MemberRepository(ctx.env.DB, ctx.gymId!);
  const member = await memberRepo.findById(parsed.data.memberId);
  if (!member || member.deleted_at !== null || member.status === 'BLOCKED') {
    return jsonErr('Cannot record payment for an inactive, archived, or blocked member', 400);
  }

  const receiptNumber = await paymentRepo.getNextReceiptNumber();
  const paymentDate = parsed.data.paymentDate ? Math.floor(new Date(parsed.data.paymentDate).getTime() / 1000) : Math.floor(Date.now() / 1000);

  const paymentId = await paymentRepo.record({
    member_id: parsed.data.memberId, membership_id: parsed.data.membershipId ?? null,
    receipt_number: receiptNumber, amount_paise: parsed.data.amountPaise,
    payment_date: paymentDate, payment_mode: parsed.data.paymentMode,
    reference_id: parsed.data.referenceId ?? null, recorded_by_user_id: ctx.user!.id,
    notes: parsed.data.notes ?? null, payment_type: 'GYM',
  });

  if (parsed.data.membershipId) {
    const membershipRepo = new MembershipRepository(ctx.env.DB, ctx.gymId!);
    await membershipRepo.updatePaymentProgress(parsed.data.membershipId, parsed.data.amountPaise);
  }

  const notif = new NotificationService(tenant.gym.name);
  const whatsappUrl = notif.generateWhatsAppUrl({
    recipientPhone: member.phone, recipientName: `${member.first_name} ${member.last_name || ''}`.trim(),
    type: 'PAYMENT_RECEIPT',
    params: { amount: parsed.data.amountPaise / 100, paymentMode: parsed.data.paymentMode, receiptNumber },
  });

  await auditGymFromCtx(
    c,
    'payment.create',
    'payment',
    paymentId,
    { after: { amount_paise: parsed.data.amountPaise, receipt_number: receiptNumber, member_id: member.id } }
  );

  return jsonOk({ paymentId, receiptNumber, whatsappUrl }, 201);
}));

// Invoice details
paymentRoutes.get('/:id/invoice', requireGym, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: any };
  const id = paramId(c.req.param() as Record<string, string>);
  const payment: any = await ctx.env.DB.prepare(`
    SELECT p.*, m.first_name, m.last_name, m.phone as member_phone, m.member_code,
           mp.name as plan_name, mp.tax_percentage as plan_tax_percentage
    FROM payments p
    JOIN members m ON m.id = p.member_id
    LEFT JOIN memberships ms ON ms.id = p.membership_id
    LEFT JOIN membership_plans mp ON mp.id = ms.membership_plan_id
    WHERE p.id = ? AND p.gym_id = ?
  `).bind(id, ctx.gymId!).first();
  if (!payment) return jsonErr('Payment not found', 404);

  const taxPercentage = Number(payment.plan_tax_percentage || 0);
  const { taxableAmount, taxAmount, cgst, sgst } = splitGstInclusiveAmount(payment.amount_paise, taxPercentage);

  return jsonOk({
    receiptNumber: payment.receipt_number, paymentDate: payment.payment_date,
    paymentMode: payment.payment_mode, referenceId: payment.reference_id, status: payment.status,
    gym: {
      name: tenant.gym.name, address: tenant.gym.address, city: tenant.gym.city,
      state: tenant.gym.state, pincode: tenant.gym.pincode, phone: tenant.gym.phone,
      email: tenant.gym.email, gstNumber: tenant.gym.gst_number,
    },
    member: { name: `${payment.first_name} ${payment.last_name || ''}`.trim(), memberCode: payment.member_code, phone: payment.member_phone },
    planName: payment.plan_name || null, sacCode: '999723', amount: payment.amount_paise,
    taxPercentage, taxableAmount, taxAmount,
    cgst: Math.round(taxAmount / 2), sgst: taxAmount - Math.round(taxAmount / 2),
    notes: payment.notes,
  });
}));