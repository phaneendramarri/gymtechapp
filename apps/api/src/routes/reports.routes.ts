// filepath: apps/api/src/routes/reports.routes.ts
import { Hono } from 'hono';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { DashboardService } from '../services/dashboard.service';
import { jsonErr, jsonOk, jsonCsv, jsonValidationErr } from './helpers';

export const reportRoutes = new Hono();

const csvEscape = (v: any) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (headers: string[], rows: any[][]) =>
  [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');

reportRoutes.get('/', requireGym, requireFeature('reports'), requirePermission('reports'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: { name: string } };

  const period = (c.req.query('period') || 'month') as 'month' | 'quarter' | 'year';
  const now = new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const periodStart =
    period === 'quarter'
      ? nowSec - 90 * 86400
      : period === 'year'
        ? Math.floor(new Date(now.getFullYear(), 0, 1).getTime() / 1000)
        : Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);

  const dashboardService = new DashboardService(ctx.env.DB, ctx.gymId!, tenant.gym.name);
  const metrics = await dashboardService.getMetrics(ctx.user?.role);

  const periodRevenueRes = await ctx.env.DB.prepare(`
    SELECT COALESCE(SUM(amount_paise), 0) as revenue, COUNT(*) as payment_count
    FROM payments WHERE gym_id = ? AND status = 'COMPLETED' AND payment_date >= ?
  `).bind(ctx.gymId!, periodStart).first<{ revenue: number; payment_count: number }>();

  const planBreakdownRes = await ctx.env.DB.prepare(`
    SELECT mp.name, COUNT(DISTINCT m.id) as count, SUM(ms.final_amount_paise) as revenue
    FROM membership_plans mp
    LEFT JOIN memberships ms ON ms.membership_plan_id = mp.id AND ms.gym_id = ? AND ms.start_date >= ?
    LEFT JOIN members m ON ms.member_id = m.id AND m.gym_id = ?
    WHERE mp.gym_id = ? AND mp.is_active = 1
    GROUP BY mp.id, mp.name ORDER BY revenue DESC LIMIT 8
  `).bind(ctx.gymId, periodStart, ctx.gymId, ctx.gymId).all();

  return jsonOk({
    metrics, period,
    periodRevenue: periodRevenueRes?.revenue || 0,
    periodPaymentCount: periodRevenueRes?.payment_count || 0,
    planBreakdown: planBreakdownRes.results || [],
  });
}));

reportRoutes.get('/export', requireGym, requireFeature('reports'), requirePermission('reports'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const type = c.req.query('type') || 'payments';
  const filename = `${type}-report.csv`;
  let csv = '';

  if (type === 'payments') {
    const rows = await ctx.env.DB.prepare(`
      SELECT p.receipt_number, p.payment_date, m.first_name, m.last_name, m.member_code,
             p.amount_paise, p.payment_mode, p.reference_id, p.status, u.name as recorded_by
      FROM payments p
      JOIN members m ON m.id = p.member_id AND m.deleted_at IS NULL
      LEFT JOIN users u ON u.id = p.recorded_by_user_id
      WHERE p.gym_id = ? AND p.deleted_at IS NULL
      ORDER BY p.payment_date DESC LIMIT 2000
    `).bind(ctx.gymId!).all();
    csv = toCsv(
      ['Receipt No', 'Date', 'Member', 'Member Code', 'Amount (INR)', 'Mode', 'Reference', 'Status', 'Recorded By'],
      (rows.results || []).map((r: any) => [
        r.receipt_number, new Date(r.payment_date * 1000).toLocaleDateString('en-IN'),
        `${r.first_name} ${r.last_name || ''}`.trim(), r.member_code,
        (r.amount_paise / 100).toFixed(2), r.payment_mode, r.reference_id || '', r.status, r.recorded_by || '',
      ])
    );
  } else if (type === 'members') {
    const rows = await ctx.env.DB.prepare(`
      SELECT m.member_code, m.first_name, m.last_name, m.phone, m.email, m.status, m.joined_date,
             mp.name as plan_name, ms.end_date, ms.due_amount_paise
      FROM members m
      LEFT JOIN memberships ms ON ms.member_id = m.id AND ms.gym_id = m.gym_id AND ms.deleted_at IS NULL
      LEFT JOIN membership_plans mp ON mp.id = ms.membership_plan_id AND mp.deleted_at IS NULL
      WHERE m.gym_id = ? AND m.deleted_at IS NULL
      GROUP BY m.id ORDER BY m.first_name ASC LIMIT 2000
    `).bind(ctx.gymId!).all();
    csv = toCsv(
      ['Member Code', 'First Name', 'Last Name', 'Phone', 'Email', 'Status', 'Joined', 'Plan', 'Expiry', 'Due (INR)'],
      (rows.results || []).map((r: any) => [
        r.member_code, r.first_name, r.last_name || '', r.phone, r.email || '', r.status,
        new Date(r.joined_date * 1000).toLocaleDateString('en-IN'),
        r.plan_name || '',
        r.end_date ? new Date(r.end_date * 1000).toLocaleDateString('en-IN') : '',
        ((r.due_amount_paise || 0) / 100).toFixed(2),
      ])
    );
  } else if (type === 'attendance') {
    const rows = await ctx.env.DB.prepare(`
      SELECT a.attendance_date, a.check_in_time, a.method, m.first_name, m.last_name, m.member_code
      FROM attendance a
      JOIN members m ON m.id = a.member_id AND m.deleted_at IS NULL
      WHERE a.gym_id = ? AND a.deleted_at IS NULL
      ORDER BY a.check_in_time DESC LIMIT 5000
    `).bind(ctx.gymId!).all();
    csv = toCsv(
      ['Date', 'Check-in Time', 'Member', 'Member Code', 'Method'],
      (rows.results || []).map((r: any) => [
        r.attendance_date, new Date(r.check_in_time * 1000).toLocaleTimeString('en-IN'),
        `${r.first_name} ${r.last_name || ''}`.trim(), r.member_code, r.method,
      ])
    );
  } else if (type === 'dues') {
    const rows = await ctx.env.DB.prepare(`
      SELECT m.member_code, m.first_name, m.last_name, m.phone, mp.name as plan_name,
             ms.end_date, ms.final_amount_paise, ms.paid_amount_paise, ms.due_amount_paise
      FROM memberships ms
      JOIN members m ON m.id = ms.member_id AND m.deleted_at IS NULL
      LEFT JOIN membership_plans mp ON mp.id = ms.membership_plan_id AND mp.deleted_at IS NULL
      WHERE ms.gym_id = ? AND ms.due_amount_paise > 0 AND ms.deleted_at IS NULL
      ORDER BY ms.due_amount_paise DESC LIMIT 2000
    `).bind(ctx.gymId!).all();
    csv = toCsv(
      ['Member Code', 'Member', 'Phone', 'Plan', 'Expiry', 'Final (INR)', 'Paid (INR)', 'Due (INR)'],
      (rows.results || []).map((r: any) => [
        r.member_code, `${r.first_name} ${r.last_name || ''}`.trim(), r.phone, r.plan_name || '',
        new Date(r.end_date * 1000).toLocaleDateString('en-IN'),
        (r.final_amount_paise / 100).toFixed(2),
        (r.paid_amount_paise / 100).toFixed(2),
        (r.due_amount_paise / 100).toFixed(2),
      ])
    );
  } else {
    return jsonErr('Unknown export type. Use payments, members, attendance or dues.', 400);
  }

  return jsonCsv(csv, filename);
}));
