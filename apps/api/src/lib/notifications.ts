export interface NotificationPayload {
  recipientPhone: string;
  recipientName: string;
  type: 'WELCOME' | 'PAYMENT_RECEIPT' | 'EXPIRY_REMINDER' | 'RENEWAL_CONFIRMATION';
  params: Record<string, string | number>;
}

export class NotificationService {
  constructor(private gymName: string) {}

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

      default:
        return `Hello ${payload.recipientName} from ${this.gymName}!`;
    }
  }
}
