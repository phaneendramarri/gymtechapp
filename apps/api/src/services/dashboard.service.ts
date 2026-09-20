import { MemberRepository } from '../repositories/member.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { NotificationService } from '../lib/notifications';
import { computeChurnRisk } from '../lib/calculations';
import type { DashboardMetrics, ExpiringMember } from '@gymtech/shared';

export class DashboardService {
  private memberRepo: MemberRepository;
  private membershipRepo: MembershipRepository;
  private paymentRepo: PaymentRepository;
  private attendanceRepo: AttendanceRepository;
  private notif: NotificationService;

  constructor(private db: D1Database, private gymId: number, private gymName: string = 'Our Gym') {
    this.memberRepo = new MemberRepository(db, gymId);
    this.membershipRepo = new MembershipRepository(db, gymId);
    this.paymentRepo = new PaymentRepository(db, gymId);
    this.attendanceRepo = new AttendanceRepository(db, gymId);
    this.notif = new NotificationService(gymName);
  }

  async getMetrics(userRole?: string): Promise<DashboardMetrics> {
    const isManager = userRole === 'MANAGER';

    const [
      activeMembers,
      todayAttendance,
      paymentMetrics,
      expiringRaw,
      recentPayments,
      todayCheckIns,
      weeklyAttendance,
      monthlyRevenueTrend,
      atRiskMembers,
      planDistribution,
    ] = await Promise.all([
      this.memberRepo.countActive(),
      this.attendanceRepo.countToday(),
      isManager ? Promise.resolve({ monthlyRevenue: 0, pendingDues: 0, monthlyCount: 0 }) : this.paymentRepo.getSummaryMetrics(),
      this.membershipRepo.getExpiringSoon(7),
      isManager ? Promise.resolve([]) : this.paymentRepo.list({ limit: 10 }),
      this.attendanceRepo.listToday(),
      this.getWeeklyAttendance(),
      isManager ? Promise.resolve([]) : this.getMonthlyRevenueTrend(),
      this.getAtRiskMembers(),
      this.getPlanDistribution(),
    ]);

    const expiringSoon: ExpiringMember[] = expiringRaw.map((m: any) => {
      const firstName = m.firstName ?? '';
      const lastName = m.lastName ?? '';
      const phone = m.phone ?? '';
      const planName = m.planName ?? 'Plan';
      const endDate = Number(m.endDate ?? 0);
      const dueAmountPaise = isManager ? 0 : Number(m.dueAmountPaise ?? 0);
      const whatsappUrl = this.notif.generateWhatsAppUrl({
        recipientPhone: phone,
        recipientName: `${firstName} ${lastName}`.trim() || 'Member',
        type: 'EXPIRY_REMINDER',
        params: {
          expiryDate: endDate ? new Date(endDate * 1000).toLocaleDateString('en-IN') : '',
        },
      });
      return {
        id: m.memberId ?? m.id,
        firstName,
        lastName,
        phone,
        planName,
        endDate,
        dueAmountPaise,
        whatsappUrl,
      };
    });

    const recentWithWhatsApp = recentPayments.map((p: any) => {
      const firstName = p.firstName ?? '';
      const lastName = p.lastName ?? '';
      const phone = p.phone ?? '';
      const amountPaise = Number(p.amountPaise ?? 0);
      const paymentMode = p.paymentMode ?? 'CASH';
      const receiptNumber = p.receiptNumber ?? '';
      const paymentDate = Number(p.paymentDate ?? 0);
      const memberName = `${firstName} ${lastName}`.trim() || 'Member';
      const whatsappUrl = this.notif.generateWhatsAppUrl({
        recipientPhone: phone,
        recipientName: memberName,
        type: 'PAYMENT_RECEIPT',
        params: {
          amount: amountPaise / 100,
          paymentMode,
          receiptNumber,
        },
      });

      return {
        ...p,
        id: p.id,
        amountPaise,
        paymentMode,
        receiptNumber,
        paymentDate,
        firstName,
        lastName,
        memberName,
        phone,
        whatsappUrl,
      };
    });

    return {
      activeMembers,
      todayAttendance,
      monthlyRevenue: isManager ? 0 : paymentMetrics.monthlyRevenue,
      pendingDues: isManager ? 0 : paymentMetrics.pendingDues,
      monthlyPayments: isManager ? 0 : (paymentMetrics as any).monthlyCount ?? 0,
      expiringSoon,
      recentPayments: isManager ? [] : (recentWithWhatsApp as any),
      todayCheckIns,
      weeklyAttendance,
      monthlyRevenueTrend: isManager ? [] : monthlyRevenueTrend,
      atRiskMembers,
      planDistribution,
    };
  }

