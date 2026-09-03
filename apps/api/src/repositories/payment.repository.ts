import { eq, and, desc, sql } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import type { Payment, PaymentMode, PaymentWithDetails } from '@gymtech/shared';
import { payments, members, users, memberships } from '../db/schema';

export class PaymentRepository {
  private db: Database;

  constructor(db: Database | D1Database, private gymId: number) {
    this.db = (db as any).prepare ? createDatabase(db as D1Database) : (db as Database);
  }

  async list(params: { limit?: number; offset?: number; memberId?: number }): Promise<PaymentWithDetails[]> {
    let query = this.db
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
      .where(eq(payments.gymId, this.gymId))
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0) as any;

    if (params.memberId) {
      query = query.where(and(eq(payments.gymId, this.gymId), eq(payments.memberId, params.memberId)));
    }

    return (await query) as PaymentWithDetails[];
  }

  async count(params: { memberId?: number } = {}): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(params.memberId
        ? and(eq(payments.gymId, this.gymId), eq(payments.memberId, params.memberId))
        : eq(payments.gymId, this.gymId)
      );
    return count ?? 0;
  }

  async getNextReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(payments)
      .where(eq(payments.gymId, this.gymId));
    const count = (total || 0) + 1;
    return `RCP-${year}-${String(count).padStart(4, '0')}`;
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
