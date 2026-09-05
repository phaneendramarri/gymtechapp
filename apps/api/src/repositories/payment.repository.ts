import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import type { Payment, PaymentMode, PaymentWithDetails } from '@gymtech/shared';
import { payments, members, users, memberships, counters } from '../db/schema';

export class PaymentRepository {
  private db: Database;
  private d1: D1Database;

  constructor(db: Database | D1Database, private gymId: number) {
    if ((db as any).prepare) {
      this.d1 = db as D1Database;
      this.db = createDatabase(db as D1Database);
    } else {
      this.db = db as Database;
      this.d1 = (db as any).$client || (db as any);
    }
  }

  async list(params: { limit?: number; offset?: number; memberId?: number }): Promise<PaymentWithDetails[]> {
    const conditions = [
      eq(payments.gymId, this.gymId),
      isNull(payments.deletedAt),
      isNull(members.deletedAt),
    ];

    if (params.memberId) {
      conditions.push(eq(payments.memberId, params.memberId));
    }

    const rows = await this.db
      .select({
        id: payments.id,
        gymId: payments.gymId,
        memberId: payments.memberId,
        membershipId: payments.membershipId,
        paymentType: payments.paymentType,
        receiptNumber: payments.receiptNumber,
        amountPaise: payments.amountPaise,
        paymentDate: payments.paymentDate,
        paymentMode: payments.paymentMode,
        referenceId: payments.referenceId,
        status: payments.status,
        recordedByUserId: payments.recordedByUserId,
        notes: payments.notes,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
        firstName: members.firstName,
        lastName: members.lastName,
        memberCode: members.memberCode,
        phone: members.phone,
        recordedByName: users.name,
      })
      .from(payments)
      .innerJoin(members, eq(payments.memberId, members.id))
      .leftJoin(users, eq(payments.recordedByUserId, users.id))
      .where(and(...conditions))
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0);

    return rows as PaymentWithDetails[];
  }

  async count(params: { memberId?: number } = {}): Promise<number> {
    const conditions = [
      eq(payments.gymId, this.gymId),
      isNull(payments.deletedAt),
    ];
    if (params.memberId) {
      conditions.push(eq(payments.memberId, params.memberId));
    }

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(and(...conditions));
    return count ?? 0;
  }

  async getNextReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    // H4 fix: use atomic upsert-returning to eliminate TOCTOU race between count and insert.
    const result = await this.d1
      .prepare(`
        INSERT INTO counters (gym_id, counter_type, value)
        VALUES (?, 'receipt', 1)
        ON CONFLICT (gym_id, counter_type) DO UPDATE SET value = value + 1
        RETURNING value AS next_val
      `)
      .bind(this.gymId)
      .all<{ next_val: number }>();
    const nextVal = result.results?.[0]?.next_val ?? 1;
    return `RCP-${year}-${String(nextVal).padStart(4, '0')}`;
  }

  async record(data: {
    memberId: number;
    membershipId?: number | null;
    receiptNumber: string;
    amountPaise: number;
    paymentDate: number;
    paymentMode: PaymentMode;
    referenceId?: string | null;
    recordedByUserId: number;
    notes?: string | null;
    paymentType?: 'GYM' | 'PERSONAL_TRAINING';
  }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .insert(payments)
      .values({
        gymId: this.gymId,
        memberId: data.memberId,
        membershipId: data.membershipId ?? null,
        paymentType: data.paymentType ?? 'GYM',
        receiptNumber: data.receiptNumber,
        amountPaise: data.amountPaise,
        paymentDate: data.paymentDate,
        paymentMode: data.paymentMode,
        referenceId: data.referenceId ?? null,
        status: 'COMPLETED',
        recordedByUserId: data.recordedByUserId,
        notes: data.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: payments.id });
    return row[0]!.id;
  }

  async getSummaryMetrics(): Promise<{ monthlyRevenue: number; todayRevenue: number; pendingDues: number }> {
    const startOfMonth = Math.floor(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000
    );
    const startOfToday = Math.floor(new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000);

    const [monthRes] = await this.db
      .select({ revenue: sql<number>`coalesce(sum(${payments.amountPaise}), 0)` })
      .from(payments)
      .where(
        and(
          eq(payments.gymId, this.gymId),
          eq(payments.status, 'COMPLETED' as any),
          isNull(payments.deletedAt),
          sql`${payments.paymentDate} >= ${startOfMonth}`
        )
      );

    const [todayRes] = await this.db
      .select({ revenue: sql<number>`coalesce(sum(${payments.amountPaise}), 0)` })
      .from(payments)
      .where(
        and(
          eq(payments.gymId, this.gymId),
          eq(payments.status, 'COMPLETED' as any),
          isNull(payments.deletedAt),
          sql`${payments.paymentDate} >= ${startOfToday}`
        )
      );

    const [duesRes] = await this.db
      .select({ total_dues: sql<number>`coalesce(sum(${memberships.dueAmountPaise}), 0)` })
      .from(memberships)
      .where(
        and(
          eq(memberships.gymId, this.gymId),
          eq(memberships.status, 'ACTIVE' as any),
          isNull(memberships.deletedAt),
          sql`${memberships.dueAmountPaise} > 0`
        )
      );

    return {
      monthlyRevenue: monthRes?.revenue ?? 0,
      todayRevenue: todayRes?.revenue ?? 0,
      pendingDues: duesRes?.total_dues ?? 0,
    };
  }
}
