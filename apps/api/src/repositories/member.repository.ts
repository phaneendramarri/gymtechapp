import type { Member, MemberStatus, MemberListItem, AttendanceListItem } from '@gymtech/shared';
import { isWithinLicenseLimit } from '../lib/calculations';

export class MemberRepository {
  constructor(private db: D1Database, private gymId: number) {}

  async list(params: { search?: string; status?: string; limit?: number; offset?: number }): Promise<MemberListItem[]> {
    let query = `
      SELECT m.*,
             ms.id as active_membership_id,
             ms.status as membership_status,
             ms.start_date as membership_start_date,
             ms.end_date as membership_end_date,
             ms.due_amount_paise as membership_due_amount_paise,
             mp.name as plan_name
      FROM members m
      LEFT JOIN memberships ms ON ms.member_id = m.id AND ms.id = (
        SELECT id FROM memberships WHERE member_id = m.id ORDER BY end_date DESC LIMIT 1
      )
      LEFT JOIN membership_plans mp ON mp.id = ms.membership_plan_id
      WHERE m.gym_id = ? AND m.deleted_at IS NULL
    `;
    const bindings: any[] = [this.gymId];

    if (params.status && params.status !== 'ALL') {
      if (params.status === 'EXPIRED') {
        query += ` AND (m.status = 'EXPIRED' OR (ms.end_date IS NOT NULL AND ms.end_date < unixepoch()))`;
      } else if (params.status === 'ACTIVE') {
        query += ` AND m.status = 'ACTIVE' AND (ms.end_date IS NULL OR ms.end_date >= unixepoch())`;
      } else {
        query += ` AND m.status = ?`;
        bindings.push(params.status);
      }
    }

    if (params.search) {
      query += ` AND (m.first_name LIKE ? OR m.last_name LIKE ? OR m.phone LIKE ? OR m.member_code LIKE ? OR m.email LIKE ?)`;
      const term = `%${params.search}%`;
      bindings.push(term, term, term, term, term);
    }

    query += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(params.limit || 50, params.offset || 0);

    const { results } = await this.db.prepare(query).bind(...bindings).all<MemberListItem>();
    return results || [];
  }

  async countActive(): Promise<number> {
    const res = await this.db
      .prepare(`SELECT COUNT(*) as count FROM members WHERE gym_id = ? AND status = 'ACTIVE' AND deleted_at IS NULL`)
      .bind(this.gymId)
      .first<{ count: number }>();
    return res?.count || 0;
  }

  async findById(id: number): Promise<Member | null> {
    return await this.db
      .prepare(`SELECT * FROM members WHERE id = ? AND gym_id = ? AND deleted_at IS NULL`)
      .bind(id, this.gymId)
      .first<Member>();
  }

  async findByIdentifier(identifier: string): Promise<Member | null> {
    return await this.db
      .prepare(`
        SELECT * FROM members
        WHERE gym_id = ? AND (phone = ? OR member_code = ? OR email = ?) AND deleted_at IS NULL
        LIMIT 1
      `)
      .bind(this.gymId, identifier, identifier, identifier)
      .first<Member>();
  }

  async getNextMemberCode(): Promise<string> {
    const res = await this.db
      .prepare(`SELECT COUNT(*) as total FROM members WHERE gym_id = ?`)
      .bind(this.gymId)
      .first<{ total: number }>();
    const count = (res?.total || 0) + 1;
    return `MEM-${1000 + count}`;
  }

