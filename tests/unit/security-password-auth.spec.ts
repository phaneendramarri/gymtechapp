import { describe, it, expect, vi } from 'vitest';
import {
  hashPassword,
  hashPasswordLegacySha256,
  verifyPassword,
  isLegacyHash,
  createSessionToken,
  verifySessionToken,
  payloadToSessionUser,
} from '../../apps/api/src/lib/session';
import { verifyTurnstileToken } from '../../apps/api/src/lib/turnstile';

describe('Authentication, Password & Cryptographic Security Invariants', () => {
  const SECRET_A = 'test_jwt_secret_key_very_long_and_secure_1234567890';
  const SECRET_B = 'another_unrelated_secret_key_for_tamper_testing_987';

  describe('Password Hashing', () => {
    it('hashes new passwords with Argon2id (PHC, non-deterministic)', async () => {
      const p1 = await hashPassword('AdminPass@123');
      const p2 = await hashPassword('AdminPass@123');
      // Argon2id uses a random salt → different ciphertext each call
      expect(p1).not.toBe(p2);
      // PHC format starts with $argon2id$
      expect(p1).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      // But verifyPassword accepts both
      expect(await verifyPassword('AdminPass@123', p1)).toBe(true);
      expect(await verifyPassword('AdminPass@123', p2)).toBe(true);
      // And rejects wrong plaintext
      expect(await verifyPassword('AdminPass@124', p1)).toBe(false);
    });

    it('produces different Argon2id digests for different passwords', async () => {
      const p1 = await hashPassword('AdminPass@123');
      const p2 = await hashPassword('AdminPass@124');
      expect(p1).not.toBe(p2);
      expect(await verifyPassword('AdminPass@123', p1)).toBe(true);
      expect(await verifyPassword('AdminPass@124', p2)).toBe(true);
    });

    it('rejects empty / oversized passwords at the boundary', async () => {
      await expect(hashPassword('')).rejects.toThrow();
      await expect(hashPassword('x'.repeat(1025))).rejects.toThrow();
      const realHash = await hashPassword('AdminPass@123');
      expect(await verifyPassword('', realHash)).toBe(false);
    });

    it('legacy sha256$… hashes verify correctly (migration path)', async () => {
      const legacy = await hashPasswordLegacySha256('admin123');
      expect(legacy).toBe('sha256$240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9');
      expect(isLegacyHash(legacy)).toBe(true);
      expect(await verifyPassword('admin123', legacy)).toBe(true);
      expect(await verifyPassword('wrong', legacy)).toBe(false);
    });

    it('rejects malformed stored hashes without throwing', async () => {
      expect(await verifyPassword('admin123', '')).toBe(false);
      expect(await verifyPassword('admin123', 'not-a-hash')).toBe(false);
      expect(await verifyPassword('admin123', 'sha256$tooshort')).toBe(false);
      expect(await verifyPassword('admin123', '$argon2id$garbage')).toBe(false);
    });
  });

  describe('Session JWT Generation & Verification', () => {
    const mockUser = {
      id: 42,
      email: 'owner@ironhouse.in',
      name: 'Vikram Rathore',
      role: 'OWNER' as const,
      gymId: 1,
    };

    it('creates and verifies a valid session token', async () => {
      const token = await createSessionToken(mockUser, SECRET_A, 3600);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const verified = await verifySessionToken(token, SECRET_A);
      expect(verified).not.toBeNull();
      expect(verified?.id).toBe(42);
      expect(verified?.email).toBe('owner@ironhouse.in');
      expect(verified?.role).toBe('OWNER');
      expect(verified?.gymId).toBe(1);
    });

    it('rejects token when verified with wrong secret', async () => {
      const token = await createSessionToken(mockUser, SECRET_A, 3600);
      const verified = await verifySessionToken(token, SECRET_B);
      expect(verified).toBeNull();
    });

    it('rejects expired token', async () => {
      // Created with -100 seconds (already expired)
      const token = await createSessionToken(mockUser, SECRET_A, -100);
      const verified = await verifySessionToken(token, SECRET_A);
      expect(verified).toBeNull();
    });

    it('rejects tampered token payload', async () => {
      const token = await createSessionToken(mockUser, SECRET_A, 3600);
      const [h, p, s] = token.split('.');

      // Alter payload by decoding, changing role to SUPER_ADMIN, and re-encoding
      const decoded = JSON.parse(atob(p));
      decoded.role = 'SUPER_ADMIN';
      const tamperedPayload = btoa(JSON.stringify(decoded));

      const tamperedToken = `${h}.${tamperedPayload}.${s}`;
      const verified = await verifySessionToken(tamperedToken, SECRET_A);
      expect(verified).toBeNull();
    });

    it('rejects malformed token strings', async () => {
      expect(await verifySessionToken('invalid-token', SECRET_A)).toBeNull();
      expect(await verifySessionToken('part1.part2', SECRET_A)).toBeNull();
      expect(await verifySessionToken('part1.part2.part3.part4', SECRET_A)).toBeNull();
      expect(await verifySessionToken('', SECRET_A)).toBeNull();
    });
  });

  describe('payloadToSessionUser conversion', () => {
    it('correctly maps payload to clean SessionUser object without exp', () => {
      const payload = {
        id: 7,
        email: 'staff@gym.in',
        name: 'Arjun Singh',
        role: 'STAFF' as const,
        gymId: 2,
        exp: 1800000000,
      };

      const sessionUser = payloadToSessionUser(payload);
      expect(sessionUser).toEqual({
        id: 7,
        email: 'staff@gym.in',
        name: 'Arjun Singh',
        role: 'STAFF',
        gymId: 2,
      });
      expect((sessionUser as any).exp).toBeUndefined();
    });
  });

  describe('Cloudflare Turnstile Verification', () => {
    it('rejects missing or empty token', async () => {
      const res = await verifyTurnstileToken(null, undefined, undefined, 'production');
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();

      const res2 = await verifyTurnstileToken('', undefined, undefined, 'production');
      expect(res2.success).toBe(false);
    });

    it('allows dev bypass tokens in non-production environments', async () => {
      const res1 = await verifyTurnstileToken('cf_turnstile_dev_test_token', undefined, undefined, 'development');
      expect(res1.success).toBe(true);
      expect(res1.devBypass).toBe(true);

      const res2 = await verifyTurnstileToken('XXXX.DUMMY.TOKEN.XXXX', undefined, undefined, 'staging');
      expect(res2.success).toBe(true);
      expect(res2.devBypass).toBe(true);
    });

    it('REFUSES dev bypass tokens in production (security)', async () => {
      const res1 = await verifyTurnstileToken('cf_turnstile_dev_test_token', undefined, undefined, 'production');
      expect(res1.success).toBe(false);
      expect(res1.devBypass).toBeUndefined();

      const res2 = await verifyTurnstileToken('XXXX.DUMMY.TOKEN.XXXX', undefined, undefined, 'production');
      expect(res2.success).toBe(false);
    });

    it('THROWS when production is missing the secret key', async () => {
      await expect(
        verifyTurnstileToken('real-token', undefined, '1.2.3.4', 'production')
      ).rejects.toThrow(/TURNSTILE_SECRET_KEY/);
    });

    it('THROWS when production uses the Cloudflare public test secret', async () => {
      await expect(
        verifyTurnstileToken('real-token', '1x0000000000000000000000000000000AA', '1.2.3.4', 'production')
      ).rejects.toThrow(/test secret/);
    });

    it('fails CLOSED on non-200 response from siteverify', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () =>
        new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } })
      ) as unknown as typeof fetch;

      try {
        const res = await verifyTurnstileToken('real-token', 'real-secret', '1.2.3.4', 'development');
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/unavailable/i);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('fails CLOSED on network error (not open)', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => {
        throw new Error('Network unreachable');
      }) as unknown as typeof fetch;

      try {
        const res = await verifyTurnstileToken('real-token', 'real-secret', '1.2.3.4', 'development');
        // Hardening: this used to be `success: true` (fail-open). Now closed.
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/unavailable/i);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('rejects when siteverify returns success:false', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () =>
        new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      ) as unknown as typeof fetch;

      try {
        const res = await verifyTurnstileToken('bad-token', 'real-secret', '1.2.3.4', 'development');
        expect(res.success).toBe(false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('accepts a real token when siteverify returns success:true', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () =>
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      ) as unknown as typeof fetch;

      try {
        const res = await verifyTurnstileToken('real-token', 'real-secret', '1.2.3.4', 'development');
        expect(res.success).toBe(true);
        expect(res.devBypass).toBeUndefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
