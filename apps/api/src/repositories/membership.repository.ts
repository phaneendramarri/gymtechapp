import type { Membership, MembershipStatus } from '@gymtech/shared';
import { applyPayment } from '../lib/calculations';

export class MembershipRepository {
  constructor(private db: D1Database, private gymId: number) {}

  async findByMemberId(memberId: number): Promise<any[]> {
    const { results } = await this.db
      .prepare(
        `SELECT ms.*, mp.name as plan_name, mp.duration_months
         FROM memberships ms
         JOIN membership_plans mp ON mp.id = ms.membership_plan_id
         WHERE ms.member_id = ? AND ms.gym_id = ?
         ORDER BY ms.created_at DESC`
      )
      .bind(memberId, this.gymId)
      .all<any>();
    return results || [];
  }

  async findActiveByMemberId(memberId: number): Promise<any | null> {
    return await this.db
      .prepare(
        `SELECT ms.*, mp.name as plan_name, mp.duration_months
         FROM memberships ms
         JOIN membership_plans mp ON mp.id = ms.membership_plan_id
         WHERE ms.member_id = ? AND ms.gym_id = ? AND ms.status = 'ACTIVE'
         ORDER BY ms.end_date DESC
         LIMIT 1`
      )
      .bind(memberId, this.gymId)
      .first<any>();
  }

  async findById(id: number): Promise<Membership | null> {
    return await this.db
      .prepare(`SELECT * FROM memberships WHERE id = ? AND gym_id = ?`)
      .bind(id, this.gymId)
      .first<Membership>();
  }

  async create(data: {
    member_id: number;
    membership_plan_id: number;
    start_date: number;
    end_date: number;
    total_amount_paise: number;
    discount_paise: number;
    final_amount_paise: number;
    paid_amount_paise: number;
    due_amount_paise: number;
    notes?: string | null;
    created_by_user_id?: number | null;
  }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const res = await this.db
      .prepare(
        `INSERT INTO memberships (
          gym_id, member_id, membership_plan_id, start_date, end_date,
          total_amount_paise, discount_paise, final_amount_paise,
          paid_amount_paise, due_amount_paise, status, notes,
          created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`
      )
      .bind(
        this.gymId,
        data.member_id,
        data.membership_plan_id,
        data.start_date,
        data.end_date,
        data.total_amount_paise,
        data.discount_paise,
        data.final_amount_paise,
        data.paid_amount_paise,
        data.due_amount_paise,
        data.notes ?? null,
        data.created_by_user_id ?? null,
        now,
        now
      )
      .run();
    return Number(res.meta?.last_row_id ?? res.meta?.lastInsertRowid ?? 0);
  }

  async updatePaymentProgress(id: number, additionalPaidPaise: number): Promise<void> {
    const current = await this.db
      .prepare(`SELECT * FROM memberships WHERE id = ? AND gym_id = ?`)
      .bind(id, this.gymId)
      .first<Membership>();
    if (!current) return;

    const { paidAmount, dueAmount } = applyPayment(
      current.final_amount_paise,
      current.paid_amount_paise,
      additionalPaidPaise
    );

    await this.db
      .prepare(
        `UPDATE memberships
         SET paid_amount_paise = ?, due_amount_paise = ?, updated_at = unixepoch()
         WHERE id = ? AND gym_id = ?`
      )
      .bind(paidAmount, dueAmount, id, this.gymId)
      .run();
  }

  async getExpiringSoon(days = 7): Promise<any[]> {
    const now = Math.floor(Date.now() / 1000);
    const target = now + days * 86400;
    const { results } = await this.db
      .prepare(
        `SELECT ms.*, m.first_name, m.last_name, m.phone, m.member_code, mp.name as plan_name
         FROM memberships ms
         JOIN members m ON m.id = ms.member_id
         JOIN membership_plans mp ON mp.id = ms.membership_plan_id
         WHERE ms.gym_id = ? AND ms.status = 'ACTIVE' AND ms.end_date >= ? AND ms.end_date <= ?
         ORDER BY ms.end_date ASC`
      )
      .bind(this.gymId, now, target)
      .all<any>();
    return results || [];
  }
}
