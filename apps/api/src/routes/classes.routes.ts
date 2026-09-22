import { Hono } from 'hono';
import { requireGym, requireFeature, requirePermission, requirePermissionOrMember } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { isMemberSession } from '../lib/roles';
import { safeHandler, paramId } from '../middleware/params';
import { jsonOk, jsonErr, jsonValidationErr, queryId } from './helpers';
import { ClassRepository } from '../repositories/class.repository';
import { CreateClassRequestSchema, UpdateClassRequestSchema, CreateScheduleRequestSchema, BookClassRequestSchema } from '@gymtech/shared';

export const classesRoutes = new Hono();

// GET /api/classes — list group fitness classes
classesRoutes.get('/', requireGym, requireFeature('classes'), requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const repo = new ClassRepository(ctx.env.DB);
  const items = await repo.listClasses(ctx.gymId!);
  return jsonOk({ classes: items });
}));

// POST /api/classes — create a new class
classesRoutes.post('/', requireGym, requireFeature('classes'), requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateClassRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid class payload');

  const repo = new ClassRepository(ctx.env.DB);
  const id = await repo.createClass(ctx.gymId!, parsed.data);
  return jsonOk({ id, ...parsed.data }, 201);
}));

// PUT /api/classes/:id — update class
classesRoutes.put('/:id', requireGym, requireFeature('classes'), requirePermission('classes'), safeHandler(async (c) => {
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
classesRoutes.delete('/:id', requireGym, requireFeature('classes'), requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const repo = new ClassRepository(ctx.env.DB);
  await repo.deleteClass(ctx.gymId!, id);
  return jsonOk({ success: true });
}));

// GET /api/classes/schedules — list timetable schedules.
// Readable by the member portal too (it is the gym's timetable, which the
// portal's Classes tab displays); staff still need the `classes` permission.
classesRoutes.get('/schedules', requireGym, requireFeature('classes'), requirePermissionOrMember('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const dayStr = c.req.query('dayOfWeek');
  let dayOfWeek: number | undefined;
  if (dayStr !== undefined && dayStr !== '') {
    const trimmed = dayStr.trim();
    if (!/^[0-6]$/.test(trimmed)) {
      return jsonErr('Invalid dayOfWeek parameter. Must be an integer between 0 and 6', 400);
    }
    dayOfWeek = parseInt(trimmed, 10);
  }
  const repo = new ClassRepository(ctx.env.DB);
  const schedules = await repo.listSchedules(ctx.gymId!, dayOfWeek);
  return jsonOk({ schedules });
}));

// POST /api/classes/schedules — add class schedule slot
classesRoutes.post('/schedules', requireGym, requireFeature('classes'), requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateScheduleRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid schedule payload');

  const repo = new ClassRepository(ctx.env.DB);
  const id = await repo.createSchedule(ctx.gymId!, parsed.data);
  return jsonOk({ id, ...parsed.data }, 201);
}));

// DELETE /api/classes/schedules/:id — delete class schedule slot
classesRoutes.delete('/schedules/:id', requireGym, requireFeature('classes'), requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const repo = new ClassRepository(ctx.env.DB);
  await repo.deleteSchedule(ctx.gymId!, id);
  return jsonOk({ success: true });
}));

// GET /api/classes/bookings?scheduleId=&bookingDate= — roster for a schedule, optionally scoped to a day
classesRoutes.get('/bookings', requireGym, requireFeature('classes'), requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const scheduleId = queryId(c.req.query('scheduleId'), 'scheduleId');
  if (!scheduleId) return jsonErr('scheduleId is required', 400);
  const bookingDate = c.req.query('bookingDate') || undefined;

  const repo = new ClassRepository(ctx.env.DB);
  const bookings = await repo.listBookings(ctx.gymId!, scheduleId, bookingDate);
  return jsonOk({ bookings });
}));

// POST /api/classes/bookings — book a member into a class occurrence.
// Two callers: the staff roster (any member, needs `classes`) and the member
// portal (self only). A member session's `id` IS a `members.id`, so it is forced
// into the payload — a member can never book or impersonate anyone else.
classesRoutes.post('/bookings', requireGym, requireFeature('classes'), requirePermissionOrMember('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const payload = isMemberSession(ctx.user) ? { ...body, memberId: ctx.user!.id } : body;
  const parsed = BookClassRequestSchema.safeParse(payload);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid booking payload');

  const repo = new ClassRepository(ctx.env.DB);
  let result;
  try {
    result = await repo.bookClass(ctx.gymId!, parsed.data.scheduleId, parsed.data.memberId, parsed.data.bookingDate);
  } catch (e: any) {
    if (e.message === 'Schedule not found') return jsonErr('Class schedule not found', 404);
    if (e.message === 'Member not found in this gym') return jsonErr('Member not found in this gym', 404);
    if (e.message === 'Member is already booked for this class occurrence') return jsonErr('Member is already booked for this class occurrence', 409);
    throw e;
  }
  return jsonOk(result, 201);
}));

// POST /api/classes/bookings/:id/cancel — cancel a booking
classesRoutes.post('/bookings/:id/cancel', requireGym, requireFeature('classes'), requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const bookingId = paramId(c.req.param() as Record<string, string>);
  const repo = new ClassRepository(ctx.env.DB);
  try {
    await repo.updateBookingStatus(ctx.gymId!, bookingId, 'CANCELLED');
  } catch (e: any) {
    if (e.message === 'Booking not found') return jsonErr('Booking not found', 404);
    throw e;
  }
  return jsonOk({ success: true });
}));

// PATCH /api/classes/bookings/:id — mark attendance (ATTENDED / NO_SHOW)
classesRoutes.patch('/bookings/:id', requireGym, requireFeature('classes'), requirePermission('classes'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const bookingId = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const status = body.status;
  if (!['ATTENDED', 'CANCELLED', 'NO_SHOW'].includes(status)) {
    return jsonErr('Invalid booking status', 400);
  }

  const repo = new ClassRepository(ctx.env.DB);
  try {
    await repo.updateBookingStatus(ctx.gymId!, bookingId, status);
  } catch (e: any) {
    if (e.message === 'Booking not found') return jsonErr('Booking not found', 404);
    throw e;
  }
  return jsonOk({ success: true });
}));
