// filepath: apps/api/src/lib/turnstile.ts
/**
 * Cloudflare Turnstile verification.
 *
 * Hardening (Phase 1.3 of the industry-standard review):
 *   - Dev bypass tokens (`cf_turnstile_dev_*`, `XXXX.DUMMY.TOKEN.XXXX`) are
 *     accepted ONLY when `appEnv !== 'production'`. A production build
 *     will refuse them.
 *   - Network errors to `siteverify` fail CLOSED (`success: false`).
 *     Fail-open turns a bot-detection control into a no-op exactly when
 *     attackers probe.
 *   - If the secret is missing in production we throw at call time, so a
 *     misconfigured deployment cannot silently bypass CAPTCHA.
 *   - `ipAddress` is required; the caller is expected to extract
 *     `CF-Connecting-IP` from the request headers.
 *
 * The official Cloudflare "always passes" test secret
 * (`1x0000000000000000000000000000000AA`) is supported in non-production
 * environments via the secret-binding mechanism — callers may set
 * `TURNSTILE_SECRET_KEY=1x000…` in dev to exercise the real `siteverify`
 * call path without needing a real widget.
 */

export type TurnstileAppEnv = 'production' | 'staging' | 'development' | 'preview';

const CLOUDFLARE_TEST_SECRET = '1x0000000000000000000000000000000AA';
const DEV_BYPASS_PREFIX = 'cf_turnstile_dev_';
const DEV_BYPASS_LITERAL = 'XXXX.DUMMY.TOKEN.XXXX';

export interface TurnstileVerifyResult {
  success: boolean;
  error?: string;
  /** True when the result was decided by the dev-bypass path (test only). */
  devBypass?: boolean;
}

export async function verifyTurnstileToken(
  token: string | undefined | null,
  secretKey: string | undefined,
  ipAddress: string | undefined,
  appEnv: TurnstileAppEnv = 'production'
): Promise<TurnstileVerifyResult> {
  if (!token) {
    return { success: false, error: 'Cloudflare Turnstile verification token is required' };
  }

  // Dev bypass — REFUSED in production.
  const isDevBypass = token.startsWith(DEV_BYPASS_PREFIX) || token === DEV_BYPASS_LITERAL;
  if (isDevBypass) {
    if (appEnv === 'production') {
      // In production, dev tokens are an attack signal — refuse and log.
      console.warn('Turnstile dev bypass token presented in production — refusing.');
      return { success: false, error: 'Bot verification failed' };
    }
    return { success: true, devBypass: true };
  }

  // Production deployments MUST have a real secret. The Cloudflare "always
  // passes" test secret is acceptable only in non-production.
  if (!secretKey) {
    if (appEnv === 'production') {
      // Throw so the bug surfaces at request time rather than silently
      // bypassing CAPTCHA in production.
      throw new Error(
        'TURNSTILE_SECRET_KEY is required in production. Set it via `wrangler secret put`.'
      );
    }
    // Non-prod without a secret: still fail closed rather than silently
    // passing with the public test secret.
    return {
      success: false,
      error: 'Bot verification is not configured. Contact the site administrator.',
    };
  }
  if (secretKey === CLOUDFLARE_TEST_SECRET && appEnv === 'production') {
    throw new Error(
      'TURNSTILE_SECRET_KEY is set to the Cloudflare test secret in production. ' +
        'Replace it with the real site key.'
    );
  }

  // Real verification path. Fail CLOSED on any error.
  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    // Always pass the client IP — Cloudflare uses it as a signal.
    if (ipAddress) {
      formData.append('remoteip', ipAddress);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      console.error('Turnstile siteverify HTTP', res.status);
      return { success: false, error: 'Bot verification service is unavailable. Please try again.' };
    }

    const data: any = await res.json().catch(() => ({}));
    if (data.success === true) {
      return { success: true };
    }

    // Surface the error-codes array in logs for debugging.
    const errorCodes: string[] = Array.isArray(data['error-codes']) ? data['error-codes'] : [];
    console.warn('Turnstile verification failed:', { errorCodes, hostname: data.hostname });
    return {
      success: false,
      error: 'Bot verification check failed. Please refresh and try again.',
    };
  } catch (err: any) {
    // Fail CLOSED — never silently accept logins when siteverify is unreachable.
    console.error('Turnstile verification network error:', err);
    return {
      success: false,
      error: 'Bot verification service is unavailable. Please try again shortly.',
    };
  }
}
