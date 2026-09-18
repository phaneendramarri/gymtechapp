import { eq, and, desc, sql } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { classes, classSchedules, classBookings, members, users } from '../db/schema';
import type { ClassItem, ClassSchedule, ClassBooking } from '@gymtech/shared';

export class ClassRepository {
  private db: ReturnType<typeof drizzle>;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async listClasses(gymId: number): Promise<ClassItem[]> {
    const rows = await this.db
      .select()
      .from(classes)
      .where(eq(classes.gymId, gymId))
      .orderBy(desc(classes.createdAt));

    return rows.map((r) => ({
      id: r.id,
      gymId: r.gymId,
      name: r.name,
      description: r.description,
      durationMinutes: r.durationMinutes,
      maxCapacity: r.maxCapacity,
      color: r.color,
      isActive: Boolean(r.isActive),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async createClass(
    gymId: number,
    data: { name: string; description?: string | null; durationMinutes: number; maxCapacity: number; color: string }
  ): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const [inserted] = await this.db
      .insert(classes)
      .values({
        gymId,
        name: data.name,
        description: data.description ?? null,
        durationMinutes: data.durationMinutes,
        maxCapacity: data.maxCapacity,
        color: data.color,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: classes.id });
    return inserted.id;
  }

  async updateClass(
    gymId: number,
    id: number,
    data: Partial<{ name: string; description: string | null; durationMinutes: number; maxCapacity: number; color: string; isActive: boolean }>
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(classes)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
        ...(data.maxCapacity !== undefined && { maxCapacity: data.maxCapacity }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedAt: now,
      })
      .where(and(eq(classes.gymId, gymId), eq(classes.id, id)));
  }

  async deleteClass(gymId: number, id: number): Promise<void> {
    await this.db.delete(classes).where(and(eq(classes.gymId, gymId), eq(classes.id, id)));
  }

  async listSchedules(gymId: number, dayOfWeek?: number): Promise<ClassSchedule[]> {
    const query = this.db
      .select({
        id: classSchedules.id,
        gymId: classSchedules.gymId,
        classId: classSchedules.classId,
        className: classes.name,
        classColor: classes.color,
        trainerUserId: classSchedules.trainerUserId,
        trainerName: users.name,
        dayOfWeek: classSchedules.dayOfWeek,
        startTime: classSchedules.startTime,
        endTime: classSchedules.endTime,
        date: classSchedules.date,
        maxCapacity: classSchedules.maxCapacity,
        isCancelled: classSchedules.isCancelled,
        createdAt: classSchedules.createdAt,
      })
      .from(classSchedules)
      .innerJoin(classes, eq(classSchedules.classId, classes.id))
      .leftJoin(users, eq(classSchedules.trainerUserId, users.id))
      .where(
        and(
          eq(classSchedules.gymId, gymId),
          dayOfWeek !== undefined ? eq(classSchedules.dayOfWeek, dayOfWeek) : sql`1=1`
        )
      )
      .orderBy(classSchedules.dayOfWeek, classSchedules.startTime);

    const rows = await query;
    return rows.map((r) => ({
      id: r.id,
      gymId: r.gymId,
      classId: r.classId,
      className: r.className,
      classColor: r.classColor,
      trainerUserId: r.trainerUserId,
      trainerName: r.trainerName,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      date: r.date,
      maxCapacity: r.maxCapacity,
      isCancelled: Boolean(r.isCancelled),
      createdAt: r.createdAt,
    }));
  }

  async createSchedule(
    gymId: number,
    data: { classId: number; trainerUserId?: number | null; dayOfWeek: number; startTime: string; endTime: string; date?: string | null; maxCapacity?: number }
  ): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const [inserted] = await this.db
      .insert(classSchedules)
      .values({
        gymId,
        classId: data.classId,
        trainerUserId: data.trainerUserId ?? null,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        date: data.date ?? null,
        maxCapacity: data.maxCapacity ?? 20,
        isCancelled: false,
        createdAt: now,
      })
      .returning({ id: classSchedules.id });
    return inserted.id;
  }

  async deleteSchedule(gymId: number, id: number): Promise<void> {
    await this.db.delete(classSchedules).where(and(eq(classSchedules.gymId, gymId), eq(classSchedules.id, id)));
  }

  async listBookings(gymId: number, scheduleId: number): Promise<ClassBooking[]> {
    const rows = await this.db
      .select({
        id: classBookings.id,
        gymId: classBookings.gymId,
        scheduleId: classBookings.scheduleId,
        memberId: classBookings.memberId,
        memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
        memberCode: members.memberCode,
        status: classBookings.status,
        bookedAt: classBookings.bookedAt,
        attendedAt: classBookings.attendedAt,
      })
      .from(classBookings)
      .innerJoin(members, eq(classBookings.memberId, members.id))
      .where(and(eq(classBookings.gymId, gymId), eq(classBookings.scheduleId, scheduleId)))
      .orderBy(classBookings.bookedAt);

    return rows.map((r) => ({
      id: r.id,
      gymId: r.gymId,
      scheduleId: r.scheduleId,
      memberId: r.memberId,
      memberName: r.memberName,
      memberCode: r.memberCode,
      status: r.status as any,
      bookedAt: r.bookedAt,
      attendedAt: r.attendedAt,
    }));
  }

  async bookClass(gymId: number, scheduleId: number, memberId: number): Promise<{ id: number; status: 'BOOKED' | 'WAITLIST' }> {
    // Check current capacity
    const schedule = await this.db
      .select()
      .from(classSchedules)
      .where(and(eq(classSchedules.gymId, gymId), eq(classSchedules.id, scheduleId)))
      .get();

    if (!schedule) throw new Error('Schedule not found');

    const existingCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(classBookings)
      .where(and(eq(classBookings.gymId, gymId), eq(classBookings.scheduleId, scheduleId), eq(classBookings.status, 'BOOKED')))
      .get();

    const bookedCount = existingCount?.count ?? 0;
    const status = bookedCount >= schedule.maxCapacity ? 'WAITLIST' : 'BOOKED';

    const now = Math.floor(Date.now() / 1000);
    const [inserted] = await this.db
      .insert(classBookings)
      .values({
        gymId,
        scheduleId,
        memberId,
        status,
        bookedAt: now,
      })
      .returning({ id: classBookings.id });

    return { id: inserted.id, status };
  }

  async updateBookingStatus(gymId: number, bookingId: number, status: 'ATTENDED' | 'CANCELLED' | 'NO_SHOW'): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(classBookings)
      .set({
        status,
        ...(status === 'ATTENDED' && { attendedAt: now }),
      })
      .where(and(eq(classBookings.gymId, gymId), eq(classBookings.id, bookingId)));
  }
}
