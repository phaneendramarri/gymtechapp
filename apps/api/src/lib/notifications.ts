/**
 * Notification service for SMS and WhatsApp messages.
 *
 * CURRENT STATUS — H-8: This is a NO-OP STUB.
 * `generateWhatsAppUrl` builds a WhatsApp Click-to-Chat link but does NOT
 * send messages. To make this functional, integrate one of:
 *   - Twilio WhatsApp Business API  (https://www.twilio.com/whatsapp)
 *   - MessageBird Conversations API (https://messagebird.com/whatsapp)
 *   - Gupshup WhatsApp API          (https://www.gupshup.io/whatsapp-api)
 *   - Meta WhatsApp Business API    (https://developers.facebook.com/docs/whatsapp)
 *
 * When integrating, replace `generateWhatsAppUrl` with an async `send` method
 * that posts to the provider's API and stores the delivery reference in
 * `communication_logs` so GDPR erasure can purge it later.
 *
 * IMPORTANT: All sent notifications MUST record an entry in `communication_logs`
 * with `memberId`, `lawfulBasis`, and `retentionUntil` so GDPR erasure
 * (H-9) can purge them when a member exercises their right to deletion.
 */

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

export class NotificationService {
  constructor(private gymName: string) {}

  /**
   * H-8 STUB: Generates a WhatsApp Click-to-Chat URL.
   * The recipient still needs to manually tap the link to send the message.
   * TODO: Replace with real sending via Twilio / MessageBird / Gupshup.
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
