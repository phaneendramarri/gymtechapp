// filepath: apps/api/src/services/email.service.ts
/**
 * EmailService — transactional email through MSG91 (Email API).
 *
 * Channels owned here: welcome mail, password-reset mail + confirmation,
 * and the admin "send test" probe. SMS/WhatsApp live in lib/notifications.ts;
 * both read the same MSG91 config (env first, platform settings override).
 *
 * Behavior contract (callers depend on this):
 *   - Without an MSG91 auth key every method is a safe no-op returning the
 *     legacy shapes, so the app runs fully before MSG91 is purchased.
 *   - `sendPasswordResetEmail` always returns a relative `resetUrl` in
 *     non-production so the forgot-password flow stays testable; production
 *     hides it behind the APP_ENV gate in auth.routes.ts.
 */

import {
  msg91ConfigFromEnv,
  applyPlatformOverrides,
  isMsg91Configured,
  sendMsg91Email,
  type Msg91Config,
} from '../lib/msg91';

export interface WelcomeEmailParams {
  to?: string;
  name?: string;
  gymName?: string;
  memberCode?: string;
  planName?: string;
}

export interface ResetEmailParams {
  to?: string;
  name?: string;
  token?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function shell(title: string, heading: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#FAFAF9;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
<div style="font-size:20px;font-weight:700;color:#0A0A0A;">${esc(title)}</div>
<h1 style="font-size:22px;color:#0A0A0A;margin:16px 0 8px;">${esc(heading)}</h1>
<div style="font-size:14px;line-height:1.6;color:#3F3F46;">${bodyHtml}</div>
${cta ? `<div style="margin:24px 0;"><a href="${esc(cta.url)}" style="display:inline-block;background:#FB923C;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:999px;">${esc(cta.label)}</a></div>` : ''}
<p style="font-size:12px;color:#71717A;">If you did not expect this email, you can safely ignore it.</p>
</div></body></html>`;
}

export class EmailService {
  private msg91: Msg91Config;
  private appUrl: string;
  private isProduction: boolean;

  constructor(
    private env: any,
    platformMsg91?: Partial<Msg91Config> | null
  ) {
    this.msg91 = applyPlatformOverrides(msg91ConfigFromEnv(env ?? {}), platformMsg91);
    this.appUrl = (env?.APP_URL as string) || 'https://gymtech.app';
    this.isProduction = (env?.APP_ENV ?? 'production') === 'production';
  }

  /** True when transactional email will actually be delivered. */
  isActive(): boolean {
    return isMsg91Configured(this.msg91);
  }

  private resetLink(token: string): string {
    const base = this.appUrl.replace(/\/$/, '');
    return `${base}/reset-password?token=${encodeURIComponent(token)}`;
  }

  async sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
    const to = (params.to || '').trim();
    if (!to || !this.isActive()) return;
    const name = params.name || 'there';
    const gymName = params.gymName || 'your gym';
    await sendMsg91Email(
      this.msg91,
      to,
      `Welcome to ${gymName} 💪`,
      shell(
        gymName,
        `Welcome, ${name}!`,
        `<p>Your membership at <strong>${esc(gymName)}</strong> is ready.</p>` +
          (params.memberCode ? `<p>Member code: <strong>${esc(params.memberCode)}</strong></p>` : '') +
          (params.planName ? `<p>Plan: <strong>${esc(params.planName)}</strong></p>` : '') +
          `<p>Show this code at the front desk or scan it from your member pass to check in.</p>`
      )
    );
  }

  async sendPasswordResetEmail(params: ResetEmailParams): Promise<{ resetUrl?: string }> {
    const token = typeof params?.token === 'string' ? params.token : '';
    const out: { resetUrl?: string } = {};
    if (!token) return out;
    // Test/dev path stays provider-free so the flow is testable pre-purchase.
    if (!this.isProduction) out.resetUrl = `/reset-password?token=${encodeURIComponent(token)}`;

    const to = (params?.to || '').trim();
    if (!to || !this.isActive()) return out;
    const link = this.resetLink(token);
    await sendMsg91Email(
      this.msg91,
      to,
      'Reset your GymTech password',
      shell(
        'GymTech',
        'Choose a new password',
        `<p>Hi ${esc(params?.name || 'there')},</p>` +
          `<p>We received a request to reset your password. This link expires in <strong>60 minutes</strong>.</p>`,
        { label: 'Reset password', url: link }
      )
    );
    return out;
  }

  async sendPasswordResetConfirmation(params: { to?: string; name?: string }): Promise<void> {
    const to = (params?.to || '').trim();
    if (!to || !this.isActive()) return;
    await sendMsg91Email(
      this.msg91,
      to,
      'Your GymTech password was changed',
      shell(
        'GymTech',
        'Password updated',
        `<p>Hi ${esc(params?.name || 'there')},</p>` +
          `<p>Your password was just changed. If this was not you, contact your gym administrator immediately.</p>`
      )
    );
  }

  async sendTestSmtpEmail(params: {
    to?: string;
    gymName?: string;
  }): Promise<{ success: boolean; message: string }> {
    const to = (params?.to || '').trim();
    if (!to) return { success: false, message: 'Enter a recipient address first.' };
    if (!this.isActive()) {
      return {
        success: false,
        message:
          'MSG91 email is not configured yet. Add your MSG91 auth key (Admin → Communications, or the MSG91_AUTH_KEY secret), verify the sender, then retry.',
      };
    }
    const res = await sendMsg91Email(
      this.msg91,
      to,
      'GymTech test email',
      shell(
        params?.gymName || 'GymTech',
        'Email channel is live ✅',
        `<p>This test was delivered through <strong>MSG91</strong>. Password resets, welcome mail, and confirmations will now reach real inboxes.</p>`
      )
    );
    return res.ok
      ? { success: true, message: `Test email accepted by MSG91${res.providerMessageId ? ` (ref ${res.providerMessageId})` : ''}.` }
      : { success: false, message: res.error || 'MSG91 rejected the test email.' };
  }
}
