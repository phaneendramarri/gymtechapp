import { Hono } from 'hono';
import { requireGym, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { jsonOk, jsonValidationErr } from './helpers';
import { PosRepository } from '../repositories/pos.repository';
import { CreateProductRequestSchema, UpdateProductRequestSchema, CreatePosSaleRequestSchema } from '@gymtech/shared';

export const posRoutes = new Hono();

// GET /api/pos/products — list products
posRoutes.get('/products', requireGym, requirePermission('pos'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const activeOnly = c.req.query('active') === 'true';
  const repo = new PosRepository(ctx.env.DB);
  const items = await repo.listProducts(ctx.gymId!, activeOnly);
  return jsonOk({ products: items });
}));

// POST /api/pos/products — create product
posRoutes.post('/products', requireGym, requirePermission('pos'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateProductRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid product payload');

  const repo = new PosRepository(ctx.env.DB);
  const id = await repo.createProduct(ctx.gymId!, parsed.data);
  return jsonOk({ id, ...parsed.data }, 201);
}));

// PUT /api/pos/products/:id — update product
posRoutes.put('/products/:id', requireGym, requirePermission('pos'), safeHandler(async (c) => {
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
posRoutes.delete('/products/:id', requireGym, requirePermission('pos'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const repo = new PosRepository(ctx.env.DB);
  await repo.deleteProduct(ctx.gymId!, id);
  return jsonOk({ success: true });
}));

// POST /api/pos/sales — record a POS checkout sale
posRoutes.post('/sales', requireGym, requirePermission('pos'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreatePosSaleRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid sale payload');

  const repo = new PosRepository(ctx.env.DB);
  const result = await repo.recordSale(ctx.gymId!, parsed.data);
  return jsonOk(result, 201);
}));

// GET /api/pos/sales — list sales history
posRoutes.get('/sales', requireGym, requirePermission('pos'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const limitStr = c.req.query('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 50;
  const repo = new PosRepository(ctx.env.DB);
  const sales = await repo.listSales(ctx.gymId!, limit);
  return jsonOk({ sales });
}));
