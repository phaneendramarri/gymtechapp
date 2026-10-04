import { Hono } from 'hono';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { jsonOk, jsonErr, jsonValidationErr, parsePageParams } from './helpers';
import { PosRepository } from '../repositories/pos.repository';
import { CreateProductRequestSchema, UpdateProductRequestSchema, CreatePosSaleRequestSchema } from '@gymtech/shared';

export const posRoutes = new Hono();

// GET /api/pos/products — list products
posRoutes.get('/products', requireGym, requireFeature('pos'), requirePermission('pos'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const activeOnly = c.req.query('active') === 'true';
  const repo = new PosRepository(ctx.env.DB);
  const items = await repo.listProducts(ctx.gymId!, activeOnly);
  return jsonOk({ products: items });
}));

// POST /api/pos/products — create product
posRoutes.post('/products', requireGym, requireFeature('pos'), requirePermission('pos'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateProductRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid product payload');

  const repo = new PosRepository(ctx.env.DB);
  const id = await repo.createProduct(ctx.gymId!, parsed.data);
  return jsonOk({ id, ...parsed.data }, 201);
}));

// PUT /api/pos/products/:id — update product
posRoutes.put('/products/:id', requireGym, requireFeature('pos'), requirePermission('pos'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateProductRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid product payload');

  const repo = new PosRepository(ctx.env.DB);
  await repo.updateProduct(ctx.gymId!, id, parsed.data);
  return jsonOk({ success: true, id });
}));

// DELETE /api/pos/products/:id — delete product
posRoutes.delete('/products/:id', requireGym, requireFeature('pos'), requirePermission('pos'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const repo = new PosRepository(ctx.env.DB);
  try {
    await repo.deleteProduct(ctx.gymId!, id);
  } catch (e: any) {
    if (/past sales reference it/i.test(e instanceof Error ? e.message : String(e ?? ''))) {
      return jsonErr('Product cannot be deleted because past sales reference it. Deactivate it instead.', 409);
    }
    throw e;
  }
  return jsonOk({ success: true });
}));

// POST /api/pos/sales — record a POS checkout sale
posRoutes.post('/sales', requireGym, requireFeature('pos'), requirePermission('pos'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreatePosSaleRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid sale payload');

  // The member (when given) must belong to this gym.
  if (parsed.data.memberId !== undefined && parsed.data.memberId !== null) {
    const { MemberRepository } = await import('../repositories/member.repository');
    const member = await new MemberRepository(ctx.env.DB, ctx.gymId!).findById(parsed.data.memberId);
    if (!member) return jsonErr('Member not found in this gym', 404);
  }

  const repo = new PosRepository(ctx.env.DB);
  try {
    const result = await repo.recordSale(ctx.gymId!, parsed.data);
    return jsonOk(result, 201);
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e ?? '');
    if (/not found in this gym|not active|Insufficient stock/i.test(msg)) {
      return jsonErr(msg, 400);
    }
    throw e;
  }
}));

// GET /api/pos/sales — list sales history
posRoutes.get('/sales', requireGym, requireFeature('pos'), requirePermission('pos'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const { limit, offset } = parsePageParams(c.req.query('limit'), c.req.query('offset'), 'default');
  const repo = new PosRepository(ctx.env.DB);
  const sales = await repo.listSales(ctx.gymId!, limit, offset);
  return jsonOk({ sales });
}));
