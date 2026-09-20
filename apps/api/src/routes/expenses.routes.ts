import { Hono } from 'hono';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { jsonOk, jsonValidationErr } from './helpers';
import { ExpenseRepository } from '../repositories/expense.repository';
import { CreateExpenseCategoryRequestSchema, CreateExpenseRequestSchema } from '@gymtech/shared';

export const expensesRoutes = new Hono();

// GET /api/expenses/categories — list expense categories
expensesRoutes.get('/categories', requireGym, requireFeature('expenses'), requirePermission('expenses'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const repo = new ExpenseRepository(ctx.env.DB);
  const categories = await repo.listCategories(ctx.gymId!);
  return jsonOk({ categories });
}));

// POST /api/expenses/categories — create category
expensesRoutes.post('/categories', requireGym, requireFeature('expenses'), requirePermission('expenses'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateExpenseCategoryRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid category payload');

  const repo = new ExpenseRepository(ctx.env.DB);
  const id = await repo.createCategory(ctx.gymId!, parsed.data.name);
  return jsonOk({ id, name: parsed.data.name }, 201);
}));

// GET /api/expenses — list logged expenses
expensesRoutes.get('/', requireGym, requireFeature('expenses'), requirePermission('expenses'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const fromDate = c.req.query('from');
  const toDate = c.req.query('to');
  const catIdStr = c.req.query('categoryId');
  const categoryId = catIdStr ? parseInt(catIdStr, 10) : undefined;

  const repo = new ExpenseRepository(ctx.env.DB);
  const items = await repo.listExpenses(ctx.gymId!, fromDate, toDate, categoryId);
  return jsonOk({ expenses: items });
}));

// POST /api/expenses — record a new expense
expensesRoutes.post('/', requireGym, requireFeature('expenses'), requirePermission('expenses'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateExpenseRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid expense payload');

  const repo = new ExpenseRepository(ctx.env.DB);
  const id = await repo.createExpense(ctx.gymId!, {
    ...parsed.data,
    createdByUserId: ctx.user?.id ?? null,
  });
  return jsonOk({ id, ...parsed.data }, 201);
}));

// DELETE /api/expenses/:id — delete expense
expensesRoutes.delete('/:id', requireGym, requireFeature('expenses'), requirePermission('expenses'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const repo = new ExpenseRepository(ctx.env.DB);
  await repo.deleteExpense(ctx.gymId!, id);
  return jsonOk({ success: true });
}));

// GET /api/expenses/pnl — Net Profit & Loss statement over an optional period
expensesRoutes.get('/pnl', requireGym, requireFeature('expenses'), requirePermission('expenses'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const fromDate = c.req.query('from') || undefined;
  const toDate = c.req.query('to') || undefined;

  const repo = new ExpenseRepository(ctx.env.DB);
  const pnl = await repo.getProfitAndLoss(ctx.gymId!, fromDate, toDate);
  return jsonOk(pnl);
}));
