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
  type: 'WELCOME' | 'PAYMENT_RECEIPT' | 'EXPIRY_REMINDER' | 'RENEWAL_CONFIRMATION' | 'CUSTOM';
  params: Record<string, string | number>;
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
