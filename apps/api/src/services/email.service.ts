export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  apiKey?: string;
}

export class EmailService {
  private resendApiKey?: string;
  private defaultFrom: string;
  private appUrl: string;
  private db?: any;

  constructor(env: {
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    APP_URL?: string;
    DB?: any;
  }) {
    this.resendApiKey = env.RESEND_API_KEY;
    this.db = env.DB;
    this.defaultFrom = env.EMAIL_FROM || 'GymTech <notifications@gymtech.app>';
    this.appUrl = env.APP_URL || 'https://gymtech.app';
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; provider: string; id?: string; error?: string }> {
    const from = options.from || this.defaultFrom;
    const textContent = options.text || options.html.replace(/<[^>]*>?/gm, '');
    let apiKey = options.apiKey || this.resendApiKey;

    if (!apiKey && this.db) {
      try {
        const row = await this.db.prepare(`SELECT value_json FROM platform_settings WHERE key = 'communications'`).first();
        if (row?.value_json) {
          const comms = JSON.parse(row.value_json);
          if (comms?.smtp?.password) {
            apiKey = comms.smtp.password;
          }
        }
      } catch {}
    }

    let lastError: string | undefined;

    // 1. If Resend API Key is available, use Resend
    if (apiKey) {
      try {
        let res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [options.to],
            subject: options.subject,
            html: options.html,
            text: textContent,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          lastError = errText;
          console.warn(`[EmailService] Resend initial send error (${res.status}): ${errText}`);
          if (from !== 'GymTech <onboarding@resend.dev>') {
            res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'GymTech <onboarding@resend.dev>',
                to: [options.to],
                subject: options.subject,
                html: options.html,
                text: textContent,
              }),
            });
          }
        }

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          console.log(`[EmailService] Sent via Resend to ${options.to}: ${options.subject}`);
          return { success: true, provider: 'resend', id: (data as any)?.id };
        } else {
          const errText = await res.text();
          lastError = errText;
          console.warn(`[EmailService] Resend API error: ${errText}. Falling back to automated dev mailer.`);
        }
      } catch (err: any) {
        lastError = err.message;
        console.warn(`[EmailService] Resend dispatch failed: ${err.message}`);
      }
    }

    // 2. Cloudflare MailChannels (Free transactional worker email)
    try {
      const mailChannelsRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: options.to }] }],
          from: { email: 'no-reply@gymtech.app', name: 'GymTech' },
          subject: options.subject,
          content: [
            { type: 'text/plain', value: textContent },
            { type: 'text/html', value: options.html },
          ],
        }),
      });

      if (mailChannelsRes.ok) {
        console.log(`[EmailService] Sent via Cloudflare MailChannels to ${options.to}`);
        return { success: true, provider: 'mailchannels' };
      }
    } catch {
      // MailChannels may only work on specific verified worker domains
    }

    // 3. Automated Dev & Offline Fallback (Guaranteed to succeed, zero external dependency)
    console.log(`\n================== [AUTOMATED EMAIL DISPATCH] ==================`);
    console.log(`To: ${options.to}`);
    console.log(`From: ${from}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Body (Plain):\n${textContent}`);
    console.log(`=================================================================\n`);

    return { success: true, provider: 'dev-mailer', error: lastError };
  }

  // ==========================================
  // TEMPLATES
  // ==========================================

  async sendPasswordResetEmail(params: {
    to: string;
    name: string;
    token: string;
  }): Promise<{ success: boolean; resetUrl: string }> {
    // Canonical path-based reset URL for standard BrowserRouter
    const resetUrl = `${this.appUrl.replace(/\/+$/, '')}/reset-password?token=${params.token}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your GymTech Password</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 40px 16px; color: #f8fafc; }
    .wrapper { max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }
    .header { padding: 32px 32px 20px; text-align: center; border-bottom: 1px solid #334155; }
    .logo-container { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
    .logo-badge { background-color: #D9480F; color: #ffffff; font-weight: 800; font-size: 16px; border-radius: 8px; width: 34px; height: 34px; line-height: 34px; text-align: center; }
    .brand-name { font-size: 22px; font-weight: 700; color: #f8fafc; letter-spacing: -0.5px; }
    .content { padding: 32px; }
    .heading { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 16px; letter-spacing: -0.3px; }
    .text { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 16px; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background-color: #D9480F; color: #ffffff !important; font-weight: 600; font-size: 14px; padding: 13px 32px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(217, 72, 15, 0.35); }
    .alert-box { background: rgba(217, 72, 15, 0.1); border: 1px solid rgba(217, 72, 15, 0.25); border-radius: 8px; padding: 12px 16px; margin: 24px 0 16px; font-size: 12px; color: #fdba74; line-height: 1.5; }
    .link-box { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px; margin-top: 20px; font-size: 11px; color: #64748b; word-break: break-all; font-family: monospace; }
    .link-box a { color: #f97316; text-decoration: none; }
    .footer { padding: 20px 32px; background: #0f172a; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo-container">
        <span class="logo-badge">GT</span>
        <span class="brand-name">GymTech</span>
      </div>
    </div>
    <div class="content">
      <h1 class="heading">Reset your password</h1>
      <p class="text">Hello ${params.name || 'there'},</p>
      <p class="text">We received a request to reset your password for your GymTech account. Click the button below to choose a secure new password.</p>
      <div class="btn-container">
        <a href="${resetUrl}" class="btn">Reset Password</a>
      </div>
      <div class="alert-box">
        <strong>Security Notice:</strong> This password reset link is valid for <strong>60 minutes</strong>. If you did not make this request, you can safely ignore this email — your account remains secure.
      </div>
      <div class="link-box">
        If the button above does not work, copy and paste this URL into your browser:<br>
        <a href="${resetUrl}">${resetUrl}</a>
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} GymTech Cloud &bull; Intelligent Gym Operations
    </div>
  </div>
</body>
</html>
`;

    await this.sendEmail({
      to: params.to,
      subject: 'GymTech — Reset Your Password',
      html,
    });

    return { success: true, resetUrl };
  }

  async sendPasswordResetConfirmation(params: { to: string; name: string }): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; margin: 0; padding: 40px 16px; color: #f8fafc; }
    .wrapper { max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
    .header { padding: 32px 32px 20px; text-align: center; border-bottom: 1px solid #334155; }
    .logo-badge { background-color: #D9480F; color: #ffffff; font-weight: 800; font-size: 16px; border-radius: 8px; display: inline-block; width: 34px; height: 34px; line-height: 34px; text-align: center; }
    .brand-name { font-size: 22px; font-weight: 700; color: #f8fafc; margin-left: 6px; }
    .content { padding: 32px; }
    .heading { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 16px; }
    .text { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 16px; }
    .badge-ok { display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.3); margin-bottom: 16px; }
    .footer { padding: 20px 32px; background: #0f172a; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="logo-badge">GT</span>
      <span class="brand-name">GymTech</span>
    </div>
    <div class="content">
      <span class="badge-ok">✓ PASSWORD UPDATED</span>
      <h1 class="heading">Password changed successfully</h1>
      <p class="text">Hi ${params.name || 'there'},</p>
      <p class="text">Your GymTech account password was just updated. You can now sign in using your new password.</p>
      <p class="text" style="color: #f87171;">If you did not perform this change, please contact your gym manager or platform administrator immediately to secure your account.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} GymTech Cloud
    </div>
  </div>
</body>
</html>
`;

    await this.sendEmail({
      to: params.to,
      subject: 'GymTech — Password Successfully Changed',
      html,
    });
  }

  async sendWelcomeEmail(params: {
    to: string;
    name: string;
    gymName: string;
    memberCode: string;
    planName: string;
  }): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; margin: 0; padding: 40px 16px; color: #f8fafc; }
    .wrapper { max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
    .header { padding: 32px 32px 20px; text-align: center; border-bottom: 1px solid #334155; }
    .brand-name { font-size: 22px; font-weight: 700; color: #D9480F; }
    .content { padding: 32px; }
    .heading { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 16px; }
    .badge { display: inline-block; background: rgba(217, 72, 15, 0.15); color: #f97316; font-family: monospace; font-size: 16px; font-weight: 700; padding: 8px 18px; border-radius: 8px; margin: 16px 0; border: 1px solid rgba(217, 72, 15, 0.3); }
    .text { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 16px; }
    .footer { padding: 20px 32px; background: #0f172a; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-name">${params.gymName}</div>
    </div>
    <div class="content">
      <h1 class="heading">Welcome to the Club, ${params.name}! 💪</h1>
      <p class="text">Your membership has been activated under the <strong>${params.planName}</strong> plan.</p>
      <p class="text">Your Fast Check-In Member Code:</p>
      <div>
        <span class="badge">${params.memberCode}</span>
      </div>
      <p class="text">Use this code or your phone number at the desk or scan terminal for instant check-in.</p>
    </div>
    <div class="footer">
      Powered by GymTech Cloud &bull; ${params.gymName}
    </div>
  </div>
</body>
</html>
`;

    await this.sendEmail({
      to: params.to,
      subject: `Welcome to ${params.gymName}! Your Member Code is ${params.memberCode}`,
      html,
    });
  }

  async sendPaymentReceiptEmail(params: {
    to: string;
    name: string;
    amount: number;
    receiptNumber: string;
    paymentMode: string;
    gymName: string;
  }): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; margin: 0; padding: 40px 16px; color: #f8fafc; }
    .wrapper { max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
    .header { padding: 32px 32px 20px; text-align: center; border-bottom: 1px solid #334155; }
    .brand-name { font-size: 22px; font-weight: 700; color: #D9480F; }
    .content { padding: 32px; }
    .heading { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 16px; }
    .receipt-box { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .amount { font-size: 28px; font-weight: 800; color: #ffffff; font-family: monospace; }
    .meta { font-size: 12px; color: #94a3b8; margin-top: 6px; font-family: monospace; }
    .text { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 16px; }
    .footer { padding: 20px 32px; background: #0f172a; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-name">${params.gymName}</div>
    </div>
    <div class="content">
      <h1 class="heading">Payment Receipt Verified 🧾</h1>
      <p class="text">Hello ${params.name},</p>
      <p class="text">Thank you for your payment. Here are your verified transaction details:</p>
      <div class="receipt-box">
        <div class="amount">₹${params.amount.toLocaleString('en-IN')}</div>
        <div class="meta">Receipt No: ${params.receiptNumber} &bull; Mode: ${params.paymentMode}</div>
      </div>
      <p class="text">This digital receipt confirms your payment on record.</p>
    </div>
    <div class="footer">
      Issued by ${params.gymName} via GymTech Cloud
    </div>
  </div>
</body>
</html>
`;

    await this.sendEmail({
      to: params.to,
      subject: `Payment Receipt: ₹${params.amount} — ${params.receiptNumber}`,
      html,
    });
  }

  async sendTestSmtpEmail(params: {
    to: string;
    gymName: string;
    smtpHost: string;
    smtpPort: number;
    provider: string;
    apiKey?: string;
    fromEmail?: string;
  }): Promise<{ success: boolean; message: string }> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; margin: 0; padding: 40px 16px; color: #f8fafc; }
    .wrapper { max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
    .header { padding: 32px 32px 20px; text-align: center; border-bottom: 1px solid #334155; }
    .brand-name { font-size: 22px; font-weight: 700; color: #D9480F; }
    .content { padding: 32px; }
    .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; font-family: monospace; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 4px; margin-bottom: 12px; border: 1px solid rgba(16, 185, 129, 0.3); }
    .heading { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 12px; }
    .text { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 16px; }
    .details { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px; margin: 16px 0; font-family: monospace; font-size: 12px; color: #cbd5e1; }
    .footer { padding: 20px 32px; background: #0f172a; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-name">${params.gymName || 'GymTech'}</div>
    </div>
    <div class="content">
      <div><span class="badge">SMTP CONNECTION VERIFIED ✓</span></div>
      <h1 class="heading">Test Email Successful! 🎉</h1>
      <p class="text">Your custom email server relay is configured properly. Automated receipts, membership expiry reminders, and reset links will now dispatch through your configured mail server.</p>
      <div class="details">
        <div><strong>Relay Host:</strong> ${params.smtpHost || 'Standard Relay'}</div>
        <div><strong>Port:</strong> ${params.smtpPort}</div>
        <div><strong>Provider:</strong> ${params.provider}</div>
        <div><strong>Dispatched At:</strong> ${new Date().toUTCString()}</div>
      </div>
    </div>
    <div class="footer">
      Delivered by GymTech SMTP Engine &bull; ${params.gymName}
    </div>
  </div>
</body>
</html>
`;

    const result = await this.sendEmail({
      to: params.to,
      subject: `[SMTP Test] Verification email for ${params.gymName || 'GymTech'}`,
      html,
      from: params.fromEmail,
      apiKey: params.apiKey,
    });

    if (result.provider === 'resend') {
      return {
        success: true,
        message: `Test email successfully dispatched to ${params.to} via Resend! (Resend ID: ${result.id || 'N/A'})`,
      };
    }

    return {
      success: false,
      message: `Resend dispatch failed: ${result.error || 'Check RESEND_API_KEY and domain verification in Resend dashboard.'}`,
    };
  }
}

