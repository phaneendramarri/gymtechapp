/**
 * Platform-admin repository — cross-tenant operations.
 *
 * Uses raw SQL via db.prepare for multi-tenant JOINs that span
 * multiple tables (gyms + licenses + members) since Drizzle's query
 * builder doesn't cleanly express this pattern.
 */
import { sql } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import { hashPassword } from '../lib/session';
import { LicenseRepository } from './license.repository';
import { licenses, gyms, users, members, membershipPlans, gymFeatures, roles } from '../db/schema';

export class AdminRepository {
  private licenseRepo: LicenseRepository;
  private db: Database;
  private d1: D1Database;

  constructor(db: Database | D1Database) {
    if ((db as any).prepare) {
      this.d1 = db as D1Database;
      this.db = createDatabase(db as D1Database);
    } else {
      this.db = db as Database;
      this.d1 = (db as any).$client || (db as any);
    }
    // gymId doesn't matter for license repo since all license ops are by gymId param
    this.licenseRepo = new LicenseRepository(this.db, 0);
  }

  async listGyms(): Promise<any[]> {
    const { results } = await this.d1.prepare(`
      SELECT g.*,
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
      ORDER BY g.created_at DESC
    `).all();
    return results || [];
  }

  async getPlatformMetrics() {
    const { results: gymsResults } = await this.d1.prepare(`
      SELECT
        COUNT(*) as total_gyms,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_gyms,
        SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) as suspended_gyms
      FROM gyms WHERE deleted_at IS NULL
    `).all();

    const { results: membersResults } = await this.d1.prepare(`
      SELECT COUNT(*) as total_members FROM members WHERE deleted_at IS NULL
    `).all();

    const { results: revResults } = await this.d1.prepare(`
      SELECT SUM(amount_paise) as platform_revenue FROM payments WHERE status = 'COMPLETED'
    `).all();

    return {
      totalGyms: gymsResults?.[0]?.total_gyms || 0,
      activeGyms: gymsResults?.[0]?.active_gyms || 0,
      suspendedGyms: gymsResults?.[0]?.suspended_gyms || 0,
      totalMembers: membersResults?.[0]?.total_members || 0,
      platformRevenue: revResults?.[0]?.platform_revenue || 0,
    };
  }

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
    const gymRow = await this.db.insert(gyms).values({
      name: data.gymName.trim(),
      slug: data.slug.trim(),
      phone: data.gymPhone.trim(),
      city: data.city?.trim() ?? null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    }).returning({ id: gyms.id });
    const gymId = gymRow[0]!.id;

    // 2. Owner role
    const ownerRoleRow = await this.db.insert(roles).values({
      gymId,
      name: 'OWNER',
      permissions: '[]',
      isOwner: true,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    }).returning({ id: roles.id });
    const ownerRoleId = ownerRoleRow[0]!.id;

    // 3. Owner user (references the OWNER role)
    const userRow = await this.db.insert(users).values({
      gymId,
      name: data.ownerName.trim(),
      email: data.ownerEmail.toLowerCase().trim(),
      phone: data.ownerPhone.trim(),
      passwordHash,
      role: 'OWNER',
      roleId: ownerRoleId,
      status: 'ACTIVE',
      permissions: '{}',
      isOwner: true,
      createdAt: now,
      updatedAt: now,
    }).returning({ id: users.id });
    const userId = userRow[0]!.id;

