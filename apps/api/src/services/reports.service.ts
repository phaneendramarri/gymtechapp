// Reports Service - Backend logic for generating reports
import type { D1Database } from '@cloudflare/workers-types';

export interface RevenueReportParams {
  startDate: number;
  endDate: number;
  groupBy?: 'day' | 'week' | 'month';
}

export interface MembershipReportParams {
  startDate: number;
  endDate: number;
  status?: string;
}

export interface AttendanceReportParams {
  startDate: number;
  endDate: number;
  memberId?: number;
}

export class ReportsService {
  constructor(private db: D1Database, private gymId: number) {}

  /**
   * Revenue Report - Shows income breakdown by date, plan, and payment mode
   */
  async getRevenueReport(params: RevenueReportParams) {
    const { startDate, endDate, groupBy = 'day' } = params;

    // Total revenue in period
    const totalRevenue = await this.db
      .prepare(
        `SELECT
          COALESCE(SUM(amountPaise), 0) as totalPaise,
          COUNT(*) as paymentCount,
          COALESCE(SUM(CASE WHEN paymentMode = 'CASH' THEN amountPaise ELSE 0 END), 0) as cashPaise,
          COALESCE(SUM(CASE WHEN paymentMode = 'UPI' THEN amountPaise ELSE 0 END), 0) as upiPaise,
          COALESCE(SUM(CASE WHEN paymentMode = 'CARD' THEN amountPaise ELSE 0 END), 0) as cardPaise,
          COALESCE(SUM(CASE WHEN paymentMode = 'BANK_TRANSFER' THEN amountPaise ELSE 0 END), 0) as bankPaise
         FROM payments
         WHERE gymId = ? AND status = 'COMPLETED'
         AND paymentDate >= ? AND paymentDate <= ?`
      )
      .bind(this.gymId, startDate, endDate)
      .first<any>();

    // Revenue by plan
    const revenueByPlan = await this.db
      .prepare(
        `SELECT mp.name as planName,
          COALESCE(SUM(p.amountPaise), 0) as revenuePaise,
          COUNT(DISTINCT p.id) as paymentCount,
          COUNT(DISTINCT m.id) as memberCount
         FROM payments p
         LEFT JOIN memberships ms ON p.membershipId = ms.id
         LEFT JOIN membershipPlans mp ON ms.membershipPlanId = mp.id
         LEFT JOIN members m ON p.memberId = m.id
         WHERE p.gymId = ? AND p.status = 'COMPLETED'
         AND p.paymentDate >= ? AND p.paymentDate <= ?
         GROUP BY mp.id, mp.name
         ORDER BY revenuePaise DESC`
      )
      .bind(this.gymId, startDate, endDate)
      .all();

    // Time series data
    let dateFormat: string;
    if (groupBy === 'month') {
      dateFormat = '%Y-%m';
    } else if (groupBy === 'week') {
      dateFormat = '%Y-W%W';
    } else {
      dateFormat = '%Y-%m-%d';
    }

    const timeSeries = await this.db
      .prepare(
        `SELECT
          strftime('${dateFormat}', paymentDate, 'unixepoch') as period,
          COALESCE(SUM(amountPaise), 0) as revenuePaise,
          COUNT(*) as paymentCount
         FROM payments
         WHERE gymId = ? AND status = 'COMPLETED'
         AND paymentDate >= ? AND paymentDate <= ?
         GROUP BY period
         ORDER BY period`
      )
      .bind(this.gymId, startDate, endDate)
      .all();

    return {
      summary: {
        totalRevenue: totalRevenue?.totalPaise || 0,
        paymentCount: totalRevenue?.paymentCount || 0,
        cashRevenue: totalRevenue?.cashPaise || 0,
        upiRevenue: totalRevenue?.upiPaise || 0,
        cardRevenue: totalRevenue?.cardPaise || 0,
        bankRevenue: totalRevenue?.bankPaise || 0,
      },
      byPlan: revenueByPlan.results || [],
      timeSeries: timeSeries.results || [],
    };
  }

