import { eq, and, desc, sql } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { products, posSales, posSaleItems, members } from '../db/schema';
import type { Product, PosSale, PosSaleItem } from '@gymtech/shared';
import { CounterRepository } from './counter.repository';

export class PosRepository {
  private db: ReturnType<typeof drizzle>;

  constructor(private d1: D1Database) {
    this.db = drizzle(d1);
  }

  async listProducts(gymId: number, activeOnly = false): Promise<Product[]> {
    const rows = await this.db
      .select()
      .from(products)
      .where(and(eq(products.gymId, gymId), activeOnly ? eq(products.isActive, true) : sql`1=1`))
      .orderBy(products.category, products.name);

    return rows.map((r) => ({
      id: r.id,
      gymId: r.gymId,
      name: r.name,
      sku: r.sku,
      category: r.category,
      pricePaise: r.pricePaise,
      costPaise: r.costPaise,
      stockQuantity: r.stockQuantity,
      lowStockThreshold: r.lowStockThreshold,
      taxRate: r.taxRate,
      isActive: Boolean(r.isActive),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async createProduct(
    gymId: number,
    data: { name: string; sku?: string | null; category?: string; pricePaise: number; costPaise?: number; stockQuantity?: number; lowStockThreshold?: number; taxRate?: number }
  ): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const [inserted] = await this.db
      .insert(products)
      .values({
        gymId,
        name: data.name,
        sku: data.sku ?? null,
        category: data.category ?? 'General',
        pricePaise: data.pricePaise,
        costPaise: data.costPaise ?? 0,
        stockQuantity: data.stockQuantity ?? 0,
        lowStockThreshold: data.lowStockThreshold ?? 5,
        taxRate: data.taxRate ?? 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: products.id });
    return inserted.id;
  }

  async updateProduct(
    gymId: number,
    id: number,
    data: Partial<{ name: string; sku: string | null; category: string; pricePaise: number; costPaise: number; stockQuantity: number; lowStockThreshold: number; taxRate: number; isActive: boolean }>
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(products)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.pricePaise !== undefined && { pricePaise: data.pricePaise }),
        ...(data.costPaise !== undefined && { costPaise: data.costPaise }),
        ...(data.stockQuantity !== undefined && { stockQuantity: data.stockQuantity }),
        ...(data.lowStockThreshold !== undefined && { lowStockThreshold: data.lowStockThreshold }),
        ...(data.taxRate !== undefined && { taxRate: data.taxRate }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedAt: now,
      })
      .where(and(eq(products.gymId, gymId), eq(products.id, id)));
  }

  async deleteProduct(gymId: number, id: number): Promise<void> {
    await this.db.delete(products).where(and(eq(products.gymId, gymId), eq(products.id, id)));
  }

  private async nextPosReceiptNumber(gymId: number): Promise<string> {
    const year = new Date().getFullYear();
    const counterRepo = new CounterRepository(this.d1 as any);
    const seq = await counterRepo.nextValue(gymId, `pos_receipt_${year}`);
    return `POS-${year}-${String(seq).padStart(4, '0')}`;
  }

  async recordSale(
    gymId: number,
    data: { memberId?: number | null; paymentMode: any; notes?: string | null; items: Array<{ productId: number; quantity: number; unitPricePaise: number }> }
  ): Promise<{ id: number; receiptNumber: string }> {
    const receiptNumber = await this.nextPosReceiptNumber(gymId);
    const now = Math.floor(Date.now() / 1000);

    let subtotalPaise = 0;
    for (const item of data.items) {
      subtotalPaise += item.quantity * item.unitPricePaise;
    }
    const taxPaise = 0;
    const totalPaise = subtotalPaise + taxPaise;

    const [sale] = await this.db
      .insert(posSales)
      .values({
        gymId,
        receiptNumber,
        memberId: data.memberId ?? null,
        subtotalPaise,
        taxPaise,
        totalPaise,
        paymentMode: data.paymentMode,
        notes: data.notes ?? null,
        createdAt: now,
      })
      .returning({ id: posSales.id });

    // Insert sale items and deduct stock
    for (const item of data.items) {
      const lineTotal = item.quantity * item.unitPricePaise;
      await this.db.insert(posSaleItems).values({
        gymId,
        saleId: sale.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        totalPaise: lineTotal,
      });

      // Deduct product stock
      await this.db
        .update(products)
        .set({
          stockQuantity: sql`max(0, ${products.stockQuantity} - ${item.quantity})`,
          updatedAt: now,
        })
        .where(and(eq(products.gymId, gymId), eq(products.id, item.productId)));
    }

    return { id: sale.id, receiptNumber };
  }

  async listSales(gymId: number, limit = 50, offset = 0): Promise<PosSale[]> {
    const rows = await this.db
      .select({
        id: posSales.id,
        gymId: posSales.gymId,
        receiptNumber: posSales.receiptNumber,
        memberId: posSales.memberId,
        memberName: sql<string | null>`${members.firstName} || ' ' || ${members.lastName}`,
        subtotalPaise: posSales.subtotalPaise,
        taxPaise: posSales.taxPaise,
        totalPaise: posSales.totalPaise,
        paymentMode: posSales.paymentMode,
        notes: posSales.notes,
        createdAt: posSales.createdAt,
      })
      .from(posSales)
      .leftJoin(members, eq(posSales.memberId, members.id))
      .where(eq(posSales.gymId, gymId))
      .orderBy(desc(posSales.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      id: r.id,
      gymId: r.gymId,
      receiptNumber: r.receiptNumber,
      memberId: r.memberId,
      memberName: r.memberName,
      subtotalPaise: r.subtotalPaise,
      taxPaise: r.taxPaise,
      totalPaise: r.totalPaise,
      paymentMode: r.paymentMode as any,
      notes: r.notes,
      createdAt: r.createdAt,
    }));
  }
}