  /** Real weekly attendance footfall for the last 7 calendar days. */
  async getWeeklyAttendance(): Promise<{ day: string; date: string; count: number; avg: number }[]> {
    const daysName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const dates: { dateInt: number; dateStr: string; dayName: string }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push({
        dateInt: todayYyyymmddFor(d),
        dateStr: d.toISOString().split('T')[0],
        dayName: daysName[d.getDay()],
      });
    }

    const minDateInt = dates[0].dateInt;
    const rowsRes = await this.db
      .prepare(
        `SELECT attendanceDate, COUNT(*) as count
         FROM attendance
         WHERE gymId = ? AND attendanceDate >= ?
         GROUP BY attendanceDate`
      )
      .bind(this.gymId, minDateInt)
      .all<{ attendanceDate: number; count: number }>();

    const countMap = new Map<number, number>();
    for (const r of rowsRes.results || []) {
      countMap.set(r.attendanceDate, r.count);
    }

    // 30-day average
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const avgRes = await this.db
      .prepare(
        `SELECT COUNT(*) as totalAttendance, COUNT(DISTINCT attendanceDate) as totalDays
         FROM attendance
         WHERE gymId = ? AND attendanceDate >= ?`
      )
      .bind(this.gymId, todayYyyymmddFor(thirtyDaysAgo))
      .first<{ totalAttendance: number; totalDays: number }>();

    const avg = avgRes && avgRes.totalDays > 0
      ? Math.round(avgRes.totalAttendance / avgRes.totalDays)
      : 0;

