import type { License } from '@gymtech/shared';
import { LicenseRepository } from '../repositories/license.repository';

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

  constructor(private db: D1Database, private gymId: number) {
    this.licenseRepo = new LicenseRepository(db, gymId);
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
   * Counts users with role = 'MANAGER' who are not deleted.
   */
  async checkManagerLimit(): Promise<LimitCheckResult> {
    const license = await this.getLicense();
    if (!license) {
      return { allowed: false, current: 0, max: 0, reason: 'No active license found for this gym.' };
    }

    const countRes = await this.db
      .prepare(`SELECT COUNT(*) as count FROM users WHERE gym_id = ? AND role = 'MANAGER' AND deleted_at IS NULL AND status = 'ACTIVE'`)
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
   * Counts all non-owner users (role in STAFF, TRAINER) who are not deleted.
   */
  async checkStaffLimit(): Promise<LimitCheckResult> {
    const license = await this.getLicense();
    if (!license) {
      return { allowed: false, current: 0, max: 0, reason: 'No active license found for this gym.' };
    }

    const countRes = await this.db
      .prepare(`SELECT COUNT(*) as count FROM users WHERE gym_id = ? AND is_owner = 0 AND role IN ('STAFF', 'TRAINER') AND deleted_at IS NULL AND status = 'ACTIVE'`)
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
    dispatchedById?: number;
    ip?: string;
  }): Promise<CommunicationConsumeResult> {
    const {
      channel,
      credits = 1,
      recipientPhone = null,
      recipientName = null,
      messageType,
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

    // Audit granular consumption in communication_logs
    try {
      await this.db
        .prepare(
          `INSERT INTO communication_logs (
            gym_id, channel, recipient_phone, recipient_name, message_type,
            credits_deducted, remaining_balance, dispatched_by_id, ip, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`
        )
        .bind(
          this.gymId,
          channel,
          recipientPhone,
          recipientName,
          messageType,
          credits,
          remaining,
          dispatchedById,
          ip
        )
        .run();
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
}
