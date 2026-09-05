// filepath: apps/api/src/routes/payments.routes.ts
import { Hono } from 'hono';
import { RecordPaymentRequestSchema } from '@gymtech/shared';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { splitGstInclusiveAmount } from '../lib/calculations';
import { PaymentRepository } from '../repositories/payment.repository';
import { MemberRepository } from '../repositories/member.repository';
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
  const now = Math.floor(Date.now() / 1000);

  // H-7: Record payment and update membership payment progress atomically.
  // If either fails, the entire operation rolls back — no orphaned records.
  const stmts = [
    ctx.env.DB
      .prepare(
        `INSERT INTO payments (gym_id, member_id, membership_id, payment_type, receipt_number,
         amount_paise, payment_date, payment_mode, reference_id, status, recorded_by_user_id,
         notes, created_at, updated_at)
         VALUES (?, ?, ?, 'GYM', ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?)`
      )
      .bind(
        ctx.gymId, parsed.data.memberId, parsed.data.membershipId ?? null,
        receiptNumber, parsed.data.amountPaise, paymentDate, parsed.data.paymentMode,
        parsed.data.referenceId ?? null, ctx.user!.id,
        parsed.data.notes ?? null, now, now
      ),
  ];
  if (parsed.data.membershipId) {
    stmts.push(
      ctx.env.DB
        .prepare(
          `UPDATE memberships
             SET paid_amount_paise = paid_amount_paise + ?,
                 due_amount_paise = CASE
                                     WHEN due_amount_paise - ? < 0 THEN 0
                                     ELSE due_amount_paise - ?
                                   END,
                 updated_at = ?
             WHERE id = ? AND gym_id = ?`
        )
        .bind(parsed.data.amountPaise, parsed.data.amountPaise, parsed.data.amountPaise, now, parsed.data.membershipId, ctx.gymId)
    );
  }
  await ctx.env.DB.batch(stmts);

  // Fetch the just-inserted payment ID using the unique receipt number.
  const paymentRow = await ctx.env.DB
    .prepare('SELECT id FROM payments WHERE gym_id = ? AND receipt_number = ?')
    .bind(ctx.gymId, receiptNumber)
    .first<{ id: number }>();
  const paymentId = paymentRow!.id;

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
