import type { SessionUser, UserRole } from '@gymtech/shared';

/**
 * The JWT payload. Numeric ids (INTEGER PKs) and numeric gymId.
 * `gymId === null` for platform admins.
 */
export interface UserSessionPayload {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  gymId: number | null;
  exp: number;
}

// Re-export the password hashing API. The implementation lives in
// `lib/password.ts` (Argon2id with legacy SHA-256 support).
// Existing call-sites can keep importing `hashPassword` from `lib/session`.
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
  user: Omit<UserSessionPayload, 'exp'>,
  secret: string,
  expiresInSeconds = 86400 * 7
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: UserSessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
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

  return `${dataToSign}.${encodedSignature}`;
}

export async function verifySessionToken(
  token: string,
  secret: string
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
  };
}
