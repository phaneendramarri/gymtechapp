/**
 * email.service.ts - stub (email sending not active in this phase).
 * Methods compile correctly; they are no-ops at runtime.
 */
export class EmailService {
  constructor(private env: any) {}

  async sendWelcomeEmail(_params: Record<string, unknown>): Promise<void> {
    // No-op
  }

  async sendPasswordResetEmail(params: Record<string, unknown>): Promise<{ resetUrl?: string }> {
    // Dev/test path: mint a relative reset URL from the opaque token so the
    // forgot-password flow is fully testable without an SMTP provider.
    // Production still hides this behind the APP_ENV gate in auth.routes.ts.
    const token = typeof params?.['token'] === 'string' ? (params['token'] as string) : '';
    if (!token) return {};
    return { resetUrl: `/reset-password?token=${encodeURIComponent(token)}` };
  }

  async sendPasswordResetConfirmation(_params: Record<string, unknown>): Promise<void> {
    // No-op
  }

  async sendTestSmtpEmail(_params: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    return { success: false, message: 'Email sending is not configured in this phase.' };
  }
}
