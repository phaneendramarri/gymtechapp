/**
 * Platform-admin repository — cross-tenant operations.
 *
 * Uses raw SQL via db.prepare for multi-tenant JOINs that span
 * multiple tables (gyms + licenses + members) since Drizzle's query
 * builder doesn't cleanly express this pattern.
 */
import { eq, sql } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import { hashPassword } from '../lib/session';
import { parseEnabledFeatures } from '../lib/features';
import { deriveCoarseRole } from '../lib/roles';
import { GYM_FEATURES } from '@gymtech/shared';
import { LicenseRepository } from './license.repository';
import { licenses, gyms, users, members, membershipPlans, roles } from '../db/schema';

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
             l.name as licenseName,
             l.pricePaise as licensePricePaise,
             l.status as licenseStatus,
             l.expiresAt as licenseExpiresAt,
             l.maxMembers as licenseMaxMembers,
             l.maxSms as licenseMaxSms,
             l.smsUsed as licenseSmsUsed,
             l.maxWhatsapp as licenseMaxWhatsapp,
             l.whatsappUsed as licenseWhatsappUsed,
             (SELECT COUNT(*) FROM members WHERE gymId = g.id AND deletedAt IS NULL) as memberCount
      FROM gyms g
      LEFT JOIN licenses l ON l.gymId = g.id
      WHERE g.deletedAt IS NULL
      ORDER BY g.createdAt DESC
    `).all();
    return results || [];
  }

  async getPlatformMetrics() {
    const { results: gymsResults } = await this.d1.prepare(`
      SELECT
        COUNT(*) as total_gyms,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_gyms,
        SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) as suspended_gyms
      FROM gyms WHERE deletedAt IS NULL
    `).all();

    const { results: membersResults } = await this.d1.prepare(`
      SELECT COUNT(*) as total_members FROM members WHERE deletedAt IS NULL
    `).all();

    const { results: revResults } = await this.d1.prepare(`
      SELECT SUM(amountPaise) as platform_revenue FROM payments WHERE status = 'COMPLETED'
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

    // Provisioning touches gyms + roles + users + licenses + plans. D1 has
    // no multi-statement transaction here, so track what was created and
    // roll it back on failure — otherwise a late failure (e.g. a duplicate
    // license code) leaves an orphan gym with no license that can never
    // sign in (requireGym rejects gyms without a license).
    let gymId: number | null = null;
    let userId: number | null = null;
    let ownerRoleId: number | null = null;
    try {
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
      gymId = gymRow[0]!.id;

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
      ownerRoleId = ownerRoleRow[0]!.id;

      // 3. Owner user (references the OWNER role)
      const userRow = await this.db.insert(users).values({
        gymId,
        name: data.ownerName.trim(),
        email: data.ownerEmail.toLowerCase().trim(),
        phone: data.ownerPhone.trim(),
        passwordHash,
        roleId: ownerRoleId,
        status: 'ACTIVE',
        isOwner: true,
        createdAt: now,
        updatedAt: now,
      }).returning({ id: users.id });
      userId = userRow[0]!.id;

      // 4. License — `code` is globally unique, and the admin console
      // reuses short codes like "PRO" for every gym. Suffix with the gym id
      // on collision so the second provisioning never 400s.
      let code = (data.licenseCode || `PLAN-${gymId}`).trim().toUpperCase() || `PLAN-${gymId}`;
      const codeTaken = await this.db
        .select({ id: licenses.id })
        .from(licenses)
        .where(eq(licenses.code, code))
        .limit(1);
      if (codeTaken.length > 0) code = `${code}-${gymId}`;
      await this.db.insert(licenses).values({
        gymId,
        name: data.licenseName,
        code,
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

      return { gymId, userId };
    } catch (e) {
      // Compensating rollback, reverse creation order. Best-effort: the
      // original error is what the caller reports.
      try {
        if (userId !== null) {
          await this.db.delete(users).where(eq(users.id, userId));
        }
        if (ownerRoleId !== null) {
          await this.db.delete(roles).where(eq(roles.id, ownerRoleId));
        }
        if (gymId !== null) {
          await this.db.delete(membershipPlans).where(eq(membershipPlans.gymId, gymId));
          await this.db.delete(licenses).where(eq(licenses.gymId, gymId));
          await this.db.delete(gyms).where(eq(gyms.id, gymId));
        }
      } catch {
        // Rollback must never mask the provisioning error.
      }
      throw e;
    }
  }

  async toggleGymStatus(gymId: number, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'): Promise<void> {
    await this.db
      .update(gyms)
      .set({ status, updatedAt: Math.floor(Date.now() / 1000) })
      .where(sql`id = ${gymId} AND deletedAt IS NULL`);
  }

  /**
   * Read a gym's feature flags from its license (`licenses.features`).
   * An empty/absent map means "everything enabled" (default license).
   * Every catalog key is always returned so the admin UI renders a full,
   * explicit toggle list.
   */
  async getGymFeatures(gymId: number): Promise<Record<string, boolean>> {
    const row = await this.db
      .select({ features: licenses.features })
      .from(licenses)
      .where(eq(licenses.gymId, gymId))
      .limit(1);

    const enabled = new Set(parseEnabledFeatures(row[0]?.features));
    return Object.fromEntries(GYM_FEATURES.map((key) => [key, enabled.has(key)]));
  }

  /**
   * Persist a gym's feature flags onto its license. Only catalogue keys are
   * stored; unknown keys are ignored so a stale client cannot inject noise.
   */
  async updateGymFeatures(gymId: number, features: Record<string, boolean>): Promise<void> {
    const sanitized: Record<string, boolean> = {};
    for (const key of GYM_FEATURES) {
      sanitized[key] = features[key] === true;
    }
    await this.db
      .update(licenses)
      .set({ features: JSON.stringify(sanitized), updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(licenses.gymId, gymId));
  }

  async listGymUsers(gymId: number): Promise<any[]> {
    // `role` is derived from the joined role row — there is no stored copy.
    const rows = await this.db
      .select({
        id: users.id,
        gymId: users.gymId,
        name: users.name,
        email: users.email,
        phone: users.phone,
        roleId: users.roleId,
        roleName: roles.name,
        roleIsOwner: roles.isOwner,
        isOwner: users.isOwner,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .leftJoin(roles, eq(roles.id, users.roleId))
      .where(sql`${users.gymId} = ${gymId} AND ${users.deletedAt} IS NULL`)
      .orderBy(users.createdAt);

    return rows.map((u) => ({
      ...u,
      role: deriveCoarseRole({
        isOwner: u.isOwner,
        roleIsOwner: u.roleIsOwner,
        roleName: u.roleName,
      }),
    }));
  }

  async updateGymUser(
    userId: number,
    patch: {
      name?: string;
      email?: string;
      phone?: string;
      status?: string;
      passwordPlain?: string;
    }
  ): Promise<void> {
    const sets: Record<string, unknown> = {};
    if (patch.name !== undefined) sets.name = patch.name.trim();
    if (patch.email !== undefined) sets.email = patch.email.toLowerCase().trim();
    if (patch.phone !== undefined) sets.phone = patch.phone.trim();
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
