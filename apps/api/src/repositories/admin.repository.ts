import { hashPassword } from '../lib/session';
import { LicenseRepository } from './license.repository';
import type { Gym, License } from '@gymtech/shared';

/**
 * Platform-admin repository. All cross-tenant operations live here.
 * Never instantiates with a gymId — operates on the whole platform.
 */
export class AdminRepository {
  private licenseRepo: LicenseRepository;

  constructor(private db: D1Database) {
    this.licenseRepo = new LicenseRepository(db, 0);
  }

  async listGyms(): Promise<any[]> {
    const { results } = await this.db
      .prepare(
        `SELECT g.*,
                l.name as license_name,
                l.price_paise as license_price_paise,
                l.status as license_status,
                l.expires_at as license_expires_at,
                l.max_members as license_max_members,
                l.max_sms as license_max_sms,
                l.sms_used as license_sms_used,
                l.max_whatsapp as license_max_whatsapp,
                l.whatsapp_used as license_whatsapp_used,
                (SELECT COUNT(*) FROM members WHERE gym_id = g.id AND deleted_at IS NULL) as member_count
         FROM gyms g
         LEFT JOIN licenses l ON l.gym_id = g.id
         WHERE g.deleted_at IS NULL
         ORDER BY g.created_at DESC`
      )
      .all<any>();
    return results || [];
  }

  async getPlatformMetrics() {
    const gymsRes = await this.db
      .prepare(
        `SELECT COUNT(*) as total_gyms,
                SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_gyms,
                SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) as suspended_gyms
         FROM gyms WHERE deleted_at IS NULL`
      )
      .first<any>();

    const membersRes = await this.db
      .prepare(`SELECT COUNT(*) as total_members FROM members WHERE deleted_at IS NULL`)
      .first<any>();

    const revRes = await this.db
      .prepare(`SELECT SUM(amount_paise) as platform_revenue FROM payments WHERE status = 'COMPLETED'`)
      .first<any>();

    return {
      totalGyms: gymsRes?.total_gyms || 0,
      activeGyms: gymsRes?.active_gyms || 0,
      suspendedGyms: gymsRes?.suspended_gyms || 0,
      totalMembers: membersRes?.total_members || 0,
      platformRevenue: revRes?.platform_revenue || 0,
    };
  }

