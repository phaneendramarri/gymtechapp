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
          COALESCE(SUM(amount_paise), 0) as total_paise,
          COUNT(*) as payment_count,
          COALESCE(SUM(CASE WHEN payment_mode = 'CASH' THEN amount_paise ELSE 0 END), 0) as cash_paise,
          COALESCE(SUM(CASE WHEN payment_mode = 'UPI' THEN amount_paise ELSE 0 END), 0) as upi_paise,
          COALESCE(SUM(CASE WHEN payment_mode = 'CARD' THEN amount_paise ELSE 0 END), 0) as card_paise,
          COALESCE(SUM(CASE WHEN payment_mode = 'BANK_TRANSFER' THEN amount_paise ELSE 0 END), 0) as bank_paise
         FROM payments
         WHERE gym_id = ? AND status = 'COMPLETED'
         AND payment_date >= ? AND payment_date <= ?`
      )
      .bind(this.gymId, startDate, endDate)
      .first<any>();

    // Revenue by plan
    const revenueByPlan = await this.db
      .prepare(
        `SELECT mp.name as plan_name,
          COALESCE(SUM(p.amount_paise), 0) as revenue_paise,
          COUNT(DISTINCT p.id) as payment_count,
          COUNT(DISTINCT m.id) as member_count
         FROM payments p
         LEFT JOIN memberships ms ON p.membership_id = ms.id
         LEFT JOIN membership_plans mp ON ms.membership_plan_id = mp.id
         LEFT JOIN members m ON p.member_id = m.id
         WHERE p.gym_id = ? AND p.status = 'COMPLETED'
         AND p.payment_date >= ? AND p.payment_date <= ?
         GROUP BY mp.id, mp.name
         ORDER BY revenue_paise DESC`
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
          strftime('${dateFormat}', payment_date, 'unixepoch') as period,
          COALESCE(SUM(amount_paise), 0) as revenue_paise,
          COUNT(*) as payment_count
         FROM payments
         WHERE gym_id = ? AND status = 'COMPLETED'
         AND payment_date >= ? AND payment_date <= ?
         GROUP BY period
         ORDER BY period`
      )
      .bind(this.gymId, startDate, endDate)
      .all();

    return {
      summary: {
        totalRevenue: totalRevenue?.total_paise || 0,
        paymentCount: totalRevenue?.payment_count || 0,
        cashRevenue: totalRevenue?.cash_paise || 0,
        upiRevenue: totalRevenue?.upi_paise || 0,
        cardRevenue: totalRevenue?.card_paise || 0,
        bankRevenue: totalRevenue?.bank_paise || 0,
      },
      byPlan: revenueByPlan.results || [],
      timeSeries: timeSeries.results || [],
    };
  }

  /**
   * Membership Report - Shows new, renewed, expired, and active memberships
   */
  async getMembershipReport(params: MembershipReportParams) {
    const { startDate, endDate, status } = params;

    // Summary counts
    const summary = await this.db
      .prepare(
        `SELECT
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END), 0) as active,
          COALESCE(SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END), 0) as expired,
          COALESCE(SUM(CASE WHEN status = 'FROZEN' THEN 1 ELSE 0 END), 0) as frozen,
          COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) as cancelled,
          COALESCE(SUM(CASE WHEN start_date >= ? THEN 1 ELSE 0 END), 0) as new_in_period
         FROM memberships
         WHERE gym_id = ? AND deleted_at IS NULL
         AND created_at >= ? AND created_at <= ?`
      )
      .bind(startDate, this.gymId, startDate, endDate)
      .first<any>();

    // Expiring soon (next 30 days)
    const expiringSoon = await this.db
      .prepare(
        `SELECT COUNT(*) as count
         FROM memberships
         WHERE gym_id = ? AND status = 'ACTIVE' AND deleted_at IS NULL
         AND end_date BETWEEN ? AND ?`
      )
      .bind(this.gymId, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 30 * 86400)
      .first<{ count: number }>();

    // By plan
    const byPlan = await this.db
      .prepare(
        `SELECT mp.name as plan_name,
          COUNT(*) as count,
          COALESCE(SUM(ms.final_amount_paise), 0) as revenue_paise
         FROM memberships ms
         LEFT JOIN membership_plans mp ON ms.membership_plan_id = mp.id
         WHERE ms.gym_id = ? AND ms.deleted_at IS NULL
         AND ms.created_at >= ? AND ms.created_at <= ?
         ${status ? `AND ms.status = ?` : ''}
         GROUP BY mp.id, mp.name
         ORDER BY count DESC`
      )
      .bind(this.gymId, startDate, endDate, ...(status ? [status] : []))
      .all();

    return {
      summary: {
        total: summary?.total || 0,
        active: summary?.active || 0,
        expired: summary?.expired || 0,
        frozen: summary?.frozen || 0,
        cancelled: summary?.cancelled || 0,
        newInPeriod: summary?.new_in_period || 0,
        expiringSoon: expiringSoon?.count || 0,
      },
      byPlan: byPlan.results || [],
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
         WHERE gym_id = ? AND deleted_at IS NULL
         AND attendance_date >= ? AND attendance_date <= ?
         ${memberId ? 'AND member_id = ?' : ''}`
      )
      .bind(this.gymId, startDateInt, endDateInt, ...(memberId ? [memberId] : []))
      .first<{ count: number }>();

    // Daily breakdown
    const dailyAttendance = await this.db
      .prepare(
        `SELECT attendance_date, COUNT(*) as check_ins
         FROM attendance
         WHERE gym_id = ? AND deleted_at IS NULL
         AND attendance_date >= ? AND attendance_date <= ?
         ${memberId ? 'AND member_id = ?' : ''}
         GROUP BY attendance_date
         ORDER BY attendance_date`
      )
      .bind(this.gymId, startDateInt, endDateInt, ...(memberId ? [memberId] : []))
      .all();

    // Peak hours (group by hour of day)
    const peakHours = await this.db
      .prepare(
        `SELECT strftime('%H', check_in_time, 'unixepoch') as hour, COUNT(*) as count
         FROM attendance
         WHERE gym_id = ? AND deleted_at IS NULL
         AND attendance_date >= ? AND attendance_date <= ?
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
          `SELECT m.first_name, m.last_name, m.member_code, COUNT(a.id) as visit_count
           FROM members m
           JOIN attendance a ON a.member_id = m.id AND a.gym_id = m.gym_id
           WHERE m.gym_id = ? AND a.deleted_at IS NULL
           AND a.attendance_date >= ? AND a.attendance_date <= ?
           GROUP BY m.id
           ORDER BY visit_count DESC
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
          strftime('%Y-%m', joined_date, 'unixepoch') as month,
          COUNT(*) as new_members
         FROM members
         WHERE gym_id = ? AND deleted_at IS NULL
         AND joined_date >= ? AND joined_date <= ?
         GROUP BY month
         ORDER BY month`
      )
      .bind(this.gymId, startDate, endDate)
      .all();

    const churn = await this.db
      .prepare(
        `SELECT
          strftime('%Y-%m', updated_at, 'unixepoch') as month,
          COUNT(*) as churned_members
         FROM members
         WHERE gym_id = ? AND status IN ('CANCELLED', 'EXPIRED')
         AND updated_at >= ? AND updated_at <= ?
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
