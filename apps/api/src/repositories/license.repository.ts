import { eq, sql } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import type { License } from '@gymtech/shared';
import { licenses } from '../db/schema';

export class LicenseRepository {
  private db: Database;

  constructor(db: Database | D1Database, private gymId: number) {
    this.db = (db as any).prepare ? createDatabase(db as D1Database) : (db as Database);
  }

  async findByGymId(gymId: number = this.gymId): Promise<License | null> {
    const rows = await this.db
      .select()
      .from(licenses)
      .where(eq(licenses.gymId, gymId))
      .limit(1);
    return (rows[0] as License) ?? null;
  }

  async listAll(): Promise<License[]> {
    return this.db
      .select()
      .from(licenses)
      .orderBy(licenses.gymId) as unknown as License[];
  }

  async create(
    data: Omit<License, 'id' | 'createdAt' | 'updatedAt' | 'smsUsed' | 'whatsappUsed' | 'emailUsed'>
  ): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .insert(licenses)
      .values({
        gymId: data.gymId,
        name: data.name,
        code: data.code,
        pricePaise: data.pricePaise,
        billingPeriod: data.billingPeriod,
        maxMembers: data.maxMembers,
        maxOwners: data.maxOwners,
        maxManagers: data.maxManagers,
        maxStaffTotal: data.maxStaffTotal,
        maxSms: data.maxSms,
        maxWhatsapp: data.maxWhatsapp,
        maxEmail: data.maxEmail,
        features: data.features,
        startedAt: data.startedAt,
        expiresAt: data.expiresAt,
        status: data.status,
        createdByAdminId: data.createdByAdminId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: licenses.id });
    return row[0]!.id;
  }

  async updateByGym(gymId: number, patch: Partial<License>): Promise<void> {
    const sets: Record<string, unknown> = {};
    if (patch.name !== undefined) sets.name = patch.name;
    if (patch.code !== undefined) sets.code = patch.code;
    if (patch.pricePaise !== undefined) sets.pricePaise = patch.pricePaise;
    if (patch.billingPeriod !== undefined) sets.billingPeriod = patch.billingPeriod;
    if (patch.maxMembers !== undefined) sets.maxMembers = patch.maxMembers;
    if (patch.maxOwners !== undefined) sets.maxOwners = patch.maxOwners;
    if (patch.maxManagers !== undefined) sets.maxManagers = patch.maxManagers;
    if (patch.maxStaffTotal !== undefined) sets.maxStaffTotal = patch.maxStaffTotal;
    if (patch.maxSms !== undefined) sets.maxSms = patch.maxSms;
    if (patch.maxWhatsapp !== undefined) sets.maxWhatsapp = patch.maxWhatsapp;
    if (patch.maxEmail !== undefined) sets.maxEmail = patch.maxEmail;
    if (patch.features !== undefined) sets.features = patch.features;
    if (patch.expiresAt !== undefined) sets.expiresAt = patch.expiresAt;
    if (patch.status !== undefined) sets.status = patch.status;
    if (Object.keys(sets).length === 0) return;
    sets.updatedAt = Math.floor(Date.now() / 1000);

    await this.db
      .update(licenses)
      .set(sets as Partial<typeof licenses.$inferInsert>)
      .where(eq(licenses.gymId, gymId));
  }

  async incrementUsage(gymId: number, channel: 'sms' | 'whatsapp' | 'email', delta = 1): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    if (channel === 'sms') {
      await this.db.update(licenses).set({ smsUsed: sql`${licenses.smsUsed} + ${delta}`, updatedAt: now }).where(eq(licenses.gymId, gymId));
    } else if (channel === 'whatsapp') {
      await this.db.update(licenses).set({ whatsappUsed: sql`${licenses.whatsappUsed} + ${delta}`, updatedAt: now }).where(eq(licenses.gymId, gymId));
    } else {
      await this.db.update(licenses).set({ emailUsed: sql`${licenses.emailUsed} + ${delta}`, updatedAt: now }).where(eq(licenses.gymId, gymId));
    }
  }

  async topUpCredits(gymId: number, channel: 'sms' | 'whatsapp' | 'email', credits: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    if (channel === 'sms') {
      await this.db.update(licenses).set({ maxSms: sql`${licenses.maxSms} + ${credits}`, updatedAt: now }).where(eq(licenses.gymId, gymId));
    } else if (channel === 'whatsapp') {
      await this.db.update(licenses).set({ maxWhatsapp: sql`${licenses.maxWhatsapp} + ${credits}`, updatedAt: now }).where(eq(licenses.gymId, gymId));
    } else {
      await this.db.update(licenses).set({ maxEmail: sql`${licenses.maxEmail} + ${credits}`, updatedAt: now }).where(eq(licenses.gymId, gymId));
    }
  }
}
