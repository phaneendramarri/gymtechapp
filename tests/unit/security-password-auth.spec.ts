import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  payloadToSessionUser,
} from '../../apps/api/src/lib/session';

describe('Authentication, Password & Cryptographic Security Invariants', () => {
  const SECRET_A = 'test_jwt_secret_key_very_long_and_secure_1234567890';
  const SECRET_B = 'another_unrelated_secret_key_for_tamper_testing_987';

  describe('Password Hashing', () => {
    it('hashes new passwords with PBKDF2-SHA256 (PHC, non-deterministic)', async () => {
      const p1 = await hashPassword('AdminPass@123');
      const p2 = await hashPassword('AdminPass@123');
      // PBKDF2 uses a random salt → different ciphertext each call
      expect(p1).not.toBe(p2);
      // PHC format starts with pbkdf2$sha256:100000$
      expect(p1).toMatch(/^pbkdf2\$sha256:100000\$/);
      // But verifyPassword accepts both
      expect(await verifyPassword('AdminPass@123', p1)).toBe(true);
      expect(await verifyPassword('AdminPass@123', p2)).toBe(true);
      // And rejects wrong plaintext
      expect(await verifyPassword('AdminPass@124', p1)).toBe(false);
    });

    it('produces different PBKDF2 digests for different passwords', async () => {
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
      isOwner: true,
      permissions: ['*'],
      roleId: null,
    };

    it('creates and verifies a valid session token', async () => {
      const { token } = await createSessionToken(mockUser, SECRET_A, { expiresInSeconds: 3600 });
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
      const { token } = await createSessionToken(mockUser, SECRET_A, { expiresInSeconds: 3600 });
      const verified = await verifySessionToken(token, SECRET_B);
      expect(verified).toBeNull();
    });

    it('rejects expired token', async () => {
      const { token } = await createSessionToken(mockUser, SECRET_A, { expiresInSeconds: -86400 });
      const verified = await verifySessionToken(token, SECRET_A);
      expect(verified).toBeNull();
    });

    it('rejects tampered token payload', async () => {
      const { token } = await createSessionToken(mockUser, SECRET_A, { expiresInSeconds: 3600 });
      const [h, p, s] = token.split('.');

      // Alter payload by decoding, changing role to SUPER_ADMIN, and re-encoding
      const decoded = JSON.parse(atob(p as string));
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
        role: 'OWNER' as const,
        gymId: 2,
        exp: 1800000000,
      };

      const sessionUser = payloadToSessionUser(payload as any);
      expect(sessionUser).toEqual({
        id: 7,
        email: 'staff@gym.in',
        name: 'Arjun Singh',
        role: 'OWNER',
        gymId: 2,
        isOwner: false,
        permissions: [],
        roleId: null,
        jti: undefined,
      });
      expect((sessionUser as any).exp).toBeUndefined();
    });
  });
});
