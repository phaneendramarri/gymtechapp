import type { License } from '@gymtech/shared';
import { LicenseRepository } from '../repositories/license.repository';
import { CommunicationRepository } from '../repositories/communication.repository';
import { lawfulBasisFor, retentionUntilFor } from '../lib/notifications';

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  max: number;
  reason?: string;
}

export interface CommunicationConsumeResult {
  success: boolean;
  remainingCredits: number;
  creditsDeducted: number;
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL';
  error?: string;
}

export class LicenseService {
  private licenseRepo: LicenseRepository;
  private commRepo: CommunicationRepository;

  constructor(private db: D1Database, private gymId: number) {
    this.licenseRepo = new LicenseRepository(db, gymId);
    this.commRepo = new CommunicationRepository(db);
  }

  async getLicense(): Promise<License | null> {
    return await this.licenseRepo.findByGymId(this.gymId);
  }

  /**
   * Verify if the gym can add another active member.
   */
  async checkMemberLimit(): Promise<LimitCheckResult> {
    const license = await this.getLicense();
    if (!license) {
      return { allowed: false, current: 0, max: 0, reason: 'No active license found for this gym.' };
    }

    if (license.status !== 'ACTIVE') {
      return { allowed: false, current: 0, max: license.maxMembers, reason: `Gym license is ${license.status}.` };
    }

    const countRes = await this.db
      .prepare(`SELECT COUNT(*) as count FROM members WHERE gym_id = ? AND deleted_at IS NULL AND status = 'ACTIVE'`)
      .bind(this.gymId)
      .first<{ count: number }>();
    const current = countRes?.count || 0;

    if (license.maxMembers !== -1 && current >= license.maxMembers) {
      return {
        allowed: false,
        current,
        max: license.maxMembers,
        reason: `Member limit reached (${current}/${license.maxMembers}). Please upgrade your commercial plan.`,
      };
    }

    return { allowed: true, current, max: license.maxMembers };
  }

  /**
   * Verify if the gym can add another manager.
   * Counts users whose assigned role resolves to MANAGER (roles.name),
   * mirroring `deriveCoarseRole` — the stored column was removed.
   */
  async checkManagerLimit(): Promise<LimitCheckResult> {
    const license = await this.getLicense();
    if (!license) {
      return { allowed: false, current: 0, max: 0, reason: 'No active license found for this gym.' };
    }

    const countRes = await this.db
      .prepare(
        `SELECT COUNT(*) as count FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.gym_id = ? AND UPPER(r.name) = 'MANAGER'
           AND u.deleted_at IS NULL AND u.status = 'ACTIVE'`
      )
      .bind(this.gymId)
      .first<{ count: number }>();
    const current = countRes?.count || 0;

    if (license.maxManagers !== -1 && current >= license.maxManagers) {
      return {
        allowed: false,
        current,
        max: license.maxManagers,
        reason: `Manager limit reached (${current}/${license.maxManagers}). Please upgrade your commercial plan.`,
      };
    }

    return { allowed: true, current, max: license.maxManagers };
  }

  /**
   * Verify if the gym can add another staff/trainer.
   * Counts all non-owner users who are not managers or members — i.e. the
   * derived coarse role is STAFF, TRAINER or an unassigned/custom role.
   */
  async checkStaffLimit(): Promise<LimitCheckResult> {
    const license = await this.getLicense();
    if (!license) {
      return { allowed: false, current: 0, max: 0, reason: 'No active license found for this gym.' };
    }

    const countRes = await this.db
      .prepare(
        `SELECT COUNT(*) as count FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.gym_id = ? AND u.is_owner = 0
           AND u.deleted_at IS NULL AND u.status = 'ACTIVE'
           AND (u.role_id IS NULL OR UPPER(r.name) NOT IN ('MANAGER', 'MEMBER'))`
      )
      .bind(this.gymId)
      .first<{ count: number }>();
    const current = countRes?.count || 0;

    if (license.maxStaffTotal !== -1 && current >= license.maxStaffTotal) {
      return {
        allowed: false,
        current,
        max: license.maxStaffTotal,
        reason: `Staff limit reached (${current}/${license.maxStaffTotal}). Please upgrade your commercial plan.`,
      };
    }

    return { allowed: true, current, max: license.maxStaffTotal };
  }

