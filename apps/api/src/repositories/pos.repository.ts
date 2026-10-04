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
    // Hard-deleting a product cascades to posSaleItems (receipt lines) and
    // corrupts past receipts. Refuse while any sale references it instead.
    const refs = await this.db
      .select({ id: posSaleItems.id })
      .from(posSaleItems)
      .where(and(eq(posSaleItems.gymId, gymId), eq(posSaleItems.productId, id)))
      .limit(1);
    if (refs.length > 0) {
      throw new Error('Product cannot be deleted because past sales reference it. Deactivate it instead.');
    }
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
    data: { memberId?: number | null; paymentMode: any; notes?: string | null; items: Array<{ productId: number; quantity: number; unitPricePaise?: number }> }
  ): Promise<{ id: number; receiptNumber: string }> {
    const receiptNumber = await this.nextPosReceiptNumber(gymId);
    const now = Math.floor(Date.now() / 1000);

    // Validate products: existence, active status, gym ownership.
    // Stock check is now ATOMIC in the UPDATE below (no separate check-then-update race).
    const ids = data.items.map((i) => i.productId);
    const productRows = await this.db
      .select()
      .from(products)
      .where(and(eq(products.gymId, gymId), sql`${products.id} IN (${sql.join(ids, sql`, `)})`));
    const byId = new Map(productRows.map((p) => [p.id, p]));
    for (const item of data.items) {
      const product = byId.get(item.productId);
      if (!product) throw new Error('Product not found in this gym');
      if (!product.isActive) throw new Error(`Product "${product.name}" is not active`);
    }

    let subtotalPaise = 0;
    let taxPaise = 0;
    for (const item of data.items) {
      const product = byId.get(item.productId)!;
      // SECURITY: Use the product's ACTUAL price from DB, not client-supplied unitPricePaise.
      // This prevents price manipulation by malicious clients.
      const actualPricePaise = product.pricePaise;
      const line = item.quantity * actualPricePaise;
      subtotalPaise += line;
      const rate = Number(product.taxRate ?? 0);
      if (rate > 0) taxPaise += Math.round((line * rate) / 100);
    }
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

    // Insert sale items and ATOMICALLY deduct stock.
    // The UPDATE's WHERE clause includes stockQuantity >= quantity,
    // so concurrent sales cannot oversell: the second will affect 0 rows
    // and we can detect it by checking the returned rows (via a SELECT).
    for (const item of data.items) {
      const product = byId.get(item.productId)!;
      const actualPricePaise = product.pricePaise;
      const lineTotal = item.quantity * actualPricePaise;
      await this.db.insert(posSaleItems).values({
        gymId,
        saleId: sale.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPricePaise: actualPricePaise,
        totalPaise: lineTotal,
      });

      // ATOMIC stock deduction: only succeeds if sufficient stock exists.
      // Returns number of rows changed; 0 = insufficient stock (race lost).
      const result = await this.db
        .update(products)
        .set({
          stockQuantity: sql`${products.stockQuantity} - ${item.quantity}`,
          updatedAt: now,
        })
        .where(
          and(
            eq(products.gymId, gymId),
            eq(products.id, item.productId),
            // Guard: only decrement if stock covers the quantity
            sql`${products.stockQuantity} >= ${item.quantity}`
          )
        );

      // SQLite returns changes in meta; if 0 rows updated, stock was insufficient.
      if ((result.meta?.changes ?? 0) === 0) {
        // Roll back: delete the sale and any previously inserted items for this sale.
        await this.db.delete(posSales).where(eq(posSales.id, sale.id));
        throw new Error(`Insufficient stock for "${product.name}" (concurrent sale)`);
      }
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
      .leftJoin(members, and(eq(posSales.memberId, members.id), eq(members.gymId, gymId)))
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
