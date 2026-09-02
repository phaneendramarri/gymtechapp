// filepath: apps/api/src/lib/lockout.ts
/**
 * Account lockout policy (Phase 1.4 of the industry-standard review).
 *
 * After N consecutive failed login attempts the account is locked for
 * `LOCKOUT_DURATION_SECONDS`. Failed counts are reset on a successful
 * login. The columns `failed_login_count` and `locked_until` already
 * exist on `users` and `platform_admins`.
 *
 * The error message returned to the client is intentionally identical to
 * the "wrong password" message so we don't leak whether a given account
 * is locked. Lockout state is also reported via audit events so SOC /
 * ops can detect credential-stuffing waves.
 *
 * We deliberately count BOTH wrong-password and "user not found" failures
 * for the platform admin path because admin accounts are high-value; for
 * tenant users, only the existing user's counter is incremented, since
 * counting "not found" would let an attacker enumerate emails.
 */

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_SECONDS = 15 * 60; // 15 minutes
export const PROGRESSIVE_LOCKOUT_THRESHOLDS: Array<{ failures: number; seconds: number }> = [
  { failures: 5, seconds: 15 * 60 },
  { failures: 10, seconds: 60 * 60 },
  { failures: 20, seconds: 24 * 60 * 60 },
];

export function isAccountLocked(
  failedLoginCount: number | null | undefined,
  lockedUntil: number | null | undefined,
  now: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!lockedUntil) return false;
  return lockedUntil > now;
}

/**
 * Decide the next `locked_until` value given a current failure count.
 * Returns `null` if the account should not yet be locked. Progressive
 * lockouts kick in at higher failure counts to make automated attacks
 * uneconomic.
 */
export function nextLockoutSeconds(failedCount: number): number | null {
  let chosen: number | null = null;
  for (const tier of PROGRESSIVE_LOCKOUT_THRESHOLDS) {
    if (failedCount >= tier.failures) {
      chosen = tier.seconds;
    }
  }
  return chosen;
}

/**
 * The error message returned to clients. Identical for "wrong password",
 * "account locked", and "user not found" to prevent email enumeration
 * and lockout-state disclosure.
 */
export const GENERIC_INVALID_CREDENTIALS = 'Invalid email or password';
