// filepath: apps/api/src/routes/attendance.routes.ts
import { Hono } from 'hono';
import { CheckInRequestSchema } from '@gymtech/shared';
import { requireGym, requireFeature } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { MemberRepository } from '../repositories/member.repository';
import { auditGymFromCtx } from '../services/audit.service';
import { jsonErr, jsonOk } from './helpers';

export const attendanceRoutes = new Hono();

// List today's attendance
attendanceRoutes.get('/', requireGym, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const attendanceRepo = new AttendanceRepository(ctx.env.DB, ctx.gymId!);
  return jsonOk({ logs: await attendanceRepo.listToday() });
}));

// Desk / Face ID Check-in
attendanceRoutes.post('/check-in', requireGym, requireFeature('attendance'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CheckInRequestSchema.safeParse(body);
  if (!parsed.success) return jsonErr(parsed.error.errors[0]?.message || 'Invalid check-in payload', 400);

  const memberRepo = new MemberRepository(ctx.env.DB, ctx.gymId!);
  const ident = parsed.data.memberIdOrCode;
  const identNum = parseInt(ident, 10);
  const member =
    (Number.isFinite(identNum) ? await memberRepo.findById(identNum) : null) ||
    (await memberRepo.findByIdentifier(ident));
  if (!member) return jsonErr('No matching member found with this code or phone', 404);

  if (member.deleted_at !== null || member.status === 'INACTIVE' || member.status === 'BLOCKED') {
    return jsonErr('Cannot check in an inactive, blocked, or archived member', 403);
  }

  const activeMembership: any = await ctx.env.DB.prepare(`
    SELECT ms.*, mp.name as plan_name
    FROM memberships ms LEFT JOIN membership_plans mp ON mp.id = ms.membership_plan_id
    WHERE ms.member_id = ? AND ms.gym_id = ? AND ms.status = 'ACTIVE'
    ORDER BY ms.end_date DESC LIMIT 1
  `).bind(member.id, ctx.gymId!).first();

  const nowSec = Math.floor(Date.now() / 1000);
  const isExpired = !activeMembership || activeMembership.end_date < nowSec;
  if (isExpired) {
    const expiryDateStr = activeMembership ? new Date(activeMembership.end_date * 1000).toLocaleDateString('en-IN') : 'No Plan';
    return jsonOk({
      success: false, code: 'MEMBERSHIP_EXPIRED',
      error: `ACCESS DENIED: Membership expired on ${expiryDateStr}. Account is frozen until renewed.`,
      member: { id: member.id, name: `${member.first_name} ${member.last_name || ''}`.trim(), memberCode: member.member_code, phone: member.phone, status: 'EXPIRED', expiryDate: expiryDateStr },
    }, 403);
  }

  const attendanceRepo = new AttendanceRepository(ctx.env.DB, ctx.gymId!);
  const res = await attendanceRepo.checkIn({
    member_id: member.id, method: parsed.data.method, recorded_by_user_id: ctx.user!.id,
  });

  await auditGymFromCtx(
    c,
    'attendance.checkin',
    'attendance',
    member.id,
    { metadata: { method: parsed.data.method, alreadyCheckedIn: res.alreadyCheckedIn } }
  );

  return jsonOk({
    success: true,
    alreadyCheckedIn: res.alreadyCheckedIn,
    member: { id: member.id, name: `${member.first_name} ${member.last_name || ''}`.trim(), memberCode: member.member_code, phone: member.phone, status: member.status },
  });
}));