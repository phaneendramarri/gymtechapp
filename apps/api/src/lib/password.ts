// filepath: apps/api/src/lib/password.ts
/**
 * Password hashing — PBKDF2-SHA256 (Cloudflare Workers compatible).
 *
 * Cloudflare Workers don't allow runtime WebAssembly compilation (which
 * hash-wasm's argon2id requires), so we use Web Crypto API's PBKDF2 which
 * is natively supported. PBKDF2-SHA256 with 100,000 iterations provides
 * adequate protection for password storage.
 *
 * Hash format (PHC-inspired):
 *   pbkdf2$sha256:100000$<base64-salt>$<base64-hash>
 *
 * Legacy format (migration only):
 *   sha256$<hex64>
 */

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH_LENGTH = 32; // bytes — matches argon2 output size
const SALT_LENGTH = 16; // bytes

/**
 * Hash a plaintext password with PBKDF2-SHA256.
 * Returns a `pbkdf2$sha256:100000$<salt>$<hash>` string.
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  if (password.length > 1024) {
    throw new Error('Password exceeds maximum allowed length (1024 chars)');
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    PBKDF2_HASH_LENGTH * 8
  );
  const saltB64 = btoa(String.fromCharCode(...salt)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(derivedBits))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `pbkdf2$sha256:${PBKDF2_ITERATIONS}$${saltB64}$${hashB64}`;
}

/**
 * Legacy SHA-256 hash — used ONLY for existing seed/migration data.
 * Format: `sha256$<hex64>`
 */
export async function hashPasswordLegacySha256(password: string): Promise<string> {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const data = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256$${hex}`;
}

/**
 * Verify a plaintext password against a stored hash.
 *
 * Supports:
 *   - `pbkdf2$sha256:<iterations>$<salt>$<hash>` (PBKDF2-SHA256, default)
 *   - `sha256$<hex64>` (legacy, migration only — verify-only, no rehash)
 *
 * Returns true on match, false otherwise. Never throws for invalid input —
 * returns false so the caller can return a uniform "Invalid credentials"
 * response without leaking which input was wrong.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (typeof password !== 'string' || password.length === 0) return false;
  if (typeof storedHash !== 'string' || storedHash.length === 0) return false;
  if (password.length > 1024) return false; // don't even attempt — prevents DoS

  // PBKDF2-SHA256 (Cloudflare Workers native — Web Crypto API)
  if (storedHash.startsWith('pbkdf2$')) {
    try {
      // Format: pbkdf2$<algoWithIterations>$<saltB64>$<hashB64>
      // Use lastIndexOf for the hash separator since base64url chars don't include '$'.
      const firstDollar = storedHash.indexOf('$');
      const secondDollar = storedHash.indexOf('$', firstDollar + 1);
      const lastDollar = storedHash.lastIndexOf('$');
      if (firstDollar < 0 || secondDollar < 0 || lastDollar <= secondDollar) return false;

      const [algo, iterationsStr] = storedHash.slice(firstDollar + 1, secondDollar).split(':');
      const iterations = parseInt(iterationsStr, 10);
      const saltB64 = storedHash.slice(secondDollar + 1, lastDollar);
      const storedHashB64 = storedHash.slice(lastDollar + 1);
      if (algo !== 'sha256' || isNaN(iterations) || iterations <= 0) return false;

      const salt = base64UrlDecode(saltB64);
      const storedHashBytes = base64UrlDecode(storedHashB64);

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const derivedBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        keyMaterial,
        storedHashBytes.length * 8
      );
      return constantTimeEqualBytes(new Uint8Array(derivedBits), storedHashBytes);
    } catch {
      return false;
    }
  }

  // Legacy SHA-256
  if (storedHash.startsWith('sha256$')) {
    const expected = storedHash.slice('sha256$'.length).toLowerCase();
    if (expected.length !== 64) return false;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    const got = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return constantTimeEqualHex(got, expected);
  }

  // Unknown format — refuse.
  return false;
}

/** Decode a base64url string to Uint8Array */
function base64UrlDecode(str: string): Uint8Array {
  // Add back padding
  const pad = str.length % 4;
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  if (pad === 2) b64 += '==';
  else if (pad === 3) b64 += '=';
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * True when the stored hash is in the legacy (sha256) format and should be
 * transparently upgraded to PBKDF2-SHA256 on the next successful login.
 */
export function isLegacyHash(storedHash: string): boolean {
  return typeof storedHash === 'string' && storedHash.startsWith('sha256$');
}

/**
 * Constant-time byte array comparison.
 */
function constantTimeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Constant-time hex string comparison. Both inputs must be the same length
 * and contain only [0-9a-f].
 */
function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * HMAC-SHA-256 of an opaque high-entropy token (e.g. password-reset link).
 *
 * Use this for tokens that are already cryptographically random — Argon2id
 * is wasted on entropy we already have, and its random-salt output would
 * make deterministic DB lookups impossible. The HMAC `secret` should be the
 * server's JWT secret (or a dedicated secret) so DB dumps don't leak the
 * raw tokens.
 *
 * Output: 64-character lowercase hex.
 */
export async function hashOpaqueToken(token: string, secret: string): Promise<string> {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Token must be a non-empty string');
  }
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('HMAC secret is required');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time verification of an opaque token against an HMAC hash.
 * Returns false on any input error; never throws.
 */
export async function verifyOpaqueToken(token: string, storedHash: string, secret: string): Promise<boolean> {
  if (typeof token !== 'string' || token.length === 0) return false;
  if (typeof storedHash !== 'string' || storedHash.length === 0) return false;
  if (typeof secret !== 'string' || secret.length === 0) return false;
  if (storedHash.length !== 64) return false;
  const expected = await hashOpaqueToken(token, secret);
  return constantTimeEqualHex(expected, storedHash.toLowerCase());
}
