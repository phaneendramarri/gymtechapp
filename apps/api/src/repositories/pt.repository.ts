/**
 * PT (personal-training) repository — single owner of the `pt_collections`
 * table. These statements used to live inline in routes/pt.routes.ts; the
 * routes now only validate, authorize, and shape responses.
 */
import type { D1Database } from '../db/client';

export interface PtCollectionRow {
  id: number;
  gymId: number;
  memberId: number;
  trainerId: number;
  sessions: number;
  amountPaise: number;
  commissionPercentage: number;
  commissionPaise: number;
  commissionStatus: 'PENDING' | 'PAID';
  paymentMode: string;
  paymentDate: number;
  receiptNumber: string | null;
  notes: string | null;
  recordedByUserId: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  memberName: string;
  memberCode: string;
  trainerName: string | null;
}

export interface PtCreateInput {
  gymId: number;
  memberId: number;
  trainerId: number;
  sessions: number;
  amountPaise: number;
  commissionPercentage: number;
  commissionPaise: number;
  paymentMode: string;
  paymentDate: number;
  receiptNumber: string;
  notes: string | null;
  recordedByUserId: number;
}

export interface PtSummary {
  totalCollected: number;
  commissionPending: number;
  commissionPaid: number;
}

export class PtRepository {
  constructor(private d1: D1Database) {}

  async listForGym(gymId: number, trainerId: number | null, limit: number): Promise<PtCollectionRow[]> {
    let sql = `
      SELECT pt.*,
             m.first_name || ' ' || COALESCE(m.last_name, '') AS member_name,
             m.member_code,
             u.name AS trainer_name
      FROM pt_collections pt
      JOIN members m ON m.id = pt.member_id
      LEFT JOIN users u ON u.id = pt.trainer_id
      WHERE pt.gym_id = ?`;
    const binds: unknown[] = [gymId];
    if (trainerId) {
      sql += ' AND pt.trainer_id = ?';
      binds.push(trainerId);
    }
    sql += ' ORDER BY pt.payment_date DESC LIMIT ?';
    binds.push(limit);

    const { results } = await this.d1.prepare(sql).bind(...binds).all<any>();
    // Map raw snake_case rows onto the shared camelCase PtCollectionRow contract
    // so the portal renders real fields instead of undefined.
    return (results ?? []).map((r: any) => ({
      id: r.id,
      gymId: r.gym_id,
      memberId: r.member_id,
      trainerId: r.trainer_id,
      sessions: r.sessions,
      amountPaise: r.amount_paise,
      commissionPercentage: r.commission_percentage,
      commissionPaise: r.commission_paise,
      commissionStatus: r.commission_status,
      paymentMode: r.payment_mode,
      paymentDate: r.payment_date,
      receiptNumber: r.receipt_number,
      notes: r.notes,
      recordedByUserId: r.recorded_by_user_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
      memberName: r.member_name,
      memberCode: r.member_code,
      trainerName: r.trainer_name,
    }));
  }

  async summaryFor(gymId: number, trainerId: number | null): Promise<PtSummary> {
    let sql = `
      SELECT
        COALESCE(SUM(amount_paise), 0) AS total_collected,
        COALESCE(SUM(CASE WHEN commission_status = 'PENDING' THEN commission_paise END), 0) AS commission_pending,
        COALESCE(SUM(CASE WHEN commission_status = 'PAID' THEN commission_paise END), 0) AS commission_paid
      FROM pt_collections
      WHERE gym_id = ?`;
    const binds: unknown[] = [gymId];
    if (trainerId) {
      sql += ' AND trainer_id = ?';
      binds.push(trainerId);
    }
    const row = await this.d1
      .prepare(sql)
      .bind(...binds)
      .first<{ total_collected: number; commission_pending: number; commission_paid: number }>();
    return {
      totalCollected: row?.total_collected ?? 0,
      commissionPending: row?.commission_pending ?? 0,
      commissionPaid: row?.commission_paid ?? 0,
    };
  }

