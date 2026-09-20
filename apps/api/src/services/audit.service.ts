/**
 * Centralized Audit Logging Service.
 *
 * All state-changing actions emit an append-only audit record.
 * Neither normal users nor staff can modify or delete audit rows.
 *
 * Platform admin actions are recorded in the same append-only table with
 * actorRole = 'PLATFORM_ADMIN' and scoped to the affected gymId (0 for
 * platform-wide actions), so a single table holds the full audit trail.
 */

import type { AuditEvent } from '@gymtech/shared';
import type { RequestContext } from '../middleware/context';
export type { RequestContext } from '../middleware/context';
export type AuditEventInput = GymAuditInput;

export interface GymAuditInput {
  gymId: number;
  actorUserId: number | null;
  actorRole: string | null;
  action: string;            // e.g. 'member.create', 'member.soft_delete'
  entityType: string;        // e.g. 'member', 'payment', 'user'
  entityId: number | null;
  beforeState?: unknown;
  afterState?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
  metadata?: unknown;
}

export function extractClientInfo(req: Request): { ip: string; userAgent: string } {
  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Unknown Client';
  return { ip, userAgent };
}

/**
 * Record a gym-scoped audit event from inside a Hono route handler.
 * Reads actor + gymId off the Hono context and never throws.
 */
export async function auditGymFromCtx(
  c: any,
  action: string,
  entityType: string,
  entityId: number | null,
  details: { before?: unknown; after?: unknown; metadata?: unknown } = {}
): Promise<void> {
  const ctx = c.get ? c.get('ctx' as never) as { gymId?: number; user?: { id: number; role: string } | null } : null;
  if (!ctx?.gymId) return;
  const client = extractClientInfo(c.req.raw);
  try {
    await new AuditService(c.env.DB).recordGymEvent({
      gymId: ctx.gymId,
      actorUserId: ctx.user?.id ?? null,
      actorRole: ctx.user?.role ?? null,
      action,
      entityType,
      entityId,
      beforeState: details.before,
      afterState: details.after,
      metadata: details.metadata,
      ip: client.ip,
      userAgent: client.userAgent,
    });
  } catch (e) {
    console.warn('auditGym failed:', (e as Error).message);
  }
}

/**
 * Record a platform admin action into auditEvents.
 * Uses the affectedGymId for gymId scoping; falls back to gymId=0 for
 * platform-wide actions (e.g. creating a new gym).
 */
export async function auditSaasFromCtx(
  c: any,
  action: string,
  affectedGymId: number | null,
  entityType?: string,
  entityId?: number | null,
  details: { before?: unknown; after?: unknown } = {}
): Promise<void> {
  const ctx = c.get ? c.get('ctx' as never) as { user?: { id: number } | null } : null;
  if (!ctx?.user) return;
  const client = extractClientInfo(c.req.raw);
  // Platform admin events go into auditEvents with gymId = affectedGymId (or 0)
  // and actorRole = 'PLATFORM_ADMIN' for easy filtering.
  try {
    await new AuditService(c.env.DB).recordGymEvent({
      gymId: affectedGymId ?? 0,
      actorUserId: ctx.user.id,
      actorRole: 'PLATFORM_ADMIN',
      action,
      entityType: entityType ?? 'platform',
      entityId: entityId ?? null,
      beforeState: details.before,
      afterState: details.after,
      ip: client.ip,
      userAgent: client.userAgent,
    });
  } catch (e) {
    console.warn('auditSaas failed:', (e as Error).message);
  }
}

export class AuditService {
  constructor(private db: D1Database) {}

  async recordGymEvent(input: GymAuditInput): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT INTO auditEvents (
            gymId, actorUserId, actorRole, action, entityType, entityId,
            beforeState, afterState, ip, userAgent, deviceInfo, metadata, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`
        )
        .bind(
          input.gymId,
          input.actorUserId,
          input.actorRole,
          input.action,
          input.entityType,
          input.entityId,
          input.beforeState !== undefined ? JSON.stringify(input.beforeState) : null,
          input.afterState !== undefined ? JSON.stringify(input.afterState) : null,
          input.ip ?? null,
          input.userAgent ?? null,
          input.deviceInfo ?? null,
          input.metadata !== undefined ? JSON.stringify(input.metadata) : null
        )
        .run();
    } catch (e) {
      console.warn('AuditService.recordGymEvent failed:', (e as Error).message);
    }
  }

  async listGymEvents(gymId: number, params: {
    limit?: number;
    offset?: number;
    action?: string;
    entityType?: string;
  }): Promise<{ events: any[]; total: number }> {
    const limit = Math.min(params.limit || 50, 100);
    const offset = params.offset || 0;

    let whereClause = 'WHERE a.gymId = ?';
    const bindings: any[] = [gymId];

    if (params.action) {
      whereClause += ' AND a.action = ?';
      bindings.push(params.action);
    }
    if (params.entityType) {
      whereClause += ' AND a.entityType = ?';
      bindings.push(params.entityType);
    }

    const countRes = await this.db
      .prepare(`SELECT COUNT(*) as count FROM auditEvents a ${whereClause}`)
      .bind(...bindings)
      .first<{ count: number }>();

    const query = `
      SELECT a.*, u.name as actorName, u.email as actorEmail
      FROM auditEvents a
      LEFT JOIN users u ON u.id = a.actorUserId
      ${whereClause}
      ORDER BY a.createdAt DESC
      LIMIT ? OFFSET ?
    `;

    const { results } = await this.db
      .prepare(query)
      .bind(...bindings, limit, offset)
      .all<any>();

    return {
      events: results || [],
      total: countRes?.count || 0,
    };
  }

  async listSaasEvents(params: {
    limit?: number;
    offset?: number;
    action?: string;
    affectedGymId?: number;
  }): Promise<{ events: any[]; total: number }> {
    const limit = Math.min(params.limit || 50, 100);
    const offset = params.offset || 0;

    let whereClause = "WHERE (s.actorRole = 'PLATFORM_ADMIN' OR s.gymId = 0)";
    const bindings: any[] = [];

    if (params.affectedGymId) {
      whereClause += ' AND s.gymId = ?';
      bindings.push(params.affectedGymId);
    }
    if (params.action) {
      whereClause += ' AND s.action = ?';
      bindings.push(params.action);
    }

    const countRes = await this.db
      .prepare(`SELECT COUNT(*) as count FROM auditEvents s ${whereClause}`)
      .bind(...bindings)
      .first<{ count: number }>();

    const query = `
      SELECT s.*, p.name as adminName, p.email as adminEmail, g.name as affectedGymName
      FROM auditEvents s
      LEFT JOIN platformAdmins p ON p.id = s.actorUserId
      LEFT JOIN gyms g ON g.id = s.gymId
      ${whereClause}
      ORDER BY s.createdAt DESC
      LIMIT ? OFFSET ?
    `;

    const { results } = await this.db
      .prepare(query)
      .bind(...bindings, limit, offset)
      .all<any>();

    return {
      events: results || [],
      total: countRes?.count || 0,
    };
  }
}
