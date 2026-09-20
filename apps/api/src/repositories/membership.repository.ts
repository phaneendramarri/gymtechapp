import { eq, and, desc, gt, isNull, lt } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import type { Membership } from '@gymtech/shared';
import { memberships, membershipPlans, members } from '../db/schema';

export class MembershipRepository {
  private db: Database;

  constructor(db: Database | D1Database, private gymId: number) {
    this.db = (db as any).prepare ? createDatabase(db as D1Database) : (db as Database);
  }

  async findByMemberId(memberId: number): Promise<any[]> {
    const rows = await this.db
      .select({
        id: memberships.id,
        gymId: memberships.gymId,
        memberId: memberships.memberId,
        membershipPlanId: memberships.membershipPlanId,
        startDate: memberships.startDate,
        endDate: memberships.endDate,
        totalAmountPaise: memberships.totalAmountPaise,
        discountPaise: memberships.discountPaise,
        finalAmountPaise: memberships.finalAmountPaise,
        paidAmountPaise: memberships.paidAmountPaise,
        dueAmountPaise: memberships.dueAmountPaise,
        status: memberships.status,
        frozenAt: memberships.frozenAt,
        notes: memberships.notes,
        createdByUserId: memberships.createdByUserId,
        createdAt: memberships.createdAt,
        updatedAt: memberships.updatedAt,
        deletedAt: memberships.deletedAt,
        planName: membershipPlans.name,
        durationMonths: membershipPlans.durationMonths,
      })
      .from(memberships)
      .leftJoin(membershipPlans, eq(memberships.membershipPlanId, membershipPlans.id))
      .where(and(eq(memberships.memberId, memberId), eq(memberships.gymId, this.gymId), isNull(memberships.deletedAt)))
      .orderBy(desc(memberships.createdAt));
    return rows;
  }

  async findActiveByMemberId(memberId: number): Promise<any | null> {
    const rows = await this.db
      .select({
        id: memberships.id,
        gymId: memberships.gymId,
        memberId: memberships.memberId,
        membershipPlanId: memberships.membershipPlanId,
        startDate: memberships.startDate,
        endDate: memberships.endDate,
        totalAmountPaise: memberships.totalAmountPaise,
        discountPaise: memberships.discountPaise,
        finalAmountPaise: memberships.finalAmountPaise,
        paidAmountPaise: memberships.paidAmountPaise,
        dueAmountPaise: memberships.dueAmountPaise,
        status: memberships.status,
        frozenAt: memberships.frozenAt,
        notes: memberships.notes,
        createdByUserId: memberships.createdByUserId,
        createdAt: memberships.createdAt,
        updatedAt: memberships.updatedAt,
        deletedAt: memberships.deletedAt,
        planName: membershipPlans.name,
        durationMonths: membershipPlans.durationMonths,
      })
      .from(memberships)
      .leftJoin(membershipPlans, eq(memberships.membershipPlanId, membershipPlans.id))
      .where(and(eq(memberships.memberId, memberId), eq(memberships.gymId, this.gymId), eq(memberships.status, 'ACTIVE' as any), isNull(memberships.deletedAt)))
      .orderBy(desc(memberships.endDate))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * The membership a walk-in dues payment should settle: the member's
   * ACTIVE membership with outstanding dues (latest-ending first).
   * Returns null when nothing is owed — the payment is then recorded
   * standalone (advance / walk-in) without touching dues.
   */
  async findDueMembershipId(memberId: number): Promise<number | null> {
    const rows = await this.db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.memberId, memberId),
          eq(memberships.gymId, this.gymId),
          eq(memberships.status, 'ACTIVE' as any),
          isNull(memberships.deletedAt),
          gt(memberships.dueAmountPaise, 0)
        )
      )
      .orderBy(desc(memberships.endDate))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  async findById(id: number): Promise<Membership | null> {
    const rows = await this.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.id, id), eq(memberships.gymId, this.gymId), isNull(memberships.deletedAt)))
      .limit(1);
    return (rows[0] as Membership) ?? null;
  }

  async create(data: {
    memberId: number;
    membershipPlanId: number;
    startDate: number;
    endDate: number;
    totalAmountPaise: number;
    discountPaise: number;
    finalAmountPaise: number;
    paidAmountPaise: number;
    dueAmountPaise: number;
    notes?: string | null;
    createdByUserId?: number | null;
  }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .insert(memberships)
      .values({
        gymId: this.gymId,
        memberId: data.memberId,
        membershipPlanId: data.membershipPlanId,
        startDate: data.startDate,
        endDate: data.endDate,
        totalAmountPaise: data.totalAmountPaise,
        discountPaise: data.discountPaise,
        finalAmountPaise: data.finalAmountPaise,
        paidAmountPaise: data.paidAmountPaise,
        dueAmountPaise: data.dueAmountPaise,
        status: 'ACTIVE',
        notes: data.notes ?? null,
        createdByUserId: data.createdByUserId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: memberships.id });
    return row[0]!.id;
  }

  /** Expire memberships whose end date has passed; returns rows changed. */
  async expireIfDue(gymId: number, nowUnix: number): Promise<number> {
    const result = await this.db
      .update(memberships)
      .set({ status: 'EXPIRED' as any, updatedAt: nowUnix })
      .where(and(eq(memberships.gymId, gymId), eq(memberships.status, 'ACTIVE' as any), lt(memberships.endDate, nowUnix), isNull(memberships.deletedAt)));
    return (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
  }

  async getExpiringSoon(days = 7): Promise<any[]> {
    const now = Math.floor(Date.now() / 1000);
    const target = now + days * 86400;
    const rows = await this.db
      .select({
        // `id` is consumed as the MEMBER id by DashboardService (ExpiringMember.id);
        // the membership row id is exposed separately.
        id: memberships.memberId,
        membershipId: memberships.id,
        gymId: memberships.gymId,
        memberId: memberships.memberId,
        membershipPlanId: memberships.membershipPlanId,
        startDate: memberships.startDate,
        endDate: memberships.endDate,
        totalAmountPaise: memberships.totalAmountPaise,
        discountPaise: memberships.discountPaise,
        finalAmountPaise: memberships.finalAmountPaise,
        paidAmountPaise: memberships.paidAmountPaise,
        dueAmountPaise: memberships.dueAmountPaise,
        status: memberships.status,
        frozenAt: memberships.frozenAt,
        notes: memberships.notes,
        createdByUserId: memberships.createdByUserId,
        createdAt: memberships.createdAt,
        updatedAt: memberships.updatedAt,
        deletedAt: memberships.deletedAt,
        firstName: members.firstName,
        lastName: members.lastName,
        phone: members.phone,
        memberCode: members.memberCode,
        planName: membershipPlans.name,
      })
      .from(memberships)
      .innerJoin(members, eq(memberships.memberId, members.id))
      .leftJoin(membershipPlans, eq(memberships.membershipPlanId, membershipPlans.id))
      .where(
        and(
          eq(memberships.gymId, this.gymId),
          eq(memberships.status, 'ACTIVE' as any),
          isNull(memberships.deletedAt),
          eq(members.gymId, this.gymId),
          isNull(members.deletedAt),
        )
      );
    // Filter by date range in JS
    return rows.filter((r) => r.endDate >= now && r.endDate <= target).sort((a, b) => a.endDate - b.endDate);
  }
}