    return dates.map((d) => ({
      day: d.dayName,
      date: d.dateStr,
      count: countMap.get(d.dateInt) || 0,
      avg,
    }));
  }

  /** Real monthly revenue trend for the last 6 calendar months. */
  async getMonthlyRevenueTrend(): Promise<{ month: string; revenue: number; renewals: number; newJoins: number; monthlyRevenue: number; yearlyRevenue: number }[]> {
    const monthsName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const monthKeys: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      monthKeys.push({ key: `${year}-${monthNum}`, label: monthsName[d.getMonth()] });
    }

    const minDateTimestamp = Math.floor(new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime() / 1000);
    // L9/L10: Bucket revenue by billing period (MONTHLY vs YEARLY) via plan join
    const rowsRes = await this.db
      .prepare(
        `SELECT
           strftime('%Y-%m', p.paymentDate, 'unixepoch') as monthKey,
           COALESCE(SUM(p.amountPaise), 0) as totalAmountPaise,
           COALESCE(SUM(CASE WHEN p.membershipId IS NOT NULL THEN p.amountPaise ELSE 0 END), 0) as renewalAmountPaise,
           COALESCE(SUM(CASE WHEN mp.billingPeriod = 'MONTHLY' THEN p.amountPaise ELSE 0 END), 0) as monthlyAmountPaise,
           COALESCE(SUM(CASE WHEN mp.billingPeriod = 'YEARLY' THEN p.amountPaise ELSE 0 END), 0) as yearlyAmountPaise
         FROM payments p
         LEFT JOIN memberships ms ON ms.id = p.membershipId AND ms.deletedAt IS NULL
         LEFT JOIN membershipPlans mp ON mp.id = ms.membershipPlanId AND mp.deletedAt IS NULL
         WHERE p.gymId = ? AND p.status = 'COMPLETED' AND p.paymentDate >= ?
         GROUP BY monthKey`
      )
      .bind(this.gymId, minDateTimestamp)
      .all<{ monthKey: string; totalAmountPaise: number; renewalAmountPaise: number; monthlyAmountPaise: number; yearlyAmountPaise: number }>();

    const dataMap = new Map<string, { total: number; renewals: number; monthly: number; yearly: number }>();
    for (const r of rowsRes.results || []) {
      dataMap.set(r.monthKey, {
        total: Math.round((r.totalAmountPaise || 0) / 100),
        renewals: Math.round((r.renewalAmountPaise || 0) / 100),
        monthly: Math.round((r.monthlyAmountPaise || 0) / 100),
        yearly: Math.round((r.yearlyAmountPaise || 0) / 100),
      });
    }

    return monthKeys.map((m) => {
      const val = dataMap.get(m.key) || { total: 0, renewals: 0, monthly: 0, yearly: 0 };
      return {
        month: m.label,
        revenue: val.total,
        renewals: val.renewals,
        newJoins: Math.max(0, val.total - val.renewals),
        monthlyRevenue: val.monthly,
        yearlyRevenue: val.yearly,
      };
    });
  }

  /** Churn radar: members inactive for 7+ days. */
  async getAtRiskMembers(): Promise<any[]> {
    const nowSec = Math.floor(Date.now() / 1000);
    const sevenDaysAgoSec = nowSec - 7 * 86400;

    const rows = await this.db
      .prepare(
        `SELECT
           m.id, m.firstName, m.lastName, m.phone, m.createdAt,
           COALESCE(mp.name, 'Active Plan') as planName,
           ms.startDate,
           MAX(a.checkInTime) as lastCheckIn
         FROM members m
         JOIN memberships ms ON ms.memberId = m.id AND ms.gymId = m.gymId AND ms.status = 'ACTIVE' AND ms.endDate > ?
         LEFT JOIN membershipPlans mp ON mp.id = ms.membershipPlanId AND mp.deletedAt IS NULL
         LEFT JOIN attendance a ON a.memberId = m.id AND a.gymId = m.gymId
         WHERE m.gymId = ? AND m.deletedAt IS NULL AND m.status = 'ACTIVE'
         GROUP BY m.id
         HAVING lastCheckIn IS NULL OR lastCheckIn < ?
         ORDER BY lastCheckIn ASC
         LIMIT 10`
      )
      .bind(nowSec, this.gymId, sevenDaysAgoSec)
      .all<any>();

    return (rows.results || []).map((r: any) => {
      const lastSec = r.lastCheckIn ? Number(r.lastCheckIn) : null;
      const { daysInactive, riskLevel } = computeChurnRisk(lastSec, Number(r.startDate), nowSec);
      const name = `${r.firstName} ${r.lastName || ''}`.trim();
      const whatsappUrl = this.notif.generateWhatsAppUrl({
        recipientPhone: r.phone,
        recipientName: name,
        type: 'CUSTOM',
        params: {
          message: `Hi ${r.firstName}, we missed seeing you at ${this.gymName}! Everything ok with your training? Let us know if you need any help getting back on track.`,
        },
      });

      return {
        id: r.id,
        name,
        firstName: r.firstName,
        lastName: r.lastName,
        phone: r.phone,
        plan: r.planName,
        daysInactive,
        lastCheckIn: r.lastCheckIn
          ? new Date(r.lastCheckIn * 1000).toLocaleDateString('en-IN')
          : 'No visits yet',
        lastAttendanceAt: lastSec,
        createdAt: r.createdAt,
        riskLevel,
        whatsappUrl,
      };
    });
  }

  /** Real plan distribution. */
  async getPlanDistribution(): Promise<{ name: string; memberCount: number; revenue: number }[]> {
    const rows = await this.db
      .prepare(
        `SELECT
           mp.name,
           COUNT(DISTINCT ms.memberId) as memberCount,
           COALESCE(SUM(ms.finalAmountPaise), 0) as revenuePaise
         FROM membershipPlans mp
         LEFT JOIN memberships ms ON ms.membershipPlanId = mp.id AND ms.gymId = mp.gymId AND ms.status = 'ACTIVE' AND ms.deletedAt IS NULL
         WHERE mp.gymId = ? AND mp.isActive = 1 AND mp.deletedAt IS NULL
         GROUP BY mp.id, mp.name
         ORDER BY memberCount DESC`
      )
      .bind(this.gymId)
      .all<any>();

    return (rows.results || []).map((r: any) => ({
      name: r.name,
      memberCount: Number(r.memberCount) || 0,
      revenue: Math.round((Number(r.revenuePaise) || 0) / 100),
    }));
  }
}

function todayYyyymmddFor(d: Date): number {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y * 10000 + parseInt(m, 10) * 100 + parseInt(day, 10);
}