  /**
   * Concurrency-safe atomic consumption of communication credits.
   * Uses atomic conditional DB updates to eliminate race conditions.
   */
  async consumeCommunicationQuota(params: {
    channel: 'SMS' | 'WHATSAPP' | 'EMAIL';
    credits?: number;
    recipientPhone?: string;
    recipientName?: string;
    messageType: string;
    /** Member the message is about, when known — enables GDPR erasure. */
    memberId?: number | null;
    dispatchedById?: number;
    ip?: string;
  }): Promise<CommunicationConsumeResult> {
    const {
      channel,
      credits = 1,
      recipientPhone = null,
      recipientName = null,
      messageType,
      memberId = null,
      dispatchedById = null,
      ip = null,
    } = params;

    const channelCol = channel.toLowerCase();
    const usedCol = `${channelCol}_used`;
    const maxCol = `max_${channelCol}`;

    // Atomic conditional increment in D1 / SQLite
    const updateResult = await this.db
      .prepare(
        `UPDATE licenses
         SET ${usedCol} = ${usedCol} + ?, updated_at = unixepoch()
         WHERE gym_id = ?
           AND (${maxCol} = -1 OR (${maxCol} - ${usedCol}) >= ?)`
      )
      .bind(credits, this.gymId, credits)
      .run();

    const rowsChanged = updateResult.meta?.changes ?? 0;
    if (rowsChanged === 0) {
      // Fetch current numbers to explain failure
      const lic = await this.getLicense();
      const max = (lic as any)?.[maxCol] ?? 0;
      const used = (lic as any)?.[usedCol] ?? 0;
      const remaining = Math.max(0, max - used);
      return {
        success: false,
        remainingCredits: remaining,
        creditsDeducted: 0,
        channel,
        error: `Insufficient ${channel} credits. Remaining: ${remaining}, required: ${credits}. Contact Super Admin to recharge.`,
      };
    }

    // Read new balance
    const updatedLicense = await this.getLicense();
    const max = (updatedLicense as any)?.[maxCol] ?? 0;
    const used = (updatedLicense as any)?.[usedCol] ?? 0;
    const remaining = max === -1 ? 999999 : Math.max(0, max - used);

    // Audit granular consumption in communication_logs.
    //
    // Every row records the member it concerns plus the GDPR basis for sending
    // and keeping it (`lawfulBasisFor` / `retentionUntilFor` own that policy), so
    // a member's erasure request can actually find and purge these rows.
    try {
      const sentAt = Math.floor(Date.now() / 1000);
      await this.commRepo.recordDispatch({
        gymId: this.gymId,
        memberId,
        channel,
        recipientPhone,
        recipientName,
        messageType,
        creditsDeducted: credits,
        remainingBalance: remaining,
        lawfulBasis: lawfulBasisFor(messageType),
        retentionUntil: retentionUntilFor(messageType, sentAt),
        dispatchedById,
        ip,
        sentAt,
      });
    } catch (e) {
      console.warn('Failed to insert communication_logs row:', (e as Error).message);
    }

    return {
      success: true,
      remainingCredits: remaining,
      creditsDeducted: credits,
      channel,
    };
  }

  /**
   * Sweeps expired licenses, memberships, and member statuses for this gym.
   * Invoked on hourly cron schedule.
   */
  async sweepExpiries(): Promise<{ expiredLicenses: number; expiredMemberships: number; expiredMembers: number }> {
    const nowSec = Math.floor(Date.now() / 1000);

    const licRes = await this.db
      .prepare(
        `UPDATE licenses SET status = 'EXPIRED', updated_at = ?
         WHERE gym_id = ? AND status = 'ACTIVE' AND expires_at < ?`
      )
      .bind(nowSec, this.gymId, nowSec)
      .run();

    const memRes = await this.db
      .prepare(
        `UPDATE memberships SET status = 'EXPIRED', updated_at = ?
         WHERE gym_id = ? AND status = 'ACTIVE' AND end_date < ?`
      )
      .bind(nowSec, this.gymId, nowSec)
      .run();

    // Sync member statuses to EXPIRED if they have no remaining active memberships
    const memberRes = await this.db
      .prepare(
        `UPDATE members SET status = 'EXPIRED', updated_at = ?
         WHERE gym_id = ? AND status = 'ACTIVE' AND deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM memberships
             WHERE memberships.member_id = members.id
               AND memberships.gym_id = members.gym_id
               AND memberships.status = 'ACTIVE'
               AND memberships.deleted_at IS NULL
           )`
      )
      .bind(nowSec, this.gymId)
      .run();

    return {
      expiredLicenses: licRes.meta?.changes ?? 0,
      expiredMemberships: memRes.meta?.changes ?? 0,
      expiredMembers: memberRes.meta?.changes ?? 0,
    };
  }
}