  /**
   * Membership Report - active/new/renewal/expired summary, per-plan active
   * counts with expiring badges, and the members whose memberships expire
   * within 7 days. Shapes match the Reports page membership tab.
   */
  async getMembershipReport(params: MembershipReportParams) {
    const { startDate, endDate } = params;
    const now = Math.floor(Date.now() / 1000);

    // One definition of "renewal": a membership created in the period for a
    // member who already had an earlier one. Both cards used to run the same
    // expression, so "New Memberships" and "Renewals" always showed the same
    // number.
    const HAS_EARLIER = `EXISTS (
        SELECT 1 FROM memberships prev
         WHERE prev.memberId = ms.memberId AND prev.gymId = ms.gymId
           AND prev.deletedAt IS NULL AND prev.id <> ms.id
           AND prev.createdAt < ms.createdAt)`;

    // Snapshot counts (current) + period-scoped new/renewal split.
    const summary = await this.db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN ms.status = 'ACTIVE' THEN 1 ELSE 0 END), 0) as totalActive,
          COALESCE(SUM(CASE WHEN ms.createdAt BETWEEN ? AND ? AND NOT ${HAS_EARLIER} THEN 1 ELSE 0 END), 0) as newMemberships,
          COALESCE(SUM(CASE WHEN ms.createdAt BETWEEN ? AND ? AND ${HAS_EARLIER} THEN 1 ELSE 0 END), 0) as renewals,
          COALESCE(SUM(CASE WHEN ms.status = 'EXPIRED' THEN 1 ELSE 0 END), 0) as expired,
          COALESCE(SUM(CASE WHEN ms.status = 'FROZEN' THEN 1 ELSE 0 END), 0) as frozen
         FROM memberships ms
         WHERE ms.gymId = ? AND ms.deletedAt IS NULL`
      )
      .bind(startDate, endDate, startDate, endDate, this.gymId)
      .first<any>();

    // Active members by plan (current ACTIVE memberships), with how many of
    // each plan expire within the next 7 days — the plan list renders both.
    // The window starts at `now`, matching the `expiring` list below: counting
    // already-lapsed memberships here made the badge disagree with an empty
    // list for exactly the members who need chasing.
    const byPlan = await this.db
      .prepare(
        `SELECT mp.name as planName,
          COUNT(DISTINCT ms.id) as activeCount,
          COALESCE(SUM(CASE WHEN ms.endDate BETWEEN ? AND ? + 7 * 86400 THEN 1 ELSE 0 END), 0) as expiringSoon
         FROM memberships ms
         JOIN membershipPlans mp ON ms.membershipPlanId = mp.id
         WHERE ms.gymId = ? AND ms.deletedAt IS NULL AND ms.status = 'ACTIVE'
         GROUP BY mp.id, mp.name
         ORDER BY activeCount DESC`
      )
      .bind(now, now, this.gymId)
      .all();

    // Members whose ACTIVE membership expires within 7 days.
    const expiring = await this.db
      .prepare(
        `SELECT m.id as memberId,
                m.firstName || ' ' || COALESCE(m.lastName, '') as memberName,
                m.memberCode,
                mp.name as planName,
                ms.endDate
         FROM memberships ms
         JOIN members m ON m.id = ms.memberId AND m.deletedAt IS NULL
         LEFT JOIN membershipPlans mp ON mp.id = ms.membershipPlanId
         WHERE ms.gymId = ? AND ms.deletedAt IS NULL AND ms.status = 'ACTIVE'
           AND ms.endDate BETWEEN ? AND ? + 7 * 86400
         ORDER BY ms.endDate ASC
         LIMIT 50`
      )
      .bind(this.gymId, now, now)
      .all();

    return {
      summary: {
        totalActive: summary?.totalActive || 0,
        newMemberships: summary?.newMemberships || 0,
        renewals: summary?.renewals || 0,
        expired: summary?.expired || 0,
        frozen: summary?.frozen || 0,
      },
      byPlan: byPlan.results || [],
      expiring: expiring.results || [],
    };
  }

  /**
   * Attendance Report - Shows daily attendance, peak hours, and member activity
   */
  async getAttendanceReport(params: AttendanceReportParams) {
    const { startDate, endDate, memberId } = params;

    // Convert to YYYYMMDD format
    const startDateInt = parseInt(
      new Date(startDate * 1000).toISOString().split('T')[0].replace(/-/g, ''),
      10
    );
    const endDateInt = parseInt(
      new Date(endDate * 1000).toISOString().split('T')[0].replace(/-/g, ''),
      10
    );

    // Total check-ins
    const totalCheckIns = await this.db
      .prepare(
        `SELECT COUNT(*) as count
         FROM attendance
         WHERE gymId = ? AND deletedAt IS NULL
         AND attendanceDate >= ? AND attendanceDate <= ?
         ${memberId ? 'AND memberId = ?' : ''}`
      )
      .bind(this.gymId, startDateInt, endDateInt, ...(memberId ? [memberId] : []))
      .first<{ count: number }>();

    // Daily breakdown
    const dailyAttendance = await this.db
      .prepare(
        `SELECT attendanceDate, COUNT(*) as checkIns
         FROM attendance
         WHERE gymId = ? AND deletedAt IS NULL
         AND attendanceDate >= ? AND attendanceDate <= ?
         ${memberId ? 'AND memberId = ?' : ''}
         GROUP BY attendanceDate
         ORDER BY attendanceDate`
      )
      .bind(this.gymId, startDateInt, endDateInt, ...(memberId ? [memberId] : []))
      .all();

    // Peak hours (group by hour of day)
    const peakHours = await this.db
      .prepare(
        `SELECT strftime('%H', checkInTime, 'unixepoch') as hour, COUNT(*) as count
         FROM attendance
         WHERE gymId = ? AND deletedAt IS NULL
         AND attendanceDate >= ? AND attendanceDate <= ?
         GROUP BY hour
         ORDER BY count DESC
         LIMIT 5`
      )
      .bind(this.gymId, startDateInt, endDateInt)
      .all();

    // Most active members (if not filtered by member)
    let topMembers: any[] = [];
    if (!memberId) {
      const topMembersResult = await this.db
        .prepare(
          `SELECT m.firstName, m.lastName, m.memberCode, COUNT(a.id) as visitCount
           FROM members m
           JOIN attendance a ON a.memberId = m.id AND a.gymId = m.gymId
           WHERE m.gymId = ? AND a.deletedAt IS NULL
           AND a.attendanceDate >= ? AND a.attendanceDate <= ?
           GROUP BY m.id
           ORDER BY visitCount DESC
           LIMIT 10`
        )
        .bind(this.gymId, startDateInt, endDateInt)
        .all();
      topMembers = topMembersResult.results || [];
    }

    return {
      summary: {
        totalCheckIns: totalCheckIns?.count || 0,
        averageDaily:
          dailyAttendance.results?.length > 0
            ? Math.round((totalCheckIns?.count || 0) / dailyAttendance.results.length)
            : 0,
      },
      dailyAttendance: dailyAttendance.results || [],
      peakHours: peakHours.results || [],
      topMembers,
    };
  }

  /**
   * Member Growth Report - New joins vs churn over time
   */
  async getMemberGrowthReport(startDate: number, endDate: number) {
    const growth = await this.db
      .prepare(
        `SELECT
          strftime('%Y-%m', joinedDate, 'unixepoch') as month,
          COUNT(*) as newMembers
         FROM members
         WHERE gymId = ? AND deletedAt IS NULL
         AND joinedDate >= ? AND joinedDate <= ?
         GROUP BY month
         ORDER BY month`
      )
      .bind(this.gymId, startDate, endDate)
      .all();

    const churn = await this.db
      .prepare(
        `SELECT
          strftime('%Y-%m', updatedAt, 'unixepoch') as month,
          COUNT(*) as churnedMembers
         FROM members
         WHERE gymId = ? AND status IN ('CANCELLED', 'EXPIRED')
         AND updatedAt >= ? AND updatedAt <= ?
         GROUP BY month
         ORDER BY month`
      )
      .bind(this.gymId, startDate, endDate)
      .all();

    return {
      growth: growth.results || [],
      churn: churn.results || [],
    };
  }
}
