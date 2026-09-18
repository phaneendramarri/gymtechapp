/**
 * Communication-log repository — the single owner of `communication_logs`.
 *
 * Every sent notification must leave an auditable row here: what was sent, to
 * whom, which license credits it consumed, and the GDPR basis for sending and
 * keeping it. Member erasure (Art. 17) purges through the same module, so the
 * linkage between "what we recorded" and "what we delete" cannot drift.
 *
 * Takes the raw D1 handle because its main producer (LicenseService) already
 * holds one; no Drizzle dependency needed for two straight statements.
 */
export interface RecordDispatchParams {
  gymId: number;
  memberId: number | null;
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL';
  recipientPhone: string | null;
  recipientName: string | null;
  messageType: string;
  creditsDeducted: number;
  remainingBalance: number;
  lawfulBasis: string;
  retentionUntil: number;
  dispatchedById: number | null;
  ip: string | null;
  sentAt: number;
}

export class CommunicationRepository {
  constructor(private d1: D1Database) {}

  /**
   * Append one audit row per dispatched message. Failures are swallowed by the
   * caller by design: a logging failure must never roll back a message the gym
   * already paid credits to send.
   */
  async recordDispatch(params: RecordDispatchParams): Promise<void> {
    await this.d1
      .prepare(
        `INSERT INTO communication_logs (
          gym_id, member_id, channel, recipient_phone, recipient_name, message_type,
          credits_deducted, remaining_balance, lawful_basis, retention_until,
          dispatched_by_id, ip, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.gymId,
        params.memberId,
        params.channel,
        params.recipientPhone,
        params.recipientName,
        params.messageType,
        params.creditsDeducted,
        params.remainingBalance,
        params.lawfulBasis,
        params.retentionUntil,
        params.dispatchedById,
        params.ip,
        params.sentAt
      )
      .run();
  }

  /** Daily-cron purge: remove rows whose retention window has elapsed. */
  async purgeExpired(gymId: number, nowUnix: number): Promise<number> {
    const res = await this.d1
      .prepare('DELETE FROM communication_logs WHERE gym_id = ? AND retention_until <= ?')
      .bind(gymId, nowUnix)
      .run();
    return res.meta.changes ?? 0;
  }

  async purgeForMember(gymId: number, memberId: number): Promise<void> {
    await this.d1
      .prepare('DELETE FROM communication_logs WHERE gym_id = ? AND member_id = ?')
      .bind(gymId, memberId)
      .run();
  }
}
