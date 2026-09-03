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
import { members, memberships, membershipPlans } from '../db/schema';

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
    const conditions: (ReturnType<typeof sql> | ReturnType<typeof isNull>)[] = [
      sql`${members.gymId} = ${this.gymId}`,
      isNull(members.deletedAt),
    ];

    if (params.status && params.status !== 'ALL') {
      if (params.status === 'EXPIRED') {
        conditions.push(sql`(${members.status} = 'EXPIRED' OR EXISTS (
          SELECT 1 FROM memberships ms2
          WHERE ms2.member_id = ${members.id} AND ms2.end_date < unixepoch() AND ms2.deleted_at IS NULL
        ))`);
      } else if (params.status === 'ACTIVE') {
        conditions.push(sql`${members.status} = 'ACTIVE'`);
        conditions.push(sql`(ms.end_date IS NULL OR ms.end_date >= unixepoch())`);
      } else {
        conditions.push(sql`${members.status} = ${params.status}`);
      }
    }

    if (params.search) {
      const term = `%${params.search}%`;
      conditions.push(
        sql`(${members.firstName} LIKE ${term} OR ${members.lastName} LIKE ${term} OR ${members.phone} LIKE ${term} OR ${members.memberCode} LIKE ${term} OR ${members.email} LIKE ${term})`
      );
    }

    // Build WHERE clause manually since we need to use raw SQL for the complex correlated subquery
    const whereParts: string[] = [`m.gym_id = ${this.gymId}`, `m.deleted_at IS NULL`];
    const bindings: any[] = [];

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

    const { results } = await this.d1.prepare(query).bind(...bindings).all() as { results: MemberListItem[] };
    return results || [];
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
    const whereParts: string[] = [`gym_id = ${this.gymId}`, `deleted_at IS NULL`];

    if (params.status && params.status !== 'ALL') {
      if (params.status === 'EXPIRED') {
        whereParts.push(`(status = 'EXPIRED' OR EXISTS (
          SELECT 1 FROM memberships ms2
          WHERE ms2.member_id = members.id AND ms2.end_date < unixepoch() AND ms2.deleted_at IS NULL
        ))`);
      } else if (params.status === 'ACTIVE') {
        whereParts.push(`status = 'ACTIVE'`);
      } else {
        whereParts.push(`status = '${params.status}'`);
      }
    }

    if (params.search) {
      const term = `%${params.search}%`;
      whereParts.push(`(first_name LIKE '${term}' OR last_name LIKE '${term}' OR phone LIKE '${term}' OR member_code LIKE '${term}' OR email LIKE '${term}')`);
    }

    const query = `SELECT COUNT(*) as count FROM members WHERE ${whereParts.join(' AND ')}`;
    const result = await this.d1.prepare(query).first() as { count: number } | undefined;
    return result?.count ?? 0;
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
    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(members)
      .where(eq(members.gymId, this.gymId));
    return `MEM-${1000 + (total || 0) + 1}`;
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
  }
}

// Need the calculation helper
import { isWithinLicenseLimit } from '../lib/calculations';
