// filepath: apps/api/src/repositories/pt.repository.ts
/**
 * PT (personal-training) repository — single owner of the `ptCollections`,
 * `ptPackages`, and `ptSessions` tables.
 *
 * Keeps all SQL queries, parameter bindings, and camelCase mappings in ONE place.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { PtCollectionRow, PtSummary } from '@gymtech/shared';

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
  receiptNumber: string | null;
  notes: string | null;
  recordedByUserId: number | null;
}

export class PtRepository {
  constructor(private d1: D1Database) {}

  async listForGym(gymId: number, trainerId: number | null, limit: number): Promise<PtCollectionRow[]> {
    let sql = `
      SELECT pt.*,
             m.firstName || ' ' || COALESCE(m.lastName, '') AS memberName,
             m.memberCode,
             u.name AS trainerName
      FROM ptCollections pt
      JOIN members m ON m.id = pt.memberId
      LEFT JOIN users u ON u.id = pt.trainerId
      WHERE pt.gymId = ?`;
    const binds: unknown[] = [gymId];
    if (trainerId) {
      sql += ' AND pt.trainerId = ?';
      binds.push(trainerId);
    }
    sql += ' ORDER BY pt.paymentDate DESC LIMIT ?';
    binds.push(limit);

    const { results } = await this.d1.prepare(sql).bind(...binds).all<any>();
    return (results ?? []).map((r: any) => ({
      id: r.id,
      gymId: r.gymId,
      memberId: r.memberId,
      trainerId: r.trainerId,
      sessions: r.sessions,
      amountPaise: r.amountPaise,
      commissionPercentage: r.commissionPercentage,
      commissionPaise: r.commissionPaise,
      commissionStatus: r.commissionStatus,
      paymentMode: r.paymentMode,
      paymentDate: r.paymentDate,
      receiptNumber: r.receiptNumber,
      notes: r.notes,
      recordedByUserId: r.recordedByUserId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
      memberName: r.memberName,
      memberCode: r.memberCode,
      trainerName: r.trainerName,
    }));
  }

  async summaryFor(gymId: number, trainerId: number | null): Promise<PtSummary> {
    let sql = `
      SELECT
        COALESCE(SUM(amountPaise), 0) AS totalCollected,
        COALESCE(SUM(CASE WHEN commissionStatus = 'PENDING' THEN commissionPaise END), 0) AS commissionPending,
        COALESCE(SUM(CASE WHEN commissionStatus = 'PAID' THEN commissionPaise END), 0) AS commissionPaid
      FROM ptCollections
      WHERE gymId = ?`;
    const binds: unknown[] = [gymId];
    if (trainerId) {
      sql += ' AND trainerId = ?';
      binds.push(trainerId);
    }
    const totals = await this.d1.prepare(sql).bind(...binds).first<{
      totalCollected: number;
      commissionPending: number;
      commissionPaid: number;
    }>();

    return {
      totalCollected: totals?.totalCollected ?? 0,
      totalCommissionPending: totals?.commissionPending ?? 0,
      totalCommissionPaid: totals?.commissionPaid ?? 0,
      byTrainer: await this.summaryByTrainer(gymId, trainerId),
    };
  }

  async summaryByTrainer(gymId: number, trainerId: number | null): Promise<PtSummary['byTrainer']> {
    let sql = `
      SELECT pt.trainerId,
             COALESCE(u.name, 'Unknown Trainer') AS trainerName,
             COUNT(*) AS collections,
             COALESCE(SUM(pt.amountPaise), 0) AS collected,
             COALESCE(SUM(CASE WHEN pt.commissionStatus = 'PENDING' THEN pt.commissionPaise END), 0) AS commissionPending,
             COALESCE(SUM(CASE WHEN pt.commissionStatus = 'PAID' THEN pt.commissionPaise END), 0) AS commissionPaid
      FROM ptCollections pt
      LEFT JOIN users u ON u.id = pt.trainerId
      WHERE pt.gymId = ?`;
    const binds: unknown[] = [gymId];
    if (trainerId) {
      sql += ' AND pt.trainerId = ?';
      binds.push(trainerId);
    }
    sql += ' GROUP BY pt.trainerId ORDER BY collected DESC';
    const { results } = await this.d1.prepare(sql).bind(...binds).all<any>();
    return (results ?? []).map((r: any) => ({
      trainerId: r.trainerId,
      trainerName: r.trainerName,
      collections: r.collections,
      collected: r.collected,
      commissionPending: r.commissionPending,
      commissionPaid: r.commissionPaid,
    }));
  }

  /** Insert a collection; returns the new row id. */
  async create(input: PtCreateInput): Promise<number> {
    const result = await this.d1
      .prepare(
        `INSERT INTO ptCollections (
           gymId, memberId, trainerId, sessions, amountPaise,
           commissionPercentage, commissionPaise, commissionStatus,
           paymentMode, paymentDate, receiptNumber, notes, recordedByUserId,
           createdAt, updatedAt
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
      .prepare(`SELECT id, name FROM users WHERE id = ? AND gymId = ? AND deletedAt IS NULL LIMIT 1`)
      .bind(userId, gymId)
      .first<{ id: number; name: string }>()) ?? null;
  }

  async findByIdInGym(id: number, gymId: number): Promise<{ id: number } | null> {
    const row = await this.d1
      .prepare(`SELECT id FROM ptCollections WHERE id = ? AND gymId = ?`)
      .bind(id, gymId)
      .first<{ id: number }>();
    return row ?? null;
  }

  async settleCommission(id: number, gymId: number, status: 'PENDING' | 'PAID'): Promise<void> {
    await this.d1
      .prepare(
        `UPDATE ptCollections SET commissionStatus = ?, updatedAt = unixepoch() WHERE id = ? AND gymId = ?`
      )
      .bind(status, id, gymId)
      .run();
  }

  // --- PT Packages & Sessions ---

  async listPackages(gymId: number, memberId?: number, trainerId?: number) {
    let sqlStr = `
      SELECT p.id,
             p.gymId,
             p.memberId,
             p.trainerUserId,
             p.packageName,
             p.totalSessions,
             p.completedSessions,
             p.pricePaise,
             p.startDate,
             p.expiryDate,
             p.status,
             p.notes,
             p.createdAt,
             p.updatedAt,
             m.firstName || ' ' || COALESCE(m.lastName, '') AS memberName,
             m.memberCode,
             u.name AS trainerName
      FROM ptPackages p
      JOIN members m ON m.id = p.memberId
      LEFT JOIN users u ON u.id = p.trainerUserId
      WHERE p.gymId = ?`;
    const binds: unknown[] = [gymId];
    if (memberId) {
      sqlStr += ' AND p.memberId = ?';
      binds.push(memberId);
    }
    if (trainerId) {
      sqlStr += ' AND p.trainerUserId = ?';
      binds.push(trainerId);
    }
    sqlStr += ' ORDER BY p.createdAt DESC';
    const { results } = await this.d1.prepare(sqlStr).bind(...binds).all();
    return (results ?? []).map((r: any) => ({
      id: r.id,
      gymId: r.gymId,
      memberId: r.memberId,
      memberName: r.memberName,
      memberCode: r.memberCode,
      trainerUserId: r.trainerUserId,
      trainerName: r.trainerName,
      packageName: r.packageName,
      totalSessions: r.totalSessions,
      completedSessions: r.completedSessions,
      usedSessions: r.completedSessions,
      pricePaise: r.pricePaise,
      startDate: r.startDate,
      expiryDate: r.expiryDate,
      status: r.status,
      notes: r.notes,
    }));
  }

  async findPackageById(packageId: number, gymId: number) {
    return await this.d1
      .prepare(`SELECT id, gymId, memberId, trainerUserId, totalSessions, completedSessions, status
                FROM ptPackages WHERE id = ? AND gymId = ?`)
      .bind(packageId, gymId)
      .first<{
        id: number;
        gymId: number;
        memberId: number;
        trainerUserId: number;
        totalSessions: number;
        completedSessions: number;
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
        `INSERT INTO ptPackages (
           gymId, memberId, trainerUserId, packageName, totalSessions,
           pricePaise, startDate, expiryDate, status, notes, createdAt, updatedAt
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
             s.gymId,
             s.packageId,
             s.sessionNumber,
             s.sessionDate,
             s.notes,
             s.trainerUserId,
             s.signedOffByMember,
             s.createdAt,
             u.name AS trainerName
      FROM ptSessions s
      JOIN ptPackages p ON p.id = s.packageId
      LEFT JOIN users u ON u.id = s.trainerUserId
      WHERE s.gymId = ?`;
    const binds: unknown[] = [gymId];
    if (packageId) {
      sqlStr += ' AND s.packageId = ?';
      binds.push(packageId);
    }
    if (memberId) {
      sqlStr += ' AND p.memberId = ?';
      binds.push(memberId);
    }
    sqlStr += ' ORDER BY s.createdAt DESC LIMIT 200';
    const { results } = await this.d1.prepare(sqlStr).bind(...binds).all();
    return (results ?? []).map((r: any) => ({
      id: r.id,
      gymId: r.gymId,
      packageId: r.packageId,
      sessionNumber: r.sessionNumber,
      sessionDate: r.sessionDate,
      notes: r.notes,
      trainerUserId: r.trainerUserId,
      trainerName: r.trainerName,
      signedOffByMember: Boolean(r.signedOffByMember),
      createdAt: r.createdAt,
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
      .prepare(`SELECT completedSessions FROM ptPackages WHERE id = ? AND gymId = ?`)
      .bind(input.packageId, input.gymId)
      .first<{ completedSessions: number }>();
    const completedSessions = pkgRow?.completedSessions ?? 0;
    const sessionNumber = completedSessions + 1;

    const sessionRes = await this.d1
      .prepare(
        `INSERT INTO ptSessions (
           gymId, packageId, sessionNumber, sessionDate,
           notes, trainerUserId, signedOffByMember, createdAt
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
        `UPDATE ptPackages
         SET completedSessions = completedSessions + 1,
             status = CASE WHEN completedSessions + 1 >= totalSessions THEN 'COMPLETED' ELSE status END,
             updatedAt = unixepoch()
         WHERE id = ? AND gymId = ?`
      )
      .bind(input.packageId, input.gymId)
      .run();

    return sessionRes?.id ?? 0;
  }
}
