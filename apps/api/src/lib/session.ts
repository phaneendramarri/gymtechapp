import type { SessionUser, UserRole } from '@gymtech/shared';
import { hashOpaqueToken, verifyOpaqueToken } from './password';

/**
 * The JWT payload. Numeric ids (INTEGER PKs) and numeric gymId.
 * `gymId === null` for platform admins.
 *
 * Hardened with RFC 7519 claims:
 *   iss – issuer – set to the APP_URL env var
 *   aud – audience – `gymtech-api`
 *   jti – unique token id – random 16-byte hex, stored in user_sessions for revocation
 *   exp – short-lived access token (15 min), refreshed via the refresh token flow
 *
 * Fields `iss`, `aud`, `jti` are optional for backward compat with legacy tokens.
 */
export interface UserSessionPayload {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  gymId: number | null;
  /** True for the gym's primary owner account */
  isOwner: boolean;
  /** Menu permission keys granted to this user */
  permissions: string[];
  /** FK to the gym's custom role (set at token minting time) */
  roleId: number | null;
  exp: number;
  iss?: string;
  aud?: string;
  jti?: string;
}

// Re-export the password hashing API. The implementation lives in
// `lib/password.ts` (Argon2id with legacy SHA-256 support).
// Existing call-sites can keep importing `hashPassword` from `lib/session`.

/** How long an access token is valid (seconds). */
export const ACCESS_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes
/** How long a refresh token is valid (seconds). */
export const REFRESH_TOKEN_EXPIRY_SECONDS = 2_592_000; // 30 days
export {
  hashPassword,
  hashPasswordLegacySha256,
  verifyPassword,
  isLegacyHash,
  hashOpaqueToken,
  verifyOpaqueToken,
} from './password';

/** Base64url helpers — Cloudflare Workers do not ship Node's Buffer. */
function b64urlEncode(s: string): string {
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

export async function createSessionToken(
  user: Omit<UserSessionPayload, 'exp' | 'iss' | 'aud' | 'jti'>,
  secret: string,
  opts: { iss?: string; aud?: string; expiresInSeconds?: number } = {}
): Promise<{ token: string; jti: string }> {
  const header = { alg: 'HS256', typ: 'JWT' };
  // Generate a random jti (16 bytes = 32 hex chars)
  const jtiBytes = new Uint8Array(16);
  crypto.getRandomValues(jtiBytes);
  const jti = Array.from(jtiBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const expiresInSeconds = opts.expiresInSeconds ?? 900; // 15 minutes default for access tokens
  const payload: UserSessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    iss: opts.iss ?? 'gymtech',
    aud: opts.aud ?? 'gymtech-api',
    jti,
  };

  const encodedHeader = b64urlEncode(JSON.stringify(header));
  const encodedPayload = b64urlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataToSign));
  const sigBytes = new Uint8Array(signature);
  let bin = '';
  for (let i = 0; i < sigBytes.length; i++) bin += String.fromCharCode(sigBytes[i]);
  const encodedSignature = btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const token = `${dataToSign}.${encodedSignature}`;
  return { token, jti };
}

export async function verifySessionToken(
  token: string,
  secret: string,
  opts?: { iss: string; aud: string }
): Promise<UserSessionPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const dataToVerify = `${headerB64}.${payloadB64}`;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const binarySignature = b64urlDecode(signatureB64);
    const sigBytes = new Uint8Array(binarySignature.length);
    for (let i = 0; i < binarySignature.length; i++) {
      sigBytes[i] = binarySignature.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(dataToVerify)
    );
    if (!isValid) return null;

    const payload = JSON.parse(b64urlDecode(payloadB64)) as UserSessionPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    // Strict validation only when opts are supplied (new tokens with iss/aud).
    // Legacy tokens without iss/aud/jti are accepted without strict validation.
    if (opts) {
      if (payload.iss !== undefined && payload.iss !== opts.iss) return null;
      if (payload.aud !== undefined && payload.aud !== opts.aud) return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function hasAllowedRole(userRole: string | undefined | null, allowedRoles: string[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

export function payloadToSessionUser(p: UserSessionPayload): SessionUser {
  return {
    id: p.id,
    email: p.email,
    name: p.name,
    role: p.role,
    gymId: p.gymId,
    isOwner: p.isOwner ?? false,
    permissions: p.permissions ?? [],
    roleId: p.roleId ?? null,
    jti: p.jti,
  };
}

// ---------------------------------------------------------------------------
// Refresh token helpers
// ---------------------------------------------------------------------------

const REFRESH_TOKEN_BYTES = 32; // 256 bits — large enough for a cryptographically random refresh token

/**
 * Generate a new refresh token (opaque, not a JWT).
 * Returns { token, jti } where `token` is the raw token and `jti` is its hash for storage.
 */
export async function createRefreshToken(secret: string): Promise<{ token: string; jti: string }> {
  const tokenBytes = new Uint8Array(REFRESH_TOKEN_BYTES);
  crypto.getRandomValues(tokenBytes);
  const rawToken = Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // Store jti = hash(opaque_token, secret) so we can look up sessions without storing raw token
  const jti = await hashOpaqueToken(rawToken, secret);
  return { token: rawToken, jti };
}

/**
 * Given a raw refresh token and the stored jti hash, verify the token.
 * Returns true if valid (not expired, not revoked).
 * Checks are done by the caller against the DB — this only verifies the HMAC.
 */
export async function verifyRefreshToken(
  token: string,
  secret: string,
  storedJti: string
): Promise<boolean> {
  return verifyOpaqueToken(token, storedJti, secret);
}
