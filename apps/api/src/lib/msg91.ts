// filepath: apps/api/src/lib/msg91.ts
/**
 * MSG91 provider client — Email + SMS + WhatsApp through one MSG91 account.
 *
 * This is the single place that talks to MSG91's HTTP APIs. Everything else
 * (EmailService, NotificationService, dispatch routes) goes through here so
 * credentials, endpoints, and payload shapes can never drift apart.
 *
 * MSG91 v5 endpoints used:
 *   SMS (Flow API) : POST https://control.msg91.com/api/v5/flow/
 *   WhatsApp       : POST https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-send/
 *   Email          : POST https://control.msg91.com/api/v5/email/send
 * Auth for all three is the `authkey` request header (MSG91 panel → API keys).
 *
 * BUYING CHECKLIST (after you purchase MSG91):
 *   1. Copy the auth key into `MSG91_AUTH_KEY` (wrangler secret, never git).
 *   2. SMS: approve a Sender ID + create a Flow; paste the Flow ID into the
 *      platform communications config (`msg91.smsFlowId`).
 *   3. WhatsApp: connect the business number, approve message templates, paste
 *      the template name/namespace (`msg91.whatsappTemplate`, `msg91.waNumber`).
 *   4. Email: verify the sender domain/address, paste it (`msg91.emailFrom`).
 *   5. Flip each channel to enabled in Admin → Communications and use the
 *      "Send test" buttons before relying on it for resets/receipts.
 *
 * Disabled by default: every method returns `{ ok: false, skipped: true }`
 * when no auth key is configured, so nothing ever attempts a live call
 * before purchase. No secrets are logged.
 */

export interface Msg91Config {
  /** MSG91 auth key (`authkey` header). Empty = provider disabled. */
  authKey: string;
  /** Approved SMS sender ID / header, e.g. GYMTEC. */
  senderId: string;
  /** Verified sender for transactional email, e.g. GymTech <hello@gymtech.app>. */
  emailFrom: string;
  /** Connected WhatsApp business number in international format, e.g. 919876543210. */
  waNumber: string;
  /** Approved SMS Flow ID used for transactional messages. */
  smsFlowId: string;
  /** Approved WhatsApp template name for transactional messages. */
  whatsappTemplate: string;
  /** WhatsApp template language code, e.g. en. */
  whatsappLanguage: string;
}

export interface Msg91Result {
  ok: boolean;
  /** Provider-side message id for tracing (when ok). */
  providerMessageId?: string;
  /** Client-safe failure reason (when !ok and !skipped). */
  error?: string;
  /** True when the call was skipped because the provider is not configured. */
  skipped?: boolean;
}

/** Build a config from Worker env. Empty authKey means "not purchased yet". */
export function msg91ConfigFromEnv(env: Record<string, string | undefined>): Msg91Config {
  return {
    authKey: env.MSG91_AUTH_KEY ?? '',
    senderId: env.MSG91_SENDER_ID ?? 'GYMTEC',
    emailFrom: env.MSG91_EMAIL_FROM ?? env.EMAIL_FROM ?? 'GymTech <hello@gymtech.app>',
    waNumber: env.MSG91_WA_NUMBER ?? '',
    smsFlowId: env.MSG91_SMS_FLOW_ID ?? '',
    whatsappTemplate: env.MSG91_WHATSAPP_TEMPLATE ?? '',
    whatsappLanguage: env.MSG91_WHATSAPP_LANGUAGE ?? 'en',
  };
}

/**
 * Overlay platform-configured values (Admin → Communications → MSG91 block)
 * on top of env. Explicit non-empty platform values win; env stays the
 * fallback so single-gym deployments can run on secrets alone.
 */
export function applyPlatformOverrides(
  base: Msg91Config,
  platform?: Partial<Msg91Config> | null
): Msg91Config {
  if (!platform) return base;
  const pick = (v: string | undefined, fb: string) =>
    v !== undefined && v !== '' ? v : fb;
  return {
    authKey: pick(platform.authKey, base.authKey),
    senderId: pick(platform.senderId, base.senderId),
    emailFrom: pick(platform.emailFrom, base.emailFrom),
    waNumber: pick(platform.waNumber, base.waNumber),
    smsFlowId: pick(platform.smsFlowId, base.smsFlowId),
    whatsappTemplate: pick(platform.whatsappTemplate, base.whatsappTemplate),
    whatsappLanguage: pick(platform.whatsappLanguage, base.whatsappLanguage),
  };
}

export function isMsg91Configured(cfg: Msg91Config): boolean {
  return cfg.authKey.trim().length > 0;
}

/**
 * Load the platform MSG91 block (Admin → Communications) from D1.
 * Returns null when nothing is persisted — env secrets remain the fallback.
 */
export async function loadPlatformMsg91(d1: {
  prepare(q: string): { bind(...args: any[]): { first(): Promise<{ valueJson: string } | null> } };
}): Promise<Partial<Msg91Config> | null> {
  try {
    const row = await d1
      .prepare(`SELECT valueJson FROM platformSettings WHERE key = ?`)
      .bind('communications')
      .first();
    if (!row?.valueJson) return null;
    const parsed = JSON.parse(row.valueJson) as { msg91?: Partial<Msg91Config> };
    return parsed?.msg91 ?? null;
  } catch {
    return null;
  }
}

