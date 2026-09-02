import type { Payment, PaymentMode, PaymentWithDetails } from '@gymtech/shared';

export class PaymentRepository {
  constructor(private db: D1Database, private gymId: number) {}

  async list(params: { limit?: number; offset?: number; memberId?: number }): Promise<PaymentWithDetails[]> {
    let query = `
      SELECT p.*, m.first_name, m.last_name, m.member_code, m.phone, u.name as recorded_by_name
      FROM payments p
      JOIN members m ON m.id = p.member_id
      LEFT JOIN users u ON u.id = p.recorded_by_user_id
      WHERE p.gym_id = ?
    `;
    const bindings: any[] = [this.gymId];

    if (params.memberId) {
      query += ` AND p.member_id = ?`;
      bindings.push(params.memberId);
    }

    query += ` ORDER BY p.payment_date DESC, p.created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(params.limit || 50, params.offset || 0);

    const { results } = await this.db.prepare(query).bind(...bindings).all<PaymentWithDetails>();
    return results || [];
  }

  async count(params: { memberId?: number } = {}): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM payments WHERE gym_id = ?`;
    const bindings: any[] = [this.gymId];
    if (params.memberId) {
      query += ` AND member_id = ?`;
      bindings.push(params.memberId);
    }
    const res = await this.db.prepare(query).bind(...bindings).first<{ count: number }>();
    return res?.count || 0;
  }

  async getNextReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const res = await this.db
      .prepare(`SELECT COUNT(*) as total FROM payments WHERE gym_id = ?`)
      .bind(this.gymId)
      .first<{ total: number }>();
    const count = (res?.total || 0) + 1;
    return `RCP-${year}-${String(count).padStart(4, '0')}`;
  }

  async record(data: {
    member_id: number;
    membership_id?: number | null;
    receipt_number: string;
    amount_paise: number;
    payment_date: number;
    payment_mode: PaymentMode;
    reference_id?: string | null;
    recorded_by_user_id: number;
    notes?: string | null;
    payment_type?: 'GYM' | 'PERSONAL_TRAINING';
  }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const res = await this.db
      .prepare(
        `INSERT INTO payments (
          gym_id, member_id, membership_id, payment_type, receipt_number,
          amount_paise, payment_date, payment_mode, reference_id,
          status, recorded_by_user_id, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?)`
      )
      .bind(
        this.gymId,
        data.member_id,
        data.membership_id ?? null,
        data.payment_type ?? 'GYM',
        data.receipt_number,
        data.amount_paise,
        data.payment_date,
        data.payment_mode,
        data.reference_id ?? null,
        data.recorded_by_user_id,
        data.notes ?? null,
        now,
        now
      )
      .run();
    return Number(res.meta?.last_row_id ?? res.meta?.lastInsertRowid ?? 0);
  }

  async getSummaryMetrics(): Promise<{ monthlyRevenue: number; todayRevenue: number; pendingDues: number }> {
    const startOfMonth = Math.floor(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000
    );
    const startOfToday = Math.floor(new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000);

    const monthRes = await this.db
      .prepare(
        `SELECT SUM(amount_paise) as revenue FROM payments
         WHERE gym_id = ? AND status = 'COMPLETED' AND payment_date >= ?`
      )
      .bind(this.gymId, startOfMonth)
      .first<{ revenue: number | null }>();

    const todayRes = await this.db
      .prepare(
        `SELECT SUM(amount_paise) as revenue FROM payments
         WHERE gym_id = ? AND status = 'COMPLETED' AND payment_date >= ?`
      )
      .bind(this.gymId, startOfToday)
      .first<{ revenue: number | null }>();

    const duesRes = await this.db
      .prepare(
        `SELECT SUM(due_amount_paise) as total_dues FROM memberships
         WHERE gym_id = ? AND status = 'ACTIVE' AND due_amount_paise > 0`
      )
      .bind(this.gymId)
      .first<{ total_dues: number | null }>();

    return {
      monthlyRevenue: monthRes?.revenue || 0,
      todayRevenue: todayRes?.revenue || 0,
      pendingDues: duesRes?.total_dues || 0,
    };
  }
}
