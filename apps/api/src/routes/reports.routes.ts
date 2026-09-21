// filepath: apps/api/src/routes/reports.routes.ts
import { Hono } from 'hono';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { DashboardService } from '../services/dashboard.service';
import { ReportsService } from '../services/reports.service';
import { jsonErr, jsonOk, jsonCsv, jsonValidationErr, parseQueryInt, queryId } from './helpers';

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
    SELECT COALESCE(SUM(amountPaise), 0) as revenue, COUNT(*) as paymentCount
    FROM payments WHERE gymId = ? AND status = 'COMPLETED' AND paymentDate >= ?
  `).bind(ctx.gymId!, periodStart).first<{ revenue: number; paymentCount: number }>();

  const planBreakdownRes = await ctx.env.DB.prepare(`
    SELECT mp.name, COUNT(DISTINCT m.id) as count, SUM(ms.finalAmountPaise) as revenue
    FROM membershipPlans mp
    LEFT JOIN memberships ms ON ms.membershipPlanId = mp.id AND ms.gymId = ? AND ms.startDate >= ?
    LEFT JOIN members m ON ms.memberId = m.id AND m.gymId = ?
    WHERE mp.gymId = ? AND mp.isActive = 1
    GROUP BY mp.id, mp.name ORDER BY revenue DESC LIMIT 8
  `).bind(ctx.gymId, periodStart, ctx.gymId, ctx.gymId).all();

  return jsonOk({
    metrics, period,
    periodRevenue: periodRevenueRes?.revenue || 0,
    periodPaymentCount: periodRevenueRes?.paymentCount || 0,
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
      SELECT p.receiptNumber, p.paymentDate, m.firstName, m.lastName, m.memberCode,
             p.amountPaise, p.paymentMode, p.referenceId, p.status, u.name as recordedBy
      FROM payments p
      JOIN members m ON m.id = p.memberId AND m.deletedAt IS NULL
      LEFT JOIN users u ON u.id = p.recordedByUserId
      WHERE p.gymId = ? AND p.deletedAt IS NULL
      ORDER BY p.paymentDate DESC LIMIT 2000
    `).bind(ctx.gymId!).all();
    csv = toCsv(
      ['Receipt No', 'Date', 'Member', 'Member Code', 'Amount (INR)', 'Mode', 'Reference', 'Status', 'Recorded By'],
      (rows.results || []).map((r: any) => [
        r.receiptNumber, new Date(r.paymentDate * 1000).toLocaleDateString('en-IN'),
        `${r.firstName} ${r.lastName || ''}`.trim(), r.memberCode,
        (r.amountPaise / 100).toFixed(2), r.paymentMode, r.referenceId || '', r.status, r.recordedBy || '',
      ])
    );
  } else if (type === 'members') {
    const rows = await ctx.env.DB.prepare(`
      SELECT m.memberCode, m.firstName, m.lastName, m.phone, m.email, m.status, m.joinedDate,
             mp.name as planName, ms.endDate, ms.dueAmountPaise
      FROM members m
      LEFT JOIN memberships ms ON ms.memberId = m.id AND ms.gymId = m.gymId AND ms.deletedAt IS NULL
        AND ms.id = (SELECT id FROM memberships WHERE memberId = m.id AND deletedAt IS NULL ORDER BY endDate DESC LIMIT 1)
      LEFT JOIN membershipPlans mp ON mp.id = ms.membershipPlanId AND mp.deletedAt IS NULL
      WHERE m.gymId = ? AND m.deletedAt IS NULL
      GROUP BY m.id ORDER BY m.firstName ASC LIMIT 2000
    `).bind(ctx.gymId!).all();
    csv = toCsv(
      ['Member Code', 'First Name', 'Last Name', 'Phone', 'Email', 'Status', 'Joined', 'Plan', 'Expiry', 'Due (INR)'],
      (rows.results || []).map((r: any) => [
        r.memberCode, r.firstName, r.lastName || '', r.phone, r.email || '', r.status,
        new Date(r.joinedDate * 1000).toLocaleDateString('en-IN'),
        r.planName || '',
        r.endDate ? new Date(r.endDate * 1000).toLocaleDateString('en-IN') : '',
        ((r.dueAmountPaise || 0) / 100).toFixed(2),
      ])
    );
  } else if (type === 'attendance') {
    const rows = await ctx.env.DB.prepare(`
      SELECT a.attendanceDate, a.checkInTime, a.method, m.firstName, m.lastName, m.memberCode
      FROM attendance a
      JOIN members m ON m.id = a.memberId AND m.deletedAt IS NULL
      WHERE a.gymId = ? AND a.deletedAt IS NULL
      ORDER BY a.checkInTime DESC LIMIT 5000
    `).bind(ctx.gymId!).all();
    csv = toCsv(
      ['Date', 'Check-in Time', 'Member', 'Member Code', 'Method'],
      (rows.results || []).map((r: any) => [
        r.attendanceDate, new Date(r.checkInTime * 1000).toLocaleTimeString('en-IN'),
        `${r.firstName} ${r.lastName || ''}`.trim(), r.memberCode, r.method,
      ])
    );
  } else if (type === 'dues') {
    const rows = await ctx.env.DB.prepare(`
      SELECT m.memberCode, m.firstName, m.lastName, m.phone, mp.name as planName,
             ms.endDate, ms.finalAmountPaise, ms.paidAmountPaise, ms.dueAmountPaise
      FROM memberships ms
      JOIN members m ON m.id = ms.memberId AND m.deletedAt IS NULL
      LEFT JOIN membershipPlans mp ON mp.id = ms.membershipPlanId AND mp.deletedAt IS NULL
      WHERE ms.gymId = ? AND ms.dueAmountPaise > 0 AND ms.deletedAt IS NULL
      ORDER BY ms.dueAmountPaise DESC LIMIT 2000
    `).bind(ctx.gymId!).all();
    csv = toCsv(
      ['Member Code', 'Member', 'Phone', 'Plan', 'Expiry', 'Final (INR)', 'Paid (INR)', 'Due (INR)'],
      (rows.results || []).map((r: any) => [
        r.memberCode, `${r.firstName} ${r.lastName || ''}`.trim(), r.phone, r.planName || '',
        new Date(r.endDate * 1000).toLocaleDateString('en-IN'),
        (r.finalAmountPaise / 100).toFixed(2),
        (r.paidAmountPaise / 100).toFixed(2),
        (r.dueAmountPaise / 100).toFixed(2),
      ])
    );
  } else {
    return jsonErr('Unknown export type. Use payments, members, attendance or dues.', 400);
  }

  return jsonCsv(csv, filename);
}));