  /**
   * Atomic insert that returns the new id. D1 doesn't have `RETURNING id`
   * for all builds reliably, so we do `last_insert_rowid` instead.
   */
  async create(data: Omit<Member, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'gym_id'>): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const res = await this.db
      .prepare(
        `INSERT INTO members (
          gym_id, member_code, first_name, last_name, email, phone, gender,
          date_of_birth, photo_url, face_embedding, address, city, pincode,
          emergency_contact_name, emergency_contact_phone, health_notes,
          status, joined_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        this.gymId,
        data.member_code,
        data.first_name,
        data.last_name ?? null,
        data.email ?? null,
        data.phone,
        data.gender ?? null,
        data.date_of_birth ?? null,
        data.photo_url ?? null,
        data.face_embedding ?? null,
        data.address ?? null,
        data.city ?? null,
        data.pincode ?? null,
        data.emergency_contact_name ?? null,
        data.emergency_contact_phone ?? null,
        data.health_notes ?? null,
        data.status,
        data.joined_date,
        now,
        now
      )
      .run();
    return Number(res.meta?.last_row_id ?? res.meta?.lastInsertRowid ?? 0);
  }

  async update(id: number, data: Partial<Member>): Promise<void> {
    const fieldMap: Record<string, string> = {
      first_name: 'first_name',
      last_name: 'last_name',
      email: 'email',
      phone: 'phone',
      gender: 'gender',
      date_of_birth: 'date_of_birth',
      photo_url: 'photo_url',
      face_embedding: 'face_embedding',
      address: 'address',
      city: 'city',
      pincode: 'pincode',
      emergency_contact_name: 'emergency_contact_name',
      emergency_contact_phone: 'emergency_contact_phone',
      health_notes: 'health_notes',
      status: 'status',
    };

    const fields: string[] = [];
    const bindings: any[] = [];
    const seen = new Set<string>();

    for (const [key, col] of Object.entries(fieldMap)) {
      const v = (data as any)[key];
      if (v !== undefined && !seen.has(col)) {
        seen.add(col);
        fields.push(`${col} = ?`);
        bindings.push(v);
      }
    }

    if (fields.length === 0) return;

    fields.push('updated_at = unixepoch()');
    bindings.push(id, this.gymId);

    const query = `UPDATE members SET ${fields.join(', ')} WHERE id = ? AND gym_id = ? AND deleted_at IS NULL`;
    await this.db.prepare(query).bind(...bindings).run();
  }

  /**
   * Bulk import. Returns counts + per-row error messages.
   * Enforces license capacity against the active member count.
   */
  async bulkCreateMembers(
    rows: any[],
    recordedByUserId: number,
    defaultPlanId?: number
  ): Promise<{ importedCount: number; skippedCount: number; errors: string[]; plan: any | null }> {
    const plansRes = await this.db
      .prepare(`SELECT * FROM membership_plans WHERE gym_id = ? AND is_active = 1 AND deleted_at IS NULL`)
      .bind(this.gymId)
      .all<any>();
    const plans: any[] = plansRes.results || [];
    const fallbackPlan = defaultPlanId ? plans.find((p) => p.id === defaultPlanId) || plans[0] : plans[0];

    if (!fallbackPlan) {
      return {
        importedCount: 0,
        skippedCount: rows.length,
        errors: ['No active membership plans exist for this gym. Create at least one plan before importing.'],
        plan: null,
      };
    }

    const currentCodeCountRes = await this.db
      .prepare(`SELECT COUNT(*) as total FROM members WHERE gym_id = ?`)
      .bind(this.gymId)
      .first<{ total: number }>();
    let memberCodeCounter = (currentCodeCountRes?.total || 0) + 1;

    const license = await this.db
      .prepare(`SELECT max_members FROM licenses WHERE gym_id = ?`)
      .bind(this.gymId)
      .first<{ max_members: number }>();
    let currentActive = await this.countActive();

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const statements: D1PreparedStatement[] = [];

    for (let i = 0; i < rows.length; i++) {
      if (license && license.max_members > 0 && !isWithinLicenseLimit(currentActive + importedCount, license.max_members)) {
        skippedCount += rows.length - i;
        errors.push(
          `License capacity reached (max ${license.max_members} active members). ${rows.length - i} remaining rows skipped.`
        );
        break;
      }

      const row = rows[i];
      const cleanPhone = String(row.phone || '').trim().replace(/\D/g, '').slice(-10);
      if (!cleanPhone || cleanPhone.length < 10) {
        skippedCount++;
        errors.push(`Row ${i + 1} (${row.firstName || 'Unknown'}): invalid 10-digit phone number`);
        continue;
      }

      const existing = await this.findByIdentifier(cleanPhone);
      if (existing) {
        skippedCount++;
        errors.push(`Row ${i + 1} (${row.firstName}): member with phone ${cleanPhone} already enrolled`);
        continue;
      }

      const memberCode = `MEM-${1000 + memberCodeCounter++}`;
      const joinedTimestamp = row.startDate
        ? Math.floor(new Date(row.startDate).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      let plan = fallbackPlan;
      if (row.planName) {
        const found = plans.find(
          (p) => p.name.toLowerCase().includes(String(row.planName).toLowerCase().trim())
        );
        if (found) plan = found;
      }

      const durationMonths = plan?.duration_months || 1;
      const startTimestamp = joinedTimestamp;
      const endTimestamp = row.endDate
        ? Math.floor(new Date(row.endDate).getTime() / 1000)
        : startTimestamp + durationMonths * 30 * 86400;

      const totalAmountPaise = plan
        ? (plan.price_paise || 0) + (plan.admission_fee_paise || 0)
        : 150000;
      const paidPaise = Math.round((Number(row.paidPaise) || Number(row.paidAmount) || 0));
      const duePaise =
        row.duePaise !== undefined && Number(row.duePaise) > 0
          ? Math.round(Number(row.duePaise))
          : Math.max(0, totalAmountPaise - paidPaise);

      // 1. Member Insert
      statements.push(
        this.db.prepare(
          `INSERT INTO members (
            gym_id, member_code, first_name, last_name, email, phone, gender,
            status, joined_date, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, unixepoch(), unixepoch())`
        ).bind(
          this.gymId,
          memberCode,
          String(row.firstName).trim(),
          row.lastName ? String(row.lastName).trim() : null,
          row.email ? String(row.email).trim() : null,
          cleanPhone,
          row.gender || 'MALE',
          joinedTimestamp
        )
      );

      // 2. Membership Insert
      statements.push(
        this.db.prepare(
          `INSERT INTO memberships (
            gym_id, member_id, membership_plan_id, start_date, end_date,
            total_amount_paise, discount_paise, final_amount_paise,
            paid_amount_paise, due_amount_paise, status,
            created_by_user_id, created_at, updated_at
          ) VALUES (?, last_insert_rowid(), ?, ?, ?, ?, 0, ?, ?, ?, 'ACTIVE', ?, unixepoch(), unixepoch())`
        ).bind(
          this.gymId,
          plan.id,
          startTimestamp,
          endTimestamp,
          totalAmountPaise,
          totalAmountPaise,
          paidPaise,
          duePaise,
          recordedByUserId
        )
      );

      importedCount++;
    }

    if (statements.length > 0) {
      // D1 batch() runs statements sequentially; final last_insert_rowid is
      // meaningless so we re-query memberships after the fact if needed.
      // For now we keep the simple sequential pattern from the original code.
      for (const stmt of statements) {
        await stmt.run();
      }
    }

    return { importedCount, skippedCount, errors, plan: fallbackPlan };
  }

  async getTodayAttendance(): Promise<AttendanceListItem[]> {
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

  async softDelete(id: number): Promise<boolean> {
    const res = await this.db
      .prepare(
        `UPDATE members
         SET deleted_at = unixepoch(), status = 'INACTIVE', updated_at = unixepoch()
         WHERE id = ? AND gym_id = ? AND deleted_at IS NULL`
      )
      .bind(id, this.gymId)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }

  async restore(id: number): Promise<boolean> {
    const res = await this.db
      .prepare(
        `UPDATE members
         SET deleted_at = NULL, status = 'ACTIVE', updated_at = unixepoch()
         WHERE id = ? AND gym_id = ? AND deleted_at IS NOT NULL`
      )
      .bind(id, this.gymId)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }
}

/** YYYYMMDD integer for the local date. */
export function todayYyyymmdd(): number {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y * 10000 + parseInt(m, 10) * 100 + parseInt(day, 10);
}
