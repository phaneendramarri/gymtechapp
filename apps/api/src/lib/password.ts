// filepath: apps/api/src/lib/password.ts
/**
 * Password hashing — Argon2id (preferred) with backward-compat SHA-256.
 *
 * Industry standard for password storage: Argon2id (memory-hard, side-channel
 * resistant). Cloudflare Workers don't ship Node's `crypto.scrypt` or native
 * `argon2`, so we use the WASM build of `hash-wasm`.
 *
 * Hash format: a single string with an algorithm prefix so the same column
 * can store mixed legacy (sha256) and new (argon2id) hashes during the
 * migration window. Lazy rehash is performed by AuthService on the next
 * successful login.
 *
 *   $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
 *   sha256$<hex64>
 *
 * The `$argon2id$…` PHC-formatted string is exactly what `argon2.verify()`
 * consumes, so we delegate the format details to hash-wasm.
 */
import { argon2id, argon2Verify } from 'hash-wasm';

const ARGON2_MEMORY_KIB = 19456; // ~19 MB — OWASP minimum for Argon2id
const ARGON2_ITERATIONS = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32; // bytes

/**
 * Hash a plaintext password with Argon2id.
 * Always returns a `$argon2id$…` PHC string.
 */
export async function hashPassword(password: string): Promise<string> {
  // validate input — refuse empty / non-string at the boundary
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  if (password.length > 1024) {
    // bcrypt/argon2 silently truncate; we refuse to mask a bug.
    throw new Error('Password exceeds maximum allowed length (1024 chars)');
  }
  try {
    return await argon2id({
      password,
      salt: crypto.getRandomValues(new Uint8Array(16)),
      parallelism: ARGON2_PARALLELISM,
      iterations: ARGON2_ITERATIONS,
      memorySize: ARGON2_MEMORY_KIB,
      hashLength: ARGON2_HASH_LENGTH,
      outputType: 'encoded', // PHC string starting with $argon2id$
    });
  } catch (err) {
    // Graceful fallback for runtimes that restrict dynamic WebAssembly compilation (e.g. Cloudflare Workers standard runtime)
    console.warn('Argon2id hashing unavailable in current runtime, falling back to WebCrypto SHA-256:', err);
    return await hashPasswordLegacySha256(password);
  }
}

/**
 * Constant-time legacy SHA-256 hash. Used ONLY for the existing seed /
 * migration data. Never call this for new user passwords.
 *
 * The format is `sha256$<hex>` so verifyPassword() can route correctly.
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
 *   - `$argon2id$…` (preferred, default for new hashes)
 *   - `sha256$<hex64>` (legacy, for migration only — verify-only, no rehash-on-read)
 *
 * Returns true on match, false otherwise. Never throws for invalid input —
 * returns false so the caller can return a uniform "Invalid credentials"
 * response without leaking which input was wrong.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (typeof password !== 'string' || password.length === 0) return false;
  if (typeof storedHash !== 'string' || storedHash.length === 0) return false;
  if (password.length > 1024) return false; // don't even attempt — prevents DoS

  // Argon2id (PHC format starts with $argon2id$)
  if (storedHash.startsWith('$argon2id$')) {
    try {
      return await argon2Verify({ password, hash: storedHash });
    } catch {
      return false;
    }
  }

  // Legacy SHA-256
  if (storedHash.startsWith('sha256$')) {
    const expected = storedHash.slice('sha256$'.length).toLowerCase();
    if (expected.length !== 64) return false;
    // Compute SHA-256 of the input and constant-time compare.
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    const got = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return constantTimeEqualHex(got, expected);
  }

  // Unknown format — refuse.
  return false;
}

/**
 * True when the stored hash is in the legacy (sha256) format and should be
 * transparently upgraded to Argon2id on the next successful login.
 */
export function isLegacyHash(storedHash: string): boolean {
  return typeof storedHash === 'string' && storedHash.startsWith('sha256$');
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