// Revenue Report - Detailed revenue breakdown
reportRoutes.get('/revenue', requireGym, requireFeature('reports'), requirePermission('reports'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const startDate = parseQueryInt(c.req.query('startDate'), 0);
  const endDate = parseQueryInt(c.req.query('endDate'), Math.floor(Date.now() / 1000));
  const groupBy = (c.req.query('groupBy') || 'day') as 'day' | 'week' | 'month';

  const reportsService = new ReportsService(ctx.env.DB, ctx.gymId!);
  const report = await reportsService.getRevenueReport({ startDate, endDate, groupBy });

  return jsonOk(report);
}));

// Membership Report - Active, expired, frozen memberships
reportRoutes.get('/membership', requireGym, requireFeature('reports'), requirePermission('reports'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const startDate = parseQueryInt(c.req.query('startDate'), 0);
  const endDate = parseQueryInt(c.req.query('endDate'), Math.floor(Date.now() / 1000));
  const status = c.req.query('status');

  const reportsService = new ReportsService(ctx.env.DB, ctx.gymId!);
  const report = await reportsService.getMembershipReport({ startDate, endDate, status });

  return jsonOk(report);
}));

// Attendance Report - Daily attendance, peak hours
reportRoutes.get('/attendance', requireGym, requireFeature('reports'), requirePermission('reports'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const startDate = parseQueryInt(c.req.query('startDate'), 0);
  const endDate = parseQueryInt(c.req.query('endDate'), Math.floor(Date.now() / 1000));
  const memberId = queryId(c.req.query('memberId'), 'memberId');

  const reportsService = new ReportsService(ctx.env.DB, ctx.gymId!);
  const report = await reportsService.getAttendanceReport({ startDate, endDate, memberId });

  return jsonOk(report);
}));

// Member Growth Report - New joins vs churn
reportRoutes.get('/growth', requireGym, requireFeature('reports'), requirePermission('reports'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const startDate = parseQueryInt(c.req.query('startDate'), 0);
  const endDate = parseQueryInt(c.req.query('endDate'), Math.floor(Date.now() / 1000));

  const reportsService = new ReportsService(ctx.env.DB, ctx.gymId!);
  const report = await reportsService.getMemberGrowthReport(startDate, endDate);

  return jsonOk(report);
}));
