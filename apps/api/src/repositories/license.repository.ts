import type { License, BillingPeriod, LicenseStatus } from '@gymtech/shared';

/**
 * One license per gym. Plan metadata is inlined on the row, so the
 * repository is mostly a thin wrapper that returns the single row.
 */
export class LicenseRepository {
  constructor(private db: D1Database, private gymId: number) {}

  async findByGymId(gymId: number = this.gymId): Promise<License | null> {
    return await this.db
      .prepare(`SELECT * FROM licenses WHERE gym_id = ?`)
      .bind(gymId)
      .first<License>();
  }

  async listAll(): Promise<License[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM licenses ORDER BY gym_id ASC`)
      .all<License>();
    return results || [];
  }

  async create(data: Omit<License, 'id' | 'created_at' | 'updated_at' | 'sms_used' | 'whatsapp_used' | 'email_used'>): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const res = await this.db
      .prepare(
        `INSERT INTO licenses (
          gym_id, name, code, price_paise, billing_period,
          max_members, max_owners, max_managers, max_staff_total,
          max_sms, max_whatsapp, max_email,
          features, started_at, expires_at, status,
          created_by_admin_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id`
      )
      .bind(
        data.gym_id,
        data.name,
        data.code,
        data.price_paise,
        data.billing_period,
        data.max_members,
        data.max_owners,
        data.max_managers,
        data.max_staff_total,
        data.max_sms,
        data.max_whatsapp,
        data.max_email,
        data.features,
        data.started_at,
        data.expires_at,
        data.status,
        data.created_by_admin_id,
        now,
        now
      )
      .first<{ id: number }>();
    return res!.id;
  }

  async updateByGym(gymId: number, patch: Partial<License>): Promise<void> {
    const fields: string[] = [];
    const bindings: any[] = [];
    const allowed: (keyof License)[] = [
      'name',
      'code',
      'price_paise',
      'billing_period',
      'max_members',
      'max_owners',
      'max_managers',
      'max_staff_total',
      'max_sms',
      'max_whatsapp',
      'max_email',
      'features',
      'expires_at',
      'status',
    ];
    for (const k of allowed) {
      if (patch[k] !== undefined) {
        fields.push(`${String(k)} = ?`);
        bindings.push(patch[k]);
      }
    }
    if (fields.length === 0) return;
    fields.push('updated_at = unixepoch()');
    bindings.push(gymId);
    await this.db
      .prepare(`UPDATE licenses SET ${fields.join(', ')} WHERE gym_id = ?`)
      .bind(...bindings)
      .run();
  }

  async incrementUsage(gymId: number, channel: 'sms' | 'whatsapp' | 'email', delta = 1): Promise<void> {
    const col = `${channel}_used`;
    await this.db
      .prepare(`UPDATE licenses SET ${col} = ${col} + ?, updated_at = unixepoch() WHERE gym_id = ?`)
      .bind(delta, gymId)
      .run();
  }

  async topUpCredits(gymId: number, channel: 'sms' | 'whatsapp' | 'email', credits: number): Promise<void> {
    const col = `max_${channel}`;
    await this.db
      .prepare(`UPDATE licenses SET ${col} = ${col} + ?, updated_at = unixepoch() WHERE gym_id = ?`)
      .bind(credits, gymId)
      .run();
  }
}