  async summaryByTrainer(gymId: number, trainerId: number | null): Promise<Record<string, unknown>[]> {
    let sql = `
      SELECT pt.trainer_id,
             COALESCE(u.name, 'Unknown Trainer') AS trainer_name,
             COUNT(*) AS collections,
             COALESCE(SUM(pt.amount_paise), 0) AS collected,
             COALESCE(SUM(CASE WHEN pt.commission_status = 'PENDING' THEN pt.commission_paise END), 0) AS commission_pending,
             COALESCE(SUM(CASE WHEN pt.commission_status = 'PAID' THEN pt.commission_paise END), 0) AS commission_paid
      FROM pt_collections pt
      LEFT JOIN users u ON u.id = pt.trainer_id
      WHERE pt.gym_id = ?`;
    const binds: unknown[] = [gymId];
    if (trainerId) {
      sql += ' AND pt.trainer_id = ?';
      binds.push(trainerId);
    }
    sql += ' GROUP BY pt.trainer_id ORDER BY collected DESC';
    const { results } = await this.d1.prepare(sql).bind(...binds).all<any>();
    // Map to the PtSummary.byTrainer camelCase contract.
    return (results ?? []).map((r: any) => ({
      trainerId: r.trainer_id,
      trainerName: r.trainer_name,
      collections: r.collections,
      collected: r.collected,
      commissionPending: r.commission_pending,
      commissionPaid: r.commission_paid,
    }));
  }

  /** Insert a collection; returns the new row id. */
  async create(input: PtCreateInput): Promise<number> {
    const result = await this.d1
      .prepare(
        `INSERT INTO pt_collections (
           gym_id, member_id, trainer_id, sessions, amount_paise,
           commission_percentage, commission_paise, commission_status,
           payment_mode, payment_date, receipt_number, notes, recorded_by_user_id,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, unixepoch(), unixepoch())
         RETURNING id`
      )
      .bind(
        input.gymId,
        input.memberId,
        input.trainerId,
        input.sessions,
        input.amountPaise,
        input.commissionPercentage,
        input.commissionPaise,
        input.paymentMode,
        input.paymentDate,
        input.receiptNumber,
        input.notes,
        input.recordedByUserId
      )
      .first<{ id: number }>();
    return result?.id ?? 0;
  }

  /** Verify a trainer belongs to this gym (used before recording a collection). */
  async findUserInGym(userId: number, gymId: number): Promise<{ id: number; name: string } | null> {
    return (await this.d1
      .prepare(`SELECT id, name FROM users WHERE id = ? AND gym_id = ? AND deleted_at IS NULL LIMIT 1`)
      .bind(userId, gymId)
      .first<{ id: number; name: string }>()) ?? null;
  }

  async findByIdInGym(id: number, gymId: number): Promise<{ id: number } | null> {
    const row = await this.d1
      .prepare(`SELECT id FROM pt_collections WHERE id = ? AND gym_id = ?`)
      .bind(id, gymId)
      .first<{ id: number }>();
    return row ?? null;
  }

  async settleCommission(id: number, gymId: number, status: 'PENDING' | 'PAID'): Promise<void> {
    await this.d1
      .prepare(
        `UPDATE pt_collections SET commission_status = ?, updated_at = unixepoch() WHERE id = ? AND gym_id = ?`
      )
      .bind(status, id, gymId)
      .run();
  }

  // --- PT Packages & Sessions ---

  async listPackages(gymId: number, memberId?: number, trainerId?: number) {
    let sqlStr = `
      SELECT p.id,
             p.gym_id,
             p.member_id,
             p.trainer_user_id,
             p.package_name,
             p.total_sessions,
             p.completed_sessions,
             p.price_paise,
             p.start_date,
             p.expiry_date,
             p.status,
             p.notes,
             p.created_at,
             p.updated_at,
             m.first_name || ' ' || COALESCE(m.last_name, '') AS member_name,
             m.member_code,
             u.name AS trainer_name
      FROM pt_packages p
      JOIN members m ON m.id = p.member_id
      LEFT JOIN users u ON u.id = p.trainer_user_id
      WHERE p.gym_id = ?`;
    const binds: unknown[] = [gymId];
    if (memberId) {
      sqlStr += ' AND p.member_id = ?';
      binds.push(memberId);
    }
    if (trainerId) {
      sqlStr += ' AND p.trainer_user_id = ?';
      binds.push(trainerId);
    }
    sqlStr += ' ORDER BY p.created_at DESC';
    const { results } = await this.d1.prepare(sqlStr).bind(...binds).all();
    // Map to the shared camelCase contract; snake_case never leaks to clients.
    return (results ?? []).map((r: any) => ({
      id: r.id,
      gymId: r.gym_id,
      memberId: r.member_id,
      memberName: r.member_name,
      memberCode: r.member_code,
      trainerUserId: r.trainer_user_id,
      trainerName: r.trainer_name,
      packageName: r.package_name,
      totalSessions: r.total_sessions,
      completedSessions: r.completed_sessions,
      usedSessions: r.completed_sessions,
      pricePaise: r.price_paise,
      startDate: r.start_date,
      expiryDate: r.expiry_date,
      status: r.status,
      notes: r.notes,
    }));
  }

