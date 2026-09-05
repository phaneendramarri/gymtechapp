import { eq, and, isNull, asc } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import type { GymMembershipPlan } from '@gymtech/shared';
import { membershipPlans } from '../db/schema';

export class PlanRepository {
  private db: Database;

  constructor(db: Database | D1Database, private gymId: number) {
    this.db = (db as any).prepare ? createDatabase(db as D1Database) : (db as Database);
  }

  async listActive(): Promise<GymMembershipPlan[]> {
    return this.db
      .select()
      .from(membershipPlans)
      .where(and(eq(membershipPlans.gymId, this.gymId), eq(membershipPlans.isActive, 1), isNull(membershipPlans.deletedAt)))
      .orderBy(asc(membershipPlans.durationMonths)) as unknown as GymMembershipPlan[];
  }

  async listAll(): Promise<GymMembershipPlan[]> {
    return this.db
      .select()
      .from(membershipPlans)
      .where(and(eq(membershipPlans.gymId, this.gymId), isNull(membershipPlans.deletedAt)))
      .orderBy(asc(membershipPlans.isActive), asc(membershipPlans.durationMonths)) as unknown as GymMembershipPlan[];
  }

  async findById(id: number): Promise<GymMembershipPlan | null> {
    const rows = await this.db
      .select()
      .from(membershipPlans)
      .where(and(eq(membershipPlans.id, id), eq(membershipPlans.gymId, this.gymId), isNull(membershipPlans.deletedAt)))
      .limit(1);
    return (rows[0] as GymMembershipPlan) ?? null;
  }

  async create(
    data: Omit<GymMembershipPlan, 'id' | 'createdAt' | 'updatedAt' | 'gymId'> & { billingPeriod?: 'MONTHLY' | 'YEARLY' }
  ): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .insert(membershipPlans)
      .values({
        gymId: this.gymId,
        name: data.name,
        description: data.description ?? null,
        durationMonths: data.durationMonths,
        pricePaise: data.pricePaise,
        admissionFeePaise: data.admissionFeePaise ?? 0,
        taxPercentage: data.taxPercentage ?? 0,
        billingPeriod: data.billingPeriod, // L9/L10: revenue bucketing
        isActive: data.isActive,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: membershipPlans.id });
    return row[0]!.id;
  }

  async update(id: number, data: Partial<GymMembershipPlan>): Promise<void> {
    const sets: Partial<typeof membershipPlans.$inferInsert> = {};
    if (data.name !== undefined) sets.name = data.name;
    if (data.description !== undefined) sets.description = data.description;
    if (data.durationMonths !== undefined) sets.durationMonths = data.durationMonths;
    if (data.pricePaise !== undefined) sets.pricePaise = data.pricePaise;
    if (data.admissionFeePaise !== undefined) sets.admissionFeePaise = data.admissionFeePaise;
    if (data.taxPercentage !== undefined) sets.taxPercentage = data.taxPercentage;
    if (data.isActive !== undefined) sets.isActive = data.isActive;
    if (Object.keys(sets).length === 0) return;
    sets.updatedAt = Math.floor(Date.now() / 1000);

    await this.db
      .update(membershipPlans)
      .set(sets)
      .where(and(eq(membershipPlans.id, id), eq(membershipPlans.gymId, this.gymId)));
  }

  async softDelete(id: number): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .update(membershipPlans)
      .set({ deletedAt: now, isActive: 0, updatedAt: now })
      .where(and(eq(membershipPlans.id, id), eq(membershipPlans.gymId, this.gymId), isNull(membershipPlans.deletedAt)))
      .returning({ id: membershipPlans.id });
    return row.length > 0;
  }

  async restore(id: number): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .update(membershipPlans)
      .set({ deletedAt: null, isActive: 1, updatedAt: now })
      .where(and(eq(membershipPlans.id, id), eq(membershipPlans.gymId, this.gymId)))
      .returning({ id: membershipPlans.id });
    return row.length > 0;
  }
}
