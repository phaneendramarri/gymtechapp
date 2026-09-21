/**
 * Notification service for SMS and WhatsApp messages.
 *
 * PROVIDER — MSG91 (all channels, one account).
 * `generateWhatsAppUrl` builds a staff tap-to-send Click-to-Chat link (kept:
 * responses still carry it as a manual fallback). `sendTransactional` delivers
 * for real through MSG91's Flow (SMS) and template (WhatsApp) APIs whenever
 * an auth key is configured; without one it reports `skipped` and callers
 * keep the legacy manual-link behavior.
 *
 * IMPORTANT: All sent notifications MUST record an entry in `communication_logs`
 * with `memberId`, `lawfulBasis`, and `retentionUntil` so GDPR erasure
 * (H-9) can purge them when a member exercises their right to deletion.
 */

import {
  msg91ConfigFromEnv,
  applyPlatformOverrides,
  sendMsg91Sms,
  sendMsg91Whatsapp,
  type Msg91Config,
  type Msg91Result,
} from './msg91';

export interface NotificationPayload {
  recipientPhone: string;
  recipientName: string;
  type: NotificationType;
  params: Record<string, string | number>;
}

export type NotificationType =
  | 'WELCOME'
  | 'PAYMENT_RECEIPT'
  | 'EXPIRY_REMINDER'
  | 'RENEWAL_CONFIRMATION'
  | 'CUSTOM';

// ---------------------------------------------------------------------------
// GDPR policy for communication logs — the single owner of these rules.
// Every logged message records why it was lawful to send and how long it may
// be kept, so erasure requests have something concrete to act on.
// ---------------------------------------------------------------------------

/** How long message metadata may be retained (GDPR Art. 5(1)(e)). */
export const COMMS_RETENTION_DAYS = 90;

/**
 * Lawful basis per message type (GDPR Art. 6):
 *   CONTRACT              service the member already signed up for
 *   LEGITIMATE_INTEREST   service-related nudges (renewal reminders)
 *   CONSENT               promotional / free-form messaging
 */
export function lawfulBasisFor(messageType: string): string {
  switch (messageType) {
    case 'PAYMENT_RECEIPT':
    case 'RENEWAL_CONFIRMATION':
      return 'CONTRACT';
    case 'EXPIRY_REMINDER':
      return 'LEGITIMATE_INTEREST';
    default:
      return 'CONSENT';
  }
}

/** Unix seconds until which a log row for `messageType` may be retained. */
export function retentionUntilFor(messageType: string, sentAtUnix: number): number {
  void messageType; // retention is currently uniform; per-type rules live here
  return sentAtUnix + COMMS_RETENTION_DAYS * 24 * 60 * 60;
}

/**
 * Map a notification payload onto ordered WhatsApp template body params.
 * Template authors: keep body variables in this order —
 * {{1}} name, {{2}} gym, then message-specific values.
 */
function whatsappTemplateParams(payload: NotificationPayload): string[] {
  const p = payload.params;
  switch (payload.type) {
    case 'WELCOME':
      return [payload.recipientName, String(p.memberCode ?? '')];
    case 'PAYMENT_RECEIPT':
      return [
        payload.recipientName,
        String(p.amount ?? ''),
        String(p.paymentMode ?? ''),
        String(p.receiptNumber ?? ''),
      ];
    case 'EXPIRY_REMINDER':
      return [payload.recipientName, String(p.expiryDate ?? '')];
    case 'RENEWAL_CONFIRMATION':
      return [payload.recipientName, String(p.newExpiryDate ?? '')];
    default:
      return [payload.recipientName, String(p.message ?? '')];
  }
}
export class NotificationService {
  private msg91: Msg91Config | null;

  constructor(
    private gymName: string,
    env?: Record<string, string | undefined>,
    platformMsg91?: Partial<Msg91Config> | null
  ) {
    this.msg91 = env ? applyPlatformOverrides(msg91ConfigFromEnv(env), platformMsg91) : null;
  }

  /** True when real provider delivery is available for `channel`. */
  canDeliver(channel: 'SMS' | 'WHATSAPP'): boolean {
    if (!this.msg91 || this.msg91.authKey.trim().length === 0) return false;
    if (channel === 'SMS') return this.msg91.smsFlowId.trim().length > 0;
    return this.msg91.waNumber.trim().length > 0 && this.msg91.whatsappTemplate.trim().length > 0;
  }

  /**
   * Deliver for real through MSG91. SMS uses the approved Flow (vars are
   * matched to the flow's template variables); WhatsApp uses the approved
   * template (body text params in order). Returns the provider result, or a
   * `skipped` result when MSG91 is not configured yet.
   */
  async sendTransactional(
    channel: 'SMS' | 'WHATSAPP',
    payload: NotificationPayload
  ): Promise<Msg91Result> {
    if (!this.msg91) return { ok: false, skipped: true };
    if (channel === 'SMS') {
      return sendMsg91Sms(this.msg91, payload.recipientPhone, {
        NAME: payload.recipientName,
        GYM: this.gymName,
        ...payload.params,
      });
    }
    return sendMsg91Whatsapp(
      this.msg91,
      payload.recipientPhone,
      whatsappTemplateParams(payload)
    );
  }

  /**
   * H-8 STUB (kept as manual fallback): Generates a WhatsApp Click-to-Chat URL.
   * The recipient still needs to manually tap the link to send the message.
   */
  generateWhatsAppUrl(payload: NotificationPayload): string {
    const rawPhone = payload.recipientPhone.replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const message = this.buildMessage(payload);

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }

  private buildMessage(payload: NotificationPayload): string {
    switch (payload.type) {
      case 'WELCOME':
        return `Hello ${payload.recipientName}! Welcome to ${this.gymName}. Your Member Code is ${payload.params.memberCode || 'N/A'}. Let's reach your fitness goals together! 💪🏋️`;

      case 'PAYMENT_RECEIPT':
        return `Hi ${payload.recipientName}, we have received ₹${payload.params.amount} via ${payload.params.paymentMode} for your membership at ${this.gymName}. Receipt No: ${payload.params.receiptNumber}. Thank you! 🧾✨`;

      case 'EXPIRY_REMINDER':
        return `Hi ${payload.recipientName}, your membership at ${this.gymName} is expiring on ${payload.params.expiryDate}. Please renew to keep achieving your fitness goals without interruption! ⏳🔥`;

      case 'RENEWAL_CONFIRMATION':
        return `Hi ${payload.recipientName}, your membership at ${this.gymName} has been successfully renewed until ${payload.params.newExpiryDate}. Let's crush those workouts! 🚀⚡`;

      case 'CUSTOM':
        return String(payload.params.message || `Hello ${payload.recipientName} from ${this.gymName}!`);

      default:
        return `Hello ${payload.recipientName} from ${this.gymName}!`;
    }
  }
}
