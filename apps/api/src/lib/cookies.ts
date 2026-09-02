// filepath: apps/api/src/lib/cookies.ts
/**
 * Cookie helpers for the auth-cookie migration (Phase 1.2).
 *
 * The session JWT is moved from `localStorage` (XSS-exfiltratable) to an
 * `HttpOnly; Secure; SameSite=Lax` cookie. The browser auto-attaches the
 * cookie to same-origin requests, so the API no longer needs the
 * `Authorization: Bearer …` header.
 *
 * A second non-httpOnly cookie (`gym_csrf`) carries a per-session CSRF
 * token. The frontend reads it via `document.cookie` and echoes it as the
 * `X-CSRF-Token` header on every non-GET request. The double-submit
 * pattern protects against CSRF: the attacker can't read the cookie
 * value from a different origin, so they can't forge the header.
 *
 * Why not just `SameSite=Strict`? It breaks the OAuth-style "click link
 * from email → land logged in" flow. `Lax` is the right balance — the
 * session cookie is sent on top-level navigations but not cross-site
 * fetch requests.
 */

const SESSION_COOKIE_NAME = 'gym_token';
const CSRF_COOKIE_NAME = 'gym_csrf';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // matches JWT lifetime

/**
 * True when the deployment should set the `Secure` flag on cookies.
 * `Secure` requires HTTPS; in dev (http://localhost) we skip it.
 */
function isSecureContext(appEnv: string | undefined): boolean {
  // Allow explicit override via APP_ENV=development for local HTTP work.
  if (appEnv === 'development' || appEnv === 'preview') return false;
  return true;
}

function buildCookie(
  name: string,
  value: string,
  opts: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Lax' | 'Strict' | 'None';
    path: string;
    maxAgeSeconds?: number;
  }
): string {
  // Don't URL-encode the value — JWTs and CSRF tokens are URL-safe already.
  const parts = [
    `${name}=${value}`,
    `Path=${opts.path}`,
    `SameSite=${opts.sameSite}`,
  ];
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.maxAgeSeconds !== undefined) parts.push(`Max-Age=${opts.maxAgeSeconds}`);
  return parts.join('; ');
}

/**
 * Build the `Set-Cookie` header for the session JWT.
 * Append to a Response's existing `Set-Cookie` headers.
 */
export function buildSessionCookie(jwt: string, appEnv: string | undefined): string {
  return buildCookie(SESSION_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: isSecureContext(appEnv),
    sameSite: 'Lax',
    path: '/',
    maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Build a `Set-Cookie` header that clears the session cookie.
 * Use this on logout / 401 paths.
 */
export function buildClearSessionCookie(appEnv: string | undefined): string {
  return buildCookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecureContext(appEnv),
    sameSite: 'Lax',
    path: '/',
    maxAgeSeconds: 0,
  });
}

/**
 * Build the `Set-Cookie` header for the CSRF token. The token MUST be
 * readable by JavaScript (so the frontend can echo it as a header), so
 * this is NOT httpOnly.
 */
export function buildCsrfCookie(csrfToken: string, appEnv: string | undefined): string {
  return buildCookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // intentionally readable by JS for the double-submit pattern
    secure: isSecureContext(appEnv),
    sameSite: 'Lax',
    path: '/',
    maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Extract a cookie value by name from the `Cookie:` header. Returns
 * `null` if the cookie is missing.
 */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  // Cookie format: "name1=value1; name2=value2"
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const trimmed = pair.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const k = trimmed.substring(0, eqIdx);
    if (k === name) {
      return trimmed.substring(eqIdx + 1);
    }
  }
  return null;
}

export const COOKIE_NAMES = {
  SESSION: SESSION_COOKIE_NAME,
  CSRF: CSRF_COOKIE_NAME,
};

/**
 * Generate a cryptographically random CSRF token (base64url, 32 bytes).
 * Used at login time and on session-rotation events.
 */
export function generateCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
