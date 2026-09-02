import type { GymMembershipPlan } from '@gymtech/shared';

/**
 * Gym-level membership plans (the "what we sell to members" catalog).
 * Distinct from `license.repository`, which manages the SaaS subscription
 * the gym buys from us.
 */
export class PlanRepository {
  constructor(private db: D1Database, private gymId: number) {}

  async listActive(): Promise<GymMembershipPlan[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM membership_plans
         WHERE gym_id = ? AND is_active = 1 AND deleted_at IS NULL
         ORDER BY duration_months ASC`
      )
      .bind(this.gymId)
      .all<GymMembershipPlan>();
    return results || [];
  }

  async listAll(): Promise<GymMembershipPlan[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM membership_plans
         WHERE gym_id = ? AND deleted_at IS NULL
         ORDER BY is_active DESC, duration_months ASC`
      )
      .bind(this.gymId)
      .all<GymMembershipPlan>();
    return results || [];
  }

  async findById(id: number): Promise<GymMembershipPlan | null> {
    return await this.db
      .prepare(`SELECT * FROM membership_plans WHERE id = ? AND gym_id = ? AND deleted_at IS NULL`)
      .bind(id, this.gymId)
      .first<GymMembershipPlan>();
  }

  async create(data: Omit<GymMembershipPlan, 'id' | 'created_at' | 'updated_at' | 'gym_id'>): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const res = await this.db
      .prepare(
        `INSERT INTO membership_plans (
          gym_id, name, description, duration_months, price_paise,
          admission_fee_paise, tax_percentage, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        this.gymId,
        data.name,
        data.description ?? null,
        data.duration_months,
        data.price_paise,
        data.admission_fee_paise ?? 0,
        data.tax_percentage ?? 0,
        data.is_active,
        now,
        now
      )
      .run();
    return Number(res.meta?.last_row_id ?? res.meta?.lastInsertRowid ?? 0);
  }

  async update(id: number, data: Partial<GymMembershipPlan>): Promise<void> {
    const fields: string[] = [];
    const bindings: any[] = [];
    const allowed: (keyof GymMembershipPlan)[] = [
      'name',
      'description',
      'duration_months',
      'price_paise',
      'admission_fee_paise',
      'tax_percentage',
      'is_active',
    ];
    for (const k of allowed) {
      if (data[k] !== undefined) {
        fields.push(`${String(k)} = ?`);
        bindings.push(data[k]);
      }
    }
    if (fields.length === 0) return;
    fields.push('updated_at = unixepoch()');
    bindings.push(id, this.gymId);
    await this.db
      .prepare(`UPDATE membership_plans SET ${fields.join(', ')} WHERE id = ? AND gym_id = ?`)
      .bind(...bindings)
      .run();
  }

  async softDelete(id: number): Promise<boolean> {
    const res = await this.db
      .prepare(
        `UPDATE membership_plans
         SET deleted_at = unixepoch(), is_active = 0, updated_at = unixepoch()
         WHERE id = ? AND gym_id = ? AND deleted_at IS NULL`
      )
      .bind(id, this.gymId)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }

  async restore(id: number): Promise<boolean> {
    const res = await this.db
      .prepare(
        `UPDATE membership_plans
         SET deleted_at = NULL, is_active = 1, updated_at = unixepoch()
         WHERE id = ? AND gym_id = ? AND deleted_at IS NOT NULL`
      )
      .bind(id, this.gymId)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }
}
