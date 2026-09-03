import { eq, and } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import type { Attendance, AttendanceMethod, AttendanceListItem } from '@gymtech/shared';
import { attendance, members } from '../db/schema';

/** Returns today's date as YYYYMMDD integer. */
export function todayYyyymmdd(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export class AttendanceRepository {
  private db: Database;

  constructor(db: Database | D1Database, private gymId: number) {
    this.db = (db as any).prepare ? createDatabase(db as D1Database) : (db as Database);
  }

  async checkIn(data: {
    memberId: number;
    method: AttendanceMethod;
    recordedByUserId?: number | null;
  }): Promise<{ alreadyCheckedIn: boolean; attendanceId: number }> {
    const today = todayYyyymmdd();

    const existing = await this.db
      .select({ id: attendance.id })
      .from(attendance)
      .where(
        and(
          eq(attendance.gymId, this.gymId),
          eq(attendance.memberId, data.memberId),
          eq(attendance.attendanceDate, today)
        )
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      return { alreadyCheckedIn: true, attendanceId: existing.id };
    }

    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .insert(attendance)
      .values({
        gymId: this.gymId,
        memberId: data.memberId,
        checkInTime: now,
        attendanceDate: today,
        method: data.method,
        recordedByUserId: data.recordedByUserId ?? null,
        createdAt: now,
      })
      .returning({ id: attendance.id });
    return { alreadyCheckedIn: false, attendanceId: row[0]!.id };
  }

  async listToday(): Promise<AttendanceListItem[]> {
    const today = todayYyyymmdd();
    const rows = await this.db
      .select({
        id: attendance.id,
        gymId: attendance.gymId,
        memberId: attendance.memberId,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        attendanceDate: attendance.attendanceDate,
        method: attendance.method,
        recordedByUserId: attendance.recordedByUserId,
        deviceInfo: attendance.deviceInfo,
        createdAt: attendance.createdAt,
        firstName: members.firstName,
        lastName: members.lastName,
        memberCode: members.memberCode,
        phone: members.phone,
        photoUrl: members.photoUrl,
      })
      .from(attendance)
      .innerJoin(members, eq(attendance.memberId, members.id))
      .where(and(eq(attendance.gymId, this.gymId), eq(attendance.attendanceDate, today)))
      .orderBy(attendance.checkInTime);
    return rows as AttendanceListItem[];
  }

  async listByMember(memberId: number, limit = 30): Promise<Attendance[]> {
    const rows = await this.db
      .select()
      .from(attendance)
      .where(and(eq(attendance.gymId, this.gymId), eq(attendance.memberId, memberId)))
      .orderBy(attendance.checkInTime)
      .limit(limit);
    return rows as Attendance[];
  }

  async countToday(): Promise<number> {
    const today = todayYyyymmdd();
    const [{ count }] = await this.db
      .select({ count: attendance.id })
      .from(attendance)
      .where(and(eq(attendance.gymId, this.gymId), eq(attendance.attendanceDate, today)));
    return count ?? 0;
  }
}
