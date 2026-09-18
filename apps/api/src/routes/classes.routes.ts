import { Hono } from 'hono';
import { requireGym, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { jsonOk, jsonErr, jsonValidationErr } from './helpers';
import { ClassRepository } from '../repositories/class.repository';
import { CreateClassRequestSchema, UpdateClassRequestSchema, CreateScheduleRequestSchema, BookClassRequestSchema } from '@gymtech/shared';

export const classesRoutes = new Hono();

// GET /api/classes — list group fitness classes
classesRoutes.get('/', requireGym, requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const repo = new ClassRepository(ctx.env.DB);
  const items = await repo.listClasses(ctx.gymId!);
  return jsonOk({ classes: items });
}));

// POST /api/classes — create a new class
classesRoutes.post('/', requireGym, requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateClassRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid class payload');

  const repo = new ClassRepository(ctx.env.DB);
  const id = await repo.createClass(ctx.gymId!, parsed.data);
  return jsonOk({ id, ...parsed.data }, 201);
}));

// PUT /api/classes/:id — update class
classesRoutes.put('/:id', requireGym, requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateClassRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid class payload');

  const repo = new ClassRepository(ctx.env.DB);
  await repo.updateClass(ctx.gymId!, id, parsed.data);
  return jsonOk({ success: true, id });
}));

// DELETE /api/classes/:id — delete class
classesRoutes.delete('/:id', requireGym, requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const repo = new ClassRepository(ctx.env.DB);
  await repo.deleteClass(ctx.gymId!, id);
  return jsonOk({ success: true });
}));

// GET /api/classes/schedules — list timetable schedules
classesRoutes.get('/schedules', requireGym, requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const dayStr = c.req.query('dayOfWeek');
  const dayOfWeek = dayStr !== undefined ? parseInt(dayStr, 10) : undefined;
  const repo = new ClassRepository(ctx.env.DB);
  const schedules = await repo.listSchedules(ctx.gymId!, dayOfWeek);
  return jsonOk({ schedules });
}));

// POST /api/classes/schedules — add class schedule slot
classesRoutes.post('/schedules', requireGym, requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateScheduleRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid schedule payload');

  const repo = new ClassRepository(ctx.env.DB);
  const id = await repo.createSchedule(ctx.gymId!, parsed.data);
  return jsonOk({ id, ...parsed.data }, 201);
}));

// DELETE /api/classes/schedules/:id — delete class schedule slot
classesRoutes.delete('/schedules/:id', requireGym, requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const repo = new ClassRepository(ctx.env.DB);
  await repo.deleteSchedule(ctx.gymId!, id);
  return jsonOk({ success: true });
}));

// GET /api/classes/schedules/:id/bookings — get roster for a schedule
classesRoutes.get('/schedules/:id/bookings', requireGym, requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const scheduleId = paramId(c.req.param() as Record<string, string>);
  const repo = new ClassRepository(ctx.env.DB);
  const bookings = await repo.listBookings(ctx.gymId!, scheduleId);
  return jsonOk({ bookings });
}));

// POST /api/classes/schedules/:id/book — book member into class
classesRoutes.post('/schedules/:id/book', requireGym, requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const scheduleId = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const memberId = body.memberId ? parseInt(body.memberId, 10) : null;
  if (!memberId) return jsonErr('Member ID is required', 400);

  const repo = new ClassRepository(ctx.env.DB);
  const result = await repo.bookClass(ctx.gymId!, scheduleId, memberId);
  return jsonOk(result, 201);
}));

// PATCH /api/classes/bookings/:id — update booking attendance
classesRoutes.patch('/bookings/:id', requireGym, requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const bookingId = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const status = body.status;
  if (!['ATTENDED', 'CANCELLED', 'NO_SHOW'].includes(status)) {
    return jsonErr('Invalid booking status', 400);
  }

  const repo = new ClassRepository(ctx.env.DB);
  await repo.updateBookingStatus(ctx.gymId!, bookingId, status);
  return jsonOk({ success: true });
}));
