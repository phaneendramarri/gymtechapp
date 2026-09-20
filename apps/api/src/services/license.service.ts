import type { License } from '@gymtech/shared';
import { LicenseRepository } from '../repositories/license.repository';
import { CommunicationRepository } from '../repositories/communication.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { MemberRepository } from '../repositories/member.repository';
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
  private membershipRepo: MembershipRepository;
  private memberRepo: MemberRepository;

  constructor(private db: D1Database, private gymId: number) {
    this.licenseRepo = new LicenseRepository(db, gymId);
    this.commRepo = new CommunicationRepository(db);
    this.membershipRepo = new MembershipRepository(db, gymId);
    this.memberRepo = new MemberRepository(db, gymId);
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
      .prepare(`SELECT COUNT(*) as count FROM members WHERE gymId = ? AND deletedAt IS NULL AND status = 'ACTIVE'`)
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
         JOIN roles r ON r.id = u.roleId
         WHERE u.gymId = ? AND UPPER(r.name) = 'MANAGER'
           AND u.deletedAt IS NULL AND u.status = 'ACTIVE'`
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
         LEFT JOIN roles r ON r.id = u.roleId
         WHERE u.gymId = ? AND u.isOwner = 0
           AND u.deletedAt IS NULL AND u.status = 'ACTIVE'
           AND (u.roleId IS NULL OR UPPER(r.name) NOT IN ('MANAGER', 'MEMBER'))`
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

    // Atomic conditional decrement — owned by LicenseRepository.
    const rowsChanged = await this.licenseRepo.consumeCredits(this.gymId, channel.toLowerCase() as 'sms' | 'whatsapp' | 'email', credits);

    if (rowsChanged === 0) {
      // Fetch current numbers to explain the failure
      const lic = await this.getLicense();
      const channelKey = channel.toLowerCase() as 'sms' | 'whatsapp' | 'email';
      const max = (lic as any)?.[`max${channelKey.charAt(0).toUpperCase()}${channelKey.slice(1)}`] ?? 0;
      const used = (lic as any)?.[`${channelKey}Used`] ?? 0;
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
    const channelKey = channel.toLowerCase() as 'sms' | 'whatsapp' | 'email';
    const max = (updatedLicense as any)?.[`max${channelKey.charAt(0).toUpperCase()}${channelKey.slice(1)}`] ?? 0;
    const used = (updatedLicense as any)?.[`${channelKey}Used`] ?? 0;
    const remaining = max === -1 ? 999999 : Math.max(0, max - used);

    // Audit granular consumption in communicationLogs.
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
      console.warn('Failed to insert communicationLogs row:', (e as Error).message);
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
   * Invoked on the hourly cron schedule. Each UPDATE lives in its table's
   * repository; this method only orchestrates.
   */
  async sweepExpiries(): Promise<{ expiredLicenses: number; expiredMemberships: number; expiredMembers: number }> {
    const nowSec = Math.floor(Date.now() / 1000);

    const expiredLicenses = await this.licenseRepo.expireIfDue(this.gymId, nowSec);
    const expiredMemberships = await this.membershipRepo.expireIfDue(this.gymId, nowSec);
    const expiredMembers = await this.memberRepo.expireMembersWithoutActiveMembership(this.gymId, nowSec);

    return { expiredLicenses, expiredMemberships, expiredMembers };
  }
}