  /**
   * Atomic gym creation. Returns the new gym + owner ids.
   */
  async createGymWithOwner(data: {
    gymName: string;
    slug: string;
    gymPhone: string;
    city?: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    ownerPasswordPlain: string;
    licenseName: string;
    licenseCode: string;
    pricePaise: number;
    billingPeriod: 'MONTHLY' | 'YEARLY';
    maxMembers: number;
    maxOwners: number;
    maxManagers: number;
    maxStaffTotal: number;
    features: string;
    durationDays: number;
  }): Promise<{ gymId: number; userId: number }> {
    const passwordHash = await hashPassword(data.ownerPasswordPlain);
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + data.durationDays * 86400;

    // 1. Gym
    const gymRes = await this.db
      .prepare(
        `INSERT INTO gyms (name, slug, phone, city, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`
      )
      .bind(data.gymName.trim(), data.slug.trim(), data.gymPhone.trim(), data.city?.trim() ?? null, now, now)
      .run();
    const gymId = Number(gymRes.meta?.last_row_id ?? 0);

    // 2. Owner user
    const userRes = await this.db
      .prepare(
        `INSERT INTO users (
          gym_id, name, email, phone, password_hash, password_algo, role, status, permissions, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'argon2id', 'OWNER', 'ACTIVE', '{}', ?, ?)`
      )
      .bind(gymId, data.ownerName.trim(), data.ownerEmail.toLowerCase().trim(), data.ownerPhone.trim(), passwordHash, now, now)
      .run();
    const userId = Number(userRes.meta?.last_row_id ?? 0);

    // 3. License
    await this.db
      .prepare(
        `INSERT INTO licenses (
          gym_id, name, code, price_paise, billing_period,
          max_members, max_owners, max_managers, max_staff_total,
          max_sms, max_whatsapp, max_email, features,
          started_at, expires_at, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, 'ACTIVE', ?, ?)`
      )
      .bind(
        gymId, data.licenseName, data.licenseCode, data.pricePaise, data.billingPeriod,
        data.maxMembers, data.maxOwners, data.maxManagers, data.maxStaffTotal,
        data.features, now, expiry, now, now
      )
      .run();

    // 4. Seed default starter membership plans for the new gym
    const starterPlans = [
      { name: 'Monthly General', duration_months: 1, price_paise: 150000, admission_fee_paise: 0, tax_percentage: 0, is_active: 1 as const },
      { name: 'Quarterly Fitness', duration_months: 3, price_paise: 400000, admission_fee_paise: 0, tax_percentage: 0, is_active: 1 as const },
      { name: 'Annual VIP Pass', duration_months: 12, price_paise: 1200000, admission_fee_paise: 0, tax_percentage: 0, is_active: 1 as const },
    ];
    for (const p of starterPlans) {
      await this.db
        .prepare(
          `INSERT INTO membership_plans (
            gym_id, name, duration_months, price_paise, admission_fee_paise,
            tax_percentage, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(gymId, p.name, p.duration_months, p.price_paise, p.admission_fee_paise, p.tax_percentage, p.is_active, now, now)
        .run();
    }

    // 5. Seed default features for the new gym
    const defaultFeatures = [
      'dashboard',
      'members',
      'attendance',
      'payments',
      'pt_collections',
      'plans',
      'staff',
      'reports',
      'settings',
    ];
    for (const f of defaultFeatures) {
      await this.db
        .prepare(
          `INSERT OR IGNORE INTO gym_features (gym_id, feature_key, is_enabled, updated_at)
           VALUES (?, ?, 1, unixepoch())`
        )
        .bind(gymId, f)
        .run();
    }

    return { gymId, userId };
  }

  async toggleGymStatus(gymId: number, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED') {
    await this.db
      .prepare(`UPDATE gyms SET status = ?, updated_at = unixepoch() WHERE id = ?`)
      .bind(status, gymId)
      .run();
  }

  async getGymFeatures(gymId: number): Promise<Record<string, boolean>> {
    const { results } = await this.db
      .prepare(`SELECT feature_key, is_enabled FROM gym_features WHERE gym_id = ?`)
      .bind(gymId)
      .all<{ feature_key: string; is_enabled: number }>();

    const out: Record<string, boolean> = {
      dashboard: true,
      members: true,
      attendance: true,
      payments: true,
      pt_collections: true,
      plans: true,
      staff: true,
      reports: true,
      settings: true,
    };

    if (results) {
      for (const r of results) {
        out[r.feature_key] = r.is_enabled === 1;
      }
    }
    return out;
  }

  async updateGymFeatures(gymId: number, features: Record<string, boolean>): Promise<void> {
    for (const [key, enabled] of Object.entries(features)) {
      await this.db
        .prepare(
          `INSERT INTO gym_features (gym_id, feature_key, is_enabled, updated_at)
           VALUES (?, ?, ?, unixepoch())
           ON CONFLICT (gym_id, feature_key)
           DO UPDATE SET is_enabled = excluded.is_enabled, updated_at = unixepoch()`
        )
        .bind(gymId, key, enabled ? 1 : 0)
        .run();
    }
  }

  async listGymUsers(gymId: number): Promise<any[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, gym_id, name, email, phone, role, status, created_at, updated_at
         FROM users
         WHERE gym_id = ? AND deleted_at IS NULL
         ORDER BY created_at ASC`
      )
      .bind(gymId)
      .all<any>();
    return results || [];
  }

  async updateGymUser(userId: number, patch: {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    status?: string;
    passwordPlain?: string;
  }): Promise<void> {
    const fields: string[] = [];
    const bindings: any[] = [];

    if (patch.name !== undefined) {
      fields.push('name = ?');
      bindings.push(patch.name.trim());
    }
    if (patch.email !== undefined) {
      fields.push('email = ?');
      bindings.push(patch.email.toLowerCase().trim());
    }
    if (patch.phone !== undefined) {
      fields.push('phone = ?');
      bindings.push(patch.phone.trim());
    }
    if (patch.role !== undefined) {
      fields.push('role = ?');
      bindings.push(patch.role);
    }
    if (patch.status !== undefined) {
      fields.push('status = ?');
      bindings.push(patch.status);
    }
    if (patch.passwordPlain) {
      const hash = await hashPassword(patch.passwordPlain);
      fields.push('password_hash = ?');
      fields.push('password_algo = ?');
      bindings.push(hash);
      bindings.push('argon2id');
    }

    if (fields.length === 0) return;
    fields.push('updated_at = unixepoch()');
    bindings.push(userId);

    await this.db
      .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`)
      .bind(...bindings)
      .run();
  }

  async updateLicenseLimits(gymId: number, patch: {
    maxMembers?: number;
    maxOwners?: number;
    maxManagers?: number;
    maxStaffTotal?: number;
    expiresAt?: number;
    pricePaise?: number;
    billingPeriod?: 'MONTHLY' | 'YEARLY';
  }): Promise<void> {
    const fields: string[] = [];
    const bindings: any[] = [];

    if (patch.maxMembers !== undefined) {
      fields.push('max_members = ?');
      bindings.push(patch.maxMembers);
    }
    if (patch.maxOwners !== undefined) {
      fields.push('max_owners = ?');
      bindings.push(patch.maxOwners);
    }
    if (patch.maxManagers !== undefined) {
      fields.push('max_managers = ?');
      bindings.push(patch.maxManagers);
    }
    if (patch.maxStaffTotal !== undefined) {
      fields.push('max_staff_total = ?');
      bindings.push(patch.maxStaffTotal);
    }
    if (patch.expiresAt !== undefined) {
      fields.push('expires_at = ?');
      bindings.push(patch.expiresAt);
    }
    if (patch.pricePaise !== undefined) {
      fields.push('price_paise = ?');
      bindings.push(patch.pricePaise);
    }
    if (patch.billingPeriod !== undefined) {
      fields.push('billing_period = ?');
      bindings.push(patch.billingPeriod);
    }

    if (fields.length === 0) return;
    fields.push('updated_at = unixepoch()');
    bindings.push(gymId);

    await this.db
      .prepare(`UPDATE licenses SET ${fields.join(', ')} WHERE gym_id = ?`)
      .bind(...bindings)
      .run();
  }
}