  async findPackageById(packageId: number, gymId: number) {
    return await this.d1
      .prepare(`SELECT id, gym_id, member_id, trainer_user_id, total_sessions, completed_sessions, status
                FROM pt_packages WHERE id = ? AND gym_id = ?`)
      .bind(packageId, gymId)
      .first<{
        id: number;
        gym_id: number;
        member_id: number;
        trainer_user_id: number;
        total_sessions: number;
        completed_sessions: number;
        status: string;
      }>();
  }

  async createPackage(input: {
    gymId: number;
    memberId: number;
    trainerId: number;
    packageName: string;
    totalSessions: number;
    amountPaise: number;
    startDate?: string;
    expiryDate?: string | null;
    notes?: string | null;
  }): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const result = await this.d1
      .prepare(
        `INSERT INTO pt_packages (
           gym_id, member_id, trainer_user_id, package_name, total_sessions,
           price_paise, start_date, expiry_date, status, notes, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, unixepoch(), unixepoch())
         RETURNING id`
      )
      .bind(
        input.gymId,
        input.memberId,
        input.trainerId,
        input.packageName || 'Personal Training',
        input.totalSessions,
        input.amountPaise,
        input.startDate ?? today,
        input.expiryDate ?? null,
        input.notes ?? null
      )
      .first<{ id: number }>();
    return result?.id ?? 0;
  }

  async listSessions(gymId: number, packageId?: number, memberId?: number) {
    let sqlStr = `
      SELECT s.id,
             s.gym_id,
             s.package_id,
             s.session_number,
             s.session_date,
             s.notes,
             s.trainer_user_id,
             s.signed_off_by_member,
             s.created_at,
             u.name AS trainer_name
      FROM pt_sessions s
      JOIN pt_packages p ON p.id = s.package_id
      LEFT JOIN users u ON u.id = s.trainer_user_id
      WHERE s.gym_id = ?`;
    const binds: unknown[] = [gymId];
    if (packageId) {
      sqlStr += ' AND s.package_id = ?';
      binds.push(packageId);
    }
    if (memberId) {
      sqlStr += ' AND p.member_id = ?';
      binds.push(memberId);
    }
    sqlStr += ' ORDER BY s.created_at DESC LIMIT 200';
    const { results } = await this.d1.prepare(sqlStr).bind(...binds).all();
    return (results ?? []).map((r: any) => ({
      id: r.id,
      gymId: r.gym_id,
      packageId: r.package_id,
      sessionNumber: r.session_number,
      sessionDate: r.session_date,
      notes: r.notes,
      trainerUserId: r.trainer_user_id,
      trainerName: r.trainer_name,
      signedOffByMember: Boolean(r.signed_off_by_member),
      createdAt: r.created_at,
    }));
  }

  async logSession(input: {
    gymId: number;
    packageId: number;
    memberId: number;
    trainerId: number;
    sessionDate?: string;
    sessionNotes?: string | null;
    feedback?: string | null;
    recordedByUserId: number;
  }): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);

    // next session number = current completed count + 1
    const pkgRow = await this.d1
      .prepare(`SELECT completed_sessions FROM pt_packages WHERE id = ? AND gym_id = ?`)
      .bind(input.packageId, input.gymId)
      .first<{ completed_sessions: number }>();
    const sessionNumber = (pkgRow?.completed_sessions ?? 0) + 1;

    const sessionRes = await this.d1
      .prepare(
        `INSERT INTO pt_sessions (
           gym_id, package_id, session_number, session_date,
           notes, trainer_user_id, signed_off_by_member, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, 1, unixepoch())
         RETURNING id`
      )
      .bind(
        input.gymId,
        input.packageId,
        sessionNumber,
        input.sessionDate ?? today,
        input.sessionNotes ?? input.feedback ?? null,
        input.trainerId
      )
      .first<{ id: number }>();

    // Increment completed sessions on the package and auto-complete at the cap.
    await this.d1
      .prepare(
        `UPDATE pt_packages
         SET completed_sessions = completed_sessions + 1,
             status = CASE WHEN completed_sessions + 1 >= total_sessions THEN 'COMPLETED' ELSE status END,
             updated_at = unixepoch()
         WHERE id = ? AND gym_id = ?`
      )
      .bind(input.packageId, input.gymId)
      .run();

    return sessionRes?.id ?? 0;
  }
}

