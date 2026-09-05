import { eq, and, desc, isNull } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import type { Membership } from '@gymtech/shared';
import { memberships, membershipPlans } from '../db/schema';

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

  async updatePaymentProgress(id: number, additionalPaidPaise: number): Promise<void> {
    const current = await this.findById(id);
    if (!current) return;

    const { paidAmount, dueAmount } = applyPayment(
      current.finalAmountPaise,
      current.paidAmountPaise,
      additionalPaidPaise
    );

    await this.db
      .update(memberships)
      .set({
        paidAmountPaise: paidAmount,
        dueAmountPaise: dueAmount,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(and(eq(memberships.id, id), eq(memberships.gymId, this.gymId)));
  }

  async getExpiringSoon(days = 7): Promise<any[]> {
    const now = Math.floor(Date.now() / 1000);
    const target = now + days * 86400;
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

// Circular dep workaround: import here to avoid circular with member.repository
import { members } from '../db/schema';

function applyPayment(
  totalPaise: number,
  alreadyPaidPaise: number,
  paymentPaise: number
): { paidAmount: number; dueAmount: number } {
  const newPaid = Math.min(alreadyPaidPaise + paymentPaise, totalPaise);
  return { paidAmount: newPaid, dueAmount: totalPaise - newPaid };
}
