/**
 * Member repository.
 *
 * Uses Drizzle's sql`` template tag for complex dynamic WHERE clauses
 * (search, status filtering, correlated subquery for latest membership).
 * Plain Drizzle query builder for everything else.
 */
import { eq, and, isNull, like, desc, sql } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import type { Member, MemberStatus, MemberListItem } from '@gymtech/shared';
import { members, memberships, membershipPlans, counters, communicationLogs, attendance } from '../db/schema';

/** Returns today's date as YYYYMMDD integer. */
export function todayYyyymmdd(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export class MemberRepository {
  private db: Database;
  private d1: D1Database;

  constructor(db: Database | D1Database, private gymId: number) {
    if ((db as any).prepare) {
      this.d1 = db as D1Database;
      this.db = createDatabase(db as D1Database);
    } else {
      this.db = db as Database;
      this.d1 = (db as any).$client || (db as any);
    }
  }

  async list(params: {
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<MemberListItem[]> {
    const whereParts: string[] = [`m.gym_id = ?`, `m.deleted_at IS NULL`];
    const bindings: any[] = [this.gymId];

    if (params.status && params.status !== 'ALL') {
      if (params.status === 'EXPIRED') {
        whereParts.push(`(m.status = 'EXPIRED' OR EXISTS (
          SELECT 1 FROM memberships ms2
          WHERE ms2.member_id = m.id AND ms2.end_date < unixepoch() AND ms2.deleted_at IS NULL
        ))`);
      } else if (params.status === 'ACTIVE') {
        whereParts.push(`m.status = 'ACTIVE'`);
        whereParts.push(`(ms.end_date IS NULL OR ms.end_date >= unixepoch())`);
      } else {
        whereParts.push(`m.status = ?`);
        bindings.push(params.status);
      }
    }

    if (params.search) {
      const term = `%${params.search}%`;
      whereParts.push(`(m.first_name LIKE ? OR m.last_name LIKE ? OR m.phone LIKE ? OR m.member_code LIKE ? OR m.email LIKE ?)`);
      bindings.push(term, term, term, term, term);
    }

    const whereClause = whereParts.join(' AND ');
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const query = `
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
      WHERE ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const { results } = await this.d1.prepare(query).bind(...bindings).all() as { results: any[] };
    return (results || []).map((row: any) => ({
      ...row,
      id: row.id,
      gymId: row.gym_id ?? row.gymId,
      memberCode: row.member_code ?? row.memberCode,
      firstName: row.first_name ?? row.firstName,
      lastName: row.last_name ?? row.lastName,
      email: row.email,
      phone: row.phone,
      gender: row.gender,
      status: row.status,
      joinedDate: row.joined_date ?? row.joinedDate,
      photoUrl: row.photo_url ?? row.photoUrl,
      activeMembershipId: row.active_membership_id ?? row.activeMembershipId,
      membershipStatus: row.membership_status ?? row.membershipStatus,
      membershipStartDate: row.membership_start_date ?? row.membershipStartDate,
      membershipEndDate: row.membership_end_date ?? row.membershipEndDate,
      membershipDueAmountPaise: row.membership_due_amount_paise ?? row.membershipDueAmountPaise,
      planName: row.plan_name ?? row.planName,
      // Keep snake_case keys intact for backward compatibility
      first_name: row.first_name ?? row.firstName,
      last_name: row.last_name ?? row.lastName,
      member_code: row.member_code ?? row.memberCode,
      joined_date: row.joined_date ?? row.joinedDate,
      active_membership_id: row.active_membership_id ?? row.activeMembershipId,
      membership_status: row.membership_status ?? row.membershipStatus,
      membership_start_date: row.membership_start_date ?? row.membershipStartDate,
      membership_end_date: row.membership_end_date ?? row.membershipEndDate,
      membership_due_amount_paise: row.membership_due_amount_paise ?? row.membershipDueAmountPaise,
      plan_name: row.plan_name ?? row.planName,
    })) as MemberListItem[];
  }

  async countActive(): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(members)
      .where(
        and(
          eq(members.gymId, this.gymId),
          eq(members.status, 'ACTIVE' as any),
          isNull(members.deletedAt)
        )
      );
    return count ?? 0;
  }

  async countTotal(params: { search?: string; status?: string } = {}): Promise<number> {
    const whereParts: string[] = [`gym_id = ?`, `deleted_at IS NULL`];
    const bindings: any[] = [this.gymId];

    if (params.status && params.status !== 'ALL') {
      if (params.status === 'EXPIRED') {
        whereParts.push(`(status = 'EXPIRED' OR EXISTS (
          SELECT 1 FROM memberships ms2
          WHERE ms2.member_id = members.id AND ms2.end_date < unixepoch() AND ms2.deleted_at IS NULL
        ))`);
      } else if (params.status === 'ACTIVE') {
        whereParts.push(`status = 'ACTIVE'`);
      } else {
        whereParts.push(`status = ?`);
        bindings.push(params.status);
      }
    }

    if (params.search) {
      const term = `%${params.search}%`;
      whereParts.push(`(first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR member_code LIKE ? OR email LIKE ?)`);
      bindings.push(term, term, term, term, term);
    }

    const query = `SELECT COUNT(*) as count FROM members WHERE ${whereParts.join(' AND ')}`;
    const result = await this.d1.prepare(query).bind(...bindings).first() as { count: number } | undefined;
    return result?.count ?? 0;
  }

  async countSummary(params: { now: number; sevenDays: number }): Promise<{
    total: number; active: number; expiring: number; frozen: number; blocked: number; expired: number;
  }> {
    // L8: Single-query summary counts using current membership status
    const base = `FROM members m
      LEFT JOIN memberships ms ON ms.member_id = m.id AND ms.deleted_at IS NULL
      AND ms.id = (
        SELECT ms2.id FROM memberships ms2
        WHERE ms2.member_id = m.id AND ms2.deleted_at IS NULL
        ORDER BY ms2.created_at DESC LIMIT 1
      )
      WHERE m.gym_id = ${this.gymId} AND m.deleted_at IS NULL`;

    const [total, active, frozen, blocked, expiring, expired] = await Promise.all([
      this.d1.prepare(`SELECT COUNT(*) as c ${base}`).first() as Promise<{ c: number } | undefined>,
      this.d1.prepare(`SELECT COUNT(*) as c ${base} AND ms.status = 'ACTIVE'`).first() as Promise<{ c: number } | undefined>,
      this.d1.prepare(`SELECT COUNT(*) as c ${base} AND ms.status = 'FROZEN'`).first() as Promise<{ c: number } | undefined>,
      this.d1.prepare(`SELECT COUNT(*) as c ${base} AND ms.status = 'BLOCKED'`).first() as Promise<{ c: number } | undefined>,
      this.d1.prepare(`SELECT COUNT(*) as c ${base} AND ms.status = 'ACTIVE' AND ms.end_date BETWEEN ? AND ?`).bind(params.now, params.sevenDays).first() as Promise<{ c: number } | undefined>,
      this.d1.prepare(`SELECT COUNT(*) as c ${base} AND (m.status = 'EXPIRED' OR ms.status = 'EXPIRED' OR (ms.end_date IS NOT NULL AND ms.end_date < ?))`).bind(params.now).first() as Promise<{ c: number } | undefined>,
    ]);

    return {
      total: total?.c ?? 0,
      active: active?.c ?? 0,
      frozen: frozen?.c ?? 0,
      blocked: blocked?.c ?? 0,
      expiring: expiring?.c ?? 0,
      expired: expired?.c ?? 0,
    };
  }

  async findById(id: number): Promise<Member | null> {
    const rows = await this.db
      .select()
      .from(members)
      .where(and(eq(members.id, id), eq(members.gymId, this.gymId), isNull(members.deletedAt)))
      .limit(1);
    return (rows[0] as Member) ?? null;
  }

  async findByIdentifier(identifier: string): Promise<Member | null> {
    const rows = await this.db
      .select()
      .from(members)
      .where(
        and(
          eq(members.gymId, this.gymId),
          isNull(members.deletedAt),
          sql`(${members.phone} = ${identifier} OR ${members.memberCode} = ${identifier} OR ${members.email} = ${identifier})`
        )
      )
      .limit(1);
    return (rows[0] as Member) ?? null;
  }

  async getNextMemberCode(): Promise<string> {
    // H4 fix: use atomic upsert-returning to eliminate TOCTOU race between count and insert.
    // INSERT ... ON CONFLICT DO UPDATE: if no row exists, inserts with value=1; if exists, increments.
    const result = await this.d1
      .prepare(`
        INSERT INTO counters (gym_id, counter_type, value)
        VALUES (?, 'member_code', 1)
        ON CONFLICT (gym_id, counter_type) DO UPDATE SET value = value + 1
        RETURNING value AS next_val
      `)
      .bind(this.gymId)
      .all<{ next_val: number }>();
    const nextVal = result.results?.[0]?.next_val ?? 1;
    return `MEM-${1000 + nextVal}`;
  }

  async create(
    data: Omit<Member, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'gymId'>
  ): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .insert(members)
      .values({
        gymId: this.gymId,
        memberCode: data.memberCode,
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        email: data.email ?? null,
        phone: data.phone,
        gender: data.gender ?? null,
        dateOfBirth: data.dateOfBirth ?? null,
        photoUrl: data.photoUrl ?? null,
        faceEmbedding: data.faceEmbedding ?? null,
        address: data.address ?? null,
        city: data.city ?? null,
        pincode: data.pincode ?? null,
        emergencyContactName: data.emergencyContactName ?? null,
        emergencyContactPhone: data.emergencyContactPhone ?? null,
        healthNotes: data.healthNotes ?? null,
        status: data.status,
        joinedDate: data.joinedDate,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: members.id });
    return row[0]!.id;
  }

  async update(id: number, data: Partial<Member>): Promise<void> {
    const sets: Partial<typeof members.$inferInsert> = {};

    if (data.firstName !== undefined) sets.firstName = data.firstName;
    if (data.lastName !== undefined) sets.lastName = data.lastName;
    if (data.email !== undefined) sets.email = data.email;
    if (data.phone !== undefined) sets.phone = data.phone;
    if (data.gender !== undefined) sets.gender = data.gender;
    if (data.dateOfBirth !== undefined) sets.dateOfBirth = data.dateOfBirth;
    if (data.photoUrl !== undefined) sets.photoUrl = data.photoUrl;
    if (data.faceEmbedding !== undefined) sets.faceEmbedding = data.faceEmbedding;
    if (data.address !== undefined) sets.address = data.address;
    if (data.city !== undefined) sets.city = data.city;
    if (data.pincode !== undefined) sets.pincode = data.pincode;
    if (data.emergencyContactName !== undefined) sets.emergencyContactName = data.emergencyContactName;
    if (data.emergencyContactPhone !== undefined) sets.emergencyContactPhone = data.emergencyContactPhone;
    if (data.healthNotes !== undefined) sets.healthNotes = data.healthNotes;
    if (data.status !== undefined) sets.status = data.status;

    if (Object.keys(sets).length === 0) return;
    sets.updatedAt = Math.floor(Date.now() / 1000);

    await this.db
      .update(members)
      .set(sets)
      .where(and(eq(members.id, id), eq(members.gymId, this.gymId), isNull(members.deletedAt)));
  }

  /**
   * Bulk import with license capacity enforcement.
   * Returns counts + per-row error messages.
   */
  async bulkCreateMembers(
    rows: any[],
    recordedByUserId: number,
    defaultPlanId?: number
  ): Promise<{
    importedCount: number;
    skippedCount: number;
    errors: string[];
    plan: any | null;
  }> {
    // Load active plans
    const plansRes = await this.db
      .select()
      .from(membershipPlans)
      .where(and(eq(membershipPlans.gymId, this.gymId), eq(membershipPlans.isActive, 1), isNull(membershipPlans.deletedAt)))
      .orderBy(membershipPlans.id);
    const fallbackPlan = defaultPlanId
      ? plansRes.find((p) => p.id === defaultPlanId) || plansRes[0]
      : plansRes[0];

    if (!fallbackPlan) {
      return {
        importedCount: 0,
        skippedCount: rows.length,
        errors: ['No active membership plans exist for this gym. Create at least one plan before importing.'],
        plan: null,
      };
    }

    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(members)
      .where(eq(members.gymId, this.gymId));
    let memberCodeCounter = (total || 0) + 1;

    const license = await this.d1
      .prepare(`SELECT max_members FROM licenses WHERE gym_id = ?`)
      .bind(this.gymId)
      .first() as { max_members: number } | undefined;
    let currentActive = await this.countActive();

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      if (license && license.max_members > 0 && !isWithinLicenseLimit(currentActive + importedCount, license.max_members)) {
        skippedCount += rows.length - i;
        errors.push(`License capacity reached (max ${license.max_members} active members). ${rows.length - i} remaining rows skipped.`);
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
        const found = plansRes.find(
          (p) => p.name.toLowerCase().includes(String(row.planName).toLowerCase().trim())
        );
        if (found) plan = found;
      }

      const durationMonths = plan?.durationMonths || 1;
      const startTimestamp = joinedTimestamp;
      const endTimestamp = row.endDate
        ? Math.floor(new Date(row.endDate).getTime() / 1000)
        : startTimestamp + durationMonths * 30 * 86400;

      const totalAmountPaise = plan
        ? (plan.pricePaise || 0) + (plan.admissionFeePaise || 0)
        : 150000;
      const paidPaise = Math.round(Number(row.paidPaise) || Number(row.paidAmount) || 0);
      const duePaise =
        row.duePaise !== undefined && Number(row.duePaise) > 0
          ? Math.round(Number(row.duePaise))
          : Math.max(0, totalAmountPaise - paidPaise);

      // Insert member
      const memberId = await this.create({
        memberCode: memberCode,
        firstName: String(row.firstName).trim(),
        lastName: row.lastName ? String(row.lastName).trim() : null,
        email: row.email ? String(row.email).trim() : null,
        phone: cleanPhone,
        gender: row.gender || 'MALE',
        status: 'ACTIVE',
        joinedDate: joinedTimestamp,
        photoUrl: null,
        faceEmbedding: null,
        dateOfBirth: null,
        address: null,
        city: null,
        pincode: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        healthNotes: null,
      });

      // Insert membership
      await this.db.insert(memberships).values({
        gymId: this.gymId,
        memberId,
        membershipPlanId: plan.id,
        startDate: startTimestamp,
        endDate: endTimestamp,
        totalAmountPaise,
        discountPaise: 0,
        finalAmountPaise: totalAmountPaise,
        paidAmountPaise: paidPaise,
        dueAmountPaise: duePaise,
        status: 'ACTIVE',
        createdByUserId: recordedByUserId,
        createdAt: joinedTimestamp,
        updatedAt: joinedTimestamp,
      });

      importedCount++;
    }

    return { importedCount, skippedCount, errors, plan: fallbackPlan };
  }

  async getTodayAttendance(): Promise<number> {
    const today = todayYyyymmdd();
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(attendance)
      .where(
        and(
          eq(attendance.gymId, this.gymId),
          eq(attendance.attendanceDate, today),
          isNull(attendance.deletedAt)
        )
      );
    return count ?? 0;
  }

  /**
   * M-17: Return the most recently-ended active membership for a member.
   * Used by attendance check-in and auth routes to determine if a member
   * can access the gym. Returns null if no active/future membership exists.
   */
  async getActiveMembership(memberId: number): Promise<any | null> {
    const row = await this.d1
      .prepare(`
        SELECT ms.*, mp.name as plan_name
        FROM memberships ms
        LEFT JOIN membership_plans mp ON mp.id = ms.membership_plan_id
        WHERE ms.member_id = ?
          AND ms.deleted_at IS NULL
          AND ms.status IN ('ACTIVE', 'FROZEN')
          AND ms.end_date >= unixepoch()
        ORDER BY ms.end_date DESC
        LIMIT 1
      `)
      .bind(memberId)
      .first();
    return row ?? null;
  }

  async softDelete(id: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(members)
      .set({ deletedAt: now, status: 'INACTIVE' as any, updatedAt: now })
      .where(and(eq(members.id, id), eq(members.gymId, this.gymId), isNull(members.deletedAt)));
  }

  async restore(id: number): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const result = await this.db
      .update(members)
      .set({ deletedAt: null, status: 'ACTIVE' as any, updatedAt: now })
      .where(and(eq(members.id, id), eq(members.gymId, this.gymId))) as any;
    return (result.changes ?? 0) > 0;
  }

  async erasePersonalData(id: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    // H-9: Anonymise + soft-delete the member record.
    await this.db
      .update(members)
      .set({
        email: null,
        phone: null,
        address: null,
        city: null,
        pincode: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        healthNotes: null,
        photoUrl: null,
        faceEmbedding: null,
        updatedAt: now,
        deletedAt: now,
      } as unknown as Partial<typeof members.$inferInsert>)
      .where(and(eq(members.id, id), eq(members.gymId, this.gymId)));

    // H-9: Purge all communication log entries linked to this member.
    // This satisfies Article 17 GDPR "right to erasure" — the communication
    // history must be removed when the data subject exercises their right.
    // Backward-compat: rows with member_id = NULL (pre-migration) are preserved
    // as they cannot be attributed to a specific member.
    await this.db
      .delete(communicationLogs)
      .where(and(eq(communicationLogs.memberId, id), eq(communicationLogs.gymId, this.gymId)));
  }
}

// Need the calculation helper
import { isWithinLicenseLimit } from '../lib/calculations';
