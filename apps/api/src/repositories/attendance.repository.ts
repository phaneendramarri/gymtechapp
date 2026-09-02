import type { Attendance, AttendanceMethod, AttendanceListItem } from '@gymtech/shared';
import { todayYyyymmdd } from './member.repository';

export class AttendanceRepository {
  constructor(private db: D1Database, private gymId: number) {}

  async checkIn(data: {
    member_id: number;
    method: AttendanceMethod;
    recorded_by_user_id?: number | null;
  }): Promise<{ alreadyCheckedIn: boolean; attendanceId: number }> {
    const today = todayYyyymmdd();

    const existing = await this.db
      .prepare(
        `SELECT id FROM attendance
         WHERE gym_id = ? AND member_id = ? AND attendance_date = ?`
      )
      .bind(this.gymId, data.member_id, today)
      .first<{ id: number }>();

    if (existing) {
      return { alreadyCheckedIn: true, attendanceId: existing.id };
    }

    const now = Math.floor(Date.now() / 1000);
    const res = await this.db
      .prepare(
        `INSERT INTO attendance (
          gym_id, member_id, check_in_time, attendance_date, method,
          recorded_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        this.gymId,
        data.member_id,
        now,
        today,
        data.method,
        data.recorded_by_user_id ?? null,
        now
      )
      .run();
    return { alreadyCheckedIn: false, attendanceId: Number(res.meta?.last_row_id ?? 0) };
  }

  async listToday(): Promise<AttendanceListItem[]> {
    const today = todayYyyymmdd();
    const { results } = await this.db
      .prepare(
        `SELECT a.*, m.first_name, m.last_name, m.member_code, m.phone, m.photo_url
         FROM attendance a
         JOIN members m ON m.id = a.member_id
         WHERE a.gym_id = ? AND a.attendance_date = ?
         ORDER BY a.check_in_time DESC`
      )
      .bind(this.gymId, today)
      .all<AttendanceListItem>();
    return results || [];
  }

  async listByMember(memberId: number, limit = 30): Promise<Attendance[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM attendance WHERE member_id = ? AND gym_id = ?
         ORDER BY check_in_time DESC LIMIT ?`
      )
      .bind(memberId, this.gymId, limit)
      .all<Attendance>();
    return results || [];
  }

  async countToday(): Promise<number> {
    const today = todayYyyymmdd();
    const res = await this.db
      .prepare(`SELECT COUNT(*) as count FROM attendance WHERE gym_id = ? AND attendance_date = ?`)
      .bind(this.gymId, today)
      .first<{ count: number }>();
    return res?.count || 0;
  }
}
