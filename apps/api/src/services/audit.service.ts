/**
 * Centralized Audit Logging Service.
 *
 * All state-changing actions emit an append-only audit record.
 * Neither normal users nor staff can modify or delete audit rows.
 */

import type { AuditEvent, SaasAuditEvent } from '@gymtech/shared';
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

export interface SaasAuditInput {
  actorAdminId: number;
  affectedGymId: number | null;
  action: string;            // e.g. 'gym.suspend', 'features.update', 'limits.update'
  entityType?: string;
  entityId?: number | null;
  beforeState?: unknown;
  afterState?: unknown;
  ip?: string | null;
  userAgent?: string | null;
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
 * Record a platform-scoped (SaaS) audit event from inside an admin route.
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
  try {
    await new AuditService(c.env.DB).recordSaasEvent({
      actorAdminId: ctx.user.id,
      affectedGymId,
      action,
      entityType,
      entityId,
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
          `INSERT INTO audit_events (
            gym_id, actor_user_id, actor_role, action, entity_type, entity_id,
            before_state, after_state, ip, user_agent, device_info, metadata, created_at
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

  async recordSaasEvent(input: SaasAuditInput): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT INTO saas_audit_events (
            actor_admin_id, affected_gym_id, action, entity_type, entity_id,
            before_state, after_state, ip, user_agent, metadata, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`
        )
        .bind(
          input.actorAdminId,
          input.affectedGymId,
          input.action,
          input.entityType ?? null,
          input.entityId ?? null,
          input.beforeState !== undefined ? JSON.stringify(input.beforeState) : null,
          input.afterState !== undefined ? JSON.stringify(input.afterState) : null,
          input.ip ?? null,
          input.userAgent ?? null,
          input.metadata !== undefined ? JSON.stringify(input.metadata) : null
        )
        .run();
    } catch (e) {
      console.warn('AuditService.recordSaasEvent failed:', (e as Error).message);
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

    let whereClause = 'WHERE a.gym_id = ?';
    const bindings: any[] = [gymId];

    if (params.action) {
      whereClause += ' AND a.action = ?';
      bindings.push(params.action);
    }
    if (params.entityType) {
      whereClause += ' AND a.entity_type = ?';
      bindings.push(params.entityType);
    }

    const countRes = await this.db
      .prepare(`SELECT COUNT(*) as count FROM audit_events a ${whereClause}`)
      .bind(...bindings)
      .first<{ count: number }>();

    const query = `
      SELECT a.*, u.name as actor_name, u.email as actor_email
      FROM audit_events a
      LEFT JOIN users u ON u.id = a.actor_user_id
      ${whereClause}
      ORDER BY a.created_at DESC
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

    let whereClause = 'WHERE 1=1';
    const bindings: any[] = [];

    if (params.affectedGymId) {
      whereClause += ' AND s.affected_gym_id = ?';
      bindings.push(params.affectedGymId);
    }
    if (params.action) {
      whereClause += ' AND s.action = ?';
      bindings.push(params.action);
    }

    const countRes = await this.db
      .prepare(`SELECT COUNT(*) as count FROM saas_audit_events s ${whereClause}`)
      .bind(...bindings)
      .first<{ count: number }>();

    const query = `
      SELECT s.*, p.name as admin_name, p.email as admin_email, g.name as affected_gym_name
      FROM saas_audit_events s
      LEFT JOIN platform_admins p ON p.id = s.actor_admin_id
      LEFT JOIN gyms g ON g.id = s.affected_gym_id
      ${whereClause}
      ORDER BY s.created_at DESC
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