/** Normalize an Indian mobile to the 91XXXXXXXXXX shape MSG91 expects. */
export function normalizeIndianMobile(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

async function postJson(
  url: string,
  authKey: string,
  body: unknown
): Promise<{ status: number; json: any }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey: authKey },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/** Extract a provider message id from the various shapes MSG91 returns. */
function extractMessageId(json: any): string | undefined {
  return (
    json?.request_id ??
    json?.requestId ??
    json?.messageId ??
    json?.id ??
    undefined
  );
}

function providerError(status: number, json: any, fallback: string): string {
  const raw =
    json?.message ??
    json?.error ??
    (typeof json === 'string' ? json : '') ??
    '';
  // Never forward raw provider blobs (they can contain keys/quotas).
  if (typeof raw === 'string' && raw.length > 0 && raw.length <= 160) return raw;
  return `${fallback} (provider status ${status})`;
}

// ---------------------------------------------------------------------------
// Payload builders — pure, unit-tested, no network.
// ---------------------------------------------------------------------------

export function buildSmsFlowPayload(cfg: Msg91Config, to: string, vars: Record<string, string | number>) {
  return {
    flow_id: cfg.smsFlowId,
    sender: cfg.senderId,
    mobiles: normalizeIndianMobile(to),
    ...Object.fromEntries(Object.entries(vars).map(([k, v]) => [k.toUpperCase(), String(v)])),
  };
}

export function buildWhatsappPayload(
  cfg: Msg91Config,
  to: string,
  templateParams: string[],
  opts?: { templateName?: string; language?: string }
) {
  return {
    integrated_number: cfg.waNumber,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: opts?.templateName || cfg.whatsappTemplate,
        language: { code: opts?.language || cfg.whatsappLanguage, policy: 'deterministic' },
        components: [
          {
            type: 'body',
            parameters: templateParams.map((text) => ({ type: 'text', text })),
          },
        ],
      },
    },
    to: normalizeIndianMobile(to),
  };
}

export function buildEmailPayload(cfg: Msg91Config, to: string, subject: string, html: string) {
  return {
    recipients: [{ to: [{ email: to }] }],
    from: cfg.emailFrom,
    subject,
    body: html,
  };
}

// ---------------------------------------------------------------------------
// Senders — network. All fail closed without an auth key.
// ---------------------------------------------------------------------------

/** Send a transactional SMS through an approved MSG91 Flow. */
export async function sendMsg91Sms(
  cfg: Msg91Config,
  to: string,
  vars: Record<string, string | number>
): Promise<Msg91Result> {
  if (!isMsg91Configured(cfg)) return { ok: false, skipped: true };
  if (!cfg.smsFlowId) return { ok: false, error: 'SMS Flow ID is not configured.' };
  const mobile = normalizeIndianMobile(to);
  if (!mobile) return { ok: false, error: 'Invalid recipient mobile number.' };
  try {
    const { status, json } = await postJson(
      'https://control.msg91.com/api/v5/flow/',
      cfg.authKey,
      buildSmsFlowPayload(cfg, mobile, vars)
    );
    if (status >= 200 && status < 300) return { ok: true, providerMessageId: extractMessageId(json) };
    return { ok: false, error: providerError(status, json, 'SMS was not accepted') };
  } catch (e: any) {
    console.error('MSG91 SMS send failed:', e?.message ?? e);
    return { ok: false, error: 'SMS provider is unreachable. Please try again.' };
  }
}

/** Send a WhatsApp template message through MSG91. */
export async function sendMsg91Whatsapp(
  cfg: Msg91Config,
  to: string,
  templateParams: string[],
  opts?: { templateName?: string; language?: string }
): Promise<Msg91Result> {
  if (!isMsg91Configured(cfg)) return { ok: false, skipped: true };
  if (!cfg.waNumber) return { ok: false, error: 'WhatsApp business number is not configured.' };
  if (!(opts?.templateName || cfg.whatsappTemplate)) {
    return { ok: false, error: 'WhatsApp template is not configured.' };
  }
  const mobile = normalizeIndianMobile(to);
  if (!mobile) return { ok: false, error: 'Invalid recipient mobile number.' };
  try {
    const { status, json } = await postJson(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-send/',
      cfg.authKey,
      buildWhatsappPayload(cfg, mobile, templateParams, opts)
    );
    if (status >= 200 && status < 300) return { ok: true, providerMessageId: extractMessageId(json) };
    return { ok: false, error: providerError(status, json, 'WhatsApp message was not accepted') };
  } catch (e: any) {
    console.error('MSG91 WhatsApp send failed:', e?.message ?? e);
    return { ok: false, error: 'WhatsApp provider is unreachable. Please try again.' };
  }
}

/** Send a transactional email through MSG91. */
export async function sendMsg91Email(
  cfg: Msg91Config,
  to: string,
  subject: string,
  html: string
): Promise<Msg91Result> {
  if (!isMsg91Configured(cfg)) return { ok: false, skipped: true };
  if (!to || !to.includes('@')) return { ok: false, error: 'Invalid recipient email address.' };
  try {
    const { status, json } = await postJson(
      'https://control.msg91.com/api/v5/email/send',
      cfg.authKey,
      buildEmailPayload(cfg, to, subject, html)
    );
    if (status >= 200 && status < 300) return { ok: true, providerMessageId: extractMessageId(json) };
    return { ok: false, error: providerError(status, json, 'Email was not accepted') };
  } catch (e: any) {
    console.error('MSG91 email send failed:', e?.message ?? e);
    return { ok: false, error: 'Email provider is unreachable. Please try again.' };
  }
}
