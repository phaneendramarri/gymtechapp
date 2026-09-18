/**
 * email.service.ts - stub (email sending not active in this phase).
 * Methods compile correctly; they are no-ops at runtime.
 */
export class EmailService {
  constructor(private env: any) {}

  async sendWelcomeEmail(_params: Record<string, unknown>): Promise<void> {
    // No-op
  }

  async sendPasswordResetEmail(_params: Record<string, unknown>): Promise<{ resetUrl?: string }> {
    // No-op: returns empty object so callers can safely destructure resetUrl
    return {};
  }

  async sendPasswordResetConfirmation(_params: Record<string, unknown>): Promise<void> {
    // No-op
  }

  async sendTestSmtpEmail(_params: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    return { success: false, message: 'Email sending is not configured in this phase.' };
  }
}