    // 4. License
    await this.db.insert(licenses).values({
      gymId,
      name: data.licenseName,
      code: data.licenseCode,
      pricePaise: data.pricePaise,
      billingPeriod: data.billingPeriod,
      maxMembers: data.maxMembers,
      maxOwners: data.maxOwners,
      maxManagers: data.maxManagers,
      maxStaffTotal: data.maxStaffTotal,
      maxSms: 0,
      maxWhatsapp: 0,
      maxEmail: 0,
      features: data.features,
      startedAt: now,
      expiresAt: expiry,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    // 5. Seed starter membership plans
    const starterPlans = [
      { name: 'Monthly General', durationMonths: 1, pricePaise: 150000, admissionFeePaise: 0, taxPercentage: 0, isActive: 1 },
      { name: 'Quarterly Fitness', durationMonths: 3, pricePaise: 400000, admissionFeePaise: 0, taxPercentage: 0, isActive: 1 },
      { name: 'Annual VIP Pass', durationMonths: 12, pricePaise: 1200000, admissionFeePaise: 0, taxPercentage: 0, isActive: 1 },
    ];
    for (const p of starterPlans) {
      await this.db.insert(membershipPlans).values({
        gymId,
        name: p.name,
        durationMonths: p.durationMonths,
        pricePaise: p.pricePaise,
        admissionFeePaise: p.admissionFeePaise,
        taxPercentage: p.taxPercentage,
        isActive: p.isActive,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 6. Seed default features
    const defaultFeatures = [
      'dashboard', 'members', 'attendance', 'payments',
      'pt_collections', 'plans', 'staff', 'reports', 'settings',
    ];
    for (const featureKey of defaultFeatures) {
      await this.db.insert(gymFeatures).values({
        gymId,
        featureKey,
        isEnabled: 1,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [gymFeatures.gymId, gymFeatures.featureKey],
        set: { isEnabled: 1, updatedAt: now },
      });
    }

    return { gymId, userId };
  }

  async toggleGymStatus(gymId: number, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'): Promise<void> {
    await this.db
      .update(gyms)
      .set({ status, updatedAt: Math.floor(Date.now() / 1000) })
      .where(sql`id = ${gymId} AND deleted_at IS NULL`);
  }

  async getGymFeatures(gymId: number): Promise<Record<string, boolean>> {
    const rows = await this.db
      .select({ featureKey: gymFeatures.featureKey, isEnabled: gymFeatures.isEnabled })
      .from(gymFeatures)
      .where(sql`${gymFeatures.gymId} = ${gymId}`);

    const out: Record<string, boolean> = {
      dashboard: true, members: true, attendance: true, payments: true,
      pt_collections: true, plans: true, staff: true, reports: true, settings: true,
    };
    for (const r of rows) {
      out[r.featureKey] = r.isEnabled === 1;
    }
    return out;
  }

  async updateGymFeatures(gymId: number, features: Record<string, boolean>): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    for (const [key, enabled] of Object.entries(features)) {
      await this.db
        .insert(gymFeatures)
        .values({ gymId, featureKey: key, isEnabled: enabled ? 1 : 0, updatedAt: now })
        .onConflictDoUpdate({
          target: [gymFeatures.gymId, gymFeatures.featureKey],
          set: { isEnabled: enabled ? 1 : 0, updatedAt: now },
        });
    }
  }

  async listGymUsers(gymId: number): Promise<any[]> {
    const rows = await this.db
      .select({
        id: users.id,
        gymId: users.gymId,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(sql`${users.gymId} = ${gymId} AND ${users.deletedAt} IS NULL`)
      .orderBy(users.createdAt);
    return rows;
  }

  async updateGymUser(
    userId: number,
    patch: {
      name?: string;
      email?: string;
      phone?: string;
      role?: string;
      status?: string;
      passwordPlain?: string;
    }
  ): Promise<void> {
    const sets: Record<string, unknown> = {};
    if (patch.name !== undefined) sets.name = patch.name.trim();
    if (patch.email !== undefined) sets.email = patch.email.toLowerCase().trim();
    if (patch.phone !== undefined) sets.phone = patch.phone.trim();
    if (patch.role !== undefined) sets.role = patch.role;
    if (patch.status !== undefined) sets.status = patch.status;
    if (patch.passwordPlain) {
      sets.passwordHash = await hashPassword(patch.passwordPlain);
    }
    if (Object.keys(sets).length === 0) return;
    sets.updatedAt = Math.floor(Date.now() / 1000);

    await this.db
      .update(users)
      .set(sets as Partial<typeof users.$inferInsert>)
      .where(sql`${users.id} = ${userId} AND ${users.deletedAt} IS NULL`);
  }

  async updateLicenseLimits(
    gymId: number,
    patch: {
      maxMembers?: number;
      maxOwners?: number;
      maxManagers?: number;
      maxStaffTotal?: number;
      expiresAt?: number;
      pricePaise?: number;
      billingPeriod?: 'MONTHLY' | 'YEARLY';
    }
  ): Promise<void> {
    const sets: Record<string, unknown> = {};
    if (patch.maxMembers !== undefined) sets.maxMembers = patch.maxMembers;
    if (patch.maxOwners !== undefined) sets.maxOwners = patch.maxOwners;
    if (patch.maxManagers !== undefined) sets.maxManagers = patch.maxManagers;
    if (patch.maxStaffTotal !== undefined) sets.maxStaffTotal = patch.maxStaffTotal;
    if (patch.expiresAt !== undefined) sets.expiresAt = patch.expiresAt;
    if (patch.pricePaise !== undefined) sets.pricePaise = patch.pricePaise;
    if (patch.billingPeriod !== undefined) sets.billingPeriod = patch.billingPeriod;
    if (Object.keys(sets).length === 0) return;
    sets.updatedAt = Math.floor(Date.now() / 1000);

    await this.db
      .update(licenses)
      .set(sets as Partial<typeof licenses.$inferInsert>)
      .where(sql`${licenses.gymId} = ${gymId}`);
  }
}
