/**
 * PT (personal-training) repository — single owner of the `pt_collections`
 * table. These statements used to live inline in routes/pt.routes.ts; the
 * routes now only validate, authorize, and shape responses.
 */
import type { D1Database } from '../db/client';

export interface PtCollectionRow {
  id: number;
  gym_id: number;
  member_id: number;
  trainer_id: number;
  sessions: number;
  amount_paise: number;
  commission_percentage: number;
  commission_paise: number;
  commission_status: 'PENDING' | 'PAID';
  payment_mode: string;
  payment_date: number;
  receipt_number: string | null;
  notes: string | null;
  recorded_by_user_id: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  member_name: string;
  member_code: string;
  trainer_name: string | null;
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

    const { results } = await this.d1.prepare(sql).bind(...binds).all<PtCollectionRow>();
    return results ?? [];
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
    const { results } = await this.d1.prepare(sql).bind(...binds).all();
    return results ?? [];
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
    let sql = `
      SELECT p.*,
             m.first_name || ' ' || COALESCE(m.last_name, '') AS member_name,
             m.member_code,
             u.name AS trainer_name
      FROM pt_packages p
      JOIN members m ON m.id = p.member_id
      LEFT JOIN users u ON u.id = p.trainer_id
      WHERE p.gym_id = ? AND p.deleted_at IS NULL`;
    const binds: unknown[] = [gymId];
    if (memberId) {
      sql += ' AND p.member_id = ?';
      binds.push(memberId);
    }
    if (trainerId) {
      sql += ' AND p.trainer_id = ?';
      binds.push(trainerId);
    }
    sql += ' ORDER BY p.created_at DESC';
    const { results } = await this.d1.prepare(sql).bind(...binds).all();
    return results ?? [];
  }

  async findPackageById(packageId: number, gymId: number) {
    return await this.d1
      .prepare(`SELECT * FROM pt_packages WHERE id = ? AND gym_id = ? AND deleted_at IS NULL`)
      .bind(packageId, gymId)
      .first<{
        id: number;
        gym_id: number;
        member_id: number;
        trainer_id: number;
        package_name: string;
        total_sessions: number;
        used_sessions: number;
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
           gym_id, member_id, trainer_id, package_name, total_sessions, used_sessions,
           amount_paise, status, start_date, expiry_date, notes, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 0, ?, 'ACTIVE', ?, ?, ?, unixepoch(), unixepoch())
         RETURNING id`
      )
      .bind(
        input.gymId,
        input.memberId,
        input.trainerId,
        input.packageName,
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
    let sql = `
      SELECT s.*,
             m.first_name || ' ' || COALESCE(m.last_name, '') AS member_name,
             u.name AS trainer_name,
             p.package_name
      FROM pt_sessions s
      JOIN pt_packages p ON p.id = s.package_id
      JOIN members m ON m.id = s.member_id
      LEFT JOIN users u ON u.id = s.trainer_id
      WHERE s.gym_id = ?`;
    const binds: unknown[] = [gymId];
    if (packageId) {
      sql += ' AND s.package_id = ?';
      binds.push(packageId);
    }
    if (memberId) {
      sql += ' AND s.member_id = ?';
      binds.push(memberId);
    }
    sql += ' ORDER BY s.created_at DESC LIMIT 200';
    const { results } = await this.d1.prepare(sql).bind(...binds).all();
    return results ?? [];
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
    const sessionRes = await this.d1
      .prepare(
        `INSERT INTO pt_sessions (
           gym_id, package_id, member_id, trainer_id, session_date,
           session_notes, feedback, recorded_by_user_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
         RETURNING id`
      )
      .bind(
        input.gymId,
        input.packageId,
        input.memberId,
        input.trainerId,
        input.sessionDate ?? today,
        input.sessionNotes ?? null,
        input.feedback ?? null,
        input.recordedByUserId
      )
      .first<{ id: number }>();

    // Increment used sessions on the package and auto-complete if reached
    await this.d1
      .prepare(
        `UPDATE pt_packages
         SET used_sessions = used_sessions + 1,
             status = CASE WHEN used_sessions + 1 >= total_sessions THEN 'COMPLETED' ELSE status END,
             updated_at = unixepoch()
         WHERE id = ? AND gym_id = ?`
      )
      .bind(input.packageId, input.gymId)
      .run();

    return sessionRes?.id ?? 0;
  }
}

