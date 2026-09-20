import { eq, and, desc, sql } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { expenses, expenseCategories, payments, ptCollections, posSales } from '../db/schema';
import type { Expense, ExpenseCategory } from '@gymtech/shared';

export class ExpenseRepository {
  private db: ReturnType<typeof drizzle>;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async listCategories(gymId: number): Promise<ExpenseCategory[]> {
    const rows = await this.db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.gymId, gymId))
      .orderBy(expenseCategories.name);

    return rows.map((r) => ({
      id: r.id,
      gymId: r.gymId,
      name: r.name,
      createdAt: r.createdAt,
    }));
  }

  async createCategory(gymId: number, name: string): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const [inserted] = await this.db
      .insert(expenseCategories)
      .values({
        gymId,
        name,
        createdAt: now,
      })
      .returning({ id: expenseCategories.id });
    return inserted.id;
  }

  async listExpenses(gymId: number, fromDate?: string, toDate?: string, categoryId?: number): Promise<Expense[]> {
    const rows = await this.db
      .select({
        id: expenses.id,
        gymId: expenses.gymId,
        categoryId: expenses.categoryId,
        categoryName: expenseCategories.name,
        title: expenses.title,
        amountPaise: expenses.amountPaise,
        expenseDate: expenses.expenseDate,
        paymentMode: expenses.paymentMode,
        vendor: expenses.vendor,
        receiptUrl: expenses.receiptUrl,
        createdByUserId: expenses.createdByUserId,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(
        and(
          eq(expenses.gymId, gymId),
          fromDate ? sql`${expenses.expenseDate} >= ${fromDate}` : sql`1=1`,
          toDate ? sql`${expenses.expenseDate} <= ${toDate}` : sql`1=1`,
          categoryId ? eq(expenses.categoryId, categoryId) : sql`1=1`
        )
      )
      .orderBy(desc(expenses.expenseDate));

    return rows.map((r) => ({
      id: r.id,
      gymId: r.gymId,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      title: r.title,
      amountPaise: r.amountPaise,
      expenseDate: r.expenseDate,
      paymentMode: r.paymentMode as any,
      vendor: r.vendor,
      receiptUrl: r.receiptUrl,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt,
    }));
  }

  async createExpense(
    gymId: number,
    data: { categoryId: number; title: string; amountPaise: number; expenseDate: string; paymentMode: any; vendor?: string | null; receiptUrl?: string | null; createdByUserId?: number | null }
  ): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const [inserted] = await this.db
      .insert(expenses)
      .values({
        gymId,
        categoryId: data.categoryId,
        title: data.title,
        amountPaise: data.amountPaise,
        expenseDate: data.expenseDate,
        paymentMode: data.paymentMode,
        vendor: data.vendor ?? null,
        receiptUrl: data.receiptUrl ?? null,
        createdByUserId: data.createdByUserId ?? null,
        createdAt: now,
      })
      .returning({ id: expenses.id });
    return inserted.id;
  }

  async deleteExpense(gymId: number, id: number): Promise<void> {
    await this.db.delete(expenses).where(and(eq(expenses.gymId, gymId), eq(expenses.id, id)));
  }

  async getProfitAndLoss(gymId: number, fromDate?: string, toDate?: string): Promise<{
    revenuePaise: { memberships: number; pt: number; pos: number; total: number };
    expensesPaise: { byCategory: Array<{ category: string; amountPaise: number }>; total: number };
    netProfitPaise: number;
  }> {
    // Optional period window. Revenue columns are unix seconds; expense dates are YYYY-MM-DD strings.
    const fromEpoch = fromDate ? Math.floor(new Date(`${fromDate}T00:00:00Z`).getTime() / 1000) : undefined;
    const toEpoch = toDate ? Math.floor(new Date(`${toDate}T23:59:59Z`).getTime() / 1000) : undefined;

    // 1. Membership payment revenue
    const paymentRows = await this.db
      .select({ sum: sql<number>`coalesce(sum(${payments.amountPaise}), 0)` })
      .from(payments)
      .where(
        and(
          eq(payments.gymId, gymId),
          eq(payments.status, 'COMPLETED'),
          fromEpoch !== undefined ? sql`${payments.paymentDate} >= ${fromEpoch}` : sql`1=1`,
          toEpoch !== undefined ? sql`${payments.paymentDate} <= ${toEpoch}` : sql`1=1`
        )
      )
      .get();
    const membershipRevenue = Number(paymentRows?.sum ?? 0);

    // 2. PT collection revenue
    const ptRows = await this.db
      .select({ sum: sql<number>`coalesce(sum(${ptCollections.amountPaise}), 0)` })
      .from(ptCollections)
      .where(
        and(
          eq(ptCollections.gymId, gymId),
          fromEpoch !== undefined ? sql`${ptCollections.paymentDate} >= ${fromEpoch}` : sql`1=1`,
          toEpoch !== undefined ? sql`${ptCollections.paymentDate} <= ${toEpoch}` : sql`1=1`
        )
      )
      .get();
    const ptRevenue = Number(ptRows?.sum ?? 0);

    // 3. POS store revenue
    const posRows = await this.db
      .select({ sum: sql<number>`coalesce(sum(${posSales.totalPaise}), 0)` })
      .from(posSales)
      .where(
        and(
          eq(posSales.gymId, gymId),
          fromEpoch !== undefined ? sql`${posSales.createdAt} >= ${fromEpoch}` : sql`1=1`,
          toEpoch !== undefined ? sql`${posSales.createdAt} <= ${toEpoch}` : sql`1=1`
        )
      )
      .get();
    const posRevenue = Number(posRows?.sum ?? 0);

    const totalRevenue = membershipRevenue + ptRevenue + posRevenue;

    // 4. Expenses by category (expense_date is a YYYY-MM-DD string)
    const expenseRows = await this.db
      .select({
        category: expenseCategories.name,
        amountPaise: sql<number>`coalesce(sum(${expenses.amountPaise}), 0)`,
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(
        and(
          eq(expenses.gymId, gymId),
          fromDate ? sql`${expenses.expenseDate} >= ${fromDate}` : sql`1=1`,
          toDate ? sql`${expenses.expenseDate} <= ${toDate}` : sql`1=1`
        )
      )
      .groupBy(expenseCategories.name);

    const totalExpenses = expenseRows.reduce((acc, curr) => acc + Number(curr.amountPaise), 0);
    const netProfit = totalRevenue - totalExpenses;

    return {
      revenuePaise: {
        memberships: membershipRevenue,
        pt: ptRevenue,
        pos: posRevenue,
        total: totalRevenue,
      },
      expensesPaise: {
        byCategory: expenseRows.map((e) => ({ category: e.category, amountPaise: Number(e.amountPaise) })),
        total: totalExpenses,
      },
      netProfitPaise: netProfit,
    };
  }
}
